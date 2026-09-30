import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// Card 1 — Diagnostic Shuffler
function DiagnosticShuffler() {
  const items = [
    { label: 'setApprovalForAll', status: 'RISKY', statusColor: 'text-critical' },
    { label: 'transferFrom', status: 'WARNING', statusColor: 'text-high' },
    { label: 'ETH transfer', status: 'SAFE', statusColor: 'text-green-400' },
    { label: 'ERC20 approve', status: 'CHECK', statusColor: 'text-low' },
    { label: 'NFT mint', status: 'SAFE', statusColor: 'text-green-400' },
  ];

  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setOffset((prev) => prev + 1);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const visible = [0, 1, 2].map((i) => items[(offset + i) % items.length]);

  return (
    <div className="space-y-3">
      {visible.map((item, i) => (
        <div
          key={`${offset}-${i}`}
          className="perspective-800 flex items-center justify-between rounded-lg border border-white/5 bg-void/50 px-4 py-3"
          style={{
            animation: i === 0 ? 'flipIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none',
            opacity: i === 0 ? 1 : 1 - i * 0.25,
          }}
        >
          <span className="font-mono text-sm text-ghost">{item.label}</span>
          <span className={`font-mono text-xs font-semibold ${item.statusColor}`}>{item.status}</span>
        </div>
      ))}
      <style>{`
        @keyframes flipIn {
          0% { transform: rotateX(20deg); opacity: 0; }
          100% { transform: rotateX(0deg); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// Card 2 — Telemetry Typewriter
function TelemetryTypewriter() {
  const messages = [
    '> Scanning transaction calldata...',
    '> Detected: setApprovalForAll(target, true)',
    '> Forking chain at block #5,842,103',
    '> Simulating state changes...',
    '> ALERT: unrestricted token approval',
    '> Cross-referencing known drainer DB...',
    '> Match found: 0x84a2... (72% conf)',
    '> Report generated. Awaiting review.',
  ];

  const [currentMsg, setCurrentMsg] = useState('');
  const [msgIndex, setMsgIndex] = useState(0);
  const [scrambling, setScrambling] = useState(false);

  useEffect(() => {
    let charIdx = 0;
    let scrambleTimeout: ReturnType<typeof setTimeout>;
    let typeInterval: ReturnType<typeof setInterval>;

    const startTyping = () => {
      const msg = messages[msgIndex];
      typeInterval = setInterval(() => {
        if (charIdx < msg.length) {
          setCurrentMsg(msg.substring(0, charIdx + 1));
          charIdx++;
        } else {
          clearInterval(typeInterval);
          scrambleTimeout = setTimeout(() => {
            setScrambling(true);
            let scrambleCount = 0;
            const scrambleInterval = setInterval(() => {
              setCurrentMsg(
                Array.from({ length: messages[(msgIndex + 1) % messages.length].length }, () =>
                  'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#[~'[Math.floor(Math.random() * 37)]
                ).join('')
              );
              scrambleCount++;
              if (scrambleCount > 10) {
                clearInterval(scrambleInterval);
                setScrambling(false);
                setMsgIndex((prev) => (prev + 1) % messages.length);
                setCurrentMsg('');
                charIdx = 0;
                startTyping();
              }
            }, 40);
          }, 1500);
        }
      }, 35);
    };

    startTyping();

    return () => {
      clearInterval(typeInterval);
      clearTimeout(scrambleTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgIndex]);

  return (
    <div className="rounded-lg border border-white/5 bg-void/50 p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="h-2 w-2 animate-pulse-dot rounded-full bg-critical" />
        <span className="font-mono text-xs text-critical">LIVE</span>
      </div>
      <p className={`font-mono text-sm leading-relaxed ${scrambling ? 'text-high' : 'text-cyan-glow'}`}>
        {currentMsg}
        <span className="ml-0.5 inline-block animate-pulse text-ghost">|</span>
      </p>
    </div>
  );
}

// Card 3 — Signal Graph
function SignalGraph() {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const path = svg.querySelector('path');
    if (!path) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    const length = path.getTotalLength();
    path.style.strokeDasharray = `${length}`;
    path.style.strokeDashoffset = `${length}`;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          path.style.transition = 'stroke-dashoffset 2.5s ease-in-out';
          path.style.strokeDashoffset = '0';
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(svg);

    return () => observer.disconnect();
  }, []);

  const points = [12, 28, 20, 45, 38, 62, 55, 78, 72, 88, 95];
  const maxVal = 100;
  const width = 280;
  const height = 120;
  const stepX = width / (points.length - 1);

  const pathD = points
    .map((p, i) => {
      const x = i * stepX;
      const y = height - (p / maxVal) * height;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  const areaD = `${pathD} L ${width} ${height} L 0 ${height} Z`;

  return (
    <div className="rounded-lg border border-white/5 bg-void/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-xs text-slate-400">detection_confidence</span>
        <span className="font-mono text-xs text-cyan-glow">99.2%</span>
      </div>
      <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="graphFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#06B6D4" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#graphFill)" />
        <path
          d={pathD}
          fill="none"
          stroke="#06B6D4"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={i * stepX}
            cy={height - (p / maxVal) * height}
            r="3"
            fill="#06B6D4"
            className="animate-pulse-dot"
            style={{ animationDelay: `${i * 0.15}s` }}
          >
            <title>{`Block ${5800000 + i * 210}: ${p}% confidence`}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}

const FEATURES = [
  {
    title: 'Pre-signature simulation',
    desc: 'Every transaction is forked and executed in a sandbox before it ever reaches your wallet.',
    component: <DiagnosticShuffler />,
  },
  {
    title: 'Real-time threat analysis',
    desc: 'Calldata is decoded, state changes are tracked, and risky patterns are flagged instantly.',
    component: <TelemetryTypewriter />,
  },
  {
    title: 'Confidence-scored detection',
    desc: 'A continuously improving model scores every interaction against known drainer signatures.',
    component: <SignalGraph />,
  },
];

export function Features() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    const ctx = gsap.context(() => {
      gsap.from('.feature-card', {
        opacity: 0,
        y: 60,
        duration: 0.8,
        ease: 'power3.out',
        stagger: 0.15,
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
    <section ref={sectionRef} className="relative px-6 py-24 sm:px-10 md:py-32 md:px-16">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 max-w-2xl">
          <p className="font-mono text-sm text-cyan-glow">// capabilities</p>
          <h2 className="mt-3 font-display text-4xl font-bold tracking-tight text-ghost sm:text-5xl">
            Three layers between
            <br />
            you and the drain
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {FEATURES.map((feature, i) => (
            <div
              key={i}
              className="feature-card group rounded-[2rem] border border-white/10 bg-panel p-6 shadow-xl transition-all hover:border-cyan/20 hover:shadow-[0_0_40px_rgba(6,182,212,0.1)]"
            >
              <div className="mb-5">
                <h3 className="font-display text-lg font-bold text-ghost">{feature.title}</h3>
                <p className="mt-2 font-display text-sm leading-relaxed text-slate-400">
                  {feature.desc}
                </p>
              </div>
              <div className="mt-6">{feature.component}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
