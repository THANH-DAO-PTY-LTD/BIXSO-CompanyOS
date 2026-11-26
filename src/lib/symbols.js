// symbols — frontend mirror of the backend symbol registry (lib/flowSchema.js
// SYMBOLS). Workspace OS remaster 28/07/2026: the 5-symbol language became an
// extensible registry; this file owns how each symbol LOOKS (icon, colour,
// palette grouping). Behaviour flags must stay in lock-step with the backend —
// the backend is the law, this is the lens.
import {
  CircleDot, Sparkles, GitBranch, UserRound, DollarSign, FileText,
  Stamp, Hourglass, MessageCircle, Boxes,
} from 'lucide-react';

export const SYMBOLS = {
  step:       { label: 'Step',           category: 'Work',      icon: CircleDot,     color: 'var(--svc-slate)',   soft: 'var(--svc-surface-sunk)', branches: false, persona: false, client: false },
  ai_step:    { label: 'AI step',        category: 'AI',        icon: Sparkles,      color: 'var(--svc-secondary)', soft: 'var(--svc-mint-50)',    branches: false, persona: true,  client: false },
  gateway:    { label: 'Decision',       category: 'Decision',  icon: GitBranch,     color: 'var(--svc-amber)',   soft: '#FCF2DE',                 branches: true,  persona: false, client: false },
  touchpoint: { label: 'Customer touch', category: 'Client',    icon: UserRound,     color: 'var(--svc-primary)', soft: 'var(--svc-coral-50)',     branches: false, persona: false, client: true  },
  payment:    { label: 'Payment',        category: 'Money',     icon: DollarSign,    color: 'var(--svc-sky, #3E8EF7)', soft: '#E8F1FE',            branches: false, persona: false, client: true  },
  document:   { label: 'Document',       category: 'Paperwork', icon: FileText,      color: '#7C5CD1',            soft: '#F1EDF9',                 branches: false, persona: false, client: false },
  approval:   { label: 'Approval',       category: 'Decision',  icon: Stamp,         color: 'var(--svc-amber)',   soft: '#FCF2DE',                 branches: false, persona: false, client: false },
  wait:       { label: 'Wait',           category: 'Work',      icon: Hourglass,     color: 'var(--svc-slate)',   soft: 'var(--svc-surface-sunk)', branches: false, persona: false, client: false },
  comms:      { label: 'Message',        category: 'Client',    icon: MessageCircle, color: 'var(--svc-primary)', soft: 'var(--svc-coral-50)',     branches: false, persona: false, client: true  },
  // MASTER WORKFLOW (20/08/2026) — ký hiệu thứ 10: khối quy-trình-con trên bản
  // đồ master của công ty. flow_ref trỏ flow con, null = Ô TRỐNG được đề xuất.
  // Chỉ hợp lệ trong flow role 'master' (backend enforce) — KHÔNG đưa vào
  // palette Design của flow thường (SYMBOL_CATEGORIES không có 'Structure').
  subflow:    { label: 'Sub-process',    category: 'Structure', icon: Boxes,         color: 'var(--svc-ink, #23262B)', soft: 'var(--svc-surface-sunk)', branches: false, persona: false, client: false },
};

export const SYMBOL_KINDS = Object.keys(SYMBOLS);

/** Palette groups, in display order. */
export const SYMBOL_CATEGORIES = ['Work', 'AI', 'Decision', 'Client', 'Money', 'Paperwork'];

/** Safe lookup — unknown kinds render as a plain step instead of crashing. */
export function symbolOf(kind) {
  return SYMBOLS[kind] || SYMBOLS.step;
}

export const AI_PERSONAS = [
  'bixso', 'negotiator', 'care', 'marketer', 'bookkeeper',
  'contract_drafter', 'flow_designer', 'planner', 'concierge', 'copilot',
];

export const FLOW_STATES = ['active', 'inactive', 'draft'];

/** Effective state for flows saved before the state field existed. */
export function flowStateOf(flow) {
  if (!flow) return 'draft';
  if (FLOW_STATES.includes(flow.state)) return flow.state;
  return (flow.published_version || 0) > 0 ? 'active' : 'draft';
}
