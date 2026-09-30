import { useCustomCursor } from '@/hooks/useCustomCursor';

export function CustomCursor() {
  const { dotRef, ringRef } = useCustomCursor();

  return (
    <>
      <div
        ref={dotRef}
        className="pointer-events-none fixed left-0 top-0 z-[99999] h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-glow transition-transform duration-150"
        style={{ willChange: 'transform, left, top' }}
      />
      <div
        ref={ringRef}
        className="pointer-events-none fixed left-0 top-0 z-[99999] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan/40 transition-[width,height] duration-200"
        style={{ willChange: 'transform, left, top, width, height', width: '32px', height: '32px' }}
      />
    </>
  );
}
