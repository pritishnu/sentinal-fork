export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface Finding {
  severity: Severity;
  title: string;
  explanation: string;
  evidence: unknown;
}

export interface AnalyzeResponse {
  simulation: {
    status: 'success' | 'reverted' | 'unsupported' | 'signature_no_evm_execution' | string;
    fork_block: number;
    gas_used: string;
  };
  intent: {
    title: string;
    function: string;
    decoded_args: Record<string, unknown>;
    unknown_calldata: boolean;
  };
  findings: Finding[];
  state_diff: {
    native: unknown[];
    erc20: unknown[];
    erc721: unknown[];
    erc1155: unknown[];
    approvals: unknown[];
  };
  drainer_matches: unknown[];
  risk: {
    score: number;
    severity: Exclude<Severity, 'info'>;
    summary: string;
  };
  limitations: string[];
}

export interface AnalyzePayload {
  chain_id: number;
  request_type: 'transaction' | 'signature';
  from: string;
  to: string;
  value: string;
  data: string;
  origin: string;
  rpc_url?: string;
}

