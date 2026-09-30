import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

class TestCustomEvent extends Event {
  constructor(type, options = {}) {
    super(type);
    this.detail = options.detail;
  }
}

function provider(label) {
  const sent = [];
  return {
    isMetaMask: true,
    sent,
    on() {},
    async request(request) {
      if (request.method === 'eth_chainId') return '0xaa36a7';
      if (request.method === 'eth_accounts') return ['0x1111111111111111111111111111111111111111'];
      sent.push({ label, request });
      return `${label}-wallet-result`;
    },
  };
}

async function harness({ chainLookupFails = false } = {}) {
  const source = await readFile(new URL('../src/page-interceptor.js', import.meta.url), 'utf8');
  const window = new EventTarget();
  const intervals = [];
  const payloads = [];
  let approve = true;

  window.location = { origin: 'https://example-dapp.test' };
  window.setTimeout = setTimeout;
  window.clearTimeout = clearTimeout;
  window.setInterval = (callback) => { intervals.push(callback); return intervals.length; };
  window.clearInterval = () => {};
  window.postMessage = (data) => {
    queueMicrotask(() => {
      const event = new Event('message');
      Object.defineProperties(event, {
        data: { value: data },
        source: { value: window },
      });
      window.dispatchEvent(event);
    });
  };
  window.ethereum = provider('first');
  if (chainLookupFails) {
    const originalRequest = window.ethereum.request.bind(window.ethereum);
    window.ethereum.request = async (request) => {
      if (request.method === 'eth_chainId') throw new Error('Wallet not connected');
      return originalRequest(request);
    };
  }
  window.addEventListener('message', (event) => {
    if (event.data?.direction !== 'to-extension') return;
    payloads.push(event.data.payload);
    window.postMessage({
      channel: event.data.channel,
      direction: 'to-page',
      requestId: event.data.requestId,
      approved: approve,
    }, '*');
  });

  vm.runInNewContext(source, {
    window,
    crypto: webcrypto,
    CustomEvent: TestCustomEvent,
    Error,
    Object,
    Proxy,
    Reflect,
    Set,
    Map,
    WeakMap,
    Array,
    Number,
    JSON,
    console,
  });
  await new Promise((resolve) => setImmediate(resolve));
  return { window, intervals, payloads, setApproval: (value) => { approve = value; } };
}

const transaction = {
  method: 'eth_sendTransaction',
  params: [{
    from: '0x1111111111111111111111111111111111111111',
    to: '0x2222222222222222222222222222222222222222',
    value: '0x0',
    data: '0x',
  }],
};

test('blocks the wallet call until the user approves it', async () => {
  const runtime = await harness();
  const wrapped = runtime.window.ethereum;
  assert.equal(wrapped.__sentinelForkWrapped, true);
  assert.equal(wrapped.sent.length, 0);

  const result = await wrapped.request(transaction);
  assert.equal(result, 'first-wallet-result');
  assert.equal(wrapped.sent.length, 1);
  assert.equal(runtime.payloads[0].request_type, 'transaction');
  assert.equal(runtime.payloads[0].to, transaction.params[0].to);
});

test('personal_sign sends the message, not the account address, to analysis', async () => {
  const runtime = await harness();
  const account = '0x1111111111111111111111111111111111111111';
  await runtime.window.ethereum.request({ method: 'personal_sign', params: ['0x68656c6c6f', account] });
  assert.equal(runtime.payloads[0].from, account);
  assert.equal(runtime.payloads[0].data, '0x68656c6c6f');
});

test('chain lookup failure still asks for approval without pretending to be Sepolia', async () => {
  const runtime = await harness({ chainLookupFails: true });
  const result = await runtime.window.ethereum.request(transaction);
  assert.equal(result, 'first-wallet-result');
  assert.equal(runtime.payloads[0].chain_id, 0);
});

test('rejects without forwarding and re-wraps a replacement MetaMask provider', async () => {
  const runtime = await harness();
  runtime.setApproval(false);
  await assert.rejects(
    runtime.window.ethereum.request(transaction),
    (error) => error.code === 4001,
  );
  assert.equal(runtime.window.ethereum.sent.length, 0);

  const replacement = provider('replacement');
  runtime.window.ethereum = replacement;
  runtime.intervals[0]();
  assert.equal(runtime.window.ethereum.__sentinelForkWrapped, true);
  assert.notEqual(runtime.window.ethereum, replacement);
});
