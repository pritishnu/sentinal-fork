import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../src/content.js', import.meta.url), 'utf8');

class Node {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.style = {};
    this.listeners = new Map();
    this.textContent = '';
    this.disabled = false;
    this.className = '';
  }
  append(...children) { this.children.push(...children); }
  attachShadow() { this.shadow = new Node('shadow'); return this.shadow; }
  setAttribute() {}
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  removeEventListener(type) { this.listeners.delete(type); }
  remove() { this.removed = true; }
  focus() {}
  click() { if (!this.disabled) this.listeners.get('click')?.(); }
}

function descendants(root) {
  if (!root || root.removed) return [];
  return [root, ...root.children.flatMap(descendants), ...descendants(root.shadow)];
}

async function harness({ flag, analysis, backendError } = {}) {
  const document = {
    documentElement: new Node('html'),
    createElement: (tag) => new Node(tag),
    createTextNode: (text) => { const node = new Node('text'); node.textContent = text; return node; },
    querySelector(selector) {
      return descendants(this.documentElement).find((node) => `#${node.id}` === selector) || null;
    },
    addEventListener() {}, removeEventListener() {},
  };
  const window = new EventTarget();
  const posted = [];
  const messages = [];
  window.postMessage = (data) => { posted.push(data); };
  const chrome = { runtime: { async sendMessage(message) {
    messages.push(message);
    if (message.type === 'SENTINEL_ANALYZE') {
      return backendError ? { ok: false, error: backendError } : { ok: true, flag, analysis };
    }
    return { ok: true };
  } } };
  vm.runInNewContext(source, { document, window, chrome, Error, String, Array, JSON, Date, console });
  const request = { channel: 'sentinel-fork-extension-v1', direction: 'to-extension', requestId: 'request-1', method: 'eth_sendTransaction', payload: { origin: 'https://dapp.example', to: '0x2222222222222222222222222222222222222222' } };
  const event = new Event('message');
  Object.defineProperties(event, { source: { value: window }, data: { value: request } });
  window.dispatchEvent(event);
  await new Promise((resolve) => setImmediate(resolve));
  const nodes = () => descendants(document.documentElement);
  const button = (text) => nodes().find((node) => node.tag === 'button' && node.textContent === text);
  return { nodes, button, posted, messages };
}

const analysis = {
  risk: { score: 91, summary: 'Operator can transfer NFTs.' },
  simulation: { status: 'success', fork_block: 100, gas_used: '0x100' },
  intent: { title: 'Approve an NFT operator', function: 'setApprovalForAll', decoded_args: { approved: true } },
  findings: [{ severity: 'critical', title: 'Unlimited approval', explanation: 'All NFTs can be moved.', evidence: { operator: '0xabc' } }],
  state_diff: { approvals: [{ approved: true }] },
  drainer_matches: [{ id: 'demo' }], limitations: ['Sepolia only'],
};

test('red request blocks Continue until acknowledged, then forwards only after a click', async () => {
  const ui = await harness({ flag: 'red', analysis });
  const approve = ui.button('Continue to MetaMask');
  assert.ok(approve);
  assert.equal(approve.disabled, true);
  assert.equal(ui.posted.length, 0);
  const checkbox = ui.nodes().find((node) => node.tag === 'input' && node.type === 'checkbox');
  checkbox.checked = true;
  checkbox.listeners.get('change')();
  assert.equal(approve.disabled, false);
  approve.click();
  assert.equal(ui.posted.at(-1).approved, true);
  assert.ok(ui.messages.some((message) => message.type === 'SENTINEL_DECISION' && message.decision === 'approved'));
});

test('Reject never forwards a wallet request', async () => {
  const ui = await harness({ flag: 'green', analysis });
  ui.button('Reject request').click();
  assert.equal(ui.posted.at(-1).approved, false);
});

test('analysis failure explains the gap and requires acknowledgement before MetaMask', async () => {
  const ui = await harness({ backendError: 'API offline' });
  const approve = ui.button('Continue unverified to MetaMask');
  assert.ok(approve);
  assert.equal(approve.disabled, true);
  assert.equal(ui.posted.length, 0);
  assert.ok(ui.nodes().some((node) => node.textContent.includes('API offline')));
  assert.ok(ui.nodes().some((node) => node.tag === 'details' && node.open));
  const checkbox = ui.nodes().find((node) => node.tag === 'input' && node.type === 'checkbox');
  checkbox.checked = true;
  checkbox.listeners.get('change')();
  approve.click();
  assert.equal(ui.posted.at(-1).approved, true);
  assert.equal(ui.messages.some((message) => message.type === 'SENTINEL_DECISION'), false);
});

test('analysis failure can still be rejected', async () => {
  const ui = await harness({ backendError: 'API offline' });
  ui.button('Reject request').click();
  assert.equal(ui.posted.at(-1).approved, false);
});

test('approval screen uses a single dark theme and keeps footer visible', async () => {
  const ui = await harness({ flag: 'red', analysis });
  const style = ui.nodes().find((node) => node.tag === 'style').textContent;
  assert.match(style, /color-scheme:dark/);
  assert.doesNotMatch(style, /color-scheme:light|background:#fff(?:[;}])/);
  assert.match(style, /\.content\{min-height:0;flex:1 1 auto/);
  assert.match(style, /\.footer\{flex:0 0 auto/);
  assert.match(style, /\.backdrop button[^}]*cursor:pointer!important/);
  assert.ok(ui.nodes().some((node) => node.tag === 'details' && node.open));
});
