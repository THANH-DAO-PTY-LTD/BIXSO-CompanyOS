export function edgeGeometry(edge, layout) {
  const { from, to } = edge;
  const x1 = from.x + layout.NODE_W;
  const y1 = from.cy;
  const x2 = to.x;
  const y2 = to.cy;
  const back = x2 < x1;

  if (back) {
    const loopY = Math.max(from.y, to.y) + layout.NODE_H + 74;
    return {
      d: `M ${from.cx} ${from.y + layout.NODE_H} C ${from.cx} ${loopY}, ${to.cx} ${loopY}, ${to.cx} ${to.y + layout.NODE_H}`,
      labelX: (from.cx + to.cx) / 2,
      labelY: loopY + 14,
      back,
    };
  }

  const dx = Math.max(36, (x2 - x1) * 0.5);
  const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
  // Branch labels belong to the first leg out of the decision. Keeping them
  // there prevents short labels from floating between unrelated blocks.
  return {
    d,
    labelX: x1 + Math.min(52, Math.max(34, (x2 - x1) * 0.34)),
    labelY: y1 + (y2 === y1 ? -15 : Math.sign(y2 - y1) * 20),
    back,
  };
}

export function edgeKind(edge, layout) {
  if (edge.to.x < edge.from.x + layout.NODE_W) return 'return';
  if (edge.branch) return 'branch';
  return 'sequence';
}
