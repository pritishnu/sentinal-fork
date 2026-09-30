import { analyzeRequest } from '@/services/api';
import type { AnalyzePayload, AnalyzeResponse } from '@/types/analyze';
import type { EthereumProvider, EthereumRequest } from '@/types/ethereum';

const INTERCEPTED_METHODS = new Set([
  'eth_sendTransaction',
  'eth_sign',
  'personal_sign',
  'eth_signTypedData',
  'eth_signTypedData_v4',
]);

export interface SentinelDecisionDetail {
  analysis: AnalyzeResponse;
  method: string;
  approve: () => void;
  reject: () => void;
}

export interface SentinelErrorDetail {
  message: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function paramsArray(request: EthereumRequest): unknown[] {
  return Array.isArray(request.params) ? request.params : [];
}

function parseChainId(value: unknown): number | undefined {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return undefined;
  const parsed = Number.parseInt(value, value.startsWith('0x') ? 16 : 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function typedDataFrom(request: EthereumRequest): Record<string, unknown> {
  const raw = paramsArray(request).find((item) => {
    if (typeof item !== 'string') return typeof item === 'object' && item !== null;
    return item.trim().startsWith('{');
  });
  if (typeof raw === 'string') {
    try { return asRecord(JSON.parse(raw)); } catch { return {}; }
  }
  return asRecord(raw);
}

async function normalizeRequest(
  request: EthereumRequest,
  realProvider: EthereumProvider,
): Promise<AnalyzePayload> {
  const params = paramsArray(request);
  const isTransaction = request.method === 'eth_sendTransaction';
  const transaction = isTransaction ? asRecord(params[0]) : {};
  const typedData = isTransaction ? {} : typedDataFrom(request);
  const domain = asRecord(typedData.domain);
  const firstParam = asString(params[0]);
  const walletAddress = isTransaction
    ? asString(transaction.from)
    : firstParam.startsWith('0x') && firstParam.length === 42 ? firstParam : asString(params[1]);
  const liveChainId = await realProvider.request<string>({ method: 'eth_chainId' });
  const chainId = parseChainId(transaction.chainId) ?? parseChainId(domain.chainId) ?? parseChainId(liveChainId) ?? 11155111;
  const signatureData = typeof params[1] === 'string' ? params[1] : JSON.stringify(typedData);

  return {
    chain_id: chainId,
    request_type: isTransaction ? 'transaction' : 'signature',
    from: walletAddress,
    to: isTransaction ? asString(transaction.to, walletAddress) : asString(domain.verifyingContract, walletAddress),
    value: isTransaction ? asString(transaction.value, '0x0') : '0x0',
    data: isTransaction ? asString(transaction.data, '0x') : signatureData,
    origin: window.location.origin,
  };
}

function waitForDecision(analysis: AnalyzeResponse, method: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (decision: boolean) => {
      if (settled) return;
      settled = true;
      resolve(decision);
    };
    window.dispatchEvent(new CustomEvent<SentinelDecisionDetail>('sentinel:decision-required', {
      detail: { analysis, method, approve: () => settle(true), reject: () => settle(false) },
    }));
  });
}

function rejectionError(): Error & { code: number } {
  return Object.assign(new Error('User rejected the request in Sentinel Fork.'), { code: 4001 });
}

function install(realProvider: EthereumProvider): void {
  if (window.__sentinelInterceptorInstalled) return;
  window.__sentinelRealEthereum = realProvider;

  const realRequest = realProvider.request.bind(realProvider);
  const requestAdapter: EthereumProvider = { request: realRequest };
  const interceptedRequest = async <T = unknown>(request: EthereumRequest): Promise<T> => {
    if (!INTERCEPTED_METHODS.has(request.method)) return realRequest<T>(request);
    try {
      const analysis = await analyzeRequest(await normalizeRequest(request, requestAdapter));
      if (!await waitForDecision(analysis, request.method)) throw rejectionError();
      return realRequest<T>(request);
    } catch (error) {
      if ((error as { code?: number }).code !== 4001) {
        window.dispatchEvent(new CustomEvent<SentinelErrorDetail>('sentinel:analysis-error', {
          detail: { message: error instanceof Error ? error.message : 'Unable to analyze this wallet request.' },
        }));
      }
      throw error;
    }
  };

  const wrapper = new Proxy(realProvider, {
    get(target, property) {
      if (property === 'request') return interceptedRequest;
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });

  let installed = false;
  try {
    Object.defineProperty(window, 'ethereum', { configurable: true, writable: true, value: wrapper });
    installed = window.ethereum === wrapper;
  } catch (error) {
    console.warn('Sentinel could not replace window.ethereum directly.', error);
  }

  if (!installed) {
    try {
      window.ethereum = wrapper;
      installed = window.ethereum === wrapper;
    } catch (error) {
      console.warn('Sentinel could not assign the wrapped provider.', error);
    }
  }

  if (!installed) {
    try {
      Object.defineProperty(realProvider, 'request', {
        configurable: true,
        writable: true,
        value: interceptedRequest,
      });
      installed = realProvider.request === interceptedRequest;
    } catch (error) {
      console.warn('Sentinel could not patch the provider request method.', error);
    }
  }

  window.__sentinelInterceptorInstalled = installed;
  if (!installed) {
    window.__sentinelInterceptorError =
      'MetaMask blocked the inline interceptor. The page remains available, but wallet requests cannot be paused in this browser profile.';
  }
}

try {
  if (window.__sentinelForkExtensionInstalled) {
    // The Chrome extension owns the provider boundary on this page. Avoid a
    // second analysis and approval dialog from the inline demo interceptor.
    window.__sentinelInterceptorInstalled = true;
  } else if (window.ethereum) {
    install(window.ethereum);
  } else {
    window.addEventListener('ethereum#initialized', () => {
      if (window.ethereum) install(window.ethereum);
    }, { once: true });
  }
} catch (error) {
  // Provider injection must never prevent the React application from mounting.
  console.error('Sentinel provider initialization failed.', error);
  window.__sentinelInterceptorError =
    'The wallet interceptor could not start. Reload after MetaMask finishes loading.';
}
