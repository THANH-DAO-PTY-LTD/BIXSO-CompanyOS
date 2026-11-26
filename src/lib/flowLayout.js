// flowLayout — auto-layout ProviderFlow (nodes/edges không mang x/y) thành lưới trái→phải.
// Tầng (column) = longest-path từ node gốc; thứ tự trong tầng = thứ tự duyệt ổn định.
// Trả { positioned: [{...node, col, row, x, y}], edges, width, height }.

const COL_W = 220;   // khoảng cách ngang giữa 2 tầng
const ROW_H = 142;   // khoảng cách dọc giữa 2 lane
const PAD_X = 40;
const PAD_Y = 40;
export const DEFAULT_FLOW_NODE_W = 150;
export const DEFAULT_FLOW_NODE_H = 74;

export function layoutFlow(flow, options = {}) {
  const nodes = Array.isArray(flow?.nodes) ? flow.nodes : [];
  const edges = Array.isArray(flow?.edges) ? flow.edges : [];
  const nodeWidth = Number(options.nodeWidth) || DEFAULT_FLOW_NODE_W;
  const nodeHeight = Number(options.nodeHeight) || DEFAULT_FLOW_NODE_H;
  const padX = Number(options.paddingX) || PAD_X;
  const padY = Number(options.paddingY) || PAD_Y;
  if (nodes.length === 0) {
    return { positioned: [], edges: [], width: 0, height: 0, NODE_W: nodeWidth, NODE_H: nodeHeight };
  }

  const colWidth = Number(options.columnGap) || COL_W;
  const rowHeight = Number(options.laneGap) || ROW_H;
  const byId = new Map(nodes.map((n) => [String(n.id), n]));
  const outAdj = new Map();
  const inAdj = new Map();
  const indeg = new Map(nodes.map((n) => [String(n.id), 0]));
  for (const e of edges) {
    const f = String(e.from), t = String(e.to);
    if (!byId.has(f) || !byId.has(t)) continue;
    (outAdj.get(f) || outAdj.set(f, []).get(f)).push(t);
    (inAdj.get(t) || inAdj.set(t, []).get(t)).push(f);
    indeg.set(t, (indeg.get(t) || 0) + 1);
  }

  // Cạnh quay ngược (vd nhánh "no" quay về bước báo giá) tạo chu trình — nếu
  // đưa vào phép tính cột sẽ đẩy cột phình vô hạn (bị chặn bởi số vòng lặp
  // nhưng vẫn làm sơ đồ giãn gấp đôi). DFS đánh dấu back-edge để LOẠI khỏi
  // layering; cạnh vẫn được VẼ (đường vòng dưới) như thường.
  const backEdges = new Set(); // "f→t"
  {
    const color = new Map(); // 0 trắng, 1 đang trên stack, 2 xong
    const dfs = (start) => {
      const stack = [[start, 0]];
      color.set(start, 1);
      while (stack.length) {
        const top = stack[stack.length - 1];
        const [u] = top;
        const tos = outAdj.get(u) || [];
        if (top[1] < tos.length) {
          const v = tos[top[1]++];
          if (!color.get(v)) { color.set(v, 1); stack.push([v, 0]); }
          else if (color.get(v) === 1) backEdges.add(`${u}→${v}`);
        } else { color.set(u, 2); stack.pop(); }
      }
    };
    for (const n of nodes) {
      const id = String(n.id);
      if (!color.get(id) && (indeg.get(id) || 0) === 0) dfs(id);
    }
    for (const n of nodes) { const id = String(n.id); if (!color.get(id)) dfs(id); }
  }

  // col = longest path từ mọi source, chỉ trên cạnh xuôi (đồ thị giờ là DAG).
  const col = new Map(nodes.map((n) => [String(n.id), 0]));
  for (let iter = 0; iter < nodes.length; iter++) {
    let changed = false;
    for (const [f, tos] of outAdj) {
      for (const t of tos) {
        if (backEdges.has(`${f}→${t}`)) continue;
        if (col.get(t) < col.get(f) + 1) { col.set(t, col.get(f) + 1); changed = true; }
      }
    }
    if (!changed) break;
  }

  // Lane follows the graph until a real join so parallel branches remain
  // visually distinct across a long flow.
  const cols = new Map();
  for (const n of nodes) {
    const c = col.get(String(n.id)) || 0;
    (cols.get(c) || cols.set(c, []).get(c)).push(n);
  }

  const lane = new Map();
  const sortedCols = [...cols.entries()].sort((a, b) => a[0] - b[0]);
  for (const [, list] of sortedCols) {
    const occupied = [];
    list.forEach((n, index) => {
      const id = String(n.id);
      const parents = (inAdj.get(id) || []).filter((p) => !backEdges.has(`${p}→${id}`));
      let nextLane;
      if (!parents.length) nextLane = index;
      else if (parents.length > 1) {
        nextLane = parents.reduce((sum, p) => sum + (lane.get(p) || 0), 0) / parents.length;
      } else {
        const parent = parents[0];
        const siblings = (outAdj.get(parent) || []).filter((child) => !backEdges.has(`${parent}→${child}`));
        const siblingIndex = siblings.indexOf(id);
        nextLane = (lane.get(parent) || 0) + (siblingIndex - (siblings.length - 1) / 2);
      }
      while (occupied.some((value) => Math.abs(value - nextLane) < 0.45)) nextLane += 1;
      occupied.push(nextLane);
      lane.set(id, nextLane);
    });
  }

  const laneValues = [...lane.values()];
  const minLane = Math.min(...laneValues, 0);
  const maxLane = Math.max(...laneValues, 0);
  const positioned = [];
  let maxCol = 0;
  for (const [c, list] of sortedCols) {
    maxCol = Math.max(maxCol, c);
    list.forEach((n) => {
      const logicalLane = lane.get(String(n.id)) || 0;
      const row = logicalLane - minLane;
      positioned.push({
        ...n,
        col: c, row, lane: logicalLane,
        x: padX + c * colWidth,
        y: padY + row * rowHeight,
        cx: padX + c * colWidth + nodeWidth / 2,
        cy: padY + row * rowHeight + nodeHeight / 2,
      });
    });
  }
  const posById = new Map(positioned.map((p) => [String(p.id), p]));
  const drawEdges = edges
    .filter((e) => posById.has(String(e.from)) && posById.has(String(e.to)))
    .map((e) => ({
      ...e,
      from: posById.get(String(e.from)),
      to: posById.get(String(e.to)),
    }));

  return {
    positioned,
    edges: drawEdges,
    width: padX * 2 + maxCol * colWidth + nodeWidth,
    height: padY * 2 + (maxLane - minLane) * rowHeight + nodeHeight,
    NODE_W: nodeWidth, NODE_H: nodeHeight, COL_W: colWidth, ROW_H: rowHeight,
  };
}
