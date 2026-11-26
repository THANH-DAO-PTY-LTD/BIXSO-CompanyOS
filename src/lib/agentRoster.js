// Who staffs a step — the bridge between the Company space and the canvas.
//
// The contract already existed on the wire and nothing read it: every entry in
// the backend's agent role registry (`backend/lib/agentRoles.js`, served by
// GET /api/company/roles) carries BOTH the AI `persona` it staffs and the flow
// `symbols` it naturally works at. Until 08/08/2026 the Company page consumed
// only label/tagline/skills/module, and the canvas showed bare persona
// identifiers like `contract_drafter` — so the two halves of the product's core
// idea ("your agents are staff, and they work your process") never met on
// screen.
//
// Pure functions over data the caller already fetched: no API calls here, so
// this stays cheap to use inside render.

import {
  Landmark, FileSignature, Users, MessagesSquare, Megaphone, Rocket, Sparkles, ClipboardCheck,
} from 'lucide-react';

/**
 * Per-role badge look — icon + tint — shared by every surface that shows
 * "who staffs this" (canvas node badges today; Company space can adopt it
 * later). Tints derive from tokens via color-mix, never a per-screen hex.
 * `ai_staff` doubles as the fallback for any role the map doesn't know yet.
 */
export const ROLE_BADGE = Object.freeze({
  finance:  { icon: Landmark,      fg: 'var(--svc-sky, #3E8EF7)',    bg: 'color-mix(in srgb, var(--svc-sky, #3E8EF7) 14%, var(--svc-surface))' },
  legal:    { icon: FileSignature, fg: 'var(--svc-violet, #7C5CD1)', bg: 'color-mix(in srgb, var(--svc-violet, #7C5CD1) 14%, var(--svc-surface))' },
  crm:      { icon: Users,         fg: 'var(--svc-primary)',         bg: 'color-mix(in srgb, var(--svc-primary) 14%, var(--svc-surface))' },
  comms:    { icon: MessagesSquare, fg: 'var(--svc-ink)',            bg: 'color-mix(in srgb, var(--svc-ink) 10%, var(--svc-surface))' },
  sales:    { icon: Megaphone,     fg: 'var(--svc-amber)',           bg: 'color-mix(in srgb, var(--svc-amber) 16%, var(--svc-surface))' },
  admin:    { icon: ClipboardCheck, fg: 'var(--svc-violet, #7C5CD1)', bg: 'color-mix(in srgb, var(--svc-violet, #7C5CD1) 12%, var(--svc-surface))' },
  marketing:{ icon: Rocket,        fg: 'var(--svc-primary)',         bg: 'color-mix(in srgb, var(--svc-primary) 12%, var(--svc-surface))' },
  ai_staff: { icon: Sparkles,      fg: 'var(--svc-secondary)',       bg: 'color-mix(in srgb, var(--svc-secondary) 14%, var(--svc-surface))' },
});

/** Roles keyed by id, exactly as GET /api/company/roles returns them. */
const asRoles = (roles) => (roles && typeof roles === 'object' ? roles : {});

/**
 * The role that staffs a flow node.
 *   • an ai_step is staffed by whichever role declares that persona
 *   • every other block is staffed by the role that lists its symbol
 * Returns { id, ...role } or null when nothing in the registry claims it —
 * null is a real answer (a plain `step` is the provider's own hands, and
 * saying "nobody" is more honest than assigning a default agent).
 */
export function roleForNode(node, roles) {
  if (!node) return null;
  const R = asRoles(roles);

  if (node.kind === 'ai_step') {
    const persona = node.ai_persona || null;
    // 'bixso' is the GENERIC persona and comms shares it — a generic ai_step
    // is AI Staff's post, never Comms'. Mirrors backend rolesForNodes.
    const byPersona = persona && persona !== 'bixso'
      ? Object.entries(R).find(([, r]) => r?.persona === persona)
      : null;
    if (byPersona) return { id: byPersona[0], ...byPersona[1] };
    // An ai_step with an unmapped/generic persona is still AI work.
    return R.ai_staff ? { id: 'ai_staff', ...R.ai_staff } : null;
  }

  const bySymbol = Object.entries(R).find(([, r]) => (r?.symbols || []).includes(node.kind));
  return bySymbol ? { id: bySymbol[0], ...bySymbol[1] } : null;
}

/** Display name for the agent staffing a node, preferring the provider's own
 *  naming of that agent over the SP role label. */
export function agentNameForNode(node, roles, agents = []) {
  const role = roleForNode(node, roles);
  if (!role) return null;
  const hired = (agents || []).find((a) => a.role === role.id);
  return hired?.name || role.label || role.id;
}

/**
 * The reverse view, for an agent card: which blocks of which flows this role
 * actually stands in. Counts real nodes in real flows — never an estimate.
 * `flows` must be full flow objects (with `nodes`), not the list summaries.
 */
export function postsForRole(roleId, roles, flows = []) {
  const R = asRoles(roles);
  const role = R[roleId];
  if (!role) return [];
  const out = [];
  for (const flow of flows || []) {
    const nodes = (flow?.nodes || []).filter((n) => {
      if (n.kind === 'ai_step') return role.persona && n.ai_persona === role.persona;
      return (role.symbols || []).includes(n.kind);
    });
    if (nodes.length) {
      out.push({
        flowId: flow.id,
        flowName: flow.name,
        flowState: flow.state,
        nodes: nodes.map((n) => ({ id: n.id, label: n.label, kind: n.kind })),
      });
    }
  }
  return out;
}

/** Flat count of staffed blocks across the given flows. */
export function postCountForRole(roleId, roles, flows = []) {
  return postsForRole(roleId, roles, flows).reduce((n, f) => n + f.nodes.length, 0);
}

/** Persona id → the agent label that owns it, for pickers that would otherwise
 *  show raw identifiers (`contract_drafter`) to a plumber. */
export function personaLabels(roles) {
  const R = asRoles(roles);
  const out = {};
  for (const [id, r] of Object.entries(R)) {
    if (r?.persona && !out[r.persona]) out[r.persona] = r.label || id;
  }
  return out;
}
