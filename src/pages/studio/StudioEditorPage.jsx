// StudioEditorPage — the three-panel BFT editor.
//
// This is the Gen-1 "BFT Design" layout, recovered from git history (deleted in
// 0852e07) and rebuilt on the Gen-2 data model:
//
//   ┌ top bar (56px): name · saved-state · zoom-free · Preview · Save · Submit ┐
//   │ palette 280 │ canvas (flex)                    │ properties 280         │
//   └─────────────┴──────────────────────────────────┴────────────────────────┘
//
// What was borrowed: the shape (palette left, canvas centre, properties right),
// the inline-edit title with a live saved indicator, the AI designer arriving as
// a LEFT-PANEL REPLACEMENT rather than a modal over the canvas, the properties
// panel swapping role with the selection, undo, and the keyboard shortcuts.
//
// What was NOT borrowed: the Gen-1 engine. That canvas placed 39 UI components
// at x/y to build a SCREEN; this one draws a PROCESS in the 9-symbol language
// that every ProviderFlow already speaks, so an approved drawing is adopted by
// the existing "Load onto canvas" path with no translation layer and no second
// runtime (docs/BFT-STUDIO-EXPERT-ROLE.md §AD-2/§AD-4).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Sparkles, Eye, Save, Send, Undo2, Loader2, Trash2, X, HelpCircle,
  CheckCircle2, AlertTriangle, Info, Play, Workflow, Bot, LibraryBig, Search,
  Copy, Plus, Wand2, Route, ListTree, ChevronRight,
} from 'lucide-react';
import SelaMark from '@/components/sela/SelaMark';
import ProcessCanvas from '@/components/workspace/canvas/ProcessCanvas';
import FlowMiniMap from '@/components/workspace/canvas/FlowMiniMap';
import { SYMBOLS, SYMBOL_KINDS, SYMBOL_CATEGORIES, AI_PERSONAS, symbolOf } from '@/lib/symbols';
import * as draftOps from '@/lib/flowDraft';
import { draftWarnings } from '@/lib/flowDraft';
import {
  getExpertBft, saveExpertBft, submitExpertBft, draftBftAI,
  getFlow, saveFlow, createFlow, publishFlow, draftFlowAI,
} from '@/lib/spFlowApi';
import { SERVICE_CATEGORIES } from '@/lib/marketplaceSearch';
import './studio-editor.css';

const INK = 'var(--svc-ink)';
const MUTED = 'var(--svc-text-muted)';
const LINE = 'var(--svc-border)';
const SURFACE = 'var(--svc-surface)';
const SURFACE_2 = 'var(--svc-surface-2, #F4F6F8)';
const CORAL = 'var(--svc-primary)';
const MINT = 'var(--svc-secondary)';
const AMBER = 'var(--svc-amber, #D08700)';
const DANGER = 'var(--svc-danger, #E5484D)';
const UNDO_LIMIT = 20;

/** The same 9 trade keys the backend validates against (domain/search.js). */
const TRADES = SERVICE_CATEGORIES;

const FLOW_PATTERNS = [
  {
    id: 'enquiry-booking', name: 'Enquiry to booking', description: 'Capture, qualify, quote and confirm a new customer.',
    nodes: [
      ['start', 'touchpoint', 'Customer sends an enquiry'],
      ['qualify', 'step', 'Qualify the request'],
      ['quote', 'document', 'Prepare the quote'],
      ['approve', 'approval', 'Approve pricing'],
      ['confirm', 'comms', 'Confirm the booking'],
    ],
    edges: [['start', 'qualify'], ['qualify', 'quote'], ['quote', 'approve'], ['approve', 'confirm']],
  },
  {
    id: 'quote-cash', name: 'Quote to payment', description: 'A governed path from accepted scope to collected payment.',
    nodes: [
      ['scope', 'touchpoint', 'Confirm scope with customer'],
      ['decision', 'gateway', 'Is the quote accepted?'],
      ['deliver', 'step', 'Complete the agreed work'],
      ['invoice', 'document', 'Issue the invoice'],
      ['paid', 'payment', 'Collect payment'],
      ['follow', 'comms', 'Follow up on the quote'],
    ],
    edges: [
      ['scope', 'decision'], ['decision', 'deliver', 'Yes'], ['decision', 'follow', 'No'],
      ['deliver', 'invoice'], ['invoice', 'paid'], ['follow', 'decision'],
    ],
  },
  {
    id: 'service-care', name: 'Service and aftercare', description: 'Deliver consistently, check quality and request feedback.',
    nodes: [
      ['booked', 'touchpoint', 'Booking is confirmed'], ['prepare', 'step', 'Prepare the job'],
      ['deliver', 'step', 'Deliver the service'], ['check', 'approval', 'Quality check'],
      ['care', 'comms', 'Send aftercare message'], ['review', 'touchpoint', 'Request customer feedback'],
    ],
    edges: [['booked', 'prepare'], ['prepare', 'deliver'], ['deliver', 'check'], ['check', 'care'], ['care', 'review']],
  },
];

const AGENT_PATTERNS = [
  {
    id: 'agent-qualify', name: 'Enquiry qualification', description: 'Teach what a good lead looks like and when a human decides.',
    nodes: [
      ['input', 'touchpoint', 'Read the incoming request'], ['knowledge', 'document', 'Use qualification examples'],
      ['judge', 'gateway', 'Does the request meet the rules?'], ['prepare', 'ai_step', 'Prepare the recommended next action'],
      ['review', 'approval', 'Human approves the decision'], ['escalate', 'comms', 'Ask a human for missing context'],
    ],
    edges: [['input', 'knowledge'], ['knowledge', 'judge'], ['judge', 'prepare', 'Yes'], ['judge', 'escalate', 'No'], ['prepare', 'review']],
  },
  {
    id: 'agent-quote', name: 'Quote preparation', description: 'Combine pricing knowledge, exceptions and approval boundaries.',
    nodes: [
      ['request', 'touchpoint', 'Receive the scoped request'], ['rules', 'document', 'Apply pricing rules and examples'],
      ['draft', 'ai_step', 'Draft the quote'], ['exception', 'gateway', 'Is an exception required?'],
      ['approval', 'approval', 'Human approves the quote'], ['escalate', 'comms', 'Escalate the exception'],
    ],
    edges: [['request', 'rules'], ['rules', 'draft'], ['draft', 'exception'], ['exception', 'approval', 'No'], ['exception', 'escalate', 'Yes']],
  },
  {
    id: 'agent-care', name: 'Customer care response', description: 'Teach tone, known answers and the human escalation line.',
    nodes: [
      ['message', 'touchpoint', 'Customer asks for help'], ['context', 'document', 'Read service history and response examples'],
      ['answer', 'ai_step', 'Prepare a helpful response'], ['risk', 'gateway', 'Is this sensitive or unresolved?'],
      ['send', 'approval', 'Human checks and sends'], ['hand', 'comms', 'Hand over to the owner'],
    ],
    edges: [['message', 'context'], ['context', 'answer'], ['answer', 'risk'], ['risk', 'send', 'No'], ['risk', 'hand', 'Yes']],
  },
];

const AGENT_SYMBOL_LABELS = {
  step: 'Method step', ai_step: 'Agent action', gateway: 'Business rule',
  touchpoint: 'Work input', payment: 'Price check', document: 'Knowledge & examples',
  approval: 'Human approval', wait: 'Wait or escalate', comms: 'Agent response',
};

function materializePattern(pattern) {
  const ids = new Map(pattern.nodes.map(([key]) => [key, draftOps.newNodeId()]));
  return {
    name: pattern.name,
    nodes: pattern.nodes.map(([key, kind, label]) => ({
      id: ids.get(key), kind, label,
      ...(symbolOf(kind).persona ? { ai_persona: 'bixso' } : {}),
      ...(symbolOf(kind).branches ? { branches: ['Yes', 'No'] } : {}),
    })),
    edges: pattern.edges.map(([from, to, branch]) => ({ from: ids.get(from), to: ids.get(to), ...(branch ? { branch } : {}) })),
  };
}

export default function StudioEditorPage({ providerMode = false, assetKind = 'flow' }) {
  const [params] = useSearchParams();
  const id = params.get('id');
  // Preserve the Company OS Department chosen before opening Studio. A new
  // Flow then returns to that Department's Activity list after it is saved.
  const companyArea = params.get('companyArea') || null;
  const { profile } = useOutletContext() || {};
  const navigate = useNavigate();
  const homePath = providerMode ? '/' : '/studio';
  const editorPath = providerMode ? '/workspace/create/editor' : '/studio/editor';
  const isAgentTraining = providerMode && assetKind === 'agent';

  const [bft, setBft] = useState(null);       // the server's copy
  const [draft, setDraft] = useState(null);   // what's on the canvas
  const [selectedId, setSelectedId] = useState(null);
  const [history, setHistory] = useState([]);
  const [aiOpen, setAiOpen] = useState(false);
  const [preview, setPreview] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [saveState, setSaveState] = useState('');   // '' | 'saving' | 'saved'
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');
  const [rehearsePath, setRehearsePath] = useState(null);
  const [paletteView, setPaletteView] = useState('blocks');
  const [startOpen, setStartOpen] = useState(providerMode && !id);
  const [hasTested, setHasTested] = useState(false);
  const [mobilePanel, setMobilePanel] = useState(null);
  const savedSigRef = useRef('');

  const locked = !providerMode && bft?.status === 'submitted';

  // ── Load ──
  useEffect(() => {
    let alive = true;
    if (providerMode && !id) {
      const seed = isAgentTraining
        ? {
            name: 'Untitled agent training',
            nodes: [
              { id: 'training-intake', kind: 'touchpoint', label: 'Work request arrives' },
              { id: 'training-method', kind: 'step', label: 'Apply your business method' },
              { id: 'training-approval', kind: 'approval', label: 'Human reviews the result' },
            ],
            edges: [
              { from: 'training-intake', to: 'training-method' },
              { from: 'training-method', to: 'training-approval' },
            ],
          }
        : draftOps.blankDraft('Untitled flow');
      const local = { id: null, name: seed.name, description: '', category: 'general', status: 'draft', companyArea, nodes: seed.nodes, edges: seed.edges };
      setBft(local);
      setDraft(seed);
      savedSigRef.current = '';
      return undefined;
    }
    if (!id) { navigate(homePath, { replace: true }); return undefined; }
    const loader = providerMode ? getFlow : getExpertBft;
    loader(id)
      .then((b) => {
        if (!alive) return;
        if (!b) { setErr('That drawing could not be found.'); return; }
        setBft(b);
        setDraft({ name: b.name, nodes: b.nodes || [], edges: b.edges || [] });
        savedSigRef.current = JSON.stringify({ name: b.name, nodes: b.nodes, edges: b.edges, category: b.category, description: b.description, companyArea: b.companyArea || b.company_area || null });
      })
      .catch((e) => { if (alive) setErr(e?.message || 'Could not open that drawing.'); });
    return () => { alive = false; };
  }, [homePath, id, isAgentTraining, navigate, providerMode]);

  const pushHistory = useCallback(() => {
    setHistory((h) => [...h.slice(-(UNDO_LIMIT - 1)), JSON.parse(JSON.stringify(draft))]);
  }, [draft]);

  // ── Edits (all six come from the shared pure module) ──
  const edit = useCallback((fn) => {
    if (locked) return;
    pushHistory();
    setDraft((d) => fn(d));
  }, [locked, pushHistory]);

  const addNode = (kind) => edit((d) => draftOps.addNode(d, kind));
  const dropNode = (kind, { afterId = null } = {}) => {
    if (afterId) {
      addNodeAfter(afterId, kind);
      setNotice('Block inserted into the path where you dropped it.');
      return;
    }
    addNode(kind);
    setNotice('Block added to the end of the workflow.');
  };
  const addNodeAfter = (nid, kind = 'step') => {
    const nextId = draftOps.newNodeId();
    edit((d) => draftOps.addNodeAfter(d, nid, kind, { id: nextId }));
    setSelectedId(nextId);
  };
  const duplicateNode = (nid) => {
    const nextId = draftOps.newNodeId();
    edit((d) => draftOps.duplicateNode(d, nid, { id: nextId }));
    setSelectedId(nextId);
  };
  const changeNodeKind = (nid, kind) => edit((d) => draftOps.convertNodeKind(d, nid, kind));
  const updateNode = (nid, patch) => edit((d) => draftOps.updateNode(d, nid, patch));
  const updateBranches = (nid, branches) => edit((d) => draftOps.setNodeBranches(d, nid, branches));
  const addEdge = (from, to) => edit((d) => draftOps.addEdge(d, from, to));
  const removeEdge = (from, to) => edit((d) => draftOps.removeEdge(d, from, to));
  const reorderNode = (nid, col, row) => edit((d) => draftOps.reorderNode(d, nid, col, row));
  const deleteNode = (nid) => { edit((d) => draftOps.deleteNode(d, nid)); setSelectedId(null); };

  function applyPattern(pattern) {
    const next = materializePattern(pattern);
    pushHistory();
    setDraft(next);
    setSelectedId(next.nodes[0]?.id || null);
    setStartOpen(false);
    setPaletteView('blocks');
    setHasTested(false);
    setNotice(`${pattern.name} is on the canvas. Make it match the way your company works.`);
  }

  function undo() {
    setHistory((h) => {
      if (!h.length) return h;
      setDraft(h[h.length - 1]);
      return h.slice(0, -1);
    });
  }

  // ── Save (explicit, plus a quiet autosave like Gen-1's 2s debounce) ──
  const doSave = useCallback(async ({ quiet = false } = {}) => {
    if (!bft || locked || !draft) return null;
    const body = {
      name: draft.name,
      description: bft.description || '',
      category: bft.category,
      ...(providerMode && (bft.companyArea || bft.company_area || companyArea) ? { companyArea: bft.companyArea || bft.company_area || companyArea } : {}),
      nodes: draft.nodes,
      edges: draft.edges,
      ...(bft.screens ? { screens: bft.screens } : {}),
    };
    const sig = JSON.stringify({ name: body.name, nodes: body.nodes, edges: body.edges, category: body.category, description: body.description, companyArea: body.companyArea });
    if (sig === savedSigRef.current) return null;   // nothing changed — no write
    if (!quiet) setBusy('save');
    setSaveState('saving'); setErr('');
    try {
      const updated = providerMode
        ? (bft.id
          ? await saveFlow(bft.id, { ...body, state: bft.state || 'draft' })
          : await createFlow(body))
        : await saveExpertBft(bft.id, body);
      savedSigRef.current = sig;
      setBft((b) => ({ ...b, ...updated }));
      if (providerMode && !bft.id && updated?.id) {
        const next = new URLSearchParams(params);
        next.set('id', String(updated.id));
        next.set('type', assetKind);
        navigate(`${editorPath}?${next.toString()}`, { replace: true });
      }
      setSaveState('saved');
      setTimeout(() => setSaveState((s) => (s === 'saved' ? '' : s)), 1600);
      return updated;
    } catch (e) {
      setSaveState('');
      // A failed save must be LOUD. Gen-1's autosave wrote silently; a drawing
      // someone believes is saved and is not is the worst outcome here.
      setErr(e?.message || 'Could not save. Your work is still on screen — try again.');
      return null;
    } finally { if (!quiet) setBusy(''); }
  }, [assetKind, bft, companyArea, draft, editorPath, locked, navigate, params, providerMode]);

  // ── Submit ──
  const warnings = useMemo(() => (draft ? draftWarnings(draft) : []), [draft]);

  async function doSubmit() {
    if (!bft) return;
    setBusy('submit'); setErr(''); setNotice('');
    try {
      const saved = await doSave();
      const targetId = saved?.id || bft.id;
      if (providerMode && !targetId) throw new Error('Save the private draft before publishing it.');
      const updated = providerMode ? await publishFlow(targetId) : await submitExpertBft(bft.id);
      setBft((b) => ({ ...b, ...updated }));
      setNotice(providerMode
        ? 'Activated in this local workspace.'
        : 'Sent for review. You’ll get a notification with the result.');
    } catch (e) {
      setErr(e?.message || 'Could not submit for review.');
    } finally { setBusy(''); }
  }

  // ── Keyboard shortcuts (the Gen-1 set, minus the ones that had no meaning
  //    here: there is no arrow tool — connecting is a port drag on the canvas) ──
  useEffect(() => {
    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '');
      if (e.key === 'Escape') { setAiOpen(false); setPreview(false); setHelpOpen(false); setSelectedId(null); return; }
      if (typing) return;
      if (e.key === '?') { setHelpOpen((v) => !v); return; }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); doSave(); return; }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd' && selectedId) { e.preventDefault(); duplicateNode(selectedId); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) { e.preventDefault(); deleteNode(selectedId); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const selected = useMemo(
    () => (draft?.nodes || []).find((n) => String(n.id) === String(selectedId)) || null,
    [draft, selectedId],
  );

  if (err && !draft) {
    return (
      <div style={{ padding: 30 }}>
        <p style={{ color: DANGER, fontWeight: 700, fontSize: 13 }}>{err}</p>
        <Link to={homePath} style={{ color: CORAL, fontWeight: 700, fontSize: 13 }}>← Back to Studio</Link>
      </div>
    );
  }
  if (!draft) return <p style={{ fontSize: 13, color: MUTED }}>Loading…</p>;

  return (
    <div className={providerMode ? 'provider-studio-editor' : undefined} style={{ margin: providerMode ? 0 : '-22px -20px -60px', display: 'flex', flexDirection: 'column', height: providerMode ? '100vh' : undefined, minHeight: providerMode ? 0 : 'calc(100vh - 92px)', background: SURFACE_2 }}>
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="studio-editor-topbar"
        style={{
          height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10,
          padding: '0 14px', background: SURFACE, borderBottom: `1px solid ${LINE}`,
        }}
      >
        <Link
          to={homePath}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 700, color: MUTED, textDecoration: 'none' }}
        >
          <ArrowLeft size={14} /> Create Studio
        </Link>
        <span style={{ width: 1, height: 20, background: LINE }} />

        {providerMode && (
          <span className={`studio-asset-type studio-asset-type--${isAgentTraining ? 'agent' : 'flow'}`}>
            {isAgentTraining ? <Bot size={13} /> : <Workflow size={13} />}
            {isAgentTraining ? 'Agent training' : 'Flow'}
          </span>
        )}

        <input
          value={draft.name}
          onChange={(e) => edit((d) => ({ ...d, name: e.target.value.slice(0, 120) }))}
          disabled={locked}
          aria-label="Process name"
          style={{
            border: 'none', borderBottom: '1px dashed transparent', background: 'transparent',
            fontSize: 14, fontWeight: 800, color: INK, minWidth: 180, maxWidth: 320,
            outline: 'none', padding: '3px 0',
          }}
          onFocus={(e) => { e.target.style.borderBottomColor = LINE; }}
          onBlur={(e) => { e.target.style.borderBottomColor = 'transparent'; }}
        />
        {/* Never claim "Saved" unless a write actually returned. */}
        {saveState === 'saving' && <span style={{ fontSize: 11.5, color: MUTED, fontWeight: 700 }}>Saving…</span>}
        {saveState === 'saved' && <span style={{ fontSize: 11.5, color: MINT, fontWeight: 700 }}>✓ Saved</span>}

        <span style={{ flex: 1 }} />

        {locked ? (
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12,
              fontWeight: 800, color: AMBER, background: SURFACE_2, padding: '6px 11px', borderRadius: 9,
            }}
          >
            <Loader2 size={13} className="animate-spin" /> With SP for review — read-only
          </span>
        ) : (
          <>
            <IconBtn onClick={() => setHelpOpen(true)} title="Keyboard shortcuts (?)"><HelpCircle size={15} /></IconBtn>
            <IconBtn onClick={undo} title="Undo (⌘Z)" disabled={!history.length}><Undo2 size={15} /></IconBtn>
            <BarBtn onClick={() => setAiOpen((v) => !v)} tone="#7255D9" active={aiOpen}>
              <Sparkles size={14} /> Sela Designer · Demo
            </BarBtn>
            <BarBtn onClick={() => setPreview(true)}><Eye size={14} /> Preview</BarBtn>
            <BarBtn onClick={() => doSave()} disabled={busy === 'save'} tone={AMBER}>
              {busy === 'save' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
            </BarBtn>
            <BarBtn
              onClick={doSubmit}
              disabled={busy === 'submit' || (!providerMode && profile?.status !== 'approved') || warnings.length > 0}
              solid
              title={
                !providerMode && profile?.status !== 'approved'
                  ? 'Your expert profile needs to be approved first'
                  : warnings.length
                    ? 'Fix what’s listed on the right before submitting'
                    : 'Send to SP for review'
              }
            >
              {busy === 'submit' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} {providerMode ? 'Activate locally' : 'Submit for review'}
            </BarBtn>
            {providerMode && (
              <BarBtn onClick={() => navigate('/workspace/create/creator')} title="Prepare a new reviewed marketplace submission">
                Market submission
              </BarBtn>
            )}
          </>
        )}
      </div>

      {providerMode && (
        <StudioPath
          warnings={warnings}
          hasTested={hasTested}
          published={bft?.state === 'active' || bft?.status === 'published'}
        />
      )}

      {(err || notice) && (
        <div
          style={{
            padding: '8px 16px', fontSize: 12.5, fontWeight: 700,
            background: err ? 'rgba(229,72,77,0.08)' : 'rgba(20,184,138,0.08)',
            color: err ? DANGER : MINT, borderBottom: `1px solid ${LINE}`,
          }}
        >
          {err || notice}
        </div>
      )}

      {/* The reviewer's note, when there is one. */}
      {bft?.review_note && (bft.status === 'changes_requested' || bft.status === 'rejected') && (
        <div
          style={{
            padding: '10px 16px', fontSize: 12.5, background: SURFACE_2,
            borderBottom: `1px solid ${LINE}`, color: INK, display: 'flex', gap: 8,
          }}
        >
          <Info size={15} style={{ color: AMBER, flexShrink: 0, marginTop: 1 }} />
          <span><strong>SP asked for a change:</strong> {bft.review_note}</span>
        </div>
      )}

      {/* ── Three panels ────────────────────────────────────────────────── */}
      <div className="studio-editor-body" style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* LEFT — palette, or the AI designer taking its place (Gen-1 idea:
            never cover the canvas with a modal). */}
        {mobilePanel && <button type="button" className="studio-mobile-scrim" onClick={() => setMobilePanel(null)} aria-label="Close design panel" />}
        <aside className={`studio-palette${mobilePanel === 'tools' ? ' is-mobile-open' : ''}`}
          style={{
            width: 280, flexShrink: 0, borderRight: `1px solid ${LINE}`,
            background: SURFACE, overflowY: 'auto',
          }}
        >
          <button type="button" className="studio-mobile-panel-close" onClick={() => setMobilePanel(null)} aria-label="Close tools"><X size={17} /></button>
          {aiOpen ? (
            <AiPanel
              category={bft?.category}
              draftFn={providerMode ? draftFlowAI : draftBftAI}
              contextLabel={isAgentTraining ? 'agent training plan' : 'flow'}
              onClose={() => setAiOpen(false)}
              onApply={(flow) => {
                pushHistory();
                setDraft({ name: draft.name?.trim() && draft.name !== 'Untitled process' ? draft.name : flow.name, nodes: flow.nodes, edges: flow.edges });
                setAiOpen(false);
                setNotice('AI draft placed on the canvas — adjust it before submitting.');
              }}
            />
          ) : (
            <Palette
              onAdd={addNode}
              onApplyPattern={applyPattern}
              disabled={locked}
              assetKind={assetKind}
              view={paletteView}
              onView={setPaletteView}
            />
          )}
        </aside>

        {/* CENTRE — the real canvas, unchanged from the provider workspace. */}
        <div className="studio-canvas" style={{ flex: 1, minWidth: 0, position: 'relative', background: SURFACE_2 }}>
          <ProcessCanvas
            view={draft}
            mode={locked ? 'run' : 'design'}
            selectedId={selectedId}
            onSelect={(n) => {
              setSelectedId(n ? n.id : null);
              setMobilePanel(n ? 'inspector' : null);
            }}
            onAddEdge={addEdge}
            onDropSymbol={dropNode}
            onAddAfter={addNodeAfter}
            onDuplicateNode={duplicateNode}
            onDeleteNode={deleteNode}
            onReorderNode={reorderNode}
            rehearsePath={rehearsePath}
            onRehearseDone={() => {
              setRehearsePath(null);
              setHasTested(true);
              setNotice(`Test run completed through ${buildRehearsePath(draft)?.length || 0} blocks.`);
            }}
            roles={{}}
            agents={[]}
          />
          {providerMode && (
            <StudioDock
              assetKind={assetKind}
              aiOpen={aiOpen}
              rehearsing={!!rehearsePath}
              onSela={() => {
                setAiOpen((v) => !v);
                setMobilePanel('tools');
              }}
              onDesign={() => { setRehearsePath(null); setAiOpen(false); setMobilePanel(null); }}
              patternsOpen={paletteView === 'patterns'}
              onTest={() => {
                setAiOpen(false);
                const path = buildRehearsePath(draft);
                if (!path || path.length < 2) {
                  setNotice('Connect at least two blocks before starting a test run.');
                  return;
                }
                setRehearsePath(path);
              }}
              onTemplates={() => {
                setAiOpen(false);
                setPaletteView((view) => (view === 'patterns' ? 'blocks' : 'patterns'));
                setMobilePanel('tools');
              }}
            />
          )}
        </div>

        {/* RIGHT — properties, swapping role with the selection (Gen-1 idea). */}
        <aside className={`studio-inspector${mobilePanel === 'inspector' ? ' is-mobile-open' : ''}`}
          style={{
            width: 280, flexShrink: 0, borderLeft: `1px solid ${LINE}`,
            background: SURFACE, overflowY: 'auto',
          }}
        >
          <button type="button" className="studio-mobile-panel-close" onClick={() => setMobilePanel(null)} aria-label="Close block settings"><X size={17} /></button>
          {selected ? (
            <NodeProperties
              node={selected}
              draft={draft}
              disabled={locked}
              onChange={(patch) => updateNode(selected.id, patch)}
              onBranches={(branches) => updateBranches(selected.id, branches)}
              onChangeKind={(kind) => changeNodeKind(selected.id, kind)}
              onAddNext={(kind) => addNodeAfter(selected.id, kind)}
              onDuplicate={() => duplicateNode(selected.id)}
              onDelete={() => deleteNode(selected.id)}
              onRemoveEdge={removeEdge}
            />
          ) : (
            <ReadyPanel
              bft={bft}
              draft={draft}
              warnings={warnings}
              profileStatus={providerMode ? 'provider' : profile?.status}
              providerMode={providerMode}
              assetKind={assetKind}
              hasTested={hasTested}
              onCategory={(c) => setBft((b) => ({ ...b, category: c }))}
              onDescription={(v) => setBft((b) => ({ ...b, description: v }))}
              disabled={locked}
            />
          )}
        </aside>
      </div>

      {preview && <PreviewModal draft={draft} onClose={() => setPreview(false)} />}
      {helpOpen && <ShortcutsModal onClose={() => setHelpOpen(false)} />}
      {startOpen && providerMode && (
        <StudioStart
          assetKind={assetKind}
          patterns={isAgentTraining ? AGENT_PATTERNS : FLOW_PATTERNS}
          onBlank={() => { setStartOpen(false); setNotice('Blank canvas ready. Add the next block or open Patterns when you want a head start.'); }}
          onSela={() => { setStartOpen(false); setAiOpen(true); }}
          onPattern={applyPattern}
          onClose={() => setStartOpen(false)}
        />
      )}
    </div>
  );
}

function StudioPath({ warnings, hasTested, published }) {
  const designReady = warnings.length === 0;
  const steps = [
    { label: 'Design', detail: designReady ? 'Structure ready' : `${warnings.length} item${warnings.length === 1 ? '' : 's'} to resolve`, state: designReady ? 'done' : 'active' },
    { label: 'Test', detail: hasTested ? 'Run completed' : 'Run a scenario', state: hasTested ? 'done' : designReady ? 'active' : 'next' },
    { label: 'Publish', detail: published ? 'Live in Workspace' : 'Private until you publish', state: published ? 'done' : hasTested ? 'active' : 'next' },
  ];
  return (
    <div className="studio-path" aria-label="Studio progress">
      <span className="studio-path-label">BUILD PATH</span>
      {steps.map((step, index) => (
        <React.Fragment key={step.label}>
          {index > 0 && <ChevronRight size={13} aria-hidden="true" />}
          <span className={`studio-path-step ${step.state}`}>
            <i>{step.state === 'done' ? <CheckCircle2 size={12} /> : index + 1}</i>
            <span><strong>{step.label}</strong><small>{step.detail}</small></span>
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

/* ── Left panel: blocks + reusable workflow patterns ─────────────────── */
function Palette({ onAdd, onApplyPattern, disabled, assetKind = 'flow', view = 'blocks', onView }) {
  const [query, setQuery] = useState('');
  const isAgent = assetKind === 'agent';
  const patterns = isAgent ? AGENT_PATTERNS : FLOW_PATTERNS;
  const groups = useMemo(
    () => SYMBOL_CATEGORIES
      .map((cat) => [cat, SYMBOL_KINDS
        .filter((kind) => SYMBOLS[kind].category === cat && kind !== 'subflow')
        .map((kind) => ({ kind, ...SYMBOLS[kind] }))
        .filter((item) => `${item.label} ${AGENT_SYMBOL_LABELS[item.kind] || ''}`.toLowerCase().includes(query.toLowerCase()))])
      .filter(([, items]) => items.length),
    [query],
  );

  return (
    <div className="studio-library-panel">
      <div className="studio-panel-heading">
        <div><strong>{isAgent ? 'Training tools' : 'Workflow tools'}</strong><small>Build from a block or a proven pattern.</small></div>
      </div>
      <div className="studio-library-tabs" role="tablist">
        <button type="button" className={view === 'blocks' ? 'active' : ''} onClick={() => onView('blocks')}><ListTree size={14} /> Blocks</button>
        <button type="button" className={view === 'patterns' ? 'active' : ''} onClick={() => onView('patterns')}><Route size={14} /> Patterns</button>
      </div>

      {view === 'blocks' ? (
        <>
          <label className="studio-tool-search"><Search size={14} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a block" /></label>
          <div className="studio-block-groups">
            {groups.map(([cat, items]) => (
              <section key={cat}>
                <p>{isAgent && cat === 'Paperwork' ? 'Knowledge' : cat}</p>
                <div className="studio-block-grid">
                  {items.map(({ kind, label, icon: Icon }) => {
                    const sym = symbolOf(kind);
                    const displayLabel = isAgent ? (AGENT_SYMBOL_LABELS[kind] || label) : label;
                    return (
                      <button
                        key={kind}
                        type="button"
                        onClick={() => onAdd(kind)}
                        draggable={!disabled}
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = 'copy';
                          e.dataTransfer.setData('application/x-service-place-symbol', kind);
                        }}
                        disabled={disabled}
                        title={`Add ${displayLabel}`}
                      >
                        <span style={{ background: sym.soft, color: sym.color }}><Icon size={14} /></span>
                        <b>{displayLabel}</b>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
          <p className="studio-panel-tip"><Info size={13} /> Select a block for quick actions. Drag its output port to create a new path.</p>
        </>
      ) : (
        <div className="studio-pattern-list">
          <div className="studio-pattern-intro"><Wand2 size={15} /><span><strong>Start with structure</strong><small>Patterns replace the current canvas. Undo restores your version.</small></span></div>
          {patterns.map((pattern) => (
            <button type="button" key={pattern.id} onClick={() => onApplyPattern(pattern)} disabled={disabled}>
              <span><Route size={15} /></span>
              <span><strong>{pattern.name}</strong><small>{pattern.description}</small><em>{pattern.nodes.length} blocks</em></span>
              <ChevronRight size={14} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function buildRehearsePath(flow) {
  const nodes = flow?.nodes || [];
  const edges = flow?.edges || [];
  if (!nodes.length) return null;
  const incoming = new Set(edges.map((edge) => String(edge.to)));
  let current = nodes.find((node) => !incoming.has(String(node.id))) || nodes[0];
  const path = [];
  const seen = new Set();
  while (current && !seen.has(String(current.id))) {
    const id = String(current.id);
    path.push(id);
    seen.add(id);
    const nextEdge = edges.find((edge) => String(edge.from) === id && !seen.has(String(edge.to)));
    current = nextEdge ? nodes.find((node) => String(node.id) === String(nextEdge.to)) : null;
  }
  return path;
}

function StudioStart({ assetKind, patterns, onBlank, onSela, onPattern, onClose }) {
  const isAgent = assetKind === 'agent';
  return (
    <div className="studio-start-backdrop" role="dialog" aria-label="Start designing">
      <section className="studio-start">
        <header>
          <div className={isAgent ? 'agent' : 'flow'}>{isAgent ? <Bot size={20} /> : <Workflow size={20} />}</div>
          <span><small>CREATE STUDIO</small><h2>{isAgent ? 'How should this agent learn the work?' : 'How does this work move through your company?'}</h2></span>
          <button type="button" onClick={onClose} aria-label="Close start guide"><X size={18} /></button>
        </header>
        <p className="studio-start-lead">
          {isAgent
            ? 'Begin with the judgement, examples and human boundaries that make your method reliable.'
            : 'Begin with an outcome. Studio will help you turn it into clear steps, decisions and handovers.'}
        </p>
        <div className="studio-start-primary">
          <button type="button" onClick={onSela}>
            <SelaMark size={38} style={{}} />
            <span><strong>Design it with Sela</strong><small>Describe the real work in your own words. Sela prepares an editable first draft.</small></span>
            <ChevronRight size={17} />
          </button>
        </div>
        <div className="studio-start-divider"><span>or start from a pattern</span></div>
        <div className="studio-start-patterns">
          {patterns.map((pattern) => (
            <button type="button" onClick={() => onPattern(pattern)} key={pattern.id}>
              <Route size={16} /><span><strong>{pattern.name}</strong><small>{pattern.description}</small></span><em>{pattern.nodes.length} blocks</em>
            </button>
          ))}
        </div>
        <footer>
          <button type="button" onClick={onBlank}><Plus size={15} /> Start from a blank canvas</button>
          <span>Everything remains private until you publish.</span>
        </footer>
      </section>
    </div>
  );
}

function StudioDock({ assetKind, aiOpen, rehearsing, patternsOpen, onSela, onDesign, onTest, onTemplates }) {
  return (
    <div className="studio-bottom-dock" data-canvas-item>
      <button type="button" className={`studio-sela-command${aiOpen ? ' active' : ''}`} onClick={onSela}>
        <SelaMark size={34} style={{}} />
        <span><strong>Sela</strong><small>{assetKind === 'agent' ? 'Training partner' : 'Process designer'}</small></span>
        <Sparkles size={15} />
      </button>
      <span className="studio-dock-divider" />
      <button type="button" className={!rehearsing ? 'active' : ''} onClick={onDesign}>
        <Workflow size={16} /><span>Design</span>
      </button>
      <button type="button" className={rehearsing ? 'active' : ''} onClick={onTest}>
        <Play size={16} /><span>{rehearsing ? 'Running' : 'Test run'}</span>
      </button>
      <button type="button" className={patternsOpen ? 'active' : ''} onClick={onTemplates}>
        <LibraryBig size={16} /><span>Patterns</span>
      </button>
    </div>
  );
}

/* ── Left panel (alt): AI designer ────────────────────────────────────── */
function AiPanel({ category, onClose, onApply, draftFn = draftBftAI, contextLabel = 'process' }) {
  const [text, setText] = useState('');
  const [flow, setFlow] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const agentContext = contextLabel.includes('agent');
  const prompts = agentContext
    ? ['Teach how to qualify a request', 'Define the human approval boundary', 'Turn examples into a training path']
    : ['Map enquiry to confirmed booking', 'Improve a quote and payment flow', 'Add customer aftercare'];

  async function run() {
    setBusy(true); setErr('');
    try {
      const f = draftFn === draftFlowAI ? await draftFn(text) : await draftFn(text, category);
      if (!f) throw new Error('Sela did not return a usable draft.');
      setFlow(f);
    } catch (e) { setErr(e?.message || 'AI is unavailable right now.'); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <Sparkles size={13} style={{ color: '#A855F7' }} />
        <h3 style={{ fontSize: 12, fontWeight: 800, color: INK, margin: 0, flex: 1 }}>Sela Designer</h3>
        <button type="button" onClick={onClose} aria-label="Close AI designer" style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED }}>
          <X size={14} />
        </button>
      </div>
      <p style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.5, margin: '0 0 8px' }}>
        Describe the {contextLabel} the way you would teach it to someone in the trade.
        This local demo fills an editable draft. No AI model is called and nothing is saved by generating a draft.
      </p>
      <div className="studio-sela-prompts">
        {prompts.map((prompt) => <button type="button" key={prompt} onClick={() => setText(prompt)}>{prompt}</button>)}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder="e.g. How a bookkeeper takes on a new small-business client, from first call to the first monthly report."
        style={{
          width: '100%', border: `1px solid ${LINE}`, borderRadius: 9, padding: 9,
          fontSize: 12.5, fontFamily: 'inherit', resize: 'vertical', color: INK, background: SURFACE,
        }}
      />
      {err && <p style={{ fontSize: 11.5, color: DANGER, fontWeight: 700, margin: '6px 0 0' }}>{err}</p>}
      <button
        type="button"
        onClick={run}
        disabled={busy || text.trim().length < 15}
        style={{
          width: '100%', marginTop: 8, padding: '9px 12px', borderRadius: 9, border: 'none',
          background: '#A855F7', color: '#fff', fontSize: 12.5, fontWeight: 800,
          cursor: busy ? 'default' : 'pointer', opacity: busy || text.trim().length < 15 ? 0.55 : 1,
        }}
      >
        {busy ? 'Designing…' : 'Create demo draft'}
      </button>

      {flow && (
        <div style={{ marginTop: 12, border: `1px solid ${LINE}`, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ background: SURFACE_2 }}>
            <FlowMiniMap flow={flow} height={92} />
          </div>
          <div style={{ padding: 10 }}>
            <p style={{ fontSize: 12.5, fontWeight: 800, color: INK, margin: 0 }}>{flow.name}</p>
            <p style={{ fontSize: 11.5, color: MUTED, margin: '2px 0 8px' }}>
              {flow.nodes.length} steps · {flow.edges.length} connections
            </p>
            <button
              type="button"
              onClick={() => onApply(flow)}
              style={{
                width: '100%', padding: '8px 10px', borderRadius: 8, border: 'none',
                background: CORAL, color: '#fff', fontSize: 12.5, fontWeight: 800, cursor: 'pointer',
              }}
            >
              Put it on the canvas
            </button>
            <p style={{ fontSize: 11, color: MUTED, margin: '7px 0 0', lineHeight: 1.45 }}>
              This replaces what’s on the canvas. Undo (⌘Z) brings your version back.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Right panel: the selected step ──────────────────────────────────── */
function NodeProperties({ node, draft, disabled, onChange, onBranches, onChangeKind, onAddNext, onDuplicate, onDelete, onRemoveEdge }) {
  const sym = symbolOf(node.kind);
  const outgoing = (draft.edges || []).filter((edge) => String(edge.from) === String(node.id));
  const NodeIcon = sym.icon;

  return (
    <div className="studio-properties">
      <div className="studio-properties-head">
        <span style={{ background: sym.soft, color: sym.color }}><NodeIcon size={16} /></span>
        <div><small>SELECTED BLOCK</small><h3>{node.label || sym.label}</h3></div>
      </div>

      <Field label="Block type">
        <select value={node.kind} onChange={(e) => onChangeKind(e.target.value)} disabled={disabled} style={inputStyle}>
          {SYMBOL_KINDS.filter((kind) => kind !== 'subflow').map((kind) => <option key={kind} value={kind}>{SYMBOLS[kind].label}</option>)}
        </select>
      </Field>

      <Field label="What happens here">
        <input value={node.label} onChange={(e) => onChange({ label: e.target.value.slice(0, 80) })} disabled={disabled} style={inputStyle} />
      </Field>

      {sym.persona && (
        <Field label="Which assistant does it">
          <select value={node.ai_persona || 'bixso'} onChange={(e) => onChange({ ai_persona: e.target.value })} disabled={disabled} style={inputStyle}>
            {AI_PERSONAS.map((persona) => <option key={persona} value={persona}>{persona}</option>)}
          </select>
        </Field>
      )}

      {sym.branches && (
        <Field label="The ways this can go (2–4)">
          {(node.branches || []).map((branch, index) => (
            <div key={index} className="studio-branch-row">
              <input
                value={branch}
                onChange={(e) => {
                  const next = [...(node.branches || [])];
                  next[index] = e.target.value.slice(0, 40);
                  onBranches(next);
                }}
                disabled={disabled}
                style={{ ...inputStyle, flex: 1 }}
              />
              {(node.branches || []).length > 2 && !disabled && (
                <button type="button" onClick={() => onBranches((node.branches || []).filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${branch}`}><X size={12} /></button>
              )}
            </div>
          ))}
          {(node.branches || []).length < 4 && !disabled && (
            <button type="button" className="studio-add-branch" onClick={() => onBranches([...(node.branches || []), `Option ${(node.branches || []).length + 1}`])}>+ Add a path</button>
          )}
        </Field>
      )}

      {!disabled && (
        <div className="studio-quick-build">
          <div><strong>Continue the workflow</strong><small>The next block is inserted without breaking the current path.</small></div>
          <div>
            {[
              ['step', 'Step'], ['gateway', 'Decision'], ['approval', 'Approval'], ['ai_step', 'AI action'],
            ].map(([kind, label]) => {
              const item = symbolOf(kind);
              const ItemIcon = item.icon;
              return <button type="button" key={kind} onClick={() => onAddNext(kind)} title={`Add ${label}`}><ItemIcon size={13} /><span>{label}</span></button>;
            })}
          </div>
        </div>
      )}

      <Field label="Next paths">
        {outgoing.length === 0 && <p className="studio-empty-path">No next path yet. Add a block above or drag the output port on the canvas.</p>}
        {outgoing.map((edge, index) => {
          const target = (draft.nodes || []).find((candidate) => String(candidate.id) === String(edge.to));
          return (
            <div key={index} className="studio-outgoing-row">
              <span>{edge.branch && <b>{edge.branch}</b>}<em>→</em>{target?.label || edge.to}</span>
              {!disabled && <button type="button" onClick={() => onRemoveEdge(edge.from, edge.to)} aria-label="Remove this connection"><X size={12} /></button>}
            </div>
          );
        })}
      </Field>

      {!disabled && (
        <div className="studio-property-actions">
          <button type="button" onClick={onDuplicate}><Copy size={14} /> Duplicate</button>
          <button type="button" onClick={onDelete} className="danger"><Trash2 size={14} /> Delete</button>
        </div>
      )}
    </div>
  );
}

/* ── Right panel (no selection): is this ready to submit? ─────────────── */
function ReadyPanel({ bft, draft, warnings, profileStatus, onCategory, onDescription, disabled, providerMode = false, assetKind = 'flow', hasTested = false }) {
  const checks = [
    { label: 'Named clearly', done: !!String(draft.name || '').trim() },
    { label: 'Connected structure', done: (draft.nodes || []).length >= 2 && warnings.every((warning) => !warning.includes('connected')) },
    { label: 'Purpose described', done: !!String(bft?.description || '').trim() },
    { label: 'Test run completed', done: hasTested },
  ];
  const score = Math.round((checks.filter((check) => check.done).length / checks.length) * 100);
  return (
    <div className="studio-ready-panel">
      <div className="studio-panel-heading"><div><strong>{assetKind === 'agent' ? 'Training blueprint' : 'Workflow setup'}</strong><small>Define where this belongs and what success means.</small></div></div>

      <Field label="Trade it belongs to">
        <select value={bft?.category || 'general'} onChange={(e) => onCategory(e.target.value)} disabled={disabled} style={inputStyle}>
          {TRADES.map((t) => <option key={t.key} value={t.key}>{t.label || t.key}</option>)}
        </select>
      </Field>

      <Field label={assetKind === 'agent' ? 'What this agent should learn' : 'Outcome this workflow produces'}>
        <textarea
          value={bft?.description || ''}
          onChange={(e) => onDescription(e.target.value.slice(0, 600))}
          disabled={disabled}
          rows={4}
          placeholder={assetKind === 'agent' ? 'Describe the business judgement and result this training should produce.' : 'Describe the customer or operating outcome this workflow should produce.'}
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
        />
      </Field>

      <div className="studio-health">
        <div className="studio-health-score"><span><strong>Design health</strong><small>{score === 100 ? 'Ready for a final review' : 'Keep shaping and testing'}</small></span><b>{score}%</b></div>
        <div className="studio-health-bar"><i style={{ width: `${score}%` }} /></div>
        <ul className="studio-health-checks">
          {checks.map((check) => <li className={check.done ? 'done' : ''} key={check.label}>{check.done ? <CheckCircle2 size={14} /> : <span />}{check.label}</li>)}
        </ul>
      </div>

      <div className="studio-readiness-detail">
        {warnings.length === 0 ? (
          <p className="studio-ready-message"><CheckCircle2 size={15} />
            {providerMode
              ? `This ${assetKind === 'agent' ? 'training blueprint' : 'flow'} is ready for your Workspace. Market submission stays separate.`
              : profileStatus === 'approved'
                ? 'This looks complete. Submit when you’re happy with it.'
                : 'The drawing looks complete — submitting opens up once your profile is approved.'}
          </p>
        ) : (
          <ul className="studio-warning-list">
            {warnings.map((warning, index) => <li key={index}><AlertTriangle size={14} />{warning}</li>)}
          </ul>
        )}
        <p className="studio-structure-count">{(draft.nodes || []).length} blocks · {(draft.edges || []).length} connections</p>
      </div>
    </div>
  );
}

/* ── Preview (Gen-1 idea: 3 device frames, read-only) ─────────────────── */
function PreviewModal({ draft, onClose }) {
  const [device, setDevice] = useState('desktop');
  const width = device === 'mobile' ? 390 : device === 'tablet' ? 768 : null;
  return (
    <Modal onClose={onClose} label="Preview">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: `1px solid ${LINE}` }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: AMBER, letterSpacing: '0.05em' }}>PREVIEW</span>
        <strong style={{ fontSize: 13, color: INK }}>{draft.name}</strong>
        <span style={{ flex: 1 }} />
        {['desktop', 'tablet', 'mobile'].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDevice(d)}
            style={{
              padding: '5px 10px', borderRadius: 8, fontSize: 11.5, fontWeight: 700,
              border: `1px solid ${device === d ? CORAL : LINE}`, cursor: 'pointer',
              background: device === d ? 'rgba(255,106,61,0.08)' : 'transparent',
              color: device === d ? CORAL : MUTED, textTransform: 'capitalize',
            }}
          >
            {d}
          </button>
        ))}
        <button type="button" onClick={onClose} aria-label="Close preview" style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, marginLeft: 4 }}>
          <X size={16} />
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'grid', placeItems: 'center', background: SURFACE_2, padding: 16 }}>
        <div
          style={{
            width: width || '100%', height: '100%', maxHeight: '100%', background: SURFACE,
            border: `1px solid ${LINE}`, borderRadius: device === 'mobile' ? 22 : 12, overflow: 'hidden',
          }}
        >
          {/* Run mode = exactly what a provider sees after adopting it. */}
          <ProcessCanvas view={draft} mode="run" roles={{}} agents={[]} />
        </div>
      </div>
      <p style={{ fontSize: 11.5, color: MUTED, padding: '8px 14px', margin: 0, borderTop: `1px solid ${LINE}` }}>
        This is how the process appears in a provider’s workspace once they adopt it.
      </p>
    </Modal>
  );
}

function ShortcutsModal({ onClose }) {
  const rows = [
    ['⌘/Ctrl + Z', 'Undo the last change'],
    ['⌘/Ctrl + S', 'Save now'],
    ['Delete / Backspace', 'Delete the selected step'],
    ['Esc', 'Deselect / close a panel'],
    ['?', 'Show this help'],
  ];
  return (
    <Modal onClose={onClose} label="Keyboard shortcuts" width={420}>
      <div style={{ padding: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: INK, margin: '0 0 12px' }}>Keyboard shortcuts</h3>
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '6px 0' }}>
            <code
              style={{
                fontSize: 11, fontWeight: 700, background: SURFACE_2, border: `1px solid ${LINE}`,
                borderRadius: 6, padding: '3px 7px', minWidth: 130, textAlign: 'center', color: INK,
              }}
            >
              {k}
            </code>
            <span style={{ fontSize: 12.5, color: MUTED }}>{v}</span>
          </div>
        ))}
        <button
          type="button"
          onClick={onClose}
          style={{
            marginTop: 14, width: '100%', padding: '9px 12px', borderRadius: 9,
            border: `1px solid ${LINE}`, background: 'transparent', color: INK,
            fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
          }}
        >
          Close
        </button>
      </div>
    </Modal>
  );
}

/* ── Small shared bits ────────────────────────────────────────────────── */
const inputStyle = {
  width: '100%', border: `1px solid ${LINE}`, borderRadius: 8, padding: '7px 9px',
  fontSize: 12.5, color: INK, background: SURFACE, outline: 'none',
};

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: MUTED, marginBottom: 5, letterSpacing: '0.03em' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function IconBtn({ children, onClick, title, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={disabled}
      style={{
        width: 30, height: 30, borderRadius: 8, border: `1px solid ${LINE}`,
        background: SURFACE, color: disabled ? LINE : MUTED, cursor: disabled ? 'default' : 'pointer',
        display: 'grid', placeItems: 'center',
      }}
    >
      {children}
    </button>
  );
}

function BarBtn({ children, onClick, disabled, solid, tone, active, title }) {
  const colour = tone || CORAL;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px',
        borderRadius: 9, fontSize: 12.5, fontWeight: 800, cursor: disabled ? 'not-allowed' : 'pointer',
        border: solid ? 'none' : `1px solid ${active ? colour : LINE}`,
        background: solid ? CORAL : active ? `${colour}14` : SURFACE,
        color: solid ? '#fff' : active ? colour : INK,
        opacity: disabled ? 0.5 : 1, whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

function Modal({ children, onClose, label, width }) {
  return (
    <div
      role="dialog"
      aria-label={label}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.42)',
        backdropFilter: 'blur(4px)', zIndex: 200, display: 'grid', placeItems: 'center', padding: 24,
      }}
    >
      <div
        style={{
          width: width || 'min(1100px, 100%)', maxHeight: '90vh', background: SURFACE,
          border: `1px solid ${LINE}`, borderRadius: 16, overflow: 'hidden',
          display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(15,23,42,0.24)',
        }}
      >
        {children}
      </div>
    </div>
  );
}
