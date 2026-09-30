const LOGOS = [
  'MetaMask', 'WalletConnect', 'OpenSea', 'Compound', 'Aave', 'Uniswap', 'Ledger', 'Coinbase',
];

const STATS = [
  '12,847 wallets protected',
  '3,201 malicious tx blocked',
  '0.4s average analysis',
  '99.2% detection rate',
];

export function SocialProofBar() {
  return (
    <section className="relative border-y border-white/5 bg-void-light py-8">
      <div className="mask-fade-x overflow-hidden">
        <div className="flex animate-scroll whitespace-nowrap">
          {[...LOGOS, ...LOGOS].map((logo, i) => (
            <span
              key={i}
              className="mx-8 font-display text-lg font-semibold text-slate-600 transition-colors hover:text-slate-400"
            >
              {logo}
            </span>
          ))}
        </div>
      </div>

      <div className="mask-fade-x mt-6 overflow-hidden">
        <div className="flex animate-scroll whitespace-nowrap" style={{ animationDelay: '-15s' }}>
          {[...STATS, ...STATS].map((stat, i) => (
            <span
              key={i}
              className="mx-8 font-mono text-sm text-slate-400"
            >
              <span className="text-cyan-glow">●</span> {stat}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
