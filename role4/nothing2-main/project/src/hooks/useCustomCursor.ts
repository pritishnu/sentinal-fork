import { useEffect, useRef } from 'react';

export function useCustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return;

    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let ringX = mouseX;
    let ringY = mouseY;
    let rafId: number;

    const syncExtensionOverlay = () => {
      const hidden = Boolean(document.getElementById('sentinel-fork-extension-root'));
      dot.style.visibility = hidden ? 'hidden' : 'visible';
      ring.style.visibility = hidden ? 'hidden' : 'visible';
    };
    const overlayObserver = new MutationObserver(syncExtensionOverlay);
    overlayObserver.observe(document.documentElement, { childList: true });
    syncExtensionOverlay();

    const onMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      dot.style.left = `${mouseX}px`;
      dot.style.top = `${mouseY}px`;
      if (document.getElementById('sentinel-fork-extension-root')) return;

      const target = e.target as HTMLElement;
      if (target.closest('button, a, [data-cursor="hover"]')) {
        ring.style.width = '60px';
        ring.style.height = '60px';
        ring.style.mixBlendMode = 'exclusion';
      } else if (target.closest('p, h1, h2, h3, span, [data-cursor="text"]')) {
        ring.style.width = '4px';
        ring.style.height = '4px';
        ring.style.mixBlendMode = 'normal';
      } else {
        ring.style.width = '32px';
        ring.style.height = '32px';
        ring.style.mixBlendMode = 'normal';
      }
    };

    const onDown = () => {
      dot.style.transform = 'translate(-50%, -50%) scale(0.6)';
    };
    const onUp = () => {
      dot.style.transform = 'translate(-50%, -50%) scale(1)';
    };

    const animate = () => {
      ringX += (mouseX - ringX) * 0.12;
      ringY += (mouseY - ringY) * 0.12;
      ring.style.left = `${ringX}px`;
      ring.style.top = `${ringY}px`;
      rafId = requestAnimationFrame(animate);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    animate();

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      cancelAnimationFrame(rafId);
      overlayObserver.disconnect();
    };
  }, []);

  return { dotRef, ringRef };
}
