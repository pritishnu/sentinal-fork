import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../src/background.js', import.meta.url), 'utf8');
const payload = {
  chain_id: 11155111,
  request_type: 'transaction',
  from: '0x1111111111111111111111111111111111111111',
  to: '0x2222222222222222222222222222222222222222',
  value: '0x0', data: '0x', origin: 'https://dapp.example',
};

function analysis(severity, status = 'success', unknown_calldata = false) {
  return {
    risk: { severity, score: 40, summary: 'Test analysis' },
    simulation: { status, fork_block: 123, gas_used: '0x10' },
    intent: { title: 'Transfer', function: 'transfer', unknown_calldata, decoded_args: {} },
    findings: [], state_diff: {}, drainer_matches: [], limitations: [],
  };
}

function harness(report, enabled = true) {
  const saved = { enabled };
  let listener;
  const chrome = {
    storage: { local: {
      async get(defaults) { return typeof defaults === 'string' ? { [defaults]: saved[defaults] } : { ...defaults, ...saved }; },
      async set(update) { Object.assign(saved, update); },
    } },
    runtime: { onMessage: { addListener(fn) { listener = fn; } } },
  };
  const fetch = async () => ({ ok: true, async json() { return report; } });
  vm.runInNewContext(source, { chrome, fetch, URL, Date, Error, Object, Array, JSON });
  const message = (input) => new Promise((resolve) => listener(input, { tab: { id: 7 } }, resolve));
  return { message, saved };
}

for (const [severity, status, unknown, expected] of [
  ['low', 'success', false, 'green'],
  ['medium', 'success', false, 'yellow'],
  ['high', 'success', false, 'red'],
  ['critical', 'success', false, 'red'],
  ['low', 'reverted', false, 'yellow'],
  ['low', 'signature_no_evm_execution', false, 'yellow'],
  ['low', 'success', true, 'yellow'],
]) {
  test(`${severity}/${status}/unknown=${unknown} maps to ${expected}`, async () => {
    const runtime = harness(analysis(severity, status, unknown));
    const result = await runtime.message({ type: 'SENTINEL_ANALYZE', payload, method: 'eth_sendTransaction', requestId: 'request-1' });
    assert.equal(result.ok, true);
    assert.equal(result.flag, expected);
    assert.equal(runtime.saved.lastAnalysis.flag, expected);
    assert.equal(runtime.saved.lastAnalysis.schemaVersion, 2);
    assert.equal(runtime.saved.lastAnalysis.tabId, 7);
    await runtime.message({ type: 'SENTINEL_DECISION', requestId: 'request-1', decision: 'rejected' });
    assert.equal(runtime.saved.lastAnalysis.decision, 'rejected');
  });
}

test('incomplete reports fail closed', async () => {
  const runtime = harness({});
  const result = await runtime.message({ type: 'SENTINEL_ANALYZE', payload, requestId: 'request-1' });
  assert.equal(result.ok, false);
  assert.equal(runtime.saved.lastAnalysis, undefined);
});

test('explicitly disabled protection bypasses analysis', async () => {
  const runtime = harness(analysis('high'), false);
  const result = await runtime.message({ type: 'SENTINEL_ANALYZE', payload, requestId: 'request-1' });
  assert.equal(result.bypass, true);
  assert.equal(runtime.saved.lastAnalysis, undefined);
});
