// canvas-kit/usePanZoom — pan (pointer-drag on empty ground) + zoom (wheel /
// pinch-trackpad) for a full-bleed canvas. Extracted as the first piece of the
// shared canvas-kit (Workspace OS remaster Phase 1). Headless: the caller
// renders a viewport div + a world div and spreads the returned props.
//
//   const pz = usePanZoom({ min: 0.4, max: 1.6 });
//   <div {...pz.viewportProps} style={{ position:'absolute', inset:0 }}>
//     <div style={{ transform: pz.transform, transformOrigin: '0 0' }}>…</div>
//   </div>
//
// Pointer-drag starts ONLY when the event target is the viewport/world ground
// (callers mark interactive children with data-canvas-item so dragging a node
// never pans). Wheel zooms toward the cursor.
import { useCallback, useRef, useState } from 'react';

export function usePanZoom({ min = 0.4, max = 1.8, initial = { x: 0, y: 0, z: 1 } } = {}) {
  const [view, setView] = useState(initial);
  const drag = useRef(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  const isGround = (e) => !e.target.closest('[data-canvas-item]');

  const onPointerDown = useCallback((e) => {
    if (e.button !== 0 || !isGround(e)) return;
    drag.current = { sx: e.clientX, sy: e.clientY, ox: viewRef.current.x, oy: viewRef.current.y };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e) => {
    if (!drag.current) return;
    const { sx, sy, ox, oy } = drag.current;
    setView((v) => ({ ...v, x: ox + e.clientX - sx, y: oy + e.clientY - sy }));
  }, []);

  const endDrag = useCallback(() => { drag.current = null; }, []);

  const onWheel = useCallback((e) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left, py = e.clientY - rect.top;
    setView((v) => {
      const z = Math.min(max, Math.max(min, v.z * Math.exp(-e.deltaY * 0.0015)));
      if (z === v.z) return v;
      // keep the point under the cursor fixed while zooming
      const wx = (px - v.x) / v.z, wy = (py - v.y) / v.z;
      return { x: px - wx * z, y: py - wy * z, z };
    });
  }, [min, max]);

  /** Convert a client (viewport) point to world coordinates. */
  const toWorld = useCallback((clientX, clientY, viewportEl) => {
    const rect = viewportEl.getBoundingClientRect();
    const v = viewRef.current;
    return { x: (clientX - rect.left - v.x) / v.z, y: (clientY - rect.top - v.y) / v.z };
  }, []);

  /** Center a world rect inside the viewport (used on flow load).
   *  Returns false when the viewport has no size yet (caller retries).
   *
   *  `inset` reserves edges that are covered by floating chrome — a left nav,
   *  a right rail. Added 20/08/2026 for the company map, whose 236px process
   *  tree used to sit on top of the first stage after a centred fit. Default
   *  is zero on all sides, so every existing caller fits exactly as before. */
  const fit = useCallback((world, viewportEl, { pad = 60, maxZ = 1, inset = {} } = {}) => {
    if (!viewportEl || !world?.width) return false;
    const { left = 0, right = 0, top = 0, bottom = 0 } = inset;
    const vw = viewportEl.clientWidth, vh = viewportEl.clientHeight;
    if (!vw || !vh) return false;
    const availW = Math.max(120, vw - left - right - pad * 2);
    const availH = Math.max(120, vh - top - bottom - pad * 2);
    const z = Math.min(maxZ, Math.max(min, Math.min(availW / world.width, availH / world.height)));
    setView({
      x: left + pad + Math.max(0, (availW - world.width * z) / 2),
      y: top + pad + Math.max(0, (availH - world.height * z) / 2),
      z,
    });
    return true;
  }, [min]);

  return {
    view,
    transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})`,
    toWorld,
    fit,
    setView,
    viewportProps: {
      onPointerDown, onPointerMove,
      onPointerUp: endDrag, onPointerLeave: endDrag, onPointerCancel: endDrag,
      onWheel,
      style: { touchAction: 'none', cursor: drag.current ? 'grabbing' : 'grab' },
    },
  };
}
