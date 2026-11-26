// FlowMiniMap — diagram thu nhỏ 5 ký hiệu cho card template (P3/R4). Dùng chung layoutFlow.
import React, { useId, useMemo } from 'react';
import { layoutFlow } from '@/lib/flowLayout';
import { edgeGeometry } from '@/lib/flowGeometry';

const COLORS = { ai_step: 'var(--svc-secondary)', gateway: 'var(--svc-amber)', touchpoint: 'var(--svc-primary)', step: 'var(--svc-slate)' };

export default function FlowMiniMap({ flow, height = 84 }) {
  const layout = useMemo(() => layoutFlow(flow), [flow]);
  const markerId = `${useId().replaceAll(':', '')}FmArrow`;
  if (!layout.positioned.length) return null;
  const pad = 10;
  const vw = layout.width, vh = layout.height;
  const scale = Math.min((320 - pad * 2) / vw, (height - pad * 2) / vh, 1);
  const cx = (n) => pad + n.cx * scale;
  const cy = (n) => pad + n.cy * scale;
  return (
    <svg width="100%" height={height} viewBox={`0 0 320 ${height}`} preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block' }} aria-hidden="true">
      <defs><marker id={markerId} viewBox="0 0 10 10" refX="9.3" refY="5" markerWidth="6" markerHeight="6" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 0L10 5L0 10z" fill="#70827c" /></marker></defs>
      <g transform={`translate(${pad} ${pad}) scale(${scale})`}>
        {layout.edges.map((e, i) => (
          <path key={i} d={edgeGeometry(e, layout).d} fill="none" stroke="#70827c" strokeWidth={2 / scale}
            strokeLinecap="round" markerEnd={`url(#${markerId})`} />
        ))}
      </g>
      {layout.positioned.map((n) => {
        const c = COLORS[n.kind] || COLORS.step;
        return n.kind === 'gateway' ? (
          <rect key={n.id} x={cx(n) - 6} y={cy(n) - 6} width="12" height="12" transform={`rotate(45 ${cx(n)} ${cy(n)})`} fill="#fff" stroke={c} strokeWidth="2" />
        ) : (
          <circle key={n.id} cx={cx(n)} cy={cy(n)} r="6" fill={n.kind === 'touchpoint' ? c : '#fff'} stroke={c} strokeWidth="2" />
        );
      })}
    </svg>
  );
}
