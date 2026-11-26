// RehearseRunner — the practice job, walking the flow one edge at a time.
//
// Replaces a 700ms setInterval that teleported a highlight from step to step.
// The old version answered "which step is it on"; this one answers "how does
// work move through my business", which is the thing a provider has never been
// shown anywhere else. It is also the moment the canvas earns its place as the
// product's front page, so it is allowed to be a small piece of cinema:
// the runner travels the real edge geometry, each step lights as the runner
// lands, and the lit steps stay lit — the trail IS the journey.
//
// Reduced motion: no travel, no confetti. The path still lights step by step on
// a timer so the feature still explains itself; it just stops moving.
import { useEffect, useRef } from 'react';

const HOP_MS = 620;
const LAND_MS = 130;

export default function RehearseRunner({ steps = [], color, onStep, onDone }) {
  const groupRef = useRef(null);
  const dotRef = useRef(null);
  const cbs = useRef({ onStep, onDone });
  cbs.current = { onStep, onDone };
  // The parent rebuilds `steps` every render (it is derived from layout), so
  // the effect keys off the GEOMETRY, not the array identity. Keying off the
  // array would restart the run on every re-render — and each step callback
  // causes one, so the job would never leave the first edge.
  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const geomKey = steps.map((s) => s.dTo || '·').join('|');

  useEffect(() => {
    const plan = stepsRef.current;
    if (!plan.length) return undefined;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    let raf = null;
    let timer = null;
    let cancelled = false;

    cbs.current.onStep?.(0);

    if (reduce) {
      let i = 0;
      timer = setInterval(() => {
        i += 1;
        if (i >= plan.length) { clearInterval(timer); cbs.current.onDone?.(); return; }
        cbs.current.onStep?.(i);
      }, 420);
      return () => clearInterval(timer);
    }

    const measure = document.createElementNS('http://www.w3.org/2000/svg', 'path');

    const hop = (i) => {
      if (cancelled) return;
      if (i >= plan.length - 1) { cbs.current.onDone?.(); return; }
      const d = plan[i].dTo;
      if (!d) { cbs.current.onStep?.(i + 1); timer = setTimeout(() => hop(i + 1), LAND_MS); return; }
      measure.setAttribute('d', d);
      const len = measure.getTotalLength();
      const t0 = performance.now();
      const frame = (now) => {
        if (cancelled) return;
        const k = Math.min(1, (now - t0) / HOP_MS);
        // easeInOutQuad — leaves and arrives calmly, moves quickly in between
        const e = k < 0.5 ? 2 * k * k : 1 - ((-2 * k + 2) ** 2) / 2;
        const pt = measure.getPointAtLength(e * len);
        if (dotRef.current) {
          dotRef.current.setAttribute('cx', pt.x);
          dotRef.current.setAttribute('cy', pt.y);
          dotRef.current.setAttribute('opacity', '1');
        }
        if (k < 1) { raf = requestAnimationFrame(frame); }
        else {
          cbs.current.onStep?.(i + 1);
          timer = setTimeout(() => hop(i + 1), LAND_MS);
        }
      };
      raf = requestAnimationFrame(frame);
    };
    hop(0);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      clearInterval(timer);
    };
  }, [geomKey]);

  if (!steps.length) return null;
  return (
    <g ref={groupRef} pointerEvents="none" aria-hidden="true">
      <circle ref={dotRef} r="8" fill={color} opacity="0"
        style={{ filter: 'drop-shadow(0 0 9px color-mix(in srgb, var(--svc-primary) 60%, transparent))' }} />
    </g>
  );
}
