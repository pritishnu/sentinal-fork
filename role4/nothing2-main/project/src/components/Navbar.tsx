import { useEffect, useState } from 'react';
import { Shield } from 'lucide-react';

const NAV_LINKS = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Evidence', href: '#testimonials' },
  { label: 'FAQ', href: '#faq' },
];

export function Navbar({ onLaunchDemo }: { onLaunchDemo: () => void }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className="fixed left-1/2 top-6 z-50 -translate-x-1/2 px-4">
      <div
        className={`flex items-center gap-2 rounded-full px-3 py-2 transition-all duration-400 ease-out sm:gap-4 sm:px-4 ${
          scrolled
            ? 'border border-white/10 bg-void/70 backdrop-blur-xl'
            : 'border border-transparent bg-transparent'
        }`}
      >
        <a href="#" className="flex items-center gap-2 pl-1">
          <Shield className="h-5 w-5 text-cyan-glow" strokeWidth={2} />
          <span className="font-display text-sm font-bold tracking-tight text-ghost">
            Sentinel Fork
          </span>
        </a>

        <div className="hidden items-center gap-5 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="font-display text-sm text-slate-400 transition-colors hover:text-ghost"
            >
              {link.label}
            </a>
          ))}
        </div>

        <button
          onClick={onLaunchDemo}
          className="rounded-full bg-cyan px-4 py-1.5 font-display text-sm font-semibold text-void transition-all hover:bg-cyan-glow hover:shadow-[0_0_20px_rgba(6,182,212,0.5)]"
        >
          Launch Demo
        </button>
      </div>
    </nav>
  );
}
