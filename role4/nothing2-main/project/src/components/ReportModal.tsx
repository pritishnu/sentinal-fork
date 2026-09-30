import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  FileSearch,
  Layers,
  Loader2,
  Shield,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import type { AnalyzeResponse, Finding, Severity } from '@/types/analyze';

interface Props {
  analysis: AnalyzeResponse;
  requestMethod: string;
  onReject: () => void;
  onContinue: () => void;
}

type Tab = 'overview' | 'findings' | 'changes' | 'raw';

const STYLES: Record<Severity, { bg: string; text: string; border: string; label: string }> = {
  critical: { bg: 'bg-critical/15', text: 'text-critical', border: 'border-critical/35', label: 'CRITICAL' },
  high: { bg: 'bg-high/15', text: 'text-high', border: 'border-high/35', label: 'HIGH RISK' },
  medium: { bg: 'bg-medium/15', text: 'text-medium', border: 'border-medium/35', label: 'MEDIUM RISK' },
  low: { bg: 'bg-cyan/10', text: 'text-cyan-glow', border: 'border-cyan/30', label: 'LOWER RISK' },
  info: { bg: 'bg-white/5', text: 'text-slate-300', border: 'border-white/10', label: 'INFO' },
};

function printable(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

function FindingRow({ finding }: { finding: Finding }) {
  const [expanded, setExpanded] = useState(false);
  const style = STYLES[finding.severity] ?? STYLES.info;
  return (
    <article className={`overflow-hidden rounded-xl border ${style.border} ${style.bg}`}>
      <button onClick={() => setExpanded((value) => !value)} className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left" aria-expanded={expanded}>
        <span className={`rounded-md border px-2 py-1 font-mono text-[11px] font-bold ${style.text} ${style.border}`}>{style.label}</span>
        <span className="flex-1 font-display text-sm font-semibold text-white">{finding.title}</span>
        {expanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
      </button>
      {expanded && (
        <div className="border-t border-white/5 px-4 pb-4 pt-3">
          <p className="font-display text-sm leading-relaxed text-slate-300">{finding.explanation}</p>
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-lg border border-white/5 bg-void/70 p-3 font-mono text-xs leading-relaxed text-cyan-glow/90">{printable(finding.evidence)}</pre>
        </div>
      )}
    </article>
  );
}

function DiffSection({ title, entries }: { title: string; entries: unknown[] }) {
  if (!entries.length) return null;
  return (
    <section>
      <h4 className="mb-2 font-mono text-xs uppercase tracking-wider text-slate-400">{title}</h4>
      <div className="space-y-2">
        {entries.map((entry, index) => (
          <pre key={index} className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-void/60 p-3 font-mono text-xs leading-relaxed text-slate-300">{printable(entry)}</pre>
        ))}
      </div>
    </section>
  );
}

export function ReportModal({ analysis, requestMethod, onReject, onContinue }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const rejectRef = useRef<HTMLButtonElement>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [acknowledged, setAcknowledged] = useState(false);
  const [forwarding, setForwarding] = useState(false);
  const [copied, setCopied] = useState(false);
  const severity = analysis.risk.severity;
  const style = STYLES[severity] ?? STYLES.info;
  const requiresAcknowledgement = severity === 'critical' || severity === 'high';
  const canContinue = !requiresAcknowledgement || acknowledged;
  const totalChanges = Object.values(analysis.state_diff).reduce((total, entries) => total + entries.length, 0);

  useEffect(() => {
    rejectRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onReject();
    };
    window.addEventListener('keydown', handleKey);
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.fromTo('.sentinel-modal-panel', { opacity: 0, scale: 0.97, y: 16 }, { opacity: 1, scale: 1, y: 0, duration: 0.28, ease: 'power3.out' });
    }
    return () => window.removeEventListener('keydown', handleKey);
  }, [onReject]);

  const continueToWallet = () => {
    if (!canContinue) return;
    setForwarding(true);
    onContinue();
  };

  const copyReport = async () => {
    await navigator.clipboard.writeText(JSON.stringify(analysis, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const tabs: { id: Tab; label: string; icon: typeof FileSearch }[] = [
    { id: 'overview', label: 'Overview', icon: FileSearch },
    { id: 'findings', label: `Findings (${analysis.findings.length})`, icon: AlertTriangle },
    { id: 'changes', label: `State changes (${totalChanges})`, icon: Layers },
    { id: 'raw', label: 'Raw report', icon: Code2 },
  ];

  return (
    <div ref={overlayRef} role="dialog" aria-modal="true" aria-labelledby="report-title" className="fixed inset-0 z-[10001] flex items-center justify-center overflow-y-auto bg-void/95 p-3 backdrop-blur-xl sm:p-6">
      <div className="sentinel-modal-panel my-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-white/15 bg-panel shadow-2xl sm:rounded-3xl">
        <header className={`border-b px-5 py-5 sm:px-7 ${style.border} ${style.bg}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3 sm:gap-4">
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${style.border} ${style.bg}`}>
                {severity === 'low' ? <Shield className={`h-5 w-5 ${style.text}`} /> : <ShieldAlert className={`h-5 w-5 ${style.text}`} />}
              </span>
              <div className="min-w-0">
                <p className={`font-mono text-xs font-bold uppercase tracking-wider ${style.text}`}>{style.label} · score {analysis.risk.score}/100</p>
                <h2 id="report-title" className="mt-1 font-display text-lg font-bold leading-snug text-white sm:text-xl">Review before MetaMask opens</h2>
                <p className="mt-1 font-display text-sm leading-relaxed text-slate-300">{analysis.risk.summary}</p>
              </div>
            </div>
            <div className="hidden shrink-0 text-right sm:block">
              <p className="font-mono text-[11px] uppercase text-slate-500">Fork block</p>
              <p className="font-mono text-sm text-slate-300">{analysis.simulation.fork_block || '—'}</p>
            </div>
          </div>
        </header>

        <nav className="flex overflow-x-auto border-b border-white/10 bg-void/45 px-3 sm:px-6" aria-label="Analysis report sections">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)} className={`flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-3 font-mono text-xs font-semibold transition sm:px-4 ${tab === id ? 'border-cyan text-cyan-glow' : 'border-transparent text-slate-400 hover:text-white'}`}>
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </nav>

        <div data-lenis-prevent className="max-h-[52vh] overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          {tab === 'overview' && (
            <div className="space-y-5">
              <section>
                <p className="font-mono text-xs uppercase tracking-wider text-slate-400">Decoded intent</p>
                <div className="mt-2 rounded-xl border border-white/10 bg-void/60 p-4">
                  <p className="font-display text-base font-bold text-white">{analysis.intent.title}</p>
                  <p className="mt-1 font-mono text-xs text-cyan-glow">{analysis.intent.function}</p>
                  <dl className="mt-4 grid gap-2 sm:grid-cols-2">
                    {Object.entries(analysis.intent.decoded_args).map(([key, value]) => (
                      <div key={key} className="rounded-lg border border-white/5 bg-panel/70 p-3">
                        <dt className="font-mono text-[11px] uppercase text-slate-500">{key.replace(/_/g, ' ')}</dt>
                        <dd className="mt-1 break-all font-mono text-xs text-slate-200">{printable(value)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </section>

              <section className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-void/50 p-3"><p className="font-mono text-[11px] uppercase text-slate-500">Simulation</p><p className="mt-1 font-display text-sm font-bold text-white">{analysis.simulation.status}</p></div>
                <div className="rounded-xl border border-white/10 bg-void/50 p-3"><p className="font-mono text-[11px] uppercase text-slate-500">Wallet method</p><p className="mt-1 font-mono text-xs text-white">{requestMethod}</p></div>
                <div className="rounded-xl border border-white/10 bg-void/50 p-3"><p className="font-mono text-[11px] uppercase text-slate-500">Gas used</p><p className="mt-1 font-mono text-xs text-white">{analysis.simulation.gas_used}</p></div>
              </section>

              {analysis.findings.length > 0 && <FindingRow finding={analysis.findings[0]} />}

              {analysis.drainer_matches.length > 0 && (
                <section className="rounded-xl border border-critical/30 bg-critical/10 p-4">
                  <p className="font-display text-sm font-bold text-white">Local demo database match</p>
                  <p className="mt-1 font-display text-sm text-slate-300">One or more independent target, selector, or bytecode criteria matched the small Sentinel Fork demonstration database.</p>
                  <pre className="mt-3 overflow-x-auto whitespace-pre-wrap font-mono text-xs text-critical">{printable(analysis.drainer_matches)}</pre>
                </section>
              )}

              {analysis.limitations.length > 0 && (
                <section>
                  <p className="font-mono text-xs uppercase tracking-wider text-slate-400">Limitations</p>
                  <ul className="mt-2 space-y-2">
                    {analysis.limitations.map((limitation) => <li key={limitation} className="flex gap-2 font-display text-sm leading-relaxed text-slate-300"><span className="text-high">•</span>{limitation}</li>)}
                  </ul>
                </section>
              )}
            </div>
          )}

          {tab === 'findings' && (
            <div className="space-y-3">
              {analysis.findings.length ? analysis.findings.map((finding, index) => <FindingRow key={`${finding.title}-${index}`} finding={finding} />) : <p className="font-display text-sm text-slate-300">No deterministic finding was produced. This is not a guarantee of safety.</p>}
            </div>
          )}

          {tab === 'changes' && (
            <div className="space-y-5">
              {totalChanges === 0 && <p className="font-display text-sm text-slate-300">The fork simulation observed no state changes. Review the decoded intent and limitations before deciding.</p>}
              <DiffSection title="Native balance" entries={analysis.state_diff.native} />
              <DiffSection title="ERC-20" entries={analysis.state_diff.erc20} />
              <DiffSection title="ERC-721" entries={analysis.state_diff.erc721} />
              <DiffSection title="ERC-1155" entries={analysis.state_diff.erc1155} />
              <DiffSection title="Approvals" entries={analysis.state_diff.approvals} />
            </div>
          )}

          {tab === 'raw' && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <p className="font-mono text-xs text-slate-400">Exact backend response</p>
                <button onClick={() => void copyReport()} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-xs text-slate-300 hover:bg-white/10">
                  {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4 text-cyan-glow" />}{copied ? 'Copied' : 'Copy JSON'}
                </button>
              </div>
              <pre className="max-h-80 overflow-auto whitespace-pre rounded-xl border border-white/10 bg-void/80 p-4 font-mono text-xs leading-relaxed text-cyan-glow/90">{JSON.stringify(analysis, null, 2)}</pre>
            </div>
          )}
        </div>

        <footer className="border-t border-white/10 bg-void/60 px-5 py-4 sm:px-7 sm:py-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <button ref={rejectRef} onClick={onReject} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-critical/35 bg-critical/10 px-5 font-display text-sm font-bold text-critical transition hover:bg-critical/20">
              <XCircle className="h-4 w-4" /> Reject — do not open wallet
            </button>
            <div className="flex flex-col gap-3 sm:items-end">
              {requiresAcknowledgement && (
                <label className="flex max-w-md cursor-pointer items-start gap-2 font-display text-sm leading-snug text-slate-300">
                  <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-cyan" />
                  I understand this request may grant access to assets in the selected test collection.
                </label>
              )}
              <button onClick={continueToWallet} disabled={!canContinue || forwarding} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-cyan px-5 font-display text-sm font-bold text-void transition hover:bg-cyan-glow disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-slate-500">
                {forwarding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                Continue to MetaMask
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
