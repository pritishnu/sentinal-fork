(() => {
  'use strict';

  const CHANNEL = 'sentinel-fork-extension-v1';
  const queue = [];
  let reviewing = false;

  const array = (value) => Array.isArray(value) ? value : [];
  const printable = (value) => {
    if (typeof value === 'string') return value;
    try { return JSON.stringify(value, null, 2); } catch { return String(value); }
  };
  function el(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = String(value);
    return node;
  }
  function section(title, content) {
    const box = el('section', 'report-section');
    box.append(el('h4', '', title), content);
    return box;
  }
  function dataList(entries) {
    const list = el('div', 'data-list');
    for (const [name, value] of entries) {
      const row = el('div', 'data-row');
      row.append(el('span', '', name), el('strong', '', value));
      list.append(row);
    }
    return list;
  }

  function overlay() {
    document.querySelector('#sentinel-fork-extension-root')?.remove();
    const host = el('div');
    host.id = 'sentinel-fork-extension-root';
    host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;cursor:auto!important;';
    (document.documentElement || document.body).append(host);
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = el('style');
    style.textContent = `
      :host{all:initial;color-scheme:dark;cursor:auto!important}
      *,*::before,*::after{box-sizing:border-box}
      .backdrop{position:fixed;inset:0;display:grid;place-items:center;padding:16px;background:#05050feb;backdrop-filter:blur(5px);font-family:Sora,Inter,ui-sans-serif,system-ui,sans-serif;color:#f0eef8;cursor:auto!important}
      .backdrop *{cursor:auto!important}
      .card{--flag:#9b9bb5;--tint:#1d1d31;width:min(580px,100%);max-height:calc(100dvh - 32px);min-height:0;display:flex;flex-direction:column;overflow:hidden;border:1px solid #30304b;border-radius:19px;background:#0f0f1a;box-shadow:0 28px 90px #000b}
      .card.red{--flag:#ff7e8b;--tint:#301922}.card.yellow{--flag:#f3c864;--tint:#302817}.card.green{--flag:#55d7a0;--tint:#102a22}
      .header{flex:0 0 auto;padding:22px 26px 16px}.brand{display:flex;align-items:center;justify-content:space-between;gap:12px}.brand-name{margin:0;color:#22d3ee;font-size:10px;font-weight:850;letter-spacing:.14em}.origin{max-width:56%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#8989a5;font-size:10px}
      .signal{display:flex;align-items:flex-start;gap:14px;margin-top:18px}.signal-icon{display:grid;place-items:center;flex:0 0 48px;height:48px;border-radius:13px;background:var(--tint);color:var(--flag);font-size:25px;font-weight:900}.signal-label{margin:1px 0 4px;color:var(--flag);font-size:11px;font-weight:850;letter-spacing:.11em}.title{margin:0;font-size:22px;line-height:1.2}.summary{margin:10px 0 0;color:#b4b4ca;font-size:13px;line-height:1.55}.score{margin:13px 0 0;color:#8b8ba7;font-size:11px}
      .content{min-height:0;flex:1 1 auto;padding:0 26px 20px;overflow:auto;overscroll-behavior:contain}.intent{padding:14px 16px;border:1px solid #30304b;border-radius:12px;background:#15152a}.label{margin:0 0 5px;color:#8b8ba7;font-size:10px;font-weight:750;text-transform:uppercase;letter-spacing:.08em}.intent-title{margin:0;font-size:14px;font-weight:750}.intent-method{margin:5px 0 0;color:#22d3ee;font:11px ui-monospace,monospace;overflow-wrap:anywhere}
      .details{margin-top:12px;border:1px solid #30304b;border-radius:12px;background:#111120;overflow:hidden}.details>summary{padding:13px 16px;font-size:12px;font-weight:750;list-style:none}.details>summary::-webkit-details-marker{display:none}.details>summary::after{content:"⌄";float:right}.details[open]>summary{border-bottom:1px solid #30304b}.details[open]>summary::after{content:"⌃"}.report{max-height:min(300px,40vh);overflow:auto;padding:2px 16px 16px}.report-section{margin-top:16px}.report-section h4{margin:0 0 8px;color:#aaaac2;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em}.data-row{display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px solid #292941;font-size:11px}.data-row span{color:#9292ad}.data-row strong{max-width:65%;text-align:right;overflow-wrap:anywhere}.finding{padding:10px 12px;border:1px solid #30304b;border-radius:9px;background:#15152a;margin:7px 0}.finding strong{font-size:12px}.finding p,.empty,.limitations li{margin:5px 0 0;color:#b2b2c8;font-size:11px;line-height:1.5}.limitations{margin:0;padding-left:19px}.code{padding:10px;max-height:160px;overflow:auto;border-radius:8px;background:#090913;color:#d2d2e4;white-space:pre-wrap;overflow-wrap:anywhere;font:10px/1.5 ui-monospace,monospace}
      .footer{flex:0 0 auto;display:flex;align-items:flex-end;justify-content:space-between;gap:15px;padding:18px 26px;border-top:1px solid #30304b;background:#0a0a18}.actions{display:flex;flex-direction:column;align-items:flex-end;gap:10px}.ack{display:flex;align-items:flex-start;gap:8px;max-width:290px;color:#b6b6cb;font-size:11px;line-height:1.45}.ack input{margin:1px 0 0;accent-color:#22d3ee}.button{min-height:42px;padding:0 16px;border-radius:9px;font-size:12px;font-weight:750}.reject{border:1px solid #4a4a68;background:#15152a;color:#f0eef8}.continue{border:1px solid #06b6d4;background:#06b6d4;color:#05050f}.button:disabled{opacity:.45}.loading{padding:16px 0;color:#aaaac2;font-size:13px}.error-copy{padding:14px;border:1px solid #5d4930;border-radius:10px;background:#302817;color:#f3c864;font-size:12px;line-height:1.5;overflow-wrap:anywhere}
      .content,.report,.code{scrollbar-color:#555574 #10101d;scrollbar-width:thin}.content::-webkit-scrollbar,.report::-webkit-scrollbar,.code::-webkit-scrollbar{width:8px;height:8px}.content::-webkit-scrollbar-track,.report::-webkit-scrollbar-track,.code::-webkit-scrollbar-track{background:#10101d}.content::-webkit-scrollbar-thumb,.report::-webkit-scrollbar-thumb,.code::-webkit-scrollbar-thumb{border-radius:8px;background:#555574}
      .backdrop button,.backdrop summary,.backdrop label,.backdrop input{cursor:pointer!important}.backdrop button:disabled{cursor:not-allowed!important}.backdrop button:focus-visible,.backdrop summary:focus-visible,.backdrop input:focus-visible{outline:2px solid #22d3ee;outline-offset:3px}
      @media(max-width:560px){.backdrop{padding:8px}.card{max-height:calc(100dvh - 16px)}.header{padding:18px}.content{padding:0 18px 18px}.footer{padding:16px 18px;flex-direction:column;align-items:stretch}.actions{align-items:stretch}.button{width:100%}}
    `;
    shadow.append(style);
    return { host, shadow };
  }

  function shell(item, flag, label, title, summary, icon) {
    const { host, shadow } = overlay();
    const backdrop = el('div', 'backdrop');
    const card = el('section', `card ${flag}`);
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-label', 'Sentinel wallet request review');
    const header = el('header', 'header');
    const brand = el('div', 'brand');
    brand.append(el('p', 'brand-name', 'SENTINEL FORK'), el('span', 'origin', item.payload.origin));
    const signal = el('div', 'signal');
    const signalCopy = el('div');
    signalCopy.append(el('p', 'signal-label', label), el('h2', 'title', title));
    signal.append(el('span', 'signal-icon', icon), signalCopy);
    header.append(brand, signal, el('p', 'summary', summary));
    const content = el('div', 'content');
    const footer = el('footer', 'footer');
    card.append(header, content, footer); backdrop.append(card); shadow.append(backdrop);
    return { host, card, header, content, footer };
  }

  function decide(item, result, host, cleanup) {
    if (item.settled) return;
    item.settled = true;
    cleanup?.();
    host.remove();
    if (item.analyzed) {
      void chrome.runtime.sendMessage({ type: 'SENTINEL_DECISION', requestId: item.requestId, decision: result.approved ? 'approved' : 'rejected' });
    }
    window.postMessage({ channel: CHANNEL, direction: 'to-page', requestId: item.requestId, ...result }, '*');
    reviewing = false;
    void reviewNext();
  }

  function rejectButton(item, host, cleanup, label = 'Reject request') {
    const button = el('button', 'button reject', label);
    button.type = 'button';
    button.addEventListener('click', () => decide(item, { approved: false }, host, cleanup));
    return button;
  }

  function attachEscape(button) {
    const onKey = (event) => { if (event.key === 'Escape') button.click(); };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }

  function showLoading(item) {
    const view = shell(item, '', 'CHECKING REQUEST', 'Analyzing before MetaMask opens', 'The wallet request is paused while Sentinel checks it.', '…');
    view.content.append(el('p', 'loading', 'Simulating and decoding the request…'));
    const reject = rejectButton(item, view.host, () => item.cleanup?.());
    item.cleanup = attachEscape(reject);
    view.footer.append(reject);
  }

  function showError(item, message) {
    item.cleanup?.();
    const view = shell(item, 'yellow', 'UNVERIFIED REQUEST', 'Analysis unavailable', 'Sentinel could not check this request. You can reject it, or explicitly continue to MetaMask without a risk verdict.', '!');
    view.content.append(el('p', 'error-copy', `Why analysis stopped: ${message}`));
    const details = el('details', 'details');
    details.open = true;
    details.append(el('summary', '', 'Request details'));
    const report = el('div', 'report');
    report.append(section('Request', dataList([
      ['Website', item.payload.origin || 'Unknown'],
      ['Wallet method', item.method],
      ['To', item.payload.to || '—'],
    ])));
    report.append(section('What this means', el('p', 'empty', 'No simulation or risk score is available. MetaMask will show its own confirmation, but Sentinel cannot tell you whether this request is safe.')));
    details.append(report);
    view.content.append(details);
    const reject = rejectButton(item, view.host, () => item.cleanup?.());
    const actions = el('div', 'actions');
    const ack = el('label', 'ack');
    const checkbox = el('input'); checkbox.type = 'checkbox';
    const approve = el('button', 'button continue', 'Continue unverified to MetaMask');
    approve.type = 'button';
    approve.disabled = true;
    checkbox.addEventListener('change', () => { approve.disabled = !checkbox.checked; });
    ack.append(checkbox, document.createTextNode('I understand Sentinel could not analyze this request.'));
    approve.addEventListener('click', () => { if (!approve.disabled) decide(item, { approved: true }, view.host, () => item.cleanup?.()); });
    actions.append(ack, approve);
    item.cleanup = attachEscape(reject);
    view.footer.append(reject, actions);
    reject.focus();
  }

  function appendFindings(report, analysis) {
    const findings = array(analysis.findings);
    const box = el('div');
    if (!findings.length) box.append(el('p', 'empty', 'No deterministic finding. This does not guarantee safety.'));
    for (const finding of findings) {
      const row = el('article', 'finding');
      row.append(el('strong', '', `${String(finding.severity || 'info').toUpperCase()} · ${finding.title || 'Finding'}`));
      row.append(el('p', '', finding.explanation || ''));
      if (finding.evidence != null) row.append(el('pre', 'code', printable(finding.evidence)));
      box.append(row);
    }
    report.append(section(`Findings (${findings.length})`, box));
  }

  function appendStateDiff(report, analysis) {
    const box = el('div');
    let count = 0;
    for (const [key, label] of [['native', 'Native balance'], ['erc20', 'ERC-20'], ['erc721', 'ERC-721'], ['erc1155', 'ERC-1155'], ['approvals', 'Approvals']]) {
      for (const entry of array(analysis.state_diff?.[key])) {
        box.append(el('p', 'label', label), el('pre', 'code', printable(entry)));
        count += 1;
      }
    }
    if (!count) box.append(el('p', 'empty', 'No state changes observed in the fork.'));
    report.append(section(`State changes (${count})`, box));
  }

  function showReview(item, analysis, flag) {
    item.cleanup?.();
    const flags = {
      green: ['LOWER RISK', 'Lower risk result', '✓'],
      yellow: ['REVIEW CAREFULLY', 'Review this request', '!'],
      red: ['HIGH RISK', 'Dangerous request', '×'],
    };
    const [label, title, icon] = flags[flag] || flags.yellow;
    const view = shell(item, flag, label, title, analysis.risk.summary, icon);
    view.header.append(el('p', 'score', `Risk score ${analysis.risk.score}/100 · ${analysis.simulation.status}`));
    const intent = el('div', 'intent');
    intent.append(el('p', 'label', 'Decoded request'), el('p', 'intent-title', analysis.intent.title), el('p', 'intent-method', analysis.intent.function || item.method));
    view.content.append(intent);

    const details = el('details', 'details');
    details.open = flag !== 'green';
    details.append(el('summary', '', 'View full analysis'));
    const report = el('div', 'report');
    report.append(section('Request', dataList([
      ['Wallet method', item.method], ['To', item.payload.to || '—'],
      ['Fork block', analysis.simulation.fork_block || '—'], ['Gas used', analysis.simulation.gas_used || '—'],
    ])));
    report.append(section('Decoded arguments', el('pre', 'code', printable(analysis.intent.decoded_args || {}))));
    appendFindings(report, analysis);
    appendStateDiff(report, analysis);
    const matches = array(analysis.drainer_matches);
    if (matches.length) report.append(section('Drainer database matches', el('pre', 'code', printable(matches))));
    const limitations = array(analysis.limitations);
    if (limitations.length) {
      const list = el('ul', 'limitations');
      for (const limitation of limitations) list.append(el('li', '', limitation));
      report.append(section('Limitations', list));
    }
    report.append(section('Raw report', el('pre', 'code', printable(analysis))));
    details.append(report); view.content.append(details);

    const risky = flag === 'red';
    const reject = rejectButton(item, view.host, () => item.cleanup?.());
    const actions = el('div', 'actions');
    const approve = el('button', 'button continue', 'Continue to MetaMask');
    approve.type = 'button';
    approve.disabled = risky;
    if (risky) {
      const ack = el('label', 'ack');
      const checkbox = el('input'); checkbox.type = 'checkbox';
      checkbox.addEventListener('change', () => { approve.disabled = !checkbox.checked; });
      ack.append(checkbox, document.createTextNode('I understand this request may put assets at risk.'));
      actions.append(ack);
    }
    approve.addEventListener('click', () => { if (!approve.disabled) decide(item, { approved: true }, view.host, () => item.cleanup?.()); });
    item.cleanup = attachEscape(reject);
    actions.append(approve); view.footer.append(reject, actions); reject.focus();
  }

  async function reviewNext() {
    if (reviewing || !queue.length) return;
    reviewing = true;
    const item = queue.shift();
    showLoading(item);
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SENTINEL_ANALYZE', requestId: item.requestId, method: item.method, payload: item.payload,
      });
      if (item.settled) return;
      if (!response?.ok) throw new Error(response?.error || 'Analysis failed.');
      if (response.bypass) {
        item.cleanup?.();
        document.querySelector('#sentinel-fork-extension-root')?.remove();
        decide(item, { bypass: true }, { remove() {} });
        return;
      }
      item.analyzed = true;
      showReview(item, response.analysis, response.flag);
    } catch (error) {
      if (!item.settled) showError(item, error instanceof Error ? error.message : 'Analysis failed.');
    }
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const message = event.data;
    if (message?.channel !== CHANNEL || message.direction !== 'to-extension') return;
    if (typeof message.requestId !== 'string' || !message.payload || typeof message.method !== 'string') return;
    queue.push({ requestId: message.requestId, payload: message.payload, method: message.method, settled: false, analyzed: false });
    void reviewNext();
  });
})();
