export interface EthereumRequest {
  method: string;
  params?: unknown[] | Record<string, unknown>;
}

export interface EthereumProvider {
  request<T = unknown>(request: EthereumRequest): Promise<T>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
    __sentinelRealEthereum?: EthereumProvider;
    __sentinelInterceptorInstalled?: boolean;
    __sentinelInterceptorError?: string;
    __sentinelForkExtensionInstalled?: boolean;
  }
}
