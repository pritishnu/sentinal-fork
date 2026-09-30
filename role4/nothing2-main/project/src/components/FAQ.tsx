import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const FAQS = [
  {
    q: 'Does Sentinel Fork have access to my private keys?',
    a: 'No. Sentinel Fork never touches your keys. It intercepts the unsigned transaction payload — the data you would sign — and simulates it in a forked environment. Your private keys remain in your wallet, untouched.',
  },
  {
    q: 'Can it analyze any type of transaction?',
    a: 'The demo backend covers native ETH, common ERC-20 and ERC-721 operations, plus selected ERC-1155 and signature intents. Unknown calldata and unobserved state are shown as limitations, never treated as proof of safety.',
  },
  {
    q: 'How fast is the analysis?',
    a: 'Analysis time depends on the Sepolia RPC and the local Anvil fork. The original wallet request stays paused for the entire analysis, so MetaMask opens only after the report and your decision.',
  },
  {
    q: 'What happens if I choose to continue despite a warning?',
    a: 'Your decision is yours. Sentinel Fork presents the evidence and makes the safe path easy, but it never blocks you. If you acknowledge the risk and choose to continue, the original unsigned request is forwarded to your wallet exactly as it was.',
  },
  {
    q: 'Is this a replacement for hardware wallets?',
    a: 'No. Sentinel Fork is complementary. Hardware wallets protect your keys — Sentinel Fork protects your judgment. The most sophisticated attack today tricks you into signing a transaction that looks safe but drains your assets.',
  },
  {
    q: 'Does the demo use real funds?',
    a: 'No. The live demo runs entirely on the Sepolia testnet. No real Ethereum, no real tokens, no real risk. You can safely trigger the risky approval and see exactly how Sentinel Fork responds.',
  },
];

function FAQItem({ faq }: { faq: (typeof FAQS)[number] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="faq-item border-b border-white/5">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-6 text-left"
      >
        <span className="font-display text-base font-semibold text-ghost sm:text-lg">
          {faq.q}
        </span>
        <Plus
          className={`h-5 w-5 shrink-0 text-cyan-glow transition-transform duration-300 ${
            open ? 'rotate-45' : ''
          }`}
        />
      </button>
      <div
        className="overflow-hidden transition-all duration-300 ease-out"
        style={{ maxHeight: open ? '300px' : '0px' }}
      >
        <p className="pb-6 pr-10 font-display text-sm leading-relaxed text-slate-400">
          {faq.a}
        </p>
      </div>
    </div>
  );
}

export function FAQ() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    const ctx = gsap.context(() => {
      gsap.from('.faq-item', {
        opacity: 0,
        y: 30,
        duration: 0.5,
        ease: 'power3.out',
        stagger: 0.08,
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 75%',
          toggleActions: 'play none none none',
        },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section id="faq" ref={sectionRef} className="px-6 py-24 sm:px-10 md:py-32 md:px-16">
      <div className="mx-auto max-w-3xl">
        <div className="mb-12">
          <p className="font-mono text-sm text-cyan-glow">// questions</p>
          <h2 className="mt-3 font-display text-4xl font-bold tracking-tight text-ghost sm:text-5xl">
            What you're
            <br />
            probably wondering
          </h2>
        </div>

        <div>
          {FAQS.map((faq, i) => (
            <FAQItem key={i} faq={faq} />
          ))}
        </div>
      </div>
    </section>
  );
}
