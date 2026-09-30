const DEFAULT_SETTINGS = { enabled: true, endpoint: 'http://127.0.0.1:8787/api/analyze' };
const $ = (selector) => document.querySelector(selector);
const enabled = $('#enabled');
const verdict = $('#verdict');
const flagIcon = $('#flag-icon');
const flagLabel = $('#flag-label');
const verdictTitle = $('#verdict-title');
const verdictSummary = $('#verdict-summary');
const verdictMeta = $('#verdict-meta');
const report = $('#report');
const reportIntent = $('#report-intent');
const reportScore = $('#report-score');
const reportDecision = $('#report-decision');
const engineStatus = $('#engine-status');
const retry = $('#retry');
const enabledNote = $('#enabled-note');
let activeTabId = null;

const FLAGS = {
  green: { label: 'LAST REQUEST · LOWER RISK', icon: '✓', title: 'Lower risk result' },
  yellow: { label: 'LAST REQUEST · REVIEW', icon: '!', title: 'Review this request' },
  red: { label: 'LAST REQUEST · HIGH RISK', icon: '×', title: 'Dangerous request' },
};

function showReport(lastAnalysis) {
  const valid = lastAnalysis?.schemaVersion === 2
    && FLAGS[lastAnalysis.flag]
    && Number.isInteger(activeTabId)
    && lastAnalysis.tabId === activeTabId
    && Date.now() - lastAnalysis.at < 5 * 60 * 1000;
  const flag = valid ? lastAnalysis.flag : 'neutral';
  verdict.className = `verdict ${flag}`;
  flagIcon.textContent = valid ? FLAGS[flag].icon : '—';
  flagLabel.textContent = valid ? FLAGS[flag].label : 'NO SCAN';
  verdictTitle.textContent = valid ? FLAGS[flag].title : 'No recent scan on this tab';
  verdictSummary.textContent = valid
    ? lastAnalysis.summary
    : 'A risk flag appears here after a wallet request from this tab is analyzed.';
  verdictMeta.textContent = valid
    ? `${lastAnalysis.origin} · ${new Date(lastAnalysis.at).toLocaleString()}`
    : '';
  report.hidden = !valid;
  if (valid) {
    reportIntent.textContent = lastAnalysis.intent || lastAnalysis.method || 'Wallet request';
    reportScore.textContent = `${lastAnalysis.score}/100`;
    reportDecision.textContent = lastAnalysis.decision === 'approved'
      ? 'Continued to wallet'
      : lastAnalysis.decision === 'rejected' ? 'Rejected' : 'Awaiting choice';
  }
}

async function checkEngine() {
  retry.disabled = true;
  engineStatus.textContent = 'Checking analysis engine…';
  try {
    const result = await chrome.runtime.sendMessage({ type: 'SENTINEL_HEALTH' });
    engineStatus.textContent = result?.ok
      ? 'Analysis engine online'
      : 'Analysis engine offline — review will be unverified';
  } catch {
    engineStatus.textContent = 'Analysis engine offline — review will be unverified';
  } finally {
    retry.disabled = false;
  }
}

async function initialize() {
  const settings = await chrome.storage.local.get(DEFAULT_SETTINGS);
  enabled.checked = Boolean(settings.enabled);
  enabledNote.textContent = enabled.checked
    ? 'Review is enabled. Sentinel asks before forwarding supported requests to MetaMask. A flag is for one request, not a site-wide safety rating.'
    : 'Review is paused. Supported requests will pass through without analysis. A flag is for one request, not a site-wide safety rating.';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTabId = tab?.id ?? null;
  } catch {
    activeTabId = null;
  }
  const { lastAnalysis } = await chrome.storage.local.get('lastAnalysis');
  showReport(lastAnalysis);
  await checkEngine();
}

enabled.addEventListener('change', async () => {
  await chrome.storage.local.set({ enabled: enabled.checked });
  enabledNote.textContent = enabled.checked
    ? 'Review is enabled. Sentinel asks before forwarding supported requests to MetaMask. A flag is for one request, not a site-wide safety rating.'
    : 'Review is paused. Supported requests will pass through without analysis. A flag is for one request, not a site-wide safety rating.';
});
retry.addEventListener('click', () => void checkEngine());
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.lastAnalysis) showReport(changes.lastAnalysis.newValue);
});
void initialize();
