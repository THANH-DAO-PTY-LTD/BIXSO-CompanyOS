// ProcessCanvas — the flagship surface of Workspace OS (remaster Phase 1).
// Renders a ProviderFlow as a STRUCTURED canvas: layout is computed
// (lib/flowLayout.js — no x/y in the schema, founder decision 28/07/2026),
// interaction is real:
//   • pan / zoom                      (canvas-kit usePanZoom)
//   • port-drag to connect steps      (kills the old chip-toggle editor)
//   • semantic drag to reorder        (vertical, within a column — layout
//                                      stays tidy; diagrams are public faces)
//   • depth law surfaced              (detail steps render dimmed)
// Click behaviour: select node → the page's dock shows properties (Design)
// or jobs-at-node (Run). All colours come from the symbol registry.
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Copy, Focus, Minus, Plus, Trash2 } from 'lucide-react';
import { layoutFlow } from '@/lib/flowLayout';
import { edgeGeometry } from '@/lib/flowGeometry';
import { symbolOf } from '@/lib/symbols';
import { usePanZoom } from '@/components/canvas-kit/usePanZoom';
import { roleForNode, ROLE_BADGE } from '@/lib/agentRoster';
import EdgeTokens from './EdgeTokens';
import RehearseRunner from './RehearseRunner';
import useFlowVisualStandard from './useFlowVisualStandard';

const LINE = 'var(--flow-connector, #71827C)';
const MINT = 'var(--svc-secondary)';
const CORAL = 'var(--svc-primary)';
const AMBER = 'var(--svc-amber)';
const DRAG_THRESHOLD = 4; // px — under this a pointer-down is a click

export default function ProcessCanvas({
  view,               // flow object { nodes, edges, … }
  mode,               // 'run' | 'design'
  tokens = {},        // { [nodeId]: Deal[] }
  metricByNode = {},  // { [nodeId]: {enters, exits, medianHoldMs, branches} }
  showMetrics = false,
  bottleneckId = null,// node the backend measured as the slowest to leave
  runToken = null,    // node id glowing during Rehearse (reduced-motion / legacy)
  rehearsePath = null,// [nodeId] — drives the cinematic run
  onRehearseDone,
  selectedId = null,
  onSelect,           // (node|null) => void
  onAddEdge,          // (fromId, toId) => void
  onDropSymbol = null,// (kind, {afterId}) => void — palette drag/drop in Studio
  onAddAfter = null,  // (nodeId) => void — direct canvas action in Studio
  onDuplicateNode = null,
  onDeleteNode = null,
  onReorderNode,      // (nodeId, col, targetRow) => void
  subflowInfo = null, // MASTER WORKFLOW: { [nodeId]: {filled, name, steps, state} | {filled:false, suggested} }
  roles = {},         // GET /api/company/roles — who staffs which symbol/persona
  agents = [],        // GET /api/company/status agents[] — hired vs open seat
  visualStandard = null,
  fitPadding = 80,
}) {
  const visual = useFlowVisualStandard(visualStandard);
  const layout = useMemo(() => (view ? layoutFlow(view, {
    columnGap: visual.column_gap, laneGap: visual.lane_gap,
  }) : null), [view, visual.column_gap, visual.lane_gap]);
  const markerScope = useId().replaceAll(':', '');
  const compactCanvas = typeof window !== 'undefined' && window.innerWidth < 720;
  const pz = usePanZoom({ min: compactCanvas ? 0.68 : 0.35, max: 1.8 });
  const viewportRef = useRef(null);
  const [link, setLink] = useState(null);   // {from, x, y} — port-drag in flight
  const [dragNode, setDragNode] = useState(null); // {id, dx, dy, moved}
  const fittedFor = useRef(null);
  // Interaction decisions read REFS, not state: a fast drag's pointerup can
  // arrive before React commits setState (state only paints ghosts).
  const linkRef = useRef(null);
  const dragRef = useRef(null);
  // Nodes animate INTO place on first paint, then slide between positions on
  // every later layout change. Both need the same left/top transition, so it is
  // armed one frame after mount — otherwise every node would visibly slide in
  // from the top-left corner on load, which reads as a bug, not a flourish.
  const [settled, setSettled] = useState(false);
  const [rehearseStep, setRehearseStep] = useState(-1);

  // A timer, not requestAnimationFrame: rAF is suspended while the tab is
  // hidden, so a canvas opened in a background tab would never arm its
  // transition and would then slide every node in from the corner the moment
  // the tab was focused.
  useEffect(() => {
    const id = setTimeout(() => setSettled(true), 60);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => { setRehearseStep(rehearsePath ? 0 : -1); }, [rehearsePath]);

  // Fit the flow into view once per flow id (not on every edit). The viewport
  // can mount with zero size for a frame — retry on the next frame until fit
  // actually applies (a 0-width fit once flung the whole world off-screen).
  useEffect(() => {
    const fid = view?.id || view?.name;
    if (!layout || fittedFor.current === fid) return;
    let raf;
    const tryFit = () => {
      if (pz.fit(layout, viewportRef.current, { pad: compactCanvas ? 20 : fitPadding, maxZ: 1 })) {
        fittedFor.current = fid;
      } else {
        raf = requestAnimationFrame(tryFit);
      }
    };
    tryFit();
    return () => cancelAnimationFrame(raf);
  }, [compactCanvas, fitPadding, layout, pz, view]);

  if (!layout) return null;

  // ── port-drag: connect steps by dragging from an out-port ────────────────
  function startLink(e, fromId) {
    e.stopPropagation(); e.preventDefault();
    e.target.setPointerCapture?.(e.pointerId);
    const p = pz.toWorld(e.clientX, e.clientY, viewportRef.current);
    linkRef.current = { from: fromId };
    setLink({ from: fromId, x: p.x, y: p.y });
  }
  function moveLink(e) {
    if (!linkRef.current) return;
    const p = pz.toWorld(e.clientX, e.clientY, viewportRef.current);
    setLink((l) => (l ? { ...l, x: p.x, y: p.y } : { from: linkRef.current.from, x: p.x, y: p.y }));
  }
  function dropLink(e) {
    const l = linkRef.current;
    if (!l) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const target = el?.closest?.('[data-node-id]');
    const toId = target?.getAttribute('data-node-id');
    if (toId && toId !== l.from) onAddEdge?.(l.from, toId);
    linkRef.current = null;
    setLink(null);
  }

  // ── semantic node drag (Design): reorder within a column ─────────────────
  function nodePointerDown(e, n) {
    if (link) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = { id: n.id, col: n.col, sx: e.clientX, sy: e.clientY, moved: false };
    setDragNode({ id: n.id, dx: 0, dy: 0, moved: false });
  }
  function nodePointerMove(e) {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    d.moved = d.moved || Math.hypot(dx, dy) > DRAG_THRESHOLD;
    setDragNode({ id: d.id, dx, dy, moved: d.moved });
  }
  function nodePointerUp(e, n) {
    const d = dragRef.current;
    if (!d) return;
    if (!d.moved) {
      onSelect?.(n); // plain click — both modes
    } else if (mode === 'design') {
      const p = pz.toWorld(e.clientX, e.clientY, viewportRef.current);
      const targetRow = Math.max(0, Math.round((p.y - 40) / layout.ROW_H));
      onReorderNode?.(n.id, d.col, targetRow);
    }
    dragRef.current = null;
    setDragNode(null);
  }

  const posById = new Map(layout.positioned.map((p) => [String(p.id), p]));
  const linkFrom = link ? posById.get(String(link.from)) : null;

  // One geometry function, three consumers (drawn edge, travelling dots,
  // rehearse runner) — so a dot can never drift off the line it belongs to.
  const edgePath = (from, to) => edgeGeometry({ from, to }, layout).d;

  const drawn = layout.edges.map((e, i) => ({
    e, i,
    ...edgeGeometry(e, layout),
    live: mode === 'run' && (tokens[String(e.to.id)] || []).length > 0,
  }));
  const liveEdges = drawn.filter((x) => x.live).map((x) => ({ key: `${x.e.from.id}>${x.e.to.id}`, d: x.d }));

  // Rehearse: pair each step with the edge that carries the runner onward.
  // Plain computation, not useMemo — this sits after the `!layout` early return,
  // and a hook there would change hook order between renders.
  const rehearseSteps = (rehearsePath || []).map((id, idx) => {
    const from = posById.get(String(id));
    const to = posById.get(String(rehearsePath[idx + 1]));
    return { id: String(id), dTo: from && to ? edgePath(from, to) : null };
  });

  function zoomBy(factor) {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const cx = viewport.clientWidth / 2;
    const cy = viewport.clientHeight / 2;
    pz.setView((current) => {
      const z = Math.min(1.8, Math.max(0.35, current.z * factor));
      const wx = (cx - current.x) / current.z;
      const wy = (cy - current.y) / current.z;
      return { x: cx - wx * z, y: cy - wy * z, z };
    });
  }

  function fitCanvas() {
    pz.fit(layout, viewportRef.current, { pad: compactCanvas ? 20 : fitPadding, maxZ: 1 });
  }

  return (
    <div
      ref={viewportRef}
      {...pz.viewportProps}
      onPointerMove={(e) => { pz.viewportProps.onPointerMove(e); moveLink(e); nodePointerMove(e); }}
      onPointerUp={(e) => { pz.viewportProps.onPointerUp(e); dropLink(e); dragRef.current = null; setDragNode(null); }}
      onDragOver={(e) => {
        if (!onDropSymbol || mode !== 'design') return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={(e) => {
        if (!onDropSymbol || mode !== 'design') return;
        const kind = e.dataTransfer.getData('application/x-service-place-symbol');
        if (!kind) return;
        e.preventDefault();
        const point = pz.toWorld(e.clientX, e.clientY, viewportRef.current);
        const nearest = layout.positioned.reduce((best, node) => {
          const distance = Math.hypot(point.x - node.cx, point.y - node.cy);
          return distance < best.distance ? { id: node.id, distance } : best;
        }, { id: null, distance: Number.POSITIVE_INFINITY });
        onDropSymbol(kind, { afterId: nearest.distance <= 150 ? nearest.id : null });
      }}
      onClick={(e) => { if (!e.target.closest('[data-canvas-item]')) onSelect?.(null); }}
      style={{
        ...pz.viewportProps.style,
        position: 'absolute', inset: 0, overflow: 'hidden',
        backgroundImage: `radial-gradient(${LINE} 1px, transparent 1px)`,
        backgroundSize: '24px 24px',
      }}
    >
      {/* living-process motion (Phase 3): edges feeding a node that holds
          jobs flow toward it; token pills breathe. */}
      <style>{`
        @keyframes pcDashFlow { to { stroke-dashoffset: -32; } }
        @keyframes pcBreath { 0%,100% { opacity: .75 } 50% { opacity: 1 } }
        @keyframes pcRise { from { opacity: 0; transform: translateY(7px) } to { opacity: 1; transform: none } }
        @keyframes pcSlowPulse { 0%,100% { opacity: .3 } 50% { opacity: .85 } }
        /* Steps arrive left to right, the way work moves through them. */
        .pc-node { animation: pcRise .42s cubic-bezier(.2,.8,.3,1) both; }
        .pc-node:hover { box-shadow: var(--svc-shadow-lift, 0 10px 26px rgba(28,36,56,.13)) !important; }
        .pc-node.is-dragging { animation: none; }
        .pc-node.is-lit { box-shadow: var(--svc-shadow-coral, 0 10px 26px rgba(255,106,61,.28)) !important; }
        .pc-slow-ring { animation: pcSlowPulse 1.9s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .pc-live-edge, .pc-token-pill, .pc-node, .pc-slow-ring { animation: none !important; }
          .pc-node { opacity: 1 !important; transform: none !important; }
        }
      `}</style>
      <div style={{ transform: pz.transform, transformOrigin: '0 0', position: 'absolute', width: layout.width, height: layout.height }}>
        {/* edges */}
        <svg width={layout.width} height={layout.height} style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}>
          <defs>
            {/* Arrowheads: a flow diagram without them makes the reader guess
                which way work travels — the one thing the diagram exists to say. */}
            <marker id={`${markerScope}Arrow`} viewBox="0 0 10 10" refX="9.5" refY="5"
              markerWidth={visual.arrow_size} markerHeight={visual.arrow_size} markerUnits="userSpaceOnUse" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" fill={LINE} />
            </marker>
            <marker id={`${markerScope}ArrowLive`} viewBox="0 0 10 10" refX="9.5" refY="5"
              markerWidth={visual.arrow_size + 0.5} markerHeight={visual.arrow_size + 0.5} markerUnits="userSpaceOnUse" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" fill={MINT} />
            </marker>
            <linearGradient id="pcFlowGrad" gradientUnits="userSpaceOnUse"
              x1="0" y1="0" x2={layout.width} y2="0">
              <stop offset="0" stopColor={CORAL} />
              <stop offset="1" stopColor={MINT} />
            </linearGradient>
          </defs>

          {drawn.map(({ e, i, d, live, labelX, labelY }) => {
            return (
              <g key={i}>
                <path d={d} fill="none" stroke="var(--svc-surface)" strokeWidth="6" opacity=".96" strokeLinecap="round" />
                {live && <path d={d} fill="none" stroke={MINT} strokeWidth="8" opacity="0.12" strokeLinecap="round" />}
                <path d={d} fill="none"
                  className={live ? 'pc-live-edge' : undefined}
                  stroke={live ? 'url(#pcFlowGrad)' : LINE}
                  strokeWidth={live ? visual.active_connector_width : visual.connector_width}
                  markerEnd={live ? `url(#${markerScope}ArrowLive)` : `url(#${markerScope}Arrow)`}
                  strokeDasharray={live && visual.motion_enabled ? '9 7' : undefined}
                  style={live && visual.motion_enabled ? { animation: `pcDashFlow ${visual.motion_seconds}s linear infinite` } : undefined} />
                {e.branch && (
                  <BranchLabel x={labelX} y={labelY} text={e.branch} />
                )}
              </g>
            );
          })}

          {layout.positioned.filter((node) => layout.edges.filter((edge) => edge.from.id === node.id).length > 1).map((node) => (
            <circle key={`fork-${node.id}`} cx={node.x + layout.NODE_W + 8} cy={node.cy} r="4.2"
              fill={MINT} stroke="var(--svc-surface)" strokeWidth="2" />
          ))}
          {layout.positioned.filter((node) => layout.edges.filter((edge) => edge.to.id === node.id).length > 1).map((node) => (
            <circle key={`join-${node.id}`} cx={node.x - 8} cy={node.cy} r="4.2"
              fill={MINT} stroke="var(--svc-surface)" strokeWidth="2" />
          ))}

          {/* jobs travelling the live edges */}
          {mode === 'run' && visual.motion_enabled && !rehearsePath && <EdgeTokens edges={liveEdges} color={CORAL} />}

          {/* the practice job */}
          {rehearsePath && (
            <RehearseRunner
              steps={rehearseSteps} color={CORAL}
              onStep={setRehearseStep}
              onDone={onRehearseDone}
            />
          )}

          {/* in-flight connection */}
          {link && linkFrom && (
            <path
              d={`M ${linkFrom.x + layout.NODE_W} ${linkFrom.cy} L ${link.x} ${link.y}`}
              fill="none" stroke={MINT} strokeWidth="2" strokeDasharray="6 5"
            />
          )}
        </svg>

        {/* nodes */}
        {layout.positioned.map((n) => {
          const sym = symbolOf(n.kind);
          const Icon = sym.icon;
          // MASTER WORKFLOW (20/08): khối quy-trình-con vẽ khác hẳn node thường —
          // nó là CỬA vào một flow con (đã lấp) hoặc Ô TRỐNG được đề xuất.
          const sf = n.kind === 'subflow' ? (subflowInfo?.[String(n.id)] || { filled: !!n.flow_ref }) : null;
          const toks = tokens[String(n.id)] || [];
          const met = metricByNode[String(n.id)];
          const lit = rehearsePath
            ? rehearseStep >= 0 && rehearsePath.slice(0, rehearseStep + 1).includes(String(n.id))
            : false;
          const hot = runToken === n.id || lit;
          const sel = selectedId === n.id;
          const dimmed = (n.depth || 0) > 0;
          const dragging = dragNode?.id === n.id && dragNode.moved;
          const slow = showMetrics && bottleneckId && String(bottleneckId) === String(n.id);
          // Who staffs this block. Truth rule: roleForNode returning null
          // means NO badge — a plain step is the provider's own hands, and
          // inventing a default agent would be a lie on the canvas.
          const staff = roleForNode(n, roles);
          const badge = staff ? (ROLE_BADGE[staff.id] || ROLE_BADGE.ai_staff) : null;
          const hired = staff ? (agents || []).find((a) => a.role === staff.id) : null;
          // `active === false` is the backend's word for an open seat. An
          // agents list that simply hasn't loaded must NOT dim anything.
          const openSeat = !!hired && hired.active === false;
          return (
            <div
              key={n.id}
              className={`pc-node${dragging ? ' is-dragging' : ''}${lit ? ' is-lit' : ''}`}
              data-canvas-item
              data-node-id={n.id}
              onPointerDown={(e) => nodePointerDown(e, n)}
              onPointerUp={(e) => nodePointerUp(e, n)}
              role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') onSelect?.(n); }}
              style={{
                position: 'absolute', left: n.x, top: n.y, width: layout.NODE_W, minHeight: layout.NODE_H,
                transform: dragging ? `translate(${dragNode.dx / pz.view.z}px, ${dragNode.dy / pz.view.z}px)` : undefined,
                opacity: dimmed && !sel ? 0.55 : 1,
                scale: dimmed && !sel ? '0.94' : '1',
                background: sf && !sf.filled ? 'transparent' : 'var(--svc-surface)',
                border: sf
                  ? (sf.filled
                    ? `2px solid ${sf.state === 'active' ? MINT : 'var(--svc-border-strong, #CBB9A8)'}`
                    : '2px dashed var(--svc-border-strong, #CBB9A8)')
                  : `1.5px solid ${hot ? MINT : sel ? 'var(--svc-ink)' : slow ? AMBER : LINE}`,
                borderRadius: sf ? 15 : sym.branches ? 16 : 12,
                padding: sf ? '12px 14px' : '10px 12px', cursor: mode === 'design' && !sf ? 'grab' : 'pointer',
                boxShadow: hot ? `0 0 0 4px color-mix(in srgb, ${MINT} 22%, transparent)`
                  : sel ? '0 0 0 3px rgba(33,48,79,.14), 0 8px 20px rgba(28,36,56,.12)'
                  : '0 1px 4px rgba(0,0,0,0.05)',
                zIndex: dragging ? 8 : sel ? 6 : 1,
                // left/top carry the layout, so they carry the slide when Design
                // adds or reorders a step. Armed only after the first frame.
                transition: dragging ? 'none'
                  : `box-shadow .15s, opacity .15s, border-color .2s${settled ? ', left .34s cubic-bezier(.2,.8,.3,1), top .34s cubic-bezier(.2,.8,.3,1)' : ''}`,
                animationDelay: `${Math.min(n.col * 55, 400)}ms`,
                userSelect: 'none',
              }}
            >
              {/* Staffed-by badge — the step is somebody's post. Dimmed when
                  that somebody is an open seat (agent not hired yet): the
                  work still shows who it belongs to, nothing is blocked. */}
              {badge && (() => {
                const BadgeIcon = badge.icon;
                return (
                  <span
                    // An open seat means the provider is covering the post
                    // themselves — which is TRUE and is the whole OPC story.
                    // Saying only "hire X" turns a working step into what looks
                    // like a paywall: the onboarding flow alone would show
                    // three of these on a brand-new account.
                    title={openSeat
                      ? `${staff.label || staff.id}: open seat — you're covering this step yourself. Hire them in Company to hand it over.`
                      : `Worked by ${hired?.name || staff.label || staff.id}`}
                    style={{
                      position: 'absolute', top: -8, right: -8, width: 20, height: 20,
                      borderRadius: '50%', background: badge.bg, color: badge.fg,
                      border: '1.5px solid var(--svc-surface)',
                      display: 'grid', placeItems: 'center',
                      opacity: openSeat ? 0.45 : 1,
                      boxShadow: '0 1px 4px rgba(28,36,56,.18)', zIndex: 2,
                    }}
                  >
                    <BadgeIcon size={11} />
                  </span>
                );
              })()}
              {slow && (
                <span className="pc-slow-ring" aria-hidden="true"
                  style={{
                    position: 'absolute', inset: -5, borderRadius: (sym.branches ? 16 : 12) + 5,
                    border: `1.5px solid ${AMBER}`, pointerEvents: 'none',
                  }} />
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: sf ? (sf.filled ? MINT : 'var(--svc-text-muted)') : sym.color, pointerEvents: 'none' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 22, height: 22, borderRadius: 7, background: sf && !sf.filled ? 'transparent' : sym.soft, flex: '0 0 auto',
                }}>
                  <Icon size={14} />
                </span>
                <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                  {sf ? (sf.filled ? 'Process' : 'Suggested') : sym.label}
                </span>
                {dimmed && <span style={{ fontSize: 9, color: 'var(--svc-text-muted)', marginLeft: 'auto' }}>detail L{n.depth}</span>}
              </div>
              <div style={{ fontSize: sf ? 14 : 13, fontWeight: sf ? 700 : 560, color: sf && !sf.filled ? 'var(--svc-text-muted)' : 'var(--svc-ink)', marginTop: 5, lineHeight: 1.3, pointerEvents: 'none' }}>
                {n.label || n.id}
              </div>
              {/* Khối master: dòng trạng thái + lời mời hành động — cửa phải nói nó mở đi đâu. */}
              {sf && (
                <div style={{ marginTop: 6, pointerEvents: 'none' }}>
                  {sf.filled ? (
                    <>
                      <div style={{ fontSize: 10.5, color: 'var(--svc-text-muted)' }}>
                        {sf.name}{sf.steps ? ` · ${sf.steps} steps` : ''}
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 5, alignItems: 'center' }}>
                        <Pill bg={sf.state === 'active' ? 'var(--svc-mint-50)' : 'var(--svc-surface-sunk)'} color={sf.state === 'active' ? MINT : 'var(--svc-text-muted)'}>
                          {sf.state === 'active' ? 'RUNNING' : sf.state === 'draft' ? 'DRAFT' : 'PAUSED'}
                        </Pill>
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: MINT }}>Open →</span>
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 11, fontWeight: 700, color: CORAL }}>
                      + Set this up{sf.suggested ? '' : ' — browse the library'}
                    </div>
                  )}
                </div>
              )}
              {(toks.length > 0 || (showMetrics && met)) && (
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap', pointerEvents: 'none' }}>
                  {toks.length > 0 && (
                    <span className="pc-token-pill" style={{ animation: 'pcBreath 2.2s ease-in-out infinite' }}>
                      <Pill bg="var(--svc-coral-50)" color={CORAL}>{toks.length} job</Pill>
                    </span>
                  )}
                  {showMetrics && met?.medianHoldMs != null && (
                    <Pill bg={slow ? '#FCF2DE' : 'var(--svc-mint-50)'} color={slow ? AMBER : MINT}>
                      {holdLabel(met.medianHoldMs)}
                    </Pill>
                  )}
                  {showMetrics && met?.enters > 0 && (
                    <Pill bg="var(--svc-surface-sunk)" color="var(--svc-text-muted)">{met.enters} through</Pill>
                  )}
                </div>
              )}
              {/* ports — Design mode only */}
              {mode === 'design' && (
                <>
                  <Port side="in" />
                  <Port side="out" active={link?.from === n.id} onPointerDown={(e) => startLink(e, n.id)} />
                </>
              )}
              {mode === 'design' && sel && (onAddAfter || onDuplicateNode || onDeleteNode) && (
                <NodeQuickActions
                  onAdd={() => onAddAfter?.(n.id)}
                  onDuplicate={() => onDuplicateNode?.(n.id)}
                  onDelete={() => onDeleteNode?.(n.id)}
                />
              )}
            </div>
          );
        })}
      </div>

      <div
        data-canvas-item
        className="process-canvas-controls"
        aria-label="Canvas controls"
        style={{
          position: 'absolute', right: 18, bottom: 18, zIndex: 20,
          display: 'flex', alignItems: 'center', gap: 3, padding: 4,
          border: '1px solid var(--svc-border)', borderRadius: 10,
          background: 'color-mix(in srgb, var(--svc-surface) 94%, transparent)',
          boxShadow: '0 8px 24px rgba(28,36,56,.12)', backdropFilter: 'blur(10px)',
        }}
      >
        <CanvasControl title="Zoom out" onClick={() => zoomBy(0.86)}><Minus size={15} /></CanvasControl>
        <span style={{ width: 48, textAlign: 'center', fontSize: 11, fontWeight: 750, color: 'var(--svc-text-muted)' }}>
          {Math.round(pz.view.z * 100)}%
        </span>
        <CanvasControl title="Zoom in" onClick={() => zoomBy(1.16)}><Plus size={15} /></CanvasControl>
        <span aria-hidden="true" style={{ width: 1, height: 22, background: 'var(--svc-border)', margin: '0 2px' }} />
        <CanvasControl title="Fit process to canvas" onClick={fitCanvas}><Focus size={15} /></CanvasControl>
      </div>
    </div>
  );
}

function CanvasControl({ title, onClick, children }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        width: 32, height: 32, border: 0, borderRadius: 7,
        display: 'grid', placeItems: 'center', background: 'transparent',
        color: 'var(--svc-ink)', cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function NodeQuickActions({ onAdd, onDuplicate, onDelete }) {
  return (
    <span
      data-canvas-item
      aria-label="Selected block actions"
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute', left: '50%', top: -39, transform: 'translateX(-50%)',
        height: 30, display: 'flex', alignItems: 'center', gap: 2, padding: 3,
        border: '1px solid var(--svc-border)', borderRadius: 8,
        background: 'var(--svc-surface)', boxShadow: '0 8px 18px rgba(28,36,56,.14)',
        zIndex: 12,
      }}
    >
      <QuickAction title="Add the next step" onClick={onAdd}><Plus size={13} /></QuickAction>
      <QuickAction title="Duplicate block" onClick={onDuplicate}><Copy size={12} /></QuickAction>
      <QuickAction title="Delete block" onClick={onDelete} danger><Trash2 size={12} /></QuickAction>
    </span>
  );
}

function QuickAction({ title, onClick, danger = false, children }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      style={{
        width: 23, height: 23, border: 0, borderRadius: 5, display: 'grid', placeItems: 'center',
        background: 'transparent', color: danger ? 'var(--svc-danger, #E5484D)' : 'var(--svc-ink)', cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function BranchLabel({ x, y, text }) {
  const label = String(text || '');
  const width = Math.max(46, label.length * 6.5 + 20);
  return (
    <g transform={`translate(${x - width / 2} ${y - 11})`}>
      <rect width={width} height="22" rx="11" fill="var(--svc-surface)"
        stroke="var(--svc-border-strong, #BFAF9E)" strokeWidth="1" />
      <text x={width / 2} y="14.8" textAnchor="middle" fontSize="10.5" fontWeight="700"
        fill="var(--svc-ink)">{label}</text>
    </g>
  );
}

/** Milliseconds → the words a tradie would use. Never a bare number. */
export function holdLabel(ms) {
  if (ms == null) return null;
  const mins = ms / 60000;
  if (mins < 90) return `${Math.max(1, Math.round(mins))} min`;
  const hrs = mins / 60;
  if (hrs < 36) return `${hrs.toFixed(hrs < 10 ? 1 : 0)} hr`;
  return `${(hrs / 24).toFixed(1)} days`;
}

function Pill({ bg, color, children }) {
  return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: bg, color }}>{children}</span>;
}

function Port({ side, active, onPointerDown }) {
  return (
    <span
      data-canvas-item
      onPointerDown={onPointerDown}
      title={side === 'out' ? 'Drag to connect to another step' : undefined}
      style={{
        position: 'absolute', top: '50%',
        [side === 'out' ? 'right' : 'left']: -7,
        transform: 'translateY(-50%)',
        width: 13, height: 13, borderRadius: '50%',
        background: active ? MINT : 'var(--svc-surface)',
        border: `2px solid ${active ? MINT : 'var(--svc-border-strong, #CBB9A8)'}`,
        cursor: side === 'out' ? 'crosshair' : 'default',
        pointerEvents: side === 'out' ? 'auto' : 'none',
      }}
    />
  );
}
