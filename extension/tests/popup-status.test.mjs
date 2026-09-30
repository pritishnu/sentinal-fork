import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../popup/popup.js', import.meta.url), 'utf8');

async function popup({ lastAnalysis, enabled = true, engineOnline = true, activeTabId = 7 } = {}) {
  const nodes = new Map();
  const document = {
    querySelector(selector) {
      if (!nodes.has(selector)) nodes.set(selector, {
        className: '', textContent: '', checked: false, disabled: false, hidden: true,
        addEventListener() {},
      });
      return nodes.get(selector);
    },
  };
  const chrome = {
    storage: {
      local: {
        async get(defaults) {
          return defaults === 'lastAnalysis' ? { lastAnalysis } : { ...defaults, enabled };
        },
        async set() {},
      },
      onChanged: { addListener() {} },
    },
    runtime: { async sendMessage() { return { ok: engineOnline }; } },
    tabs: { async query() { return [{ id: activeTabId }]; } },
  };
  vm.runInNewContext(source, { document, chrome, Date, Promise, Boolean, String });
  await new Promise((resolve) => setImmediate(resolve));
  return (selector) => nodes.get(selector);
}

const report = (flag) => ({
  schemaVersion: 2,
  tabId: 7,
  at: Date.now(),
  origin: 'https://dapp.example',
  flag,
  score: 42,
  summary: 'Backend analysis summary',
  intent: 'Approve an NFT operator',
  decision: 'rejected',
});

test('no scan remains neutral even when the engine is online', async () => {
  const node = await popup();
  assert.equal(node('#verdict').className, 'verdict neutral');
  assert.equal(node('#flag-label').textContent, 'NO SCAN');
  assert.equal(node('#engine-status').textContent, 'Analysis engine online');
  assert.equal(node('#report').hidden, true);
});

for (const flag of ['green', 'yellow', 'red']) {
  test(`${flag} flag comes from the last analysis`, async () => {
    const node = await popup({ lastAnalysis: report(flag) });
    assert.equal(node('#verdict').className, `verdict ${flag}`);
    assert.equal(node('#report').hidden, false);
    assert.equal(node('#report-intent').textContent, 'Approve an NFT operator');
    assert.equal(node('#report-decision').textContent, 'Rejected');
  });
}

test('an old-format status cannot produce a green verdict', async () => {
  const node = await popup({ lastAnalysis: { flag: 'green', score: 0 } });
  assert.equal(node('#verdict').className, 'verdict neutral');
});

test('a verdict from a different tab stays neutral', async () => {
  const node = await popup({ lastAnalysis: report('green'), activeTabId: 8 });
  assert.equal(node('#verdict').className, 'verdict neutral');
});

test('an old verdict on the same tab expires to neutral', async () => {
  const node = await popup({ lastAnalysis: { ...report('green'), at: Date.now() - 10 * 60 * 1000 } });
  assert.equal(node('#verdict').className, 'verdict neutral');
});

test('offline engine is reported separately from the last risk flag', async () => {
  const node = await popup({ lastAnalysis: report('yellow'), engineOnline: false });
  assert.equal(node('#verdict').className, 'verdict yellow');
  assert.match(node('#engine-status').textContent, /offline/);
});
