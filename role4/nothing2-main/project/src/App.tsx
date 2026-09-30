import { useEffect, useRef, useState } from 'react';
import { useSmoothScroll } from '@/hooks/useSmoothScroll';
import { CustomCursor } from '@/components/CustomCursor';
import { Navbar } from '@/components/Navbar';
import { Hero } from '@/components/Hero';
import { SocialProofBar } from '@/components/SocialProofBar';
import { Features } from '@/components/Features';
import { HowItWorks } from '@/components/HowItWorks';
import { Stats } from '@/components/Stats';
import { Testimonials } from '@/components/Testimonials';
import { FAQ } from '@/components/FAQ';
import { FinalCTA } from '@/components/FinalCTA';
import { Footer } from '@/components/Footer';
import { DemoPanel } from '@/components/DemoPanel';
import { ReportModal } from '@/components/ReportModal';
import type { SentinelDecisionDetail } from '@/provider-wrapper';

type View = 'landing' | 'demo';

function App() {
  const [view, setView] = useState<View>('landing');
  const [pendingDecision, setPendingDecision] = useState<SentinelDecisionDetail | null>(null);
  const pendingRef = useRef<SentinelDecisionDetail | null>(null);

  useSmoothScroll();

  useEffect(() => {
    const handleDecision = (event: Event) => {
      const detail = (event as CustomEvent<SentinelDecisionDetail>).detail;
      pendingRef.current?.reject();
      pendingRef.current = detail;
      setPendingDecision(detail);
    };
    window.addEventListener('sentinel:decision-required', handleDecision);
    return () => {
      window.removeEventListener('sentinel:decision-required', handleDecision);
      pendingRef.current?.reject();
      pendingRef.current = null;
    };
  }, []);

  const resolveDecision = (approved: boolean) => {
    const decision = pendingRef.current;
    pendingRef.current = null;
    setPendingDecision(null);
    if (approved) decision?.approve();
    else decision?.reject();
  };

  const showDemo = () => {
    setView('demo');
    window.scrollTo({ top: 0 });
  };

  const showOverview = () => {
    setView('landing');
    window.scrollTo({ top: 0 });
  };

  return (
    <>
      <CustomCursor />
      {view === 'landing' ? (
        <>
          <Navbar onLaunchDemo={showDemo} />
          <Hero onLaunchDemo={showDemo} />
          <SocialProofBar />
          <Features />
          <HowItWorks />
          <Stats />
          <Testimonials />
          <FAQ />
          <FinalCTA onLaunchDemo={showDemo} />
          <Footer />
        </>
      ) : (
        <DemoPanel onShowOverview={showOverview} modalVisible={Boolean(pendingDecision)} />
      )}

      {pendingDecision && (
        <ReportModal
          analysis={pendingDecision.analysis}
          requestMethod={pendingDecision.method}
          onReject={() => resolveDecision(false)}
          onContinue={() => resolveDecision(true)}
        />
      )}
    </>
  );
}

export default App;
