import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function FinalCTA({ onLaunchDemo }: { onLaunchDemo: () => void }) {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    const ctx = gsap.context(() => {
      gsap.from('.cta-content', {
        scale: 0.95,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 70%',
          toggleActions: 'play none none none',
        },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="px-6 py-24 sm:px-10 md:px-16">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-plasma via-plasma to-cyan p-1">
        <div className="cta-content rounded-[2.4rem] bg-void px-8 py-20 text-center sm:px-16 md:py-28">
          <h2 className="font-display text-4xl font-extrabold tracking-tight text-ghost sm:text-6xl">
            Stop signing
            <br />
            <span className="font-serif italic text-cyan-glow">blind</span>
          </h2>
          <p className="mx-auto mt-6 max-w-md font-display text-base text-slate-400 sm:text-lg">
            Run the Sepolia demo. Trigger a risky approval. Watch Sentinel Fork catch it in real time.
          </p>
          <button
            onClick={onLaunchDemo}
            className="mt-10 rounded-full bg-ghost px-8 py-4 font-display text-sm font-bold text-void transition-all hover:bg-white hover:shadow-[0_0_40px_rgba(240,238,248,0.3)] hover:scale-[1.02]"
          >
            Launch the demo
          </button>
        </div>
      </div>
    </section>
  );
}
