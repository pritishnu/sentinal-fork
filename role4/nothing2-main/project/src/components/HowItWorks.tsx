import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const STEPS = [
  {
    num: '01',
    title: 'Intercept',
    desc: 'The extension captures your transaction before it reaches MetaMask — no signature leaves your device yet.',
  },
  {
    num: '02',
    title: 'Fork & simulate',
    desc: 'Sentinel forks the chain at the current block and executes your transaction in an isolated sandbox.',
  },
  {
    num: '03',
    title: 'Report & decide',
    desc: 'You see every state change, every approval, every risk. You choose to reject or continue with full knowledge.',
  },
];

export function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    const ctx = gsap.context(() => {
      gsap.from('.step-card', {
        opacity: 0,
        y: 50,
        duration: 0.7,
        ease: 'power3.out',
        stagger: 0.2,
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 70%',
          toggleActions: 'play none none none',
        },
      });

      // Animate connecting line
      const line = sectionRef.current?.querySelector('.connecting-line path');
      if (line) {
        const length = (line as SVGPathElement).getTotalLength();
        gsap.fromTo(
          line,
          { strokeDashoffset: length, strokeDasharray: length },
          {
            strokeDashoffset: 0,
            duration: 2,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: sectionRef.current,
              start: 'top 60%',
              toggleActions: 'play none none none',
            },
          }
        );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section id="how-it-works" ref={sectionRef} className="relative px-6 py-24 sm:px-10 md:py-32 md:px-16">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 max-w-2xl">
          <p className="font-mono text-sm text-cyan-glow">// the process</p>
          <h2 className="mt-3 font-display text-4xl font-bold tracking-tight text-ghost sm:text-5xl">
            From click to clarity
            <br />
            in under a second
          </h2>
        </div>

        <div className="relative">
          {/* Connecting line */}
          <svg
            className="connecting-line absolute left-0 top-20 hidden w-full md:block"
            height="2"
            style={{ overflow: 'visible' }}
          >
            <path
              d="M 100 1 L 90% 1"
              fill="none"
              stroke="#7C3AED"
              strokeWidth="2"
              strokeDasharray="8 8"
              opacity="0.4"
            />
          </svg>

          <div className="grid gap-12 md:grid-cols-3 md:gap-8">
            {STEPS.map((step) => (
              <div key={step.num} className="step-card relative">
                <span className="font-mono text-6xl font-bold text-plasma/30">{step.num}</span>
                <h3 className="mt-4 font-display text-xl font-bold text-ghost">{step.title}</h3>
                <p className="mt-3 font-display text-sm leading-relaxed text-slate-400">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
