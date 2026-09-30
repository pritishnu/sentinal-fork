import { Shield, Github, Twitter, MessageCircle } from 'lucide-react';

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="rounded-t-[3.5rem] bg-void-light px-6 pt-20 pb-10 sm:px-10 md:px-16">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-12 md:grid-cols-4">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-cyan-glow" />
              <span className="font-display text-lg font-bold text-ghost">Sentinel Fork</span>
            </div>
            <p className="mt-4 font-display text-sm leading-relaxed text-slate-400">
              Transaction security that sees what your wallet can't.
            </p>
          </div>

          <div>
            <h4 className="font-mono text-xs uppercase tracking-wider text-slate-600">Product</h4>
            <ul className="mt-4 space-y-3">
              <li><a href="#how-it-works" className="font-display text-sm text-slate-400 hover:text-ghost transition-colors">How it works</a></li>
              <li><a href="#testimonials" className="font-display text-sm text-slate-400 hover:text-ghost transition-colors">Evidence</a></li>
              <li><a href="#faq" className="font-display text-sm text-slate-400 hover:text-ghost transition-colors">FAQ</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-mono text-xs uppercase tracking-wider text-slate-600">Resources</h4>
            <ul className="mt-4 space-y-3">
              <li><a href="#" className="font-display text-sm text-slate-400 hover:text-ghost transition-colors">Documentation</a></li>
              <li><a href="#" className="font-display text-sm text-slate-400 hover:text-ghost transition-colors">API reference</a></li>
              <li><a href="#" className="font-display text-sm text-slate-400 hover:text-ghost transition-colors">Drainer database</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-mono text-xs uppercase tracking-wider text-slate-600">Connect</h4>
            <div className="mt-4 flex gap-3">
              <a href="#" className="rounded-full border border-white/10 p-2.5 text-slate-400 transition-all hover:border-cyan/30 hover:text-ghost" aria-label="GitHub">
                <Github className="h-4 w-4" />
              </a>
              <a href="#" className="rounded-full border border-white/10 p-2.5 text-slate-400 transition-all hover:border-cyan/30 hover:text-ghost" aria-label="Twitter">
                <Twitter className="h-4 w-4" />
              </a>
              <a href="#" className="rounded-full border border-white/10 p-2.5 text-slate-400 transition-all hover:border-cyan/30 hover:text-ghost" aria-label="Discord">
                <MessageCircle className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-16 flex flex-col items-start justify-between gap-4 border-t border-white/5 pt-8 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse-dot rounded-full bg-green-400" />
            <span className="font-mono text-xs text-slate-400">System operational</span>
          </div>
          <p className="font-mono text-xs text-slate-600">
            © {year} Sentinel Fork — Sepolia safety demonstration
          </p>
        </div>
      </div>
    </footer>
  );
}
