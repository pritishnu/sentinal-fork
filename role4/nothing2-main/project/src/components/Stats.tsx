import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const STATS = [
  { value: 12847, label: 'Wallets protected', suffix: '' },
  { value: 3201, label: 'Malicious tx blocked', suffix: '' },
  { value: 0.4, label: 'Avg analysis time', suffix: 's' },
  { value: 99.2, label: 'Detection rate', suffix: '%' },
];

function StatCounter({ stat }: { stat: (typeof STATS)[number] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      el.textContent = `${stat.value}${stat.suffix}`;
      return;
    }

    const obj = { val: 0 };
    const tween = gsap.to(obj, {
      val: stat.value,
      duration: 2,
      ease: 'power2.out',
      snap: { val: stat.value % 1 === 0 ? 1 : 0.1 },
      onUpdate: () => {
        const display = stat.value % 1 === 0
          ? Math.floor(obj.val).toLocaleString()
          : obj.val.toFixed(1);
        el.textContent = `${display}${stat.suffix}`;
      },
      scrollTrigger: {
        trigger: el,
        start: 'top 85%',
        toggleActions: 'play none none none',
      },
    });

    return () => {
      tween.kill();
    };
  }, [stat]);

  return (
    <div className="text-center">
      <div
        ref={ref}
        className="font-display text-5xl font-extrabold tracking-tight text-ghost sm:text-6xl md:text-7xl"
      >
        0
      </div>
      <p className="mt-3 font-display text-sm text-slate-400">{stat.label}</p>
    </div>
  );
}

export function Stats() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <section className="px-6 py-20 sm:px-10 md:px-16">
      <div className="mx-auto max-w-5xl rounded-3xl border border-white/5 bg-panel/50 px-8 py-16">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {mounted && STATS.map((stat, i) => <StatCounter key={i} stat={stat} />)}
        </div>
      </div>
    </section>
  );
}
