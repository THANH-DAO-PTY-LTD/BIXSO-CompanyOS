// flowDraft — the edits you can make to a process drawing, as pure functions.
//
// Extracted from WorkCanvasPage on 08/08/2026 when BFT Studio needed the same
// six operations. Copying them would have left two implementations of the same
// law (how a gateway picks its next free branch, what a new node inherits from
// its symbol) drifting apart in two files — the exact shape of the "two ways to
// understand the same thing, nobody notices" bugs this codebase keeps paying
// for. One module, one behaviour, both canvases.
//
// Pure by design: every function takes a draft and returns a NEW draft. No
// React, no API, no store — so it is testable without a browser and reusable by
// any surface that edits a flow.
//
// The SCHEMA is still owned by the backend (lib/flowSchema.js). Nothing here
// validates; these helpers only keep an in-progress drawing internally coherent
// (no dangling edges, no duplicate branch on a fork). The server has the last
// word on every save.

import { symbolOf } from '@/lib/symbols';
import { layoutFlow } from '@/lib/flowLayout';

/** Short, collision-resistant node id. */
export function newNodeId() {
  return `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

function nodeFor(kind, { id = newNodeId(), label } = {}) {
  const sym = symbolOf(kind);
  return {
    id,
    kind,
    label: label || `New ${String(sym.label || kind).toLowerCase()}`,
    ...(sym.persona ? { ai_persona: 'bixso' } : {}),
    ...(sym.branches ? { branches: ['Yes', 'No'] } : {}),
  };
}

/** Deep clone + mutate + return. The clone is what makes these pure. */
function patch(draft, fn) {
  const next = JSON.parse(JSON.stringify(draft));
  fn(next);
  return next;
}

/**
 * Add a node of `kind`, wired from the current last node.
 * Seeds the fields the symbol's flags make mandatory, so a brand-new AI step or
 * decision is valid the moment it appears rather than failing on save with a
 * message about a field the person never saw.
 */
export function addNode(draft, kind, { label } = {}) {
  return patch(draft, (d) => {
    const node = nodeFor(kind, { label });
    const last = d.nodes[d.nodes.length - 1];
    d.nodes.push(node);
    // Auto-connect from the end of the chain: a disconnected node is almost
    // never what someone means, and unwiring is one click.
    if (last) d.edges.push({ from: last.id, to: node.id });
  });
}

/** Insert a block after a selected step without breaking a straight path. */
export function addNodeAfter(draft, fromId, kind, { id, label } = {}) {
  return patch(draft, (d) => {
    const node = nodeFor(kind, { id, label });
    const outgoing = d.edges.filter((edge) => String(edge.from) === String(fromId));
    d.nodes.push(node);

    const previous = outgoing[0];
    if (previous) {
      d.edges = d.edges.filter((edge) => edge !== previous);
      d.edges.push(previous.branch
        ? { from: fromId, to: node.id, branch: previous.branch }
        : { from: fromId, to: node.id });
      d.edges.push({ from: node.id, to: previous.to });
    } else {
      d.edges.push({ from: fromId, to: node.id });
    }
  });
}

/** Duplicate a step and place the copy directly after it on a straight path. */
export function duplicateNode(draft, nodeId, { id = newNodeId() } = {}) {
  const source = (draft.nodes || []).find((node) => String(node.id) === String(nodeId));
  if (!source) return draft;
  const copy = JSON.parse(JSON.stringify(source));
  return patch(draft, (d) => {
    copy.id = id;
    copy.label = `${copy.label} copy`.slice(0, 80);
    const outgoing = d.edges.filter((edge) => String(edge.from) === String(nodeId));
    d.nodes.push(copy);
    const previous = outgoing[0];
    if (previous) {
      d.edges = d.edges.filter((edge) => edge !== previous);
      d.edges.push(previous.branch
        ? { from: nodeId, to: copy.id, branch: previous.branch }
        : { from: nodeId, to: copy.id });
      d.edges.push({ from: copy.id, to: previous.to });
    } else {
      d.edges.push({ from: nodeId, to: copy.id });
    }
  });
}

/** Change symbol while keeping shared content and seeding/removing type fields. */
export function convertNodeKind(draft, nodeId, kind) {
  const sym = symbolOf(kind);
  return patch(draft, (d) => {
    const node = d.nodes.find((candidate) => String(candidate.id) === String(nodeId));
    if (!node) return;
    node.kind = kind;
    if (sym.persona) node.ai_persona ||= 'bixso';
    else delete node.ai_persona;
    if (sym.branches) node.branches = Array.isArray(node.branches) && node.branches.length >= 2 ? node.branches : ['Yes', 'No'];
    else {
      delete node.branches;
      d.edges = d.edges.map((edge) => String(edge.from) === String(nodeId)
        ? (({ branch: _branch, ...rest }) => rest)(edge)
        : edge);
    }
  });
}

export function updateNode(draft, id, changes) {
  return patch(draft, (d) => {
    const n = d.nodes.find((x) => String(x.id) === String(id));
    if (n) Object.assign(n, changes);
  });
}

/** Keep gateway branch labels and their outgoing edges in sync by position. */
export function setNodeBranches(draft, id, branches) {
  return patch(draft, (d) => {
    const node = d.nodes.find((candidate) => String(candidate.id) === String(id));
    if (!node) return;
    const previous = Array.isArray(node.branches) ? node.branches : [];
    node.branches = branches;
    d.edges = d.edges
      .filter((edge) => String(edge.from) !== String(id) || !edge.branch || !previous.includes(edge.branch) || previous.indexOf(edge.branch) < branches.length)
      .map((edge) => {
        if (String(edge.from) !== String(id) || !edge.branch) return edge;
        const index = previous.indexOf(edge.branch);
        return index >= 0 && branches[index] ? { ...edge, branch: branches[index] } : edge;
      });
  });
}

/** Delete a node AND every edge touching it — a dangling edge fails validation. */
export function deleteNode(draft, id) {
  return patch(draft, (d) => {
    d.nodes = d.nodes.filter((n) => String(n.id) !== String(id));
    d.edges = d.edges.filter((e) => String(e.from) !== String(id) && String(e.to) !== String(id));
  });
}

/**
 * Connect two nodes. Leaving a decision, the edge claims the next branch name
 * that is not already used — so dragging two lines out of a fork produces
 * "Yes" then "No" without anyone naming them.
 */
export function addEdge(draft, fromId, toId) {
  return patch(draft, (d) => {
    if (d.edges.some((e) => String(e.from) === String(fromId) && String(e.to) === String(toId))) return;
    const from = d.nodes.find((n) => String(n.id) === String(fromId));
    const sym = symbolOf(from?.kind);
    let branch;
    if (sym.branches) {
      const used = new Set(d.edges.filter((e) => String(e.from) === String(fromId)).map((e) => e.branch));
      branch = (from.branches || []).find((b) => !used.has(b));
    }
    d.edges.push(branch ? { from: fromId, to: toId, branch } : { from: fromId, to: toId });
  });
}

export function removeEdge(draft, fromId, toId) {
  return patch(draft, (d) => {
    const i = d.edges.findIndex((e) => String(e.from) === String(fromId) && String(e.to) === String(toId));
    if (i >= 0) d.edges.splice(i, 1);
  });
}

/**
 * Move a node to `targetRow` among its column siblings.
 * Rows within a column follow declaration order in nodes[], so reordering is a
 * reorder of that array — there is no x/y to write.
 */
export function reorderNode(draft, nodeId, col, targetRow) {
  return patch(draft, (d) => {
    const positioned = layoutFlow(d).positioned;
    const colIds = positioned.filter((p) => p.col === col).map((p) => String(p.id));
    const fromIdx = colIds.indexOf(String(nodeId));
    if (fromIdx < 0) return;
    colIds.splice(fromIdx, 1);
    colIds.splice(Math.min(targetRow, colIds.length), 0, String(nodeId));
    const rank = new Map(colIds.map((id, i) => [id, i]));
    const inCol = new Set(colIds);
    const sameCol = d.nodes.filter((n) => inCol.has(String(n.id)));
    sameCol.sort((a, b) => rank.get(String(a.id)) - rank.get(String(b.id)));
    let k = 0;
    d.nodes = d.nodes.map((n) => (inCol.has(String(n.id)) ? sameCol[k++] : n));
  });
}

/** A one-node starting drawing — what "blank canvas" means. */
export function blankDraft(name = 'Untitled process') {
  return {
    name,
    nodes: [{ id: newNodeId(), kind: 'touchpoint', label: 'Customer gets in touch' }],
    edges: [],
  };
}

/**
 * The client-side readiness read. NOT validation — the server owns that
 * (lib/flowSchema.js) and will refuse a bad drawing regardless. This exists so
 * the studio can say what is missing BEFORE someone clicks submit and waits for
 * a round trip to be told.
 *
 * @returns {string[]} human sentences, empty when the drawing looks submittable
 */
export function draftWarnings(draft) {
  const out = [];
  if (!draft) return ['There is nothing drawn yet.'];
  const nodes = draft.nodes || [];
  const edges = draft.edges || [];
  if (!String(draft.name || '').trim()) out.push('Give the process a name.');
  if (nodes.length < 2) out.push('A process needs at least two steps.');

  for (const n of nodes) {
    const sym = symbolOf(n.kind);
    if (sym.branches) {
      const named = Array.isArray(n.branches) ? n.branches.filter(Boolean) : [];
      if (named.length < 2) {
        out.push(`“${n.label}” is a decision but has fewer than two named branches.`);
      } else {
        const wired = new Set(edges.filter((e) => String(e.from) === String(n.id)).map((e) => e.branch));
        const missing = named.filter((b) => !wired.has(b));
        if (missing.length) out.push(`“${n.label}” has no path for: ${missing.join(', ')}.`);
      }
    }
    if (sym.persona && !n.ai_persona) {
      out.push(`“${n.label}” is an AI step with no assistant chosen.`);
    }
  }

  // An orphan is legal to the schema but reads as a mistake to a provider who
  // adopts the template: they see a step nothing leads to.
  if (nodes.length > 1) {
    const touched = new Set();
    for (const e of edges) { touched.add(String(e.from)); touched.add(String(e.to)); }
    const orphans = nodes.filter((n) => !touched.has(String(n.id)));
    for (const o of orphans) out.push(`“${o.label}” is not connected to anything.`);
  }
  return out;
}
