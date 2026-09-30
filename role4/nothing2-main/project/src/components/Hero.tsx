import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { HeroCanvas } from './HeroCanvas';

export function Hero({ onLaunchDemo }: { onLaunchDemo: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ delay: 0.5 });
      tl.from('.hero-line-1', { opacity: 0, y: 50, duration: 1, ease: 'power3.out' })
        .from(
          '.hero-line-2',
          { opacity: 0, y: 50, duration: 1, ease: 'power3.out' },
          '-=0.7'
        )
        .from(
          '.hero-desc',
          { opacity: 0, y: 30, duration: 0.8, ease: 'power3.out' },
          '-=0.6'
        )
        .from(
          '.hero-cta',
          { opacity: 0, y: 30, duration: 0.8, ease: 'power3.out' },
          '-=0.5'
        )
        .from(
          '.hero-meta',
          { opacity: 0, y: 20, duration: 0.6, ease: 'power3.out' },
          '-=0.4'
        );
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={containerRef} className="relative flex min-h-[100dvh] flex-col justify-end overflow-hidden">
      <HeroCanvas />

      <div className="absolute inset-0 bg-gradient-to-t from-void via-void/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-br from-plasma/10 via-transparent to-cyan/5" />

      <div className="relative z-10 flex items-end px-6 pb-20 pl-6 sm:pl-10 md:pl-16">
        <div className="max-w-3xl">
          <p className="hero-line-1 font-display text-lg font-semibold tracking-wide text-cyan-glow">
            SENTINEL FORK
          </p>

          <h1 className="hero-line-2 mt-3 font-display text-5xl font-extrabold leading-[0.95] tracking-tight text-ghost sm:text-7xl md:text-8xl">
            See what your
            <br />
            wallet <span className="font-serif italic text-cyan-glow">can't</span>
          </h1>

          <p className="hero-desc mt-6 max-w-md font-display text-base leading-relaxed text-slate-400 sm:text-lg">
            Sentinel Fork simulates every transaction in a private fork before it reaches your wallet.
            You see exactly what changes — before you sign.
          </p>

          <div className="hero-cta mt-8 flex flex-wrap items-center gap-4">
            <button
              onClick={onLaunchDemo}
              className="rounded-full bg-cyan px-7 py-3.5 font-display text-sm font-bold text-void transition-all hover:bg-cyan-glow hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] hover:scale-[1.02]"
            >
              Try the live demo
            </button>
            <a
              href="#how-it-works"
              className="font-display text-sm font-medium text-slate-400 transition-colors hover:text-ghost"
            >
              See how it works →
            </a>
          </div>

          <div className="hero-meta mt-12 flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse-dot rounded-full bg-green-400" />
              <span className="font-mono text-xs text-slate-400">Sepolia testnet — no real funds at risk</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
