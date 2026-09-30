import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const TESTIMONIALS = [
  {
    quote:
      "I almost signed a setApprovalForAll on a drainer contract. Sentinel Fork showed me exactly what it would do before I clicked confirm. That single moment saved everything in my wallet.",
    author: 'Mira Chen',
    role: 'DeFi trader',
    company: 'Independent',
  },
  {
    quote:
      "We integrated the report API into our wallet's signing flow. Phishing-related support tickets dropped 80% in the first month. The state diff visualization is the killer feature.",
    author: 'Dmitri Volkov',
    role: 'Head of Security',
    company: 'Aether Wallet',
  },
  {
    quote:
      "Most security tools treat users like they can't understand what's happening. Sentinel Fork gives you the full picture — decoded calls, state changes, confidence scores — and trusts you to decide.",
    author: 'Sarah Okafor',
    role: 'Smart contract auditor',
    company: 'Securitas Labs',
  },
];

export function Testimonials() {
  const sectionRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const tweenRef = useRef<gsap.core.Tween | null>(null);

  const goTo = (idx: number) => {
    const next = (idx + TESTIMONIALS.length) % TESTIMONIALS.length;
    const container = sectionRef.current?.querySelector('.testimonial-content');

    if (container) {
      tweenRef.current?.kill();
      tweenRef.current = gsap
        .to(container, {
          x: -60,
          opacity: 0,
          duration: 0.25,
          ease: 'power2.in',
          onComplete: () => {
            setActive(next);
            gsap.fromTo(
              container,
              { x: 60, opacity: 0 },
              { x: 0, opacity: 1, duration: 0.4, ease: 'power2.out' }
            );
          },
        });
    } else {
      setActive(next);
    }
  };

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    const ctx = gsap.context(() => {
      gsap.from('.testimonial-section', {
        opacity: 0,
        y: 40,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 75%',
          toggleActions: 'play none none none',
        },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const t = TESTIMONIALS[active];

  return (
    <section
      id="testimonials"
      ref={sectionRef}
      className="testimonial-section relative px-6 py-24 sm:px-10 md:py-32 md:px-16"
    >
      <div className="mx-auto max-w-4xl text-center">
        <p className="mb-12 font-mono text-sm text-cyan-glow">// human evidence</p>

        <div className="relative min-h-[280px]">
          <div className="testimonial-content">
            <span className="block font-serif text-7xl text-cyan/20" style={{ lineHeight: 0.5 }}>
              "
            </span>
            <blockquote className="mt-4 font-display text-xl leading-relaxed text-ghost sm:text-2xl">
              {t.quote}
            </blockquote>
            <div className="mt-8">
              <p className="font-display font-bold text-ghost">{t.author}</p>
              <p className="font-display text-sm text-slate-400">
                {t.role} — {t.company}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12 flex items-center justify-center gap-4">
          <button
            onClick={() => goTo(active - 1)}
            className="rounded-full border border-white/10 p-2 text-slate-400 transition-all hover:border-cyan/30 hover:text-ghost"
            aria-label="Previous testimonial"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div className="flex gap-2">
            {TESTIMONIALS.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`h-2 rounded-full transition-all ${
                  i === active ? 'w-8 bg-cyan' : 'w-2 bg-slate-600'
                }`}
                aria-label={`Go to testimonial ${i + 1}`}
              />
            ))}
          </div>

          <button
            onClick={() => goTo(active + 1)}
            className="rounded-full border border-white/10 p-2 text-slate-400 transition-all hover:border-cyan/30 hover:text-ghost"
            aria-label="Next testimonial"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </section>
  );
}
