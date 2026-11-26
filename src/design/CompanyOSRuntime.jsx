import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2, Workflow, Bot, UserRound, X, ArrowRight, PanelLeftClose, PanelRightClose, PanelLeftOpen, PanelRightOpen,
  RefreshCw, Plus, FileText, ShieldCheck, Zap, Clock3, GitBranch, CheckCircle2,
  Sparkles, BriefcaseBusiness, Maximize2, Bell, Settings, MessageSquareText,
} from 'lucide-react';
import { layoutFlow } from '../lib/flowLayout';
import { spApi } from '../api/spApi';
import NotificationBell from '../components/shared/NotificationBell';
import Logo from '../components/shared/Logo';
import CompanyEcosystem from './CompanyEcosystem';
import CompanyOSCanvas from './CompanyOSCanvas';
import CompanyOSProcessWork from './CompanyOSProcessWork';
import CompanyOSProcessOverview from './CompanyOSProcessOverview';
import CompanyOSDrillCard from './CompanyOSDrillCard';
import { processTasks } from './companyOSWorkDetails.mjs';
import { groupCompanyFlows } from './companyOSEcosystem.mjs';
import {
  parentFlow, flowNavigation, flowScope, nodeResponsibility, nodeOperatingCard,
  eventVerb, flowOperatingSummary, workItemsForNode,
} from './companyOSNavigation.mjs';
import './company-os-runtime.css';
import './company-os-navigation-rail.css';
import './company-os-information-flow.css';
import './company-os-polish.css';

export const COMPANY_OS_OFFICIAL_BOUNDARY = 'Company OS is a local workspace.';
export const COMPANY_OS_FIRST_RUN_KEY = 'sp.company-os.1.first-run.story.dismissed';
export const COMPANY_OS_GENERAL_TEMPLATE = {
  id: 'general-service-company',
  title: 'General service company',
  subtitle: 'A safe starting shell for any provider before industry-specific templates are available.',
  companyAreas: ['Customers', 'Work delivery', 'Finance', 'Suppliers', 'Trust & compliance'],
  firstFlow: 'Receive request → prepare response → human approval → deliver work → collect payment',
  workerPath: 'Every Work item has a clear worker: Human for responsibility, Agent for prepared support.',
};
const COMPANY_TEMPLATES = [
  { id: 'general-service-company', icon: Building2, title: 'General service company', category: 'general', description: 'A simple starting map for a small service business.', areas: ['Customers', 'Work delivery', 'Finance'], firstFlow: 'Find new customers', badge: 'Recommended' },
  { id: 'trades-service-company', icon: BriefcaseBusiness, title: 'Trade services', category: 'trades', description: 'For quoting, booking, site work and invoicing.', areas: ['Enquiries', 'Jobs & scheduling', 'Suppliers'], firstFlow: 'Enquiry to booked job' },
  { id: 'home-service-company', icon: Building2, title: 'Home services', category: 'general', description: 'For recurring household services and customer care.', areas: ['Customers', 'Visits', 'Follow-up'], firstFlow: 'Request to confirmed visit' },
  { id: 'professional-service-company', icon: FileText, title: 'Professional services', category: 'general', description: 'For briefs, recommendations and reviewed delivery.', areas: ['Client intake', 'Delivery', 'Trust & compliance'], firstFlow: 'Brief to approved proposal' },
  { id: 'consulting-service-company', icon: Workflow, title: 'Consulting', category: 'general', description: 'For discovery, advice, decisions and next actions.', areas: ['Discovery', 'Recommendation', 'Client care'], firstFlow: 'Discovery to recommendation' },
  { id: 'health-wellness-service-company', icon: Sparkles, title: 'Health & wellness', category: 'health', description: 'For enquiries, appointments and careful follow-up.', areas: ['Enquiries', 'Appointments', 'Care'], firstFlow: 'Enquiry to confirmed appointment' },
];
const SERVICE_OPTIONS = COMPANY_TEMPLATES.map((template) => template.title);
const FLOW_NODE_WIDTH = 188;
const FLOW_NODE_HEIGHT = 164;
const SPACE_STORY = [
  { icon: Building2, label: 'Company', body: 'The map of your business.' },
  { icon: Workflow, label: 'Flow', body: 'The route inside one company card.' },
  { icon: BriefcaseBusiness, label: 'Work', body: 'The real job with a Human or Agent assigned.' },
];
const FIRST_RUN_QUESTIONS = [
  'What service do you sell most often?',
  'Which repeatable job should become your first Flow?',
  'Who must approve the output before Sela sends, charges or publishes anything?',
];
const DEFAULT_FREE_FLOW = {
  name: 'Product photography',
  blocks: ['Review the request', 'Prepare the image', 'Hand over the result'],
};
const TEMPLATE_FLOW_BLUEPRINT = [
  { step: 'Intake', text: 'Capture the customer, request, location and urgency.' },
  { step: 'Prepare', text: 'Draft the quote, reply, checklist or recommendation.' },
  { step: 'Approve', text: 'Human confirms the action before external impact.' },
  { step: 'Deliver', text: 'Work moves into a Work Shell with a clear owner.' },
  { step: 'Settle', text: 'Invoice, Energy and next follow-up stay visible.' },
];

const DEPARTMENT_MODULES = {
  care: [
    ['clients', 'Customers', 'Customer records and service history'],
    ['messages', 'Messages', 'Customer conversations and follow-up'],
    ['jobs', 'Jobs', 'Open customer work linked to this area'],
  ],
  delivery: [
    ['jobs', 'Jobs', 'Delivery work, site visits and fulfilment'],
    ['listings', 'My services & listings', 'Services customers can request'],
    ['messages', 'Messages', 'Delivery updates and customer handover'],
  ],
  finance: [
    ['leads', 'Enquiries & quotes', 'Quote requests and pricing decisions'],
    ['invoices', 'Invoices', 'Invoices, receipts and payment status'],
    ['billing', 'Energy & billing', 'Energy use and operating costs'],
  ],
  growth: [
    ['listings', 'My services & listings', 'Published offers and service pages'],
    ['leads', 'Enquiries & quotes', 'New demand entering the company'],
    ['messages', 'Messages', 'Lead nurture and reply drafts'],
  ],
  assurance: [
    ['contracts', 'Contracts', 'Agreements, insurance and evidence'],
    ['settings', 'Settings', 'Business rules and approval boundaries'],
    ['billing', 'Energy & billing', 'Cost controls before work is assigned'],
  ],
  operations: [
    ['jobs', 'Jobs', 'Unclassified work'],
    ['settings', 'Settings', 'Map this route into a department later'],
  ],
};
const DEPARTMENT_PROFILES = {
  care: {
    owner: 'Customer care owner',
    mission: 'Turn customer questions into clear requests, replies and follow-up without losing the relationship history.',
    input: 'New enquiries, customer replies, service notes and feedback.',
    output: 'Qualified customer needs, follow-up messages and jobs ready for Delivery.',
    control: 'Sela may draft replies, but a Human approves anything sent to a customer.',
    next: 'Review the care rhythm, then open the Flow route that turns enquiries into customer work.',
    metrics: [['2h', 'Target reply'], ['2', 'Flow routes'], ['3', 'Modules']],
    activity: [
      ['message', 'Today · 09:12', 'New enquiry triaged', 'Sela grouped a customer request with the existing relationship history.'],
      ['flow', 'Today · 09:20', 'Follow-up rhythm reviewed', 'Customer follow-up can draft the next helpful message after a completed job.'],
      ['check', 'Next', 'Needs owner decision', 'Approve whether this department starts from the care Flow or a new enquiry Flow.'],
    ],
  },
  delivery: {
    owner: 'Delivery owner',
    mission: 'Coordinate the accepted job, schedule, resources and handover so the promised result is delivered cleanly.',
    input: 'Accepted quotes, booking details, site notes and supplier requirements.',
    output: 'Completed service, delivery evidence and a customer-ready handover.',
    control: 'Work is only assigned after a Flow has the job boundary, owner and approval step.',
    next: 'Open the delivery Flow to inspect handover, evidence and where AI can prepare checklists.',
    metrics: [['2', 'Flow routes'], ['10', 'Cards'], ['0', 'Open jobs']],
    activity: [
      ['job', 'Today · 10:05', 'Delivery board prepared', 'A sample booked-job route is available for scheduling and handover review.'],
      ['flow', 'Today · 10:18', 'Checklist draft available', 'Operations Agent can prepare a job checklist after Human assignment.'],
      ['clock', 'Next', 'Waiting for real request', 'No customer Work item is live in this department yet.'],
    ],
  },
  finance: {
    owner: 'Finance owner',
    mission: 'Keep quotes, invoices, payments and Energy visible before work is closed.',
    input: 'Quote requests, approved scope, invoice items and payment events.',
    output: 'Approved quote, issued invoice, reconciled payment and clear cost record.',
    control: 'A Human approves price, invoice and any external payment action.',
    next: 'Use the quote-to-invoice route to connect enquiries, invoices and Energy/billing.',
    metrics: [['1', 'Flow route'], ['4', 'Cards'], ['A$0', 'Live value']],
    activity: [
      ['invoice', 'Today · 09:42', 'Invoice template ready', 'Finance Agent can prepare invoice details once a real job exists.'],
      ['billing', 'Today · 09:48', 'Energy boundary checked', 'Costs remain visible before any Work item is closed.'],
      ['check', 'Next', 'Owner approval required', 'Confirm pricing rules before publishing or sending finance actions.'],
    ],
  },
  growth: {
    owner: 'Growth owner',
    mission: 'Connect new enquiries to your company workflow.',
    input: 'Service offers, listing copy, referral ideas and market signals.',
    output: 'Published services, qualified enquiries and next customer opportunities.',
    control: 'A Human approves public listing changes before they go live.',
    next: 'Open a Flow to see the steps for handling enquiries.',
    metrics: [['2', 'Flow routes'], ['9', 'Cards'], ['1', 'SP listing path']],
    activity: [
      ['platform', 'Today · 08:55', 'Sample listing reviewed', 'Listing Agent suggested copy improvements for customer discovery.'],
      ['flow', 'Today · 09:02', 'Find new customers ready', 'The free starter Flow is available as the first acquisition route.'],
      ['message', 'Next', 'Prepare customer offer', 'Sela can draft the offer, but the provider approves publication.'],
    ],
  },
  assurance: {
    owner: 'Business assurance owner',
    mission: 'Keep agreements, records, insurance, evidence and business rules ready before work creates risk.',
    input: 'Contracts, insurance, licences, approvals, evidence and operating rules.',
    output: 'Reviewable records, renewal reminders and clear approval boundaries.',
    control: 'Trust and compliance items stay Human-owned even when Sela prepares checklists.',
    next: 'Open the assurance Flow to inspect contracts, settings and Energy boundaries.',
    metrics: [['14d', 'Insurance reminder'], ['1', 'Flow route'], ['3', 'Control modules']],
    activity: [
      ['shield', 'Today · 09:30', 'Insurance reminder created', 'Sela marked a sample renewal check for review in this department.'],
      ['file', 'Today · 09:36', 'Record checklist drafted', 'Contract Agent can prepare the checklist; owner confirms the final state.'],
      ['check', 'Next', 'Set approval boundary', 'Confirm what Sela can prepare versus what a Human must decide.'],
    ],
  },
  operations: {
    owner: 'Business owner',
    mission: 'Hold operating routes that are not mapped to a specific department yet.',
    input: 'Unclassified work, notes and imported legacy Flow routes.',
    output: 'A department assignment and a clearer Company → Flow → Work path.',
    control: 'No external action until the route has a responsible owner.',
    next: 'Map this route into a department before hiring capacity.',
    metrics: [['0', 'Live routes'], ['0', 'Cards'], ['0', 'Work']],
    activity: [['flow', 'Next', 'Map route to department', 'Sela can help classify the route before Work is assigned.']],
  },
};

// Live-data migration surface. No fixture imports or writes: canonical Shell owns operations.
export default function CompanyOSRuntime(props) {
  return <CompanyOSRuntimeCore {...props}/>;
}
function CompanyOSRuntimeCore({
  flows, businessName, workItems = [], companyTemplateKey = '', onSetupTemplate, active = true,
  onStudio, onLibrary, onHire, onTask, onModule, sampleNotice,
}) {
  const [flowId, setFlowId] = useState(() => new URLSearchParams(window.location.search).get('flowId'));
  const [companyCard, setCompanyCard] = useState(null);
  const [areaView, setAreaView] = useState(false);
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef(null);
  const [selected, setSelected] = useState(null);
  const [left, setLeft] = useState(() => window.innerWidth > 1024);
  const [right, setRight] = useState(() => window.innerWidth > 1024);
  const [focusedNodeId, setFocusedNodeId] = useState(() => new URLSearchParams(window.location.search).get('processId'));
  const dialogRef = useRef(null);
  const [navigationError, setNavigationError] = useState('');
  const [activity, setActivity] = useState({ status: 'idle', rows: [] });
  const [attempt, setAttempt] = useState(0);
  const [serviceType, setServiceType] = useState('');
  const [setupOpen, setSetupOpen] = useState(() => !companyTemplateKey);
  const [templateId, setTemplateId] = useState(() => companyTemplateKey || COMPANY_OS_GENERAL_TEMPLATE.id);
  const [templateState, setTemplateState] = useState('idle');
  const [templateError, setTemplateError] = useState('');
  const [setupSelaNote, setSetupSelaNote] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [workProcess, setWorkProcess] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('shell') === 'work' ? flows.find(item => String(item.id) === params.get('flowId'))?.nodes?.find(node => String(node.id) === params.get('processId')) || null : null;
  });
  const [processOverview, setProcessOverview] = useState(null);
  const [entryTaskId, setEntryTaskId] = useState(() => new URLSearchParams(window.location.search).get('taskId'));
  const [departmentDetail, setDepartmentDetail] = useState(null);
  const departmentDialogRef = useRef(null);
  const [noticeIndex, setNoticeIndex] = useState(0);
  const [flowPreviewIndex, setFlowPreviewIndex] = useState(-1);
  const [welcomeDismissed, setWelcomeDismissed] = useState(() => {
    try { return window.localStorage.getItem(COMPANY_OS_FIRST_RUN_KEY) === '1'; }
    catch { return false; }
  });
  const flow = flows.find(row => String(row.id) === flowId) || null;
  const selectedTemplate = COMPANY_TEMPLATES.find((template) => template.id === templateId) || COMPANY_TEMPLATES[0];
  const parent = parentFlow(flows, flow);
  const navigation = useMemo(() => flowNavigation(flows), [flows]);
  const showFirstRun = !flow && !welcomeDismissed && !flows.length;
  const focusedNode = flow?.nodes?.find(node => String(node.id) === focusedNodeId);
  const focusedNodeCard = focusedNode ? nodeOperatingCard(focusedNode, activity.rows) : null;
  const focusedNodeTasks = focusedNode ? processTasks(focusedNode) : [];
  useEffect(() => {
    if (!workProcess || !flow) return;
    const current = flow.nodes?.find(node => node.id === workProcess.id);
    if (current && current !== workProcess) setWorkProcess(current);
  }, [flow, workProcess]);
  useEffect(() => {
    if (!active || workProcess) return undefined;
    // 14/09/2026: lớp Flow phải mang `flowId` — không có nó, "giải thích quy trình này" từ thanh Sela
    // luôn phải hỏi lại "quy trình nào?" dù chủ đang nhìn thẳng vào nó.
    window.dispatchEvent(new CustomEvent('company-os-selection', { detail: { title: focusedNode?.label || flow?.name || companyCard?.title || businessName || 'your company', shell: flow ? 'flow' : 'company', flowId: flow?.id || undefined, processId: focusedNode?.id || undefined } }));
    return () => window.dispatchEvent(new CustomEvent('company-os-selection', { detail: null }));
  }, [active, workProcess, focusedNode?.label, flow?.name, companyCard?.title, businessName]);
  const graph = useMemo(() => layoutFlow(flow, { nodeWidth: FLOW_NODE_WIDTH, nodeHeight: FLOW_NODE_HEIGHT, columnGap: 248, laneGap: 220, paddingX: 30, paddingY: 36 }), [flow]);
  useEffect(() => {
    if (!flow || !canvasRef.current) return undefined;
    const fit = () => {
      const width = canvasRef.current?.clientWidth || 0;
      if (width) setZoom(Math.max(.3, Math.min(1, (width - 56) / Math.max(graph.width, 700))));
    };
    const frame = window.requestAnimationFrame(fit);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
    observer?.observe(canvasRef.current);
    return () => { window.cancelAnimationFrame(frame); observer?.disconnect(); };
  }, [flowId, graph.width, flow]);
  const flowRunNodes = flow?.nodes || [];
  const previewNode = flowPreviewIndex >= 0 ? flowRunNodes[flowPreviewIndex] : null;
  const activeFlowNodeId = focusedNodeId || previewNode?.id || null;
  useEffect(() => { setFlowPreviewIndex(-1); }, [flowId]);
  useEffect(() => {
    if (flowPreviewIndex < 0) return undefined;
    if (!flowRunNodes.length) { setFlowPreviewIndex(-1); return undefined; }
    if (flowPreviewIndex >= flowRunNodes.length - 1) {
      const done = window.setTimeout(() => setFlowPreviewIndex(-1), 1200);
      return () => window.clearTimeout(done);
    }
    const timer = window.setTimeout(() => setFlowPreviewIndex((value) => value + 1), 850);
    return () => window.clearTimeout(timer);
  }, [flowPreviewIndex, flowRunNodes.length]);
  useEffect(() => {
    if (!flowId) { setActivity({ status: 'idle', rows: [] }); return undefined; }
    if (flow?.sampleOnly) { setActivity({ status: 'ready', rows: [] }); return undefined; }
    let active = true;
    setActivity({ status: 'loading', rows: [] });
    spApi.get(`flows/${encodeURIComponent(flowId)}/events`).then((response) => {
      if (!Array.isArray(response)) throw new Error('Unexpected flow activity response');
      if (active) setActivity({ status: 'ready', rows: response });
    }).catch(() => { if (active) setActivity({ status: 'error', rows: [] }); });
    return () => { active = false; };
  }, [flowId, flow?.sampleOnly, attempt]);
  useEffect(() => { if (selected && dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal(); }, [selected]);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 1024px)');
    const compact = () => { setLeft(!media.matches); setRight(!media.matches); };
    media.addEventListener('change', compact);
    return () => media.removeEventListener('change', compact);
  }, []);
  useEffect(() => {
    document.body.classList.toggle('sp-company-os-modal-active', active && setupOpen);
    return () => document.body.classList.remove('sp-company-os-modal-active');
  }, [active, setupOpen]);
  useEffect(() => {
    if (departmentDetail && departmentDialogRef.current && !departmentDialogRef.current.open) {
      departmentDialogRef.current.showModal();
    }
  }, [departmentDetail]);
  useEffect(() => {
    const timer = window.setInterval(() => setNoticeIndex((value) => value + 1), 6500);
    return () => window.clearInterval(timer);
  }, []);
  const open = (id) => {
    if (!flows.some(row => String(row.id) === String(id))) { setNavigationError('This linked flow is unavailable. It may have been removed or is outside your access.'); return; }
    setNavigationError(''); setSelected(null); setFocusedNodeId(null); setFlowId(String(id)); setZoom(1);
    if (window.innerWidth <= 1024) { setLeft(false); setRight(false); }
  };
  const toggleRail = (side) => {
    if (side === 'left') { setLeft(!left); if (window.innerWidth <= 1024) setRight(false); }
    else { setRight(!right); if (window.innerWidth <= 1024) setLeft(false); }
  };
  const dismissFirstRun = () => {
    setWelcomeDismissed(true);
    try { window.localStorage.setItem(COMPANY_OS_FIRST_RUN_KEY, '1'); } catch {}
  };
  const applyCompanyTemplate = async () => {
    if (templateState === 'saving') return;
    setTemplateState('saving'); setTemplateError('');
    try {
      await onSetupTemplate?.(selectedTemplate);
      setTemplateState('done');
      setSetupOpen(false);
    } catch (error) {
      setTemplateError(error?.message || 'This company template could not be saved. Please try again.');
      setTemplateState('idle');
    }
  };
  const currentEvents = activity.rows.filter((event) => !focusedNodeId || String(event.nodeId) === focusedNodeId);
  const workForNode = (nodeId) => workItemsForNode(flow?.id, nodeId, workItems);
  const selectedWorkItems = selected ? workForNode(selected.id) : [];
  const summary = flowOperatingSummary(flow, activity.rows);
  const selectedCard = selected ? nodeOperatingCard(selected, activity.rows) : null;
  const selectedNeedsAgent = Boolean(selected?.ai_persona) || /agent/i.test(String(selectedCard?.owner || ''));
  const rootFlows = navigation.filter(row => row.depth === 0);
  const liveWorkCount = workItems.length;
  const openWorkCount = workItems.filter((item) => !/complete|closed|sent/i.test(String(item.status || item.wait || ''))).length;
  const reviewMode = false;
  const shellLabel = flow || areaView ? 'Flow Shell' : 'Company Shell';
  const identityName = businessName || 'Your company';
  const identityInitials = identityName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'SP';
  const reviewOnlyFlows = [];
  const companyDiagramAreas = groupCompanyFlows([...rootFlows.map(row => row.flow), ...reviewOnlyFlows]);
  const activeArea = companyCard?.external ? companyDiagramAreas.find(area => area.id === companyCard.area) : companyDiagramAreas.find(area => area.id === companyCard?.id);
  const areaFlows = flowScope(flows, activeArea?.flows || []);
  const areaFlowIds = new Set(areaFlows.map(row => String(row.id)));
  const areaStepCount = areaFlows.reduce((total, row) => total + (row.nodes?.filter(node => !node.flow_ref).length || 0), 0);
  const areaWorkItems = workItems.filter((item) => areaFlowIds.has(String(item.flowId)));
  const areaOpenWork = areaWorkItems.filter((item) => !/complete|closed|sent/i.test(String(item.status || item.wait || ''))).length;
  const areaOwner = companyCard?.external ? 'Outside company' : activeArea?.flows.length ? 'Business owner' : 'Not assigned yet';
  const selectedCompanyTitle = companyCard?.title || 'Company overview';
  const rightRailFlows = companyCard ? (activeArea?.flows || []) : companyDiagramAreas.flatMap(area => area.flows);
  const departmentModules = (area) => DEPARTMENT_MODULES[area?.id] || DEPARTMENT_MODULES.operations;
  const departmentProfile = (area) => {
    const profile = DEPARTMENT_PROFILES[area?.id] || DEPARTMENT_PROFILES.operations;
    return reviewMode ? profile : { ...profile, metrics: [], activity: [] };
  };
  const relationshipFacts = {
    customers: ['Enquiries, preferences and feedback', 'Replies, progress updates and service results'],
    suppliers: ['Availability, materials and delivery dates', 'Resource requests and agreed requirements'],
    platform: ['Service discovery and incoming opportunities', 'Your service listings and availability'],
    partners: ['Referrals and specialist support', 'Briefs and coordinated handovers'],
    authorities: ['Requirements and renewal reminders', 'Evidence, agreements and compliance records'],
    accountant: ['Reconciliation questions and financial advice', 'Invoices, payments and financial records'],
  };
  const selectedProfile = companyCard?.external ? {
    mission: companyCard.description,
    owner: `${activeArea?.title || 'Company'} · internal contact`,
    input: relationshipFacts[companyCard.id]?.[0],
    output: relationshipFacts[companyCard.id]?.[1],
    control: 'You review information before sharing it outside your company.',
    next: `Follow the connection to ${activeArea?.title || 'your department'} to see its Flows and work.`,
    metrics: [],
    activity: [],
  } : companyCard ? departmentProfile(activeArea) : null;
  const activityIcon = (kind) => ({
    message: MessageSquareText,
    flow: Workflow,
    job: BriefcaseBusiness,
    invoice: FileText,
    billing: Zap,
    shield: ShieldCheck,
    file: FileText,
    platform: Sparkles,
    check: CheckCircle2,
    clock: Clock3,
  }[kind] || Bell);
  const flowRailDetail = (item) => {
    const nodes = Array.isArray(item.nodes) ? item.nodes : [];
    const aiNodes = nodes.filter(node => node.ai_persona || node.kind === 'ai_step');
    const humanNodes = nodes.filter(node => ['step', 'approval', 'payment', 'touchpoint', 'document', 'comms'].includes(node.kind));
    const aiName = item.sampleAi || (aiNodes[0]?.ai_persona ? `AI · ${aiNodes[0].ai_persona}` : 'Sela can prepare work after a Human assigns it');
    const ownerName = item.sampleOwner || (humanNodes.length ? 'Human owner · approves external action' : 'Flow owner · not assigned yet');
    return {
      description: item.description || 'A repeatable route inside this department.',
      ownerName,
      aiName,
      activity: item.sampleActivity || (item.sampleOnly ? 'Sample only · no live activity' : 'No live activity recorded in this review scope.'),
      aiCount: aiNodes.length,
      humanCount: humanNodes.length,
      cardCount: nodes.length,
    };
  };
  const flowActivitySummary = (item) => {
    const nodes = Array.isArray(item.nodes) ? item.nodes : [];
    const workCount = workItems.filter(row => String(row.flowId ?? row.sourceFlowId ?? '') === String(item.id)).length;
    const aiCount = nodes.filter(node => node.ai_persona || node.kind === 'ai_step').length;
    const humanCount = nodes.filter(node => !node.flow_ref && ['step', 'approval', 'payment', 'touchpoint', 'document', 'comms'].includes(node.kind)).length;
    return {
      processes: nodes.length,
      workCount,
      aiCount,
      humanCount,
      next: workCount ? `${workCount} Work item${workCount === 1 ? '' : 's'} linked` : 'Ready for first Work item',
    };
  };
  const shellTitle = flow
    ? `${flow.name} is open.`
    : areaView
      ? `${activeArea?.title || 'Department'} flows`
      : 'Company overview';
  const shellSubtext = flow
    ? `${flow.nodes?.length || 0} cards · ${summary.find((item) => item.label === 'Jobs seen')?.value || 0} jobs seen · ${flow.state || 'draft'}`
    : areaView
      ? `${activeArea?.flows.length || 0} Flow route${activeArea?.flows.length === 1 ? '' : 's'} · ${areaStepCount} cards · ${areaOpenWork} open Work item${areaOpenWork === 1 ? '' : 's'}`
      : `${companyDiagramAreas.length} departments · ${rootFlows.length} live Flow route${rootFlows.length === 1 ? '' : 's'}${reviewOnlyFlows.length ? ` · ${reviewOnlyFlows.length} sample routes` : ''} · ${liveWorkCount} Work item${liveWorkCount === 1 ? '' : 's'}`;
  const sampleAreaEvents = [
    { time: '09:10', title: `${selectedCompanyTitle} checked`, detail: rightRailFlows.length ? `${rightRailFlows.length} Flow route${rightRailFlows.length === 1 ? '' : 's'} available in this scope.` : 'No saved Flow yet. Sela can help draft the first route.' },
    { time: '09:16', title: 'Sela suggested next action', detail: rightRailFlows.length ? 'Open the Flow, inspect owners, then assign Work only where a real request exists.' : 'Create one repeatable Flow before hiring a Human or Agent.' },
    { time: '09:24', title: 'Company map updated', detail: `${selectedCompanyTitle} remains linked to Company -> Flow -> Work.` },
  ];
  const selectedCompanyActivity = selectedProfile?.activity?.length
    ? selectedProfile.activity.slice(0, 1)
    : reviewMode
      ? sampleAreaEvents.slice(0, 1).map(item => ['flow', item.time, item.title, item.detail])
      : [];
  const activeFlowArea = flow
    ? companyDiagramAreas.find(area => area.flows.some(item => String(item.id) === String(parent?.id || flow.id)))
    : null;
  const notices = [
    { label: 'NOTIFICATIONS', title: 'New enquiries land here', detail: 'Open the request, quote or message from the bell.', action: 'View enquiries', run: () => onModule('leads') },
    { label: 'FLOW ACTIVITY', title: rootFlows.length ? `${rootFlows.length} main Flow ready` : 'No Flow yet', detail: rootFlows.length ? 'Pick a department card to see its Flow routes and activity.' : 'Start with Company setup or Create Studio.', action: rootFlows.length ? 'Open flows' : 'Setup company', run: () => rootFlows.length ? setAreaView(true) : setSetupOpen(true) },
    { label: 'WORK ATTENTION', title: liveWorkCount ? `${liveWorkCount} Work item${liveWorkCount === 1 ? '' : 's'} tracked` : 'No live Work yet', detail: liveWorkCount ? `${openWorkCount} still open across your company.` : 'Work appears only after a Flow creates a real job.', action: liveWorkCount ? 'View jobs' : 'Ask Sela', run: () => liveWorkCount ? onModule('jobs') : window.dispatchEvent(new CustomEvent('company-os-selection', { detail: { title: identityName } })) },
  ];
  const activeNotice = import.meta.env.DEV && sampleNotice ? sampleNotice : notices[noticeIndex % notices.length];
  const detailArea = departmentDetail ? companyDiagramAreas.find(area => area.id === departmentDetail.id) : null;
  const detailFlows = detailArea?.flows || [];
  const detailProfile = departmentProfile(detailArea);
  const detailScope = flowScope(flows, detailFlows);
  const detailResponsibilities = detailScope.flatMap(item => (item.nodes || []).filter(node => !node.flow_ref).map(node => ({ flow: item, node, card: nodeOperatingCard(node) })));
  const detailFlowIds = new Set(detailScope.map(row => String(row.id)));
  const detailWorkItems = workItems.filter((item) => detailFlowIds.has(String(item.flowId)));
  const companyShellActions = useMemo(() => {
    if (flow) return [
      { id: 'flow-current-work', group: 'Next step', label: focusedNode ? (focusedNode.flow_ref ? 'Open selected Subflow' : 'Open selected work') : 'Choose work to coordinate', consequenceLabel: focusedNode?.label || 'Select a responsibility in Activity', primary: true, run: () => { if (focusedNode?.flow_ref) open(focusedNode.flow_ref); else if (focusedNode) { setEntryTaskId(null); setWorkProcess(focusedNode); } else { setRight(true); if (window.innerWidth <= 1024) setLeft(false); } } },
      { id: 'flow-preview', group: 'Explore', label: 'Preview this route', consequenceLabel: 'Preview the sequence', run: () => { setFlowPreviewIndex(0); setRight(true); if (window.innerWidth <= 1024) setLeft(false); } },
      { id: 'flow-next-work', group: 'Sela guides', label: focusedNode ? `Focus ${focusedNode.label || 'current process'}` : 'Focus first process', consequenceLabel: 'Input, owner and output', run: () => { const node = focusedNode || flow.nodes?.[0]; if (node) { setFocusedNodeId(String(node.id)); setProcessOverview(node); } } },
      { id: 'flow-information', group: 'Flow', label: 'View Flow structure', consequenceLabel: 'Master Flow and Subflows', run: () => { setLeft(true); if (window.innerWidth <= 1024) setRight(false); } },
      { id: 'flow-process', group: 'Flow', label: 'Explore process work', consequenceLabel: focusedNode?.label || flow.name, run: () => { setRight(true); if (window.innerWidth <= 1024) setLeft(false); } },
      { id: 'flow-assign', group: 'Design & assignment', label: 'Configure Human / AI', consequenceLabel: 'Responsible role and approval rules in Create Studio', run: () => onStudio({ ...flow, processId: focusedNode?.id, inspector: 'runtime' }) },
      { id: 'flow-studio', group: 'Design', label: 'Design Flow', dock: true, consequenceLabel: 'Edit this Flow in Create Studio · draft', run: () => onStudio({ ...flow, processId: focusedNode?.id }) },
    ];
    const targetTitle = companyCard?.title || identityName;
    const base = [
      {
        id: 'cos-company-open-information',
        group: 'Sela suggests',
        label: companyCard ? `About ${targetTitle}` : 'About my company',
        consequenceLabel: 'Key facts',
        intents: [`Show me the facts for ${targetTitle}`],
        run: () => { setLeft(true); if (window.innerWidth <= 1024) setRight(false); },
      },
      {
        id: 'cos-company-open-activity',
        group: 'Sela suggests',
        label: 'See what needs doing',
        consequenceLabel: companyCard ? `Work in ${targetTitle}` : 'Work across your company',
        intents: [`Review activity for ${targetTitle}`],
        run: () => { setRight(true); if (window.innerWidth <= 1024) setLeft(false); },
      },
      {
        id: 'cos-company-create-flow',
        group: 'Build next',
        label: companyCard && !companyCard.external ? `Create Flow for ${targetTitle}` : 'Create a Flow',
        consequenceLabel: 'Open Create Studio',
        primary: true,
        intents: [`Create a Flow for ${targetTitle}`],
        run: () => onStudio({ name: `${targetTitle} flow`, companyArea: activeArea?.id }),
      },
      {
        id: 'cos-company-flow-library',
        group: 'Build next',
        label: 'Open Flow library',
        consequenceLabel: 'Reuse patterns',
        intents: ['Open the Flow library'],
        run: () => onLibrary(),
      },
      {
        id: 'cos-company-hire',
        group: 'Build next',
        label: companyCard && !companyCard.external ? `Hire for ${targetTitle}` : 'Plan Human or AI capacity',
        consequenceLabel: 'Review capacity',
        intents: [`Plan capacity for ${targetTitle}`],
        run: () => onHire(companyCard && !companyCard.external ? { areaId: activeArea?.id, areaName: targetTitle } : undefined),
      },
    ];
    if (companyCard?.external) return [
      ...base.slice(0, 2),
      { id: 'cos-open-relationship-department', group: 'Continue', label: `Open ${activeArea?.title || 'linked department'}`, consequenceLabel: 'Information and Flows', intents: [`Open the department linked to ${targetTitle}`], run: () => setCompanyCard(activeArea) },
    ];
    if (companyCard && !companyCard.external) {
      base.splice(2, 0, {
        id: 'cos-company-open-department-details',
        group: 'Sela suggests',
        label: `Open ${targetTitle} overview`,
        consequenceLabel: 'Owner and controls',
        intents: [`Open ${targetTitle} department view`],
        run: () => setDepartmentDetail(companyCard),
      });
      base.splice(3, 0, {
        id: 'cos-company-open-department-flows',
        group: 'Build next',
        label: `Open ${targetTitle} Flow view`,
        consequenceLabel: `${activeArea?.flows.length || 0} routes`,
        intents: [`Open ${targetTitle} Flow routes`],
        run: () => setAreaView(true),
      });
    }
    return base;
  }, [activeArea, companyCard, flow, focusedNode?.id, focusedNode?.label, identityName, onHire, onLibrary, onStudio]);
  useEffect(() => {
    if (workProcess) return undefined;
    if (!active || workProcess) {
      window.dispatchEvent(new CustomEvent('company-os-actions', { detail: [] }));
      return undefined;
    }
    window.dispatchEvent(new CustomEvent('company-os-actions', { detail: companyShellActions }));
    return () => window.dispatchEvent(new CustomEvent('company-os-actions', { detail: [] }));
  }, [active, companyShellActions, workProcess]);
  const selectCompanyCard = (card) => { setCompanyCard(card); setRight(true); setLeft(window.innerWidth > 1024); };
  if (workProcess && flow) return <CompanyOSProcessWork key={`${workProcess.id}:${entryTaskId || ''}`} initialTaskId={entryTaskId} onProcess={node => { setEntryTaskId(null); setWorkProcess(node); }} flow={flow} node={workProcess} items={workForNode(workProcess.id)} events={activity.rows.filter(event => String(event.nodeId) === String(workProcess.id))} onBack={() => { setWorkProcess(null); setRight(true); }} onCompany={() => { setWorkProcess(null); setFlowId(null); setAreaView(false); }} onHire={onHire} onTask={onTask} onStudio={onStudio} onProfile={() => onModule('settings')} businessName={identityName} departmentName={activeFlowArea?.title}/>;
  return <section className="cos-runtime">
    <header className="cos-header">
      <div className="cos-brand"><Logo variant="mark-only" showText={false} linkTo={null}/><div><b>BIXSO Company OS</b><span>Local workspace</span></div></div>
      {flow ? <nav className="cos-shell-navigation" aria-label="Flow breadcrumb"><button onClick={() => { setFlowId(null); setAreaView(false); }}>Company</button><ArrowRight size={14}/>{activeFlowArea && <><button onClick={() => { setCompanyCard(activeFlowArea); setFlowId(null); setAreaView(false); }}>{activeFlowArea.title}</button><ArrowRight size={14}/></>}{parent && <><button onClick={() => open(parent.id)}>{parent.name}</button><ArrowRight size={14}/></>}<strong>{flow.name}</strong></nav> : <section className="cos-notification-center" aria-label="Company OS notifications" aria-live="polite">
        <div className="cos-notification-icon"><NotificationBell space="provider" className="cos-notification-bell" /></div>
        <div className="cos-notification-content"><span>{activeNotice.label}</span><b>{activeNotice.title}</b><small>{activeNotice.detail}</small></div>
        <button className="cos-notification-action" type="button" onClick={activeNotice.run}>{activeNotice.action}<ArrowRight size={15}/></button>
        <div className="cos-notification-progress" key={noticeIndex}><i /></div>
      </section>}
      <div className="cos-company-identity">
        <div><b>{identityName}</b><span>{flow ? `${activeFlowArea?.title || 'Company'} · Flow` : 'Company overview'}</span></div>
        <button className="cos-avatar" title="Profile & company configuration" aria-label="Open profile and company configuration" onClick={() => setProfileOpen(!profileOpen)}>{identityInitials}</button>
        {profileOpen && <aside className="cos-profile-popover" aria-label="Profile and company configuration">
          <header><span>{identityInitials}</span><div><strong>{identityName}</strong><small>Provider profile · Company OS</small></div></header>
          <section>
            <small>ACCOUNT</small>
            <button type="button" onClick={() => { setProfileOpen(false); onModule('settings'); }}><Settings size={15}/><span><strong>Profile & settings</strong><em>Name, login, notifications and workspace preferences</em></span></button>
          </section>
          <section>
            <small>COMPANY</small>
            <button type="button" onClick={() => { setProfileOpen(false); setTemplateState('idle'); setTemplateError(''); setSetupSelaNote(''); setSetupOpen(true); }}><Building2 size={15}/><span><strong>Company setup</strong><em>Template, company areas and first Flow structure</em></span></button>
            <div className="cos-profile-stats"><span><b>{companyDiagramAreas.length}</b>Areas</span><span><b>{rootFlows.length}</b>Main Flows</span><span><b>{liveWorkCount}</b>Work</span></div>
          </section>
          <section>
            <small>ENERGY</small>
            <button type="button" onClick={() => { setProfileOpen(false); onModule('billing'); }}><Zap size={15}/><span><strong>Energy & billing</strong><em>Balance, receipts, usage and renewal controls</em></span></button>
          </section>
          <section>
            <small>OPERATIONS</small>
            <button type="button" onClick={() => { setProfileOpen(false); onModule('listings'); }}><BriefcaseBusiness size={15}/><span><strong>Services & listings</strong><em>Public services, customer entry points and offer setup</em></span></button>
            <button type="button" onClick={() => { setProfileOpen(false); onModule('messages'); }}><MessageSquareText size={15}/><span><strong>Messages & support</strong><em>Customer messages and SP support threads</em></span></button>
          </section>
        </aside>}
      </div>
    </header>
    <div className="cos-workstation" data-left={left} data-right={right}>
      {left ? <aside className="cos-rail cos-rail--left" aria-label="Information panel"><header><small>INFORMATION</small><h2>{flow ? flow.name : companyCard?.title || (showFirstRun ? 'Company setup' : identityName)}</h2><button className="cos-rail-toggle" aria-label="Collapse information panel" onClick={() => toggleRail('left')}><PanelLeftClose size={16}/></button></header><div className="cos-rail-body">
        {!flow && companyCard && <section className="cos-operating-card cos-area-context"><span className="cos-context-label">{companyCard.external ? 'External relationship' : 'Department responsibility'}</span><p className="cos-rail-lead">{selectedProfile?.mission || companyCard.description}</p>{companyCard.external && <p>Connected department: <strong>{activeArea?.title || 'Your company'}</strong>.</p>}<div className="cos-area-stats" aria-label="Selected area facts"><div><strong>{activeArea?.flows.length || 0}</strong><span>Flows</span></div><div><strong>{areaStepCount}</strong><span>Cards</span></div><div><strong>{areaWorkItems.length}</strong><span>Work items</span></div></div>{selectedProfile && <div className="cos-department-mini-metrics" aria-label={`${companyCard.title} department metrics`}>{selectedProfile.metrics.map(([value, label]) => <span key={`${value}-${label}`}><strong>{value}</strong>{label}</span>)}</div>}<dl><div><dt><UserRound size={14}/>Owner</dt><dd>{selectedProfile?.owner || areaOwner}</dd></div><div><dt><FileText size={14}/>Input</dt><dd>{selectedProfile?.input || (companyCard.external ? 'External relationship context.' : 'Customer, company or service-place signal.')}</dd></div><div><dt><CheckCircle2 size={14}/>Output</dt><dd>{selectedProfile?.output || 'Clear next operating action.'}</dd></div><div><dt><ShieldCheck size={14}/>Control</dt><dd>{selectedProfile?.control || 'Human approval remains visible before Sela sends, publishes, charges or assigns external work.'}</dd></div><div><dt><BriefcaseBusiness size={14}/>Modules</dt><dd>{companyCard.external ? 'Relationship context only' : departmentModules(activeArea).map(([, label]) => label).join(' · ')}</dd></div></dl>{selectedProfile && <p className="cos-next-note"><Sparkles size={14}/>{selectedProfile.next}</p>}{companyCard.external ? <button onClick={() => setCompanyCard(activeArea)}>Open linked department<ArrowRight size={15}/></button> : <button onClick={() => setDepartmentDetail(companyCard)}>Open department overview<ArrowRight size={15}/></button>}</section>}
        {!flow && !companyCard && !showFirstRun && <section className="cos-operating-card cos-company-info"><span className="cos-context-label">Operating snapshot</span><p className="cos-rail-lead">Your departments, outside relationships and saved Flow routes in one place.</p><div className="cos-area-stats" aria-label="Company facts"><div><strong>{companyDiagramAreas.length}</strong><span>Departments</span></div><div><strong>{rootFlows.length}</strong><span>Live flows</span></div><div><strong>{liveWorkCount}</strong><span>Work items</span></div></div><dl><div><dt><Bell size={14}/>Incoming</dt><dd>Requests, replies and service updates appear in Notifications.</dd></div><div><dt><Workflow size={14}/>Navigate</dt><dd>Select a department to see its responsibility and operating activity.</dd></div><div><dt><Sparkles size={14}/>Coordinate</dt><dd>Ask Sela what needs attention or use a suggested next action.</dd></div></dl></section>}

        {showFirstRun && <section className="cos-operating-card cos-selected-work">
          <small>SELA SETUP RHYTHM</small>
          <h3>{serviceType || 'Choose your service type'}</h3>
          <p>Next: confirm the company shell, create one Master Flow, then decide whether a Human or AI teammate should own each work card.</p>
          <dl>
            <div><dt><Building2 size={14}/>Company</dt><dd>Define the business and operating areas first.</dd></div>
            <div><dt><Workflow size={14}/>Flow</dt><dd>Create a repeatable process before assigning work.</dd></div>
            <div><dt><Bot size={14}/>Agent</dt><dd>Hire only after the flow has clear input, output and approval gates.</dd></div>
          </dl>
        </section>}
        {flow && <section className="cos-operating-card cos-flow-information">
          <div className="cos-information-priority"><span className="cos-context-label">Flow hierarchy</span>
            <nav aria-label="Master Flow and Subflows">{navigation.filter(({flow: row}) => String(row.id) === String(flow.id) || String(row.id) === String(parent?.id) || String(parentFlow(flows,row)?.id) === String(parent?.id || flow.id)).map(({flow: row,depth}) => <button className={`cos-list-item ${depth ? 'cos-child-flow' : 'cos-master-flow'}`} key={row.id} onClick={() => open(row.id)} aria-current={String(row.id) === flowId ? 'page' : undefined}><Workflow size={16}/><span>{row.name}<small>{row.role === 'master' ? 'Master Flow' : depth ? 'Subflow' : 'Flow'}</small></span></button>)}</nav>
          </div>
          <div className="cos-information-secondary"><span className="cos-context-label">{focusedNode ? 'Selected process' : 'Flow overview'}</span>
          {focusedNode ? <div className="cos-selected-context" aria-live="polite">
            <strong>{focusedNode.label || focusedNode.id}</strong>
            <p>{focusedNode.description || focusedNode.operation?.purpose || 'A process inside this Flow.'}</p>
            <dl><div><dt><UserRound size={14}/>Person in charge</dt><dd>{focusedNodeCard?.owner || 'Not assigned'}</dd></div><div><dt><FileText size={14}/>Information in</dt><dd>{focusedNode.operation?.input || focusedNodeTasks[0]?.input || 'Not defined'}</dd></div><div><dt><CheckCircle2 size={14}/>Information out</dt><dd>{focusedNode.operation?.output || focusedNodeTasks[0]?.output || 'Not defined'}</dd></div><div><dt><Clock3 size={14}/>Time</dt><dd>{focusedNode.operation?.sla || focusedNodeTasks[0]?.sla || 'Not defined'}</dd></div></dl>
            <button type="button" onClick={() => setProcessOverview(focusedNode)}><Maximize2 size={14}/>Open process overview</button>
          </div> : <><p>{flow.description}</p><dl><div><dt>Processes</dt><dd>{flow.nodes?.length || 0}</dd></div><div><dt>Status</dt><dd>{flow.state || 'Draft'} · Version {flow.version ?? '—'}</dd></div><div><dt>Work</dt><dd>{workItems.filter(item => String(item.flowId) === String(flow.id)).length} linked items</dd></div></dl><p>Select a process card to see its information and activity.</p></>}
          </div>
        </section>}
      </div></aside> : <button className="cos-rail-tab left" aria-label="Expand information panel" onClick={() => toggleRail('left')}><PanelLeftOpen size={17}/></button>}
      <CompanyOSCanvas key={flow?.id || 'company'} canvasRef={canvasRef} className={flow ? '' : 'cos-canvas--company'} aria-label={flow ? 'Saved flow diagram' : 'Company flows'} zoom={flow ? zoom : undefined} onZoom={flow ? setZoom : undefined} onFit={flow ? () => setZoom(Math.max(.3, Math.min(1, ((canvasRef.current?.clientWidth || 700) - 56) / Math.max(graph.width, 700)))) : undefined}>
        {(!flow && areaView) && <div className="cos-shell-toolbar cos-shell-toolbar--summary"><div><small>{shellLabel.toUpperCase()}</small><strong>{shellTitle}</strong><span>{shellSubtext}</span></div></div>}
        {!flow ? <div className="cos-company-home">
          {showFirstRun && <section className="cos-first-run" aria-label="Sela Company OS onboarding">
            <div className="cos-first-run-copy">
              <small>SELA · COMPANY OS FIRST RUN</small>
              <h2>Hi, I’m Sela. I’ll guide you through your first Company OS setup.</h2>
              <p>Keep track of how your business runs customer work. Company OS has three layers: Company, Flow and Work.</p>
              <div className="cos-space-story" aria-label="Company OS space map">
                {SPACE_STORY.map(({ icon: Icon, label, body }) => <article key={label}>
                  <Icon size={16}/><strong>{label}</strong><span>{body}</span>
                </article>)}
              </div>
              <div className="cos-sela-question">
                <Sparkles size={17} />
                <span>Start with the fictional sample Flow and try opening a Work item.</span>
              </div>
              <div className="cos-service-picker" role="group" aria-label="Choose service type">
                {SERVICE_OPTIONS.map((option) => <button key={option} type="button" aria-pressed={serviceType === option} onClick={() => setServiceType(option)}>{option}</button>)}
              </div>
              <div className="cos-first-run-questions" aria-label="Sela setup questions">
                {FIRST_RUN_QUESTIONS.map((question) => <span key={question}>{question}</span>)}
              </div>
            </div>
            <article className="cos-template-card">
              <small>STARTER TEMPLATE</small>
              <h3>{COMPANY_OS_GENERAL_TEMPLATE.title}</h3>
              <p>{COMPANY_OS_GENERAL_TEMPLATE.subtitle}</p>
              <dl>
                <div><dt>Company areas</dt><dd>{COMPANY_OS_GENERAL_TEMPLATE.companyAreas.join(' · ')}</dd></div>
                <div><dt>First flow</dt><dd>{COMPANY_OS_GENERAL_TEMPLATE.firstFlow}</dd></div>
                <div><dt>Worker rule</dt><dd>{COMPANY_OS_GENERAL_TEMPLATE.workerPath}</dd></div>
              </dl>
              <div className="cos-template-blueprint">
                {TEMPLATE_FLOW_BLUEPRINT.map(({ step, text }, index) => <div key={step}>
                  <b>{index + 1}</b><span><strong>{step}</strong>{text}</span>
                </div>)}
              </div>
              <div className="cos-default-flow">
                <small>FREE DEFAULT FLOW</small>
                <h4>{DEFAULT_FREE_FLOW.name}</h4>
                {DEFAULT_FREE_FLOW.blocks.map((block) => <span key={block}>{block}</span>)}
              </div>
              <footer>
                <button type="button" onClick={() => onStudio({ name: serviceType ? `${serviceType} · ${DEFAULT_FREE_FLOW.name}` : DEFAULT_FREE_FLOW.name, templateKey: COMPANY_OS_GENERAL_TEMPLATE.id, defaultFlow: DEFAULT_FREE_FLOW.name })}><Plus size={15}/>Start with this free Flow</button>
                <button type="button" onClick={onHire}><Bot size={15}/>Preview hire path</button>
                <button type="button" onClick={dismissFirstRun}>I understand</button>
              </footer>
            </article>
          </section>}
          {areaView && <nav className="cos-area-breadcrumb" aria-label="Company navigation"><button onClick={() => { setAreaView(false); setCompanyCard(null); }}>Company overview</button><ArrowRight size={13}/><span>{activeArea?.title} · Flows</span></nav>}
          {!areaView && <CompanyEcosystem
            name={identityName}
            areas={companyDiagramAreas}
            flows={flows}
            workItems={workItems}
            selectedId={companyCard?.id}
            onSelect={selectCompanyCard}
            onOpenDepartment={(area) => { selectCompanyCard(area); setDepartmentDetail(area); }}
          />}
          {areaView &&
          <section className="cos-company-flow-list" aria-label="Open a company flow">
            <header><small>OPEN A FLOW</small><h2>{activeArea?.title || 'Saved operating routes'}</h2><p>Open a Flow to inspect its cards, owner, activity and Work requests.</p></header>
          <div className="cos-flow-grid">{(activeArea?.flows || []).map((row) => <button key={row.id} onClick={() => open(row.id)}><Workflow/><small>{row.role === 'master' ? 'MASTER FLOW' : 'STANDALONE FLOW'}</small><h2>{row.name}</h2><p>{row.description || 'Open this flow to review its steps and connections.'}</p><span>{row.nodes?.length || 0} steps · {row.state || 'Unknown'}</span></button>)}{!activeArea?.flows.length && <p>No saved flow in this area yet. Create a route for this part of your business.</p>}<button onClick={() => onStudio({ name: `${activeArea?.title || 'Company'} flow`, companyArea: activeArea?.id })}><Plus/><h2>Create a flow</h2><p>Design a route for {activeArea?.title?.toLowerCase()}.</p></button></div>
          </section>}
        </div>
          : <><div className="cos-flow-canvas-stage"><header className="cos-diagram-title" aria-label="Flow diagram title">
              <small>FLOW DIAGRAM</small>
              <h2>How {flow.name} works</h2>
            </header><div className="cos-flow-diagram-viewport" style={{ height: Math.max(graph.height, 500) * zoom }}><div className="cos-graph" style={{ width: Math.max(graph.width, 700), height: Math.max(graph.height, 500), transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
            <svg width="100%" height="100%" aria-hidden="true"><defs><marker id="cos-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#779389"/></marker></defs>{graph.edges.map((edge,index) => {
              const from = edge.from;
              const to = edge.to;
              if (!from || !to) return null;
              const x = from.x + FLOW_NODE_WIDTH, y = from.y + FLOW_NODE_HEIGHT / 2, tx = to.x, ty = to.y + FLOW_NODE_HEIGHT / 2;
              const activeId = activeFlowNodeId;
              return <g key={index} data-active={Boolean(activeId && [String(from.id), String(to.id)].includes(activeId))}><path className="cos-flow-base" d={`M ${x} ${y} C ${x+50} ${y}, ${tx-50} ${ty}, ${tx} ${ty}`} fill="none" stroke="#b9cec0" strokeWidth="2"/><path className="cos-flow-line" d={`M ${x} ${y} C ${x+50} ${y}, ${tx-50} ${ty}, ${tx} ${ty}`} fill="none" stroke="#779389" strokeWidth="1.8" markerEnd="url(#cos-arrow)"/>{edge.branch && <text x={(x+tx)/2} y={(y+ty)/2-10}>{edge.branch}</text>}</g>;
            })}</svg>
            {graph.positioned.map((node) => {
              const card = nodeOperatingCard(node, activity.rows);
              const linkedWorkCount = workForNode(node.id).length;
              return <article key={node.id} className={`cos-node ${node.kind}`} data-selected={String(focusedNodeId) === String(node.id)} data-preview={String(previewNode?.id) === String(node.id)} style={{ left: node.x, top: node.y, height: FLOW_NODE_HEIGHT }}>
                <button className="cos-node-main" type="button" aria-pressed={String(focusedNodeId) === String(node.id)} onClick={() => { setFocusedNodeId(String(node.id)); setRight(true); setLeft(window.innerWidth > 1024); }}>
                  <small>{card.kindLabel.toUpperCase()}</small>
                  <strong>{node.label || node.id}</strong>
                  <span>{node.ai_persona ? <Bot size={14}/> : ['gateway','subflow'].includes(node.kind) ? <Workflow size={14}/> : <UserRound size={14}/>} {card.owner}</span>
                  <em>{node.flow_ref ? 'Linked Subflow' : linkedWorkCount ? `${linkedWorkCount} assigned Work` : card.status || 'No activity recorded'}</em>
                </button>
                <button className="cos-node-overview" type="button" aria-label={`Open ${node.label || node.id} process overview`} onClick={() => { setFocusedNodeId(String(node.id)); setProcessOverview(node); }}><Maximize2 size={15}/></button>
              </article>;
            })}
          </div></div></div></>}
      </CompanyOSCanvas>
      {right ? <aside className="cos-rail cos-rail--right" aria-label="Activity panel"><header><small>ACTIVITY</small><h2>{flow ? 'Process work' : 'Flow routes'}</h2><button className="cos-rail-toggle" aria-label="Collapse activity panel" onClick={() => toggleRail('right')}><PanelRightClose size={16}/></button></header><div className="cos-rail-body">
        {!flow && <section className="cos-drill-list cos-company-activity-list" aria-label="Department flow navigation">
          <header className="cos-activity-group cos-activity-group--primary"><span>{companyCard ? 'Flows in selected department' : 'Company Flow routes'}</span><b>{rightRailFlows.length}</b></header>
          {rightRailFlows.map(item => {
            const detail = flowRailDetail(item);
            const activitySummary = flowActivitySummary(item);
            const area = companyDiagramAreas.find(area => area.flows.some(row => row.id === item.id));
            return <CompanyOSDrillCard key={item.id} icon={Workflow} title={item.name}
              variant="flow"
              eyebrow={area?.title || companyCard?.title || 'Company Flow'}
              description={item.description} owner={detail.ownerName}
              facts={[[ 'Processes', detail.cardCount ], [ 'Human', detail.humanCount || 'Not set' ], [ 'AI', detail.aiCount || 'Assist only' ], [ 'Work', activitySummary.workCount || 'No live Work' ]]}
              status={item.sampleOnly ? 'Sample Flow' : item.state || 'Saved Flow'}
              meta={activitySummary.next}
              action="View flow" onOpen={() => open(item.id)}/>;
          })}
          {!rightRailFlows.length && <div className="cos-empty-note"><strong>No Flow in this department yet</strong><p>Start with one repeatable process, then assign people or AI.</p><button onClick={() => onStudio({ name: `${companyCard?.title || activeArea?.title || 'Company'} flow`, companyArea: activeArea?.id })}>Design a Flow<ArrowRight size={15}/></button></div>}
          {companyCard && selectedCompanyActivity.length > 0 && <section className="cos-compact-activity" aria-label={`${companyCard.title} latest activity`}>
            <span className="cos-context-label">Latest signal</span>
            {selectedCompanyActivity.map(([kind,time,title,detail]) => {
              const Icon = activityIcon(kind);
              return <article key={`${time}-${title}`}><Icon size={15}/><span><time>{time}</time><strong>{title}</strong><p>{detail}</p></span></article>;
            })}
          </section>}
          {companyCard && !companyCard.external && <button className="cos-secondary-action" onClick={() => setDepartmentDetail(companyCard)}>Department overview<ArrowRight size={14}/></button>}
          {workItems.some(item => item.mapping === 'unlinked') && <details className="cos-rail-history"><summary>Company inbox · {workItems.filter(item => item.mapping === 'unlinked').length} needs Flow link</summary><p>These jobs have no verified Flow/process link. They are not assigned to the selected department.</p>{workItems.filter(item => item.mapping === 'unlinked').map(item => <article className="cos-event" key={item.requestId || item.dealId || item.id}><strong>{item.title}</strong><p>{item.customer} · Workflow linkage required</p></article>)}</details>}
          <details className="cos-rail-history"><summary>Recent activity</summary>
            {selectedProfile?.activity?.length ? selectedProfile.activity.map(([kind,time,title,detail]) => {
              const Icon = activityIcon(kind);
              return <article className="cos-event" key={`${time}-${title}`}><Icon size={14}/><time>{time}</time><strong>{title}</strong><p>{detail}</p></article>;
            }) : reviewMode ? sampleAreaEvents.map(item => <article className="cos-event" key={item.title}><time>Sample · {item.time}</time><strong>{item.title}</strong><p>{item.detail}</p></article>) : <p>No activity recorded in this scope.</p>}
          </details>
        </section>}
        {flow && <section className="cos-drill-list" aria-label="Process work navigation">
          {focusedNode && <section className="cos-compact-activity cos-selected-process-activity" aria-label="Selected process activity">
            <span className="cos-context-label">Selected process</span>
            <article>{focusedNode.ai_persona || focusedNode.kind === 'ai_step' ? <Bot size={15}/> : focusedNode.flow_ref ? <Workflow size={15}/> : <UserRound size={15}/>}<span><strong>{focusedNode.label || focusedNode.id}</strong><p>{focusedNodeCard?.owner} · {focusedNode.flow_ref ? 'Linked Subflow' : `${workForNode(focusedNode.id).length} assigned Work item${workForNode(focusedNode.id).length === 1 ? '' : 's'}`}</p></span></article>
          </section>}
          <header className="cos-activity-group cos-activity-group--primary"><span>Process owners</span><b>{flow.nodes?.length || 0}</b></header>
          {(flow.nodes || []).map((node,index) => {
            const detail = nodeOperatingCard(node, activity.rows);
            const linked = workForNode(node.id);
            const nodeVariant = node.flow_ref ? 'flow' : node.ai_persona || node.kind === 'ai_step' ? 'ai' : ['approval', 'payment', 'manual'].includes(node.kind) ? 'human' : 'work';
            return <CompanyOSDrillCard key={node.id} icon={node.flow_ref ? Workflow : node.ai_persona || node.kind === 'ai_step' ? Bot : UserRound}
              variant={nodeVariant}
              personFirst={!node.flow_ref}
              index={index} selected={focusedNodeId === String(node.id)}
              title={node.label || node.id}
              eyebrow={node.flow_ref ? 'Subflow route' : nodeVariant === 'ai' ? 'AI prepares' : 'Human owns'}
              description={node.description || node.operation?.purpose}
              facts={[[ 'Assignment', node.assignee?.name || node.owner?.name || node.assignee_name ? 'Named worker recorded' : 'Role only' ], [ 'Energy', detail.energy ], [ 'Time', node.operation?.sla ]].filter(([,value]) => value)}
              tasks={node.flow_ref || processTasks(node).length === 1 ? [] : processTasks(node).map(task => ({ ...task, meta: `${task.kind} · ${task.sla || 'Time not set'}`, actionLabel: 'View work' }))} onTaskOpen={task => { setFocusedNodeId(String(node.id)); setEntryTaskId(task.id); setWorkProcess(node); }}
              owner={detail.owner} status={node.flow_ref ? 'Linked process group' : linked.length ? `${linked.length} assigned work items` : 'No assigned work'}
              meta={detail.status === 'No run recorded' ? '' : detail.status} action={node.flow_ref ? 'Open Subflow' : 'View work'}
              taskActionLabel="View work"
              onOpen={() => { setFocusedNodeId(String(node.id)); setEntryTaskId(null); if (node.flow_ref) open(node.flow_ref); else setWorkProcess(node); }}/>;
          })}
        </section>}
        {activity.status === 'loading' && <p role="status">Loading activity…</p>}
        {activity.status === 'error' && <><p role="alert">Activity could not be loaded.</p><button onClick={() => setAttempt(attempt+1)}><RefreshCw size={15}/>Retry</button></>}
        {flow && <details className="cos-rail-history"><summary>Activity · {currentEvents.length}</summary>
        {!currentEvents.length && <p>No activity recorded for this scope.</p>}
        {currentEvents.map((event,index) => {
          const eventNode = flow?.nodes?.find(node => String(node.id) === String(event.nodeId));
          return <article className={`cos-event ${event.source || ''}`} key={event.id || index}>
            <time><Clock3 size={13}/>{event.at ? new Date(event.at).toLocaleString('en-AU') : 'Time not recorded'}</time>
            <strong>{eventVerb(event)}</strong>
            <p>{eventNode?.label || event.nodeId || 'Flow level activity'}</p>
            <small>{event.source || 'source unknown'} · {event.dealId || 'No job id recorded'}</small>
          </article>;
        })}</details>}
      </div></aside> : <button className="cos-rail-tab right" aria-label="Expand activity panel" onClick={() => toggleRail('right')}><PanelRightOpen size={17}/></button>}
    </div>
    {processOverview && flow && <CompanyOSProcessOverview node={processOverview} flow={flow} relatedFlow={flows.find(item => String(item.id) === String(processOverview.flow_ref))} onOpenRelatedTask={node => { const id = processOverview.flow_ref; setProcessOverview(null); open(node.flow_ref || id); if (!node.flow_ref) { setFocusedNodeId(String(node.id)); setEntryTaskId(null); setWorkProcess(node); } }} onOpenFlow={() => { const id = processOverview.flow_ref; setProcessOverview(null); open(id); }} onClose={() => setProcessOverview(null)} onOpenTask={task => { setEntryTaskId(task.id); setWorkProcess(processOverview); setProcessOverview(null); }} onShowWork={() => { setProcessOverview(null); setRight(true); if (window.innerWidth <= 1024) setLeft(false); }}/ >}
    {departmentDetail && detailArea && <dialog className="cos-department-modal" ref={departmentDialogRef} aria-labelledby="cos-department-title" onCancel={() => setDepartmentDetail(null)} onClick={(event) => { if (event.target === event.currentTarget) setDepartmentDetail(null); }}>
      <section>
        <button className="cos-close" aria-label="Close department detail" onClick={() => setDepartmentDetail(null)}><X size={18}/></button>
        <header>
          <small>COMPANY DEPARTMENT</small>
          <h2 id="cos-department-title">{detailArea.title}</h2>
          <p>{detailProfile.mission}</p>
          <div className="cos-area-stats" aria-label={`${detailArea.title} facts`}><div><strong>{detailFlows.length}</strong><span>Flow routes</span></div><div><strong>{detailResponsibilities.length}</strong><span>Processes</span></div><div><strong>{detailWorkItems.length}</strong><span>Work items</span></div></div>
          <div className="cos-department-overview" aria-label={`${detailArea.title} overview`}>
            <article><UserRound size={16}/><span><small>OWNER</small><strong>{detailProfile.owner}</strong></span></article>
            <article><FileText size={16}/><span><small>INPUT</small><strong>{detailProfile.input}</strong></span></article>
            <article><CheckCircle2 size={16}/><span><small>OUTPUT</small><strong>{detailProfile.output}</strong></span></article>
            <article><ShieldCheck size={16}/><span><small>CONTROL</small><strong>{detailProfile.control}</strong></span></article>
          </div>
          <div className="cos-department-mini-metrics" aria-label={`${detailArea.title} operating metrics`}>{detailProfile.metrics.map(([value, label]) => <span key={`${value}-${label}`}><strong>{value}</strong>{label}</span>)}</div>
        </header>
        <div className="cos-department-grid">
          <section>
            <small>FLOW ROUTES</small>
            <div className="cos-department-flow-list">
              {detailFlows.length ? detailFlows.map((item) => {
                const detail = flowRailDetail(item);
                return <article key={item.id} className="cos-flow-overview-card">
                  <header><span><strong>{item.name}</strong><small>{item.sampleOnly ? 'Review sample · not live' : `${item.state || 'draft'} · live Flow route`}</small></span><Workflow size={16}/></header>
                  <p>{detail.description}</p>
                  <dl>
                    <div><dt><UserRound size={13}/>Owner</dt><dd>{detail.ownerName}</dd></div>
                    <div><dt><Bot size={13}/>AI support</dt><dd>{detail.aiName}</dd></div>
                    <div><dt><GitBranch size={13}/>Workload</dt><dd>{detail.cardCount} cards · {detail.humanCount} Human gates · {detail.aiCount} AI steps</dd></div>
                  </dl>
                  {item.sampleOnly ? <button type="button" disabled>Sample overview only</button> : <button type="button" onClick={() => { setDepartmentDetail(null); open(item.id); }}>Open Flow<ArrowRight size={14}/></button>}
                </article>;
              }) : <p className="cos-empty-note">No Flow route is saved in this department yet.</p>}
            </div>
          </section>
          <section>
            <small>PEOPLE & RESPONSIBILITIES</small>
            <div className="cos-overview-shortcuts">
              {detailResponsibilities.map(({ flow: item, node, card }) => <button type="button" key={`${item.id}:${node.id}`} onClick={() => { setDepartmentDetail(null); open(item.id); setFocusedNodeId(String(node.id)); setEntryTaskId(null); setWorkProcess(node); }}>
                {node.ai_persona || node.kind === 'ai_step' ? <Bot size={18}/> : <UserRound size={18}/>}<span><strong>{card.owner}</strong><small>{node.label} · {item.name}</small></span><ArrowRight size={15}/>
              </button>)}
              {!detailResponsibilities.length && <p className="cos-empty-note">Responsibilities will appear after you add a Flow to this department.</p>}
            </div>
            <details className="cos-rail-history"><summary>Department tools</summary>
            <small>DEPARTMENT MODULES</small>
            <div className="cos-department-module-list">
              {departmentModules(detailArea).map(([key, label, body]) => <button key={key} type="button" onClick={() => { setDepartmentDetail(null); onModule(key); }}>
                <span><strong>{label}</strong><small>{body}</small></span><ArrowRight size={14}/>
              </button>)}
              <button type="button" onClick={() => { setDepartmentDetail(null); onLibrary(); }}><span><strong>Flow library</strong><small>Reuse or inspect saved operating patterns</small></span><Workflow size={15}/></button>
              <button type="button" onClick={() => { setDepartmentDetail(null); onHire({ areaId: detailArea.id, areaName: detailArea.title }); }}><span><strong>Hire for this department</strong><small>Add Human or AI capacity only after a Flow is clear</small></span><Bot size={15}/></button>
            </div>
            </details>
          </section>
        </div>
        <footer><button type="button" onClick={() => { setDepartmentDetail(null); setAreaView(true); }}>Open department Flow view<ArrowRight size={14}/></button><button type="button" onClick={() => setDepartmentDetail(null)}>Close</button></footer>
      </section>
    </dialog>}
    {selected && <dialog className="cos-detail" ref={dialogRef} aria-labelledby="cos-detail-title" onCancel={() => setSelected(null)} onClick={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><section>
      <button className="cos-close" autoFocus aria-label="Close step detail" onClick={() => setSelected(null)}><X/></button>
      <small>{flow.name} · {selectedCard.kindLabel}</small>
      <h2 id="cos-detail-title">{selected.label}</h2>
      <div className="cos-detail-grid">
        <article><ShieldCheck size={17}/><small>PIC</small><strong>{selectedCard.owner}</strong><span>{nodeResponsibility(selected)}</span></article>
        <article><GitBranch size={17}/><small>Status</small><strong>{selectedCard.status}</strong><span>{selectedCard.actionLabel}</span></article>
        <article><Zap size={17}/><small>Energy</small><strong>{selectedCard.energy}</strong><span>Shown only when the flow records a metered action.</span></article>
      </div>
      <section className="cos-operating-card">
        <small>WHAT THIS CARD DOES</small>
        <p>{selectedCard.purpose}</p>
        <dl>
          <div><dt>Input</dt><dd>{selectedCard.input}</dd></div>
          <div><dt>Expected output</dt><dd>{selectedCard.output}</dd></div>
        </dl>
      </section>
      {navigationError && <p role="alert">{navigationError}</p>}
      {!selected.flow_ref && selectedWorkItems.length ? <section className="cos-work-picker" aria-label="Real work to open">
        <h3>REAL WORK REQUESTS</h3>
        {selectedWorkItems.slice(0, 4).map((item) => <button key={item.requestId} onClick={() => { onTask(flow.id, selected.id, item); setSelected(null); }}>
          <span><strong>{item.title}</strong><small>{item.customer} · request {item.requestId}</small></span><ArrowRight size={15}/>
        </button>)}
      </section> : null}
      {!selected.flow_ref && !selectedWorkItems.length ? <div className="cos-empty-note"><p>{selectedNeedsAgent ? 'This Agent step has no linked Work yet. Hire or review an Agent before assigning the next customer request.' : 'No work is linked to this step yet. Your company enquiries are kept separately until their Flow and step are recorded.'}</p>{!selectedNeedsAgent && <button onClick={() => { setSelected(null); onModule('leads'); }}>View enquiries<ArrowRight size={14}/></button>}</div> : null}
      <footer>{selected.flow_ref ? <button onClick={() => open(selected.flow_ref)}>Open subflow<ArrowRight size={16}/></button> : selectedWorkItems.length ? <button onClick={() => { onTask(flow.id, selected.id, selectedWorkItems[0]); setSelected(null); }}>Open Work<ArrowRight size={16}/></button> : selectedNeedsAgent ? <button onClick={() => { setSelected(null); onHire({ flowId: flow.id, flowName: flow.name, stepId: selected.id, stepName: selected.label }); }}>Find or hire an Agent<Bot size={16}/></button> : <button disabled>Open Work<ArrowRight size={16}/></button>}</footer>
    </section></dialog>}
    {setupOpen && <div className="cos-template-modal-backdrop" role="presentation"><section className="cos-template-modal" role="dialog" aria-modal="true" aria-labelledby="company-template-title">
      <button className="cos-close" aria-label="Close company setup" onClick={() => setSetupOpen(false)}><X size={19}/></button>
      <small>COMPANY OS · COMPANY SETUP</small>
      <h2 id="company-template-title">Choose a starting map for {businessName || 'your company'}.</h2>
      <p>Start simple. This gives Sela the right Company areas and a suggested first Flow. You can change the map later; it does not send, publish or charge anything.</p>
      <div className="cos-template-modal-body">
        <div className="cos-template-choice-grid" role="radiogroup" aria-label="Company template">
          {COMPANY_TEMPLATES.map((template) => { const Icon = template.icon; const active = template.id === templateId; return <button type="button" key={template.id} role="radio" aria-checked={active} className={active ? 'active' : ''} onClick={() => { setTemplateId(template.id); setServiceType(template.title); setSetupSelaNote(''); }}>
            <Icon size={18}/><span><strong>{template.title}</strong><small>{template.description}</small></span>{template.badge && <em>{template.badge}</em>}
          </button>; })}
        </div>
        <aside className="cos-template-sela" aria-label="Sela template support">
          <header><span><Sparkles size={18}/></span><div><small>SELA · SETUP GUIDE</small><strong>I’ll help shape this map.</strong></div></header>
          <p>{setupSelaNote || `For ${selectedTemplate.title}, I’m starting with the areas that make the first customer journey clear.`}</p>
          <dl><div><dt>Next Flow</dt><dd>{selectedTemplate.firstFlow}</dd></div><div><dt>Control</dt><dd>A Human remains accountable for every decision.</dd></div></dl>
          <button type="button" onClick={() => setSetupSelaNote(`This template starts with ${selectedTemplate.areas.join(', ')}. We can adjust each area later without interrupting active work.`)}><Sparkles size={15}/>Why this map?</button>
        </aside>
      </div>
      <section className="cos-template-preview" aria-label="Selected template preview"><div><small>YOUR STARTING MAP</small><h3>{selectedTemplate.title}</h3><p>{selectedTemplate.areas.map((area) => <span key={area}>{area}</span>)}</p></div><div><small>FIRST SUGGESTED FLOW</small><strong><Workflow size={16}/>{selectedTemplate.firstFlow}</strong><p>Company → Flow → Work. A Human remains accountable; an Agent can prepare work after you assign it.</p></div></section>
      {templateError && <p role="alert" className="cos-template-error">{templateError}</p>}
      <footer><button onClick={() => setSetupOpen(false)}>Not now</button><button className="cos-template-primary" onClick={applyCompanyTemplate} disabled={templateState === 'saving'}>{templateState === 'saving' ? 'Saving company setup…' : <>Use this template<ArrowRight size={16}/></>}</button></footer>
    </section></div>}
  </section>;
}
