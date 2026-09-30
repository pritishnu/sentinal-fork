(() => {
  'use strict';

  if (window.__sentinelForkExtensionInstalled) return;
  window.__sentinelForkExtensionInstalled = true;

  const CHANNEL = 'sentinel-fork-extension-v1';
  const INTERCEPTED_METHODS = new Set([
    'eth_sendTransaction',
    'eth_sign',
    'personal_sign',
    'eth_signTypedData',
    'eth_signTypedData_v3',
    'eth_signTypedData_v4',
  ]);
  const pending = new Map();
  const wrappers = new WeakMap();

  const asRecord = (value) => value && typeof value === 'object' ? value : {};
  const asString = (value, fallback = '') => typeof value === 'string' ? value : fallback;
  const paramsArray = (request) => Array.isArray(request.params) ? request.params : [];

  function parseChainId(value) {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return undefined;
    const parsed = Number.parseInt(value, value.startsWith('0x') ? 16 : 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  function typedDataFrom(request) {
    const raw = paramsArray(request).find((item) => {
      if (typeof item !== 'string') return item && typeof item === 'object';
      return item.trim().startsWith('{');
    });
    if (typeof raw === 'string') {
      try { return asRecord(JSON.parse(raw)); } catch { return {}; }
    }
    return asRecord(raw);
  }

  async function normalizeRequest(request, provider) {
    const params = paramsArray(request);
    const isTransaction = request.method === 'eth_sendTransaction';
    const transaction = isTransaction ? asRecord(params[0]) : {};
    const typedData = isTransaction ? {} : typedDataFrom(request);
    const domain = asRecord(typedData.domain);
    const firstParam = asString(params[0]);
    const secondParam = asString(params[1]);
    const walletAddress = isTransaction
      ? asString(transaction.from)
      : firstParam.length === 42 && firstParam.startsWith('0x') ? firstParam : secondParam;
    let liveChainId;
    try {
      liveChainId = await provider.request({ method: 'eth_chainId' });
    } catch {
      // Wallets may decline chain lookup before connection. Still show a
      // review, but never assume the request was made on Sepolia.
    }
    const chainId = parseChainId(transaction.chainId)
      ?? parseChainId(domain.chainId)
      ?? parseChainId(liveChainId)
      ?? 0;
    const signatureData = request.method === 'personal_sign'
      ? asString(params[0], JSON.stringify(params[0] ?? ''))
      : request.method === 'eth_sign'
        ? asString(params[1], JSON.stringify(params[1] ?? ''))
        : JSON.stringify(typedData);

    return {
      chain_id: chainId,
      request_type: isTransaction ? 'transaction' : 'signature',
      from: walletAddress,
      to: isTransaction
        ? asString(transaction.to, walletAddress)
        : asString(domain.verifyingContract, walletAddress),
      value: isTransaction ? asString(transaction.value, '0x0') : '0x0',
      data: isTransaction ? asString(transaction.data, '0x') : signatureData,
      origin: window.location.origin,
    };
  }

  function requestDecision(method, payload) {
    const requestId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        pending.delete(requestId);
        reject(new Error('Sentinel Fork timed out while analyzing this request.'));
      }, 120000);
      pending.set(requestId, { resolve, reject, timeout });
      window.postMessage({ channel: CHANNEL, direction: 'to-extension', requestId, method, payload }, '*');
    });
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const message = event.data;
    if (!message || message.channel !== CHANNEL) return;
    if (message.direction !== 'to-page') return;
    const waiter = pending.get(message.requestId);
    if (!waiter) return;
    pending.delete(message.requestId);
    window.clearTimeout(waiter.timeout);
    if (message.error) waiter.reject(new Error(message.error));
    else waiter.resolve(message);
  });

  function rejectionError(message = 'User rejected the request in Sentinel Fork.') {
    return Object.assign(new Error(message), { code: 4001 });
  }

  function install(provider) {
    if (!provider || typeof provider.request !== 'function') return;
    if (provider.__sentinelForkWrapped) return;
    const existingWrapper = wrappers.get(provider);
    if (existingWrapper) {
      if (window.ethereum !== existingWrapper) replaceGlobalProvider(existingWrapper);
      return;
    }
    const realRequest = provider.request.bind(provider);
    const adapter = { request: realRequest };

    const interceptedRequest = async (request) => {
      if (!request || !INTERCEPTED_METHODS.has(request.method)) return realRequest(request);
      try {
        const payload = await normalizeRequest(request, adapter);
        const decision = await requestDecision(request.method, payload);
        if (decision.bypass === true || decision.approved === true) return realRequest(request);
        throw rejectionError(decision.reason);
      } catch (error) {
        if (error?.code === 4001) throw error;
        throw rejectionError(error instanceof Error ? error.message : 'Sentinel blocked this request.');
      }
    };

    const wrapper = new Proxy(provider, {
      get(target, property) {
        if (property === 'request') return interceptedRequest;
        if (property === '__sentinelForkWrapped') return true;
        const value = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });

    wrappers.set(provider, wrapper);

    let installed = replaceGlobalProvider(wrapper);

    if (!installed) {
      try {
        Object.defineProperty(provider, 'request', {
          configurable: true,
          writable: true,
          value: interceptedRequest,
        });
        installed = provider.request === interceptedRequest;
      } catch {
        // A frozen provider cannot be wrapped by a page-level extension.
      }
    }

    if (installed) {
      window.dispatchEvent(new CustomEvent('sentinel-fork:ready'));
    } else {
      console.warn('[Sentinel Fork] The injected wallet provider could not be wrapped on this page.');
    }
  }

  function replaceGlobalProvider(wrapper) {
    try {
      Object.defineProperty(window, 'ethereum', {
        configurable: true,
        writable: true,
        value: wrapper,
      });
      return window.ethereum === wrapper;
    } catch {
      try {
        window.ethereum = wrapper;
        return window.ethereum === wrapper;
      } catch {
        return false;
      }
    }
  }

  if (window.ethereum) install(window.ethereum);
  window.addEventListener('ethereum#initialized', () => install(window.ethereum));

  // Keep watching: MetaMask and multi-wallet shims may replace window.ethereum after startup.
  window.setInterval(() => {
    if (window.ethereum) install(window.ethereum);
  }, 1000);
})();
