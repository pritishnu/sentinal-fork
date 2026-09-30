const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  endpoint: 'http://127.0.0.1:8787/api/analyze',
});

async function getSettings() {
  const saved = await chrome.storage.local.get(DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...saved };
}

async function readError(response) {
  try {
    const body = await response.json();
    if (body && typeof body.error === 'string') return body.error;
  } catch {
    // The status line below is more useful than an invalid response body.
  }
  return `Sentinel analysis failed with HTTP ${response.status}.`;
}

function flagFromAnalysis(analysis) {
  const severity = analysis?.risk?.severity;
  if (severity === 'critical' || severity === 'high') return 'red';
  if (severity !== 'low') return 'yellow';
  // A low score is not a green light if execution was not verified or the
  // contract call could not be decoded confidently.
  if (analysis?.simulation?.status !== 'success' || analysis?.intent?.unknown_calldata) return 'yellow';
  return 'green';
}

async function analyze(payload, method, requestId, tabId) {
  const settings = await getSettings();
  if (!settings.enabled) return { bypass: true };

  let response;
  try {
    response = await fetch(settings.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error('Sentinel Fork cannot reach its local API. Start the Rust backend on port 8787.');
  }

  if (!response.ok) throw new Error(await readError(response));
  const analysis = await response.json();
  if (!analysis?.risk || !analysis?.simulation || !analysis?.intent) {
    throw new Error('The analysis engine returned an incomplete report. Request blocked.');
  }
  const flag = flagFromAnalysis(analysis);
  await chrome.storage.local.set({
    lastAnalysis: {
      schemaVersion: 2,
      at: Date.now(),
      requestId,
      tabId,
      origin: payload.origin,
      method: method || payload.request_type,
      score: analysis?.risk?.score ?? 0,
      severity: analysis?.risk?.severity || 'unknown',
      summary: analysis?.risk?.summary || 'Analysis complete',
      findings: Array.isArray(analysis?.findings) ? analysis.findings.length : 0,
      flag,
      intent: analysis.intent.title,
      analysis,
    },
  });
  return { analysis, flag };
}

async function health() {
  const settings = await getSettings();
  const healthUrl = new URL('/health', settings.endpoint).toString();
  try {
    const response = await fetch(healthUrl, { method: 'GET' });
    return { ok: response.ok, status: response.status };
  } catch {
    return { ok: false };
  }
}

async function recordDecision(requestId, decision) {
  const { lastAnalysis } = await chrome.storage.local.get('lastAnalysis');
  if (lastAnalysis?.requestId === requestId) {
    await chrome.storage.local.set({ lastAnalysis: { ...lastAnalysis, decision } });
  }
  return {};
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== 'string') return false;

  const operation = message.type === 'SENTINEL_ANALYZE'
    ? analyze(message.payload, message.method, message.requestId, sender.tab?.id)
    : message.type === 'SENTINEL_HEALTH'
      ? health()
      : message.type === 'SENTINEL_DECISION'
        ? recordDecision(message.requestId, message.decision)
      : null;

  if (!operation) return false;
  operation
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : 'Sentinel request failed.',
    }));
  return true;
});
