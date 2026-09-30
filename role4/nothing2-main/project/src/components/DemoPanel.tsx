import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  Loader2,
  RotateCcw,
  Shield,
  Wallet,
} from 'lucide-react';
import type { SentinelErrorDetail } from '@/provider-wrapper';

type WalletState = 'disconnected' | 'connecting' | 'connected';
type RunState = 'idle' | 'analyzing' | 'rejected' | 'forwarded' | 'error';

interface Props {
  onShowOverview: () => void;
  modalVisible: boolean;
}

const SEPOLIA_CHAIN_ID = '0xaa36a7';
const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

function shorten(address: string): string {
  return address ? `${address.slice(0, 6)}…${address.slice(-4)}` : 'Not connected';
}

function approvalCalldata(operator: string): string {
  return `0xa22cb465${operator.slice(2).padStart(64, '0')}${'1'.padStart(64, '0')}`;
}

function errorMessage(error: unknown): string {
  if ((error as { code?: number }).code === 4001) return 'Request rejected. Nothing was sent to MetaMask.';
  return error instanceof Error ? error.message : 'The wallet request could not be completed.';
}

export function DemoPanel({ onShowOverview, modalVisible }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [walletState, setWalletState] = useState<WalletState>('disconnected');
  const [address, setAddress] = useState('');
  const [chainId, setChainId] = useState('');
  const [runState, setRunState] = useState<RunState>('idle');
  const [statusMessage, setStatusMessage] = useState('Connect MetaMask when you’re ready to try the demo.');
  const [collectionAddress, setCollectionAddress] = useState(import.meta.env.VITE_MOCK_REWARDS_NFT_ADDRESS ?? '');
  const [operatorAddress, setOperatorAddress] = useState(import.meta.env.VITE_FAKE_REWARDS_DRAINER_ADDRESS ?? '');
  const [logs, setLogs] = useState<string[]>([
    'Interceptor ready',
    'Wallet requests will pause for review',
  ]);

  const addressesValid = ADDRESS_PATTERN.test(collectionAddress) && ADDRESS_PATTERN.test(operatorAddress);
  const onSepolia = chainId.toLowerCase() === SEPOLIA_CHAIN_ID;
  const isBusy = runState === 'analyzing' || modalVisible;

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const context = gsap.context(() => {
      gsap.from('.demo-intro', { opacity: 0, y: 28, duration: 0.8, ease: 'power3.out' });
      gsap.from('.claim-card', { opacity: 0, y: 36, duration: 0.8, delay: 0.12, ease: 'power3.out' });
      gsap.from('.demo-footnote', { opacity: 0, y: 18, duration: 0.6, delay: 0.3, ease: 'power3.out' });
    }, containerRef);
    return () => context.revert();
  }, []);

  useEffect(() => {
    const provider = window.ethereum;
    if (!provider) {
      setStatusMessage('MetaMask wasn’t detected. Install or enable it to run the wallet flow.');
      return;
    }
    if (window.__sentinelInterceptorError) {
      setRunState('error');
      setStatusMessage(window.__sentinelInterceptorError);
    }

    provider.request<string[]>({ method: 'eth_accounts' }).then((accounts) => {
      if (accounts[0]) {
        setAddress(accounts[0]);
        setWalletState('connected');
      }
    }).catch(() => undefined);
    provider.request<string>({ method: 'eth_chainId' }).then(setChainId).catch(() => undefined);

    const accountsChanged = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      setAddress(accounts?.[0] ?? '');
      setWalletState(accounts?.[0] ? 'connected' : 'disconnected');
    };
    const chainChanged = (...args: unknown[]) => setChainId(String(args[0] ?? ''));
    provider.on?.('accountsChanged', accountsChanged);
    provider.on?.('chainChanged', chainChanged);
    return () => {
      provider.removeListener?.('accountsChanged', accountsChanged);
      provider.removeListener?.('chainChanged', chainChanged);
    };
  }, []);

  useEffect(() => {
    const handleAnalysisError = (event: Event) => {
      const { message } = (event as CustomEvent<SentinelErrorDetail>).detail;
      setRunState('error');
      setStatusMessage(message);
      setLogs((previous) => [...previous, `Analysis error — ${message}`]);
    };
    window.addEventListener('sentinel:analysis-error', handleAnalysisError);
    return () => window.removeEventListener('sentinel:analysis-error', handleAnalysisError);
  }, []);

  async function connectWallet(): Promise<string | null> {
    if (!window.ethereum) {
      setRunState('error');
      setStatusMessage('MetaMask is required for this demo.');
      return null;
    }
    setWalletState('connecting');
    try {
      const accounts = await window.ethereum.request<string[]>({ method: 'eth_requestAccounts' });
      const connected = accounts[0] ?? '';
      setAddress(connected);
      setWalletState(connected ? 'connected' : 'disconnected');
      const nextChainId = await window.ethereum.request<string>({ method: 'eth_chainId' });
      setChainId(nextChainId);
      setStatusMessage('Wallet connected. Add the Sepolia demo addresses below.');
      return connected || null;
    } catch (error) {
      setWalletState('disconnected');
      setStatusMessage(errorMessage(error));
      return null;
    }
  }

  async function switchToSepolia(): Promise<boolean> {
    if (!window.ethereum) return false;
    try {
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: SEPOLIA_CHAIN_ID }] });
      setChainId(SEPOLIA_CHAIN_ID);
      return true;
    } catch (error) {
      setRunState('error');
      setStatusMessage(`Switch to Sepolia in MetaMask: ${errorMessage(error)}`);
      return false;
    }
  }

  async function requestTrainingApproval() {
    const from = address || await connectWallet();
    if (!from) return;
    if (!addressesValid) {
      setRunState('error');
      setStatusMessage('Add the deployed mock NFT and training operator addresses first.');
      return;
    }
    if (!onSepolia && !await switchToSepolia()) return;

    setRunState('analyzing');
    setStatusMessage('Sentinel Fork is checking the request before MetaMask opens.');
    setLogs((previous) => [
      ...previous,
      `Request intercepted from ${shorten(from)}`,
      `Decoded setApprovalForAll(${shorten(operatorAddress)}, true)`,
      'Simulating against a local Sepolia fork',
    ]);

    try {
      const result = await window.ethereum!.request<string>({
        method: 'eth_sendTransaction',
        params: [{
          from,
          to: collectionAddress,
          value: '0x0',
          data: approvalCalldata(operatorAddress),
        }],
      });
      setRunState('forwarded');
      setStatusMessage(`Sent to MetaMask. Wallet response: ${shorten(result)}`);
      setLogs((previous) => [...previous, `Forwarded to wallet — ${result}`]);
    } catch (error) {
      const rejected = (error as { code?: number }).code === 4001;
      setRunState(rejected ? 'rejected' : 'error');
      setStatusMessage(errorMessage(error));
      if (rejected) setLogs((previous) => [...previous, 'Stopped before wallet forwarding']);
    }
  }

  return (
    <div ref={containerRef} className="relative min-h-screen overflow-hidden bg-void text-ghost">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_72%_25%,rgba(6,182,212,.12),transparent_32%),radial-gradient(circle_at_18%_70%,rgba(124,58,237,.12),transparent_30%)]" />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan/50 to-transparent" />

      <nav className="fixed left-1/2 top-5 z-50 w-[calc(100%-2rem)] max-w-4xl -translate-x-1/2">
        <div className="flex items-center justify-between gap-3 rounded-full border border-white/10 bg-void/70 px-3 py-2 backdrop-blur-xl sm:px-4">
          <button onClick={onShowOverview} className="flex items-center gap-2 pl-1 font-display text-sm font-bold text-white transition hover:text-cyan-glow">
            <Shield className="h-5 w-5 text-cyan-glow" />
            <span className="hidden sm:inline">Sentinel Fork</span>
          </button>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden items-center gap-2 font-mono text-xs text-slate-400 md:flex">
              <span className={`h-1.5 w-1.5 rounded-full ${onSepolia ? 'bg-green-400' : 'bg-high'}`} />
              {onSepolia ? 'Sepolia connected' : 'Sepolia testnet'}
            </span>
            <button onClick={onShowOverview} className="hidden font-display text-sm text-slate-400 transition hover:text-white sm:block">How it works</button>
            <button
              onClick={() => void connectWallet()}
              disabled={walletState === 'connecting'}
              className="flex min-h-9 items-center gap-2 whitespace-nowrap rounded-full bg-cyan px-4 font-display text-sm font-bold text-void transition hover:bg-cyan-glow disabled:opacity-60"
            >
              {walletState === 'connecting' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
              {walletState === 'connected' ? shorten(address) : 'Connect wallet'}
            </button>
          </div>
        </div>
      </nav>

      <main className="relative z-10 mx-auto flex min-h-screen max-w-7xl items-start px-6 pb-16 pt-28 sm:px-10 md:px-16 lg:items-center">
        <div className="grid w-full items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(360px,460px)] lg:gap-20">
          <section className="demo-intro max-w-2xl">
            <p className="font-display text-base font-semibold tracking-wide text-cyan-glow">SEPOLIA REWARDS DROP</p>
            <h1 className="mt-4 font-display text-5xl font-extrabold leading-[0.95] tracking-tight text-white sm:text-6xl xl:text-7xl">
              Your tester rewards are <span className="font-serif italic font-normal text-cyan-glow">ready</span>
            </h1>
            <p className="mt-7 max-w-xl font-display text-base leading-relaxed text-slate-400 sm:text-lg">
              A deliberately risky claim, built to show the moment Sentinel Fork steps between a dApp and your wallet.
            </p>

            <div className="mt-10 grid max-w-md grid-cols-3 gap-4 text-sm">
              {['Request', 'Simulate', 'Decide'].map((step, index) => (
                <div key={step} className="flex items-center gap-2 font-display text-slate-300 sm:gap-3">
                  <span className="font-mono text-xs text-cyan-glow">0{index + 1}</span>
                  {step}
                  {index < 2 && <ArrowRight className="hidden h-4 w-4 text-slate-600 md:block" />}
                </div>
              ))}
            </div>

            <div className="demo-footnote mt-12 flex items-start gap-3 border-l border-cyan/50 pl-4">
              <Shield className="mt-0.5 h-4 w-4 shrink-0 text-cyan-glow" />
              <p className="max-w-lg font-display text-sm leading-relaxed text-slate-400">
                Training only. This flow uses Sepolia and tester-owned mock NFTs. No mainnet transaction is created.
              </p>
            </div>
          </section>

          <section className="claim-card relative rounded-[2rem] border border-white/10 bg-void/75 p-6 shadow-[0_30px_100px_rgba(0,0,0,.5)] backdrop-blur-xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-display text-sm text-slate-400">Your allocation</p>
                <p className="mt-2 font-display text-4xl font-extrabold tracking-tight text-white">250 <span className="text-cyan-glow">SNTL</span></p>
              </div>
              <span className="rounded-full border border-white/10 px-3 py-1 font-mono text-xs text-slate-400">TESTNET</span>
            </div>

            <div className="my-7 h-px bg-white/10" />

            <div className="space-y-4 font-display text-sm">
              <div className="flex items-center justify-between"><span className="text-slate-400">Network</span><span className="text-white">Sepolia</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-400">Connected wallet</span><span className="font-mono text-xs text-white">{shorten(address)}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-400">Claim fee</span><span className="text-white">Gas only</span></div>
            </div>

            <details className="group mt-7 border-y border-white/10 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between font-display text-sm text-slate-300">
                Demo contract details
                <ChevronDown className="h-4 w-4 text-slate-500 transition group-open:rotate-180" />
              </summary>
              <div className="mt-4 space-y-4">
                <label className="block">
                  <span className="mb-2 block font-mono text-[11px] uppercase tracking-wider text-slate-500">Mock NFT collection</span>
                  <input value={collectionAddress} onChange={(event) => setCollectionAddress(event.target.value.trim())} placeholder="0x… MockRewardsNFT" spellCheck={false} className="min-h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 font-mono text-xs text-white outline-none transition placeholder:text-slate-600 focus:border-cyan/50" />
                </label>
                <label className="block">
                  <span className="mb-2 block font-mono text-[11px] uppercase tracking-wider text-slate-500">Training operator</span>
                  <input value={operatorAddress} onChange={(event) => setOperatorAddress(event.target.value.trim())} placeholder="0x… FakeRewardsDrainer" spellCheck={false} className="min-h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 font-mono text-xs text-white outline-none transition placeholder:text-slate-600 focus:border-cyan/50" />
                </label>
              </div>
            </details>

            <div className="mt-6 flex items-start gap-3 rounded-xl bg-high/10 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-high" />
              <p className="font-display text-xs leading-relaxed text-slate-300">
                This training claim intentionally requests broad approval. You’ll see the exact permission before anything reaches MetaMask.
              </p>
            </div>

            <button onClick={() => void requestTrainingApproval()} disabled={isBusy} className="mt-6 flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-cyan px-5 py-3.5 font-display text-sm font-bold text-void transition hover:scale-[1.01] hover:bg-cyan-glow hover:shadow-[0_0_30px_rgba(6,182,212,.3)] disabled:cursor-wait disabled:opacity-60">
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {modalVisible ? 'Waiting for your decision…' : isBusy ? 'Checking request…' : 'Review claim request'}
            </button>

            <p aria-live="polite" className={`mt-4 text-center font-display text-xs leading-relaxed ${runState === 'error' ? 'text-critical' : runState === 'forwarded' ? 'text-green-400' : 'text-slate-500'}`}>
              {statusMessage}
            </p>

            <details className="mt-5 text-left">
              <summary className="cursor-pointer list-none text-center font-mono text-[11px] text-slate-600 transition hover:text-slate-400">View technical trace</summary>
              <div className="mt-3 border-t border-white/5 pt-3">
                <div className="flex justify-end"><button onClick={() => setLogs(['Interceptor ready'])} aria-label="Clear trace" className="text-slate-600 transition hover:text-white"><RotateCcw className="h-3.5 w-3.5" /></button></div>
                <div data-lenis-prevent className="mt-1 max-h-28 space-y-1 overflow-y-auto font-mono text-[11px] leading-relaxed text-slate-500">
                  {logs.map((log, index) => <p key={`${index}-${log}`}>{log}</p>)}
                </div>
              </div>
            </details>
          </section>
        </div>
      </main>
    </div>
  );
}
