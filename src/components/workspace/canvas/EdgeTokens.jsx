// EdgeTokens — the dots that travel along an edge while work is on it.
//
// Why this exists: before it, a step holding jobs showed a pill that breathed
// in place ("3 job", opacity 0.75 ↔ 1). A pill that pulses tells you a number;
// it doesn't tell you that work MOVES. The canvas is the product's claim — that
// a one-person company can see its business running — so movement along the
// path is the claim made visible.
//
// One rAF loop drives every dot on the canvas (not one per edge): with ≤30
// nodes that is ≤35 paths × 2 dots ≈ 70 getPointAtLength calls per frame,
// measured well under a millisecond. Path length is cached and only recomputed
// when the `d` string changes.
//
// Measurement uses hidden <path> elements this component owns, deliberately NOT
// the drawn ones: the drawn edges re-render on every layout change and holding
// refs into them would couple two lifecycles for no gain. Same coordinate
// space, so pan/zoom needs no compensation (the transform lives on the parent).
import React, { useEffect, useRef } from 'react';

const SPEED = 0.00016;   // fraction of path per ms — ~6s end to end
const DOTS_PER_EDGE = 2;

export default function EdgeTokens({ edges = [], color = 'var(--svc-primary)' }) {
  const pathRefs = useRef([]);
  const dotRefs = useRef([]);
  const raf = useRef(null);

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (reduce || edges.length === 0) return undefined;

    const lens = new Map();
    let last = performance.now();
    const phase = [];   // one phase per dot, spread so dots don't clump

    const tick = (now) => {
      const dt = Math.min(64, now - last);   // a backgrounded tab must not jump
      last = now;
      let d = 0;
      for (let e = 0; e < edges.length; e += 1) {
        const p = pathRefs.current[e];
        if (!p) { d += DOTS_PER_EDGE; continue; }
        let len = lens.get(p);
        if (len == null) { len = p.getTotalLength(); lens.set(p, len); }
        for (let k = 0; k < DOTS_PER_EDGE; k += 1, d += 1) {
          if (phase[d] == null) phase[d] = k / DOTS_PER_EDGE;
          phase[d] = (phase[d] + SPEED * dt) % 1;
          const dot = dotRefs.current[d];
          if (!dot || !len) continue;
          const pt = p.getPointAtLength(phase[d] * len);
          dot.setAttribute('cx', pt.x);
          dot.setAttribute('cy', pt.y);
          dot.setAttribute('opacity', '0.95');
        }
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
    // edges.length + the joined `d` strings: same geometry → same loop.
  }, [edges.length, edges.map((e) => e.d).join('|')]);

  if (!edges.length) return null;

  return (
    <g pointerEvents="none" aria-hidden="true">
      {edges.map((e, i) => (
        <path key={`m${e.key || i}`} d={e.d} fill="none" stroke="none"
          ref={(el) => { pathRefs.current[i] = el; }} />
      ))}
      {edges.flatMap((e, i) =>
        Array.from({ length: DOTS_PER_EDGE }, (_, k) => (
          <circle key={`d${e.key || i}-${k}`} r="4.5" fill={color} opacity="0"
            ref={(el) => { dotRefs.current[i * DOTS_PER_EDGE + k] = el; }} />
        ))
      )}
    </g>
  );
}
