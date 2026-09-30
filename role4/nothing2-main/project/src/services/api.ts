import type { AnalyzePayload, AnalyzeResponse } from '@/types/analyze';

const BACKEND_ENDPOINT =
  import.meta.env.VITE_SENTINEL_API_URL ?? 'http://127.0.0.1:8787/api/analyze';

export class AnalyzeApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'AnalyzeApiError';
  }
}

export async function analyzeRequest(payload: AnalyzePayload): Promise<AnalyzeResponse> {
  let response: Response;
  try {
    response = await fetch(BACKEND_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new AnalyzeApiError(
      'Sentinel Fork is not reachable. Start the Rust backend on port 8787 and try again.',
    );
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new AnalyzeApiError(
      body?.error ?? `Analysis failed with HTTP ${response.status}.`,
      response.status,
    );
  }

  return response.json() as Promise<AnalyzeResponse>;
}

