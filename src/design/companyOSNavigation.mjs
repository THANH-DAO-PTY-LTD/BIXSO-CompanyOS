export function parentFlow(flows, flow) {
  if (!flow || flow.role === 'master') return null;
  const masters = flows.filter(row => row.role === 'master' && String(row.id) !== String(flow.id));
  if (flow.parent_master_id) return masters.find(row => String(row.id) === String(flow.parent_master_id)) || null;
  const references = masters.filter(row => row.nodes?.some(node => String(node.flow_ref) === String(flow.id)));
  return references.length === 1 ? references[0] : null;
}

export function flowNavigation(flows) {
  const roots = flows.filter(flow => !parentFlow(flows, flow));
  return roots.flatMap(flow => [
    { flow, depth: 0 },
    ...flows.filter(child => parentFlow(flows, child)?.id === flow.id)
      .sort((a, b) => {
        const order = id => { const index = (flow.nodes || []).findIndex(node => String(node.flow_ref) === String(id)); return index < 0 ? Number.MAX_SAFE_INTEGER : index; };
        return order(a.id) - order(b.id);
      }).map(child => ({ flow: child, depth: 1 })),
  ]);
}

// Include linked Subflows once, even if an imported graph contains a cycle.
export function flowScope(flows, roots = []) {
  const seen = new Set();
  const result = [];
  const visit = flow => {
    if (!flow || seen.has(String(flow.id))) return;
    seen.add(String(flow.id)); result.push(flow);
    for (const node of flow.nodes || []) {
      if (node.flow_ref) visit(flows.find(row => String(row.id) === String(node.flow_ref)));
    }
    for (const child of flows) if (child.parent_master_id != null && String(child.parent_master_id) === String(flow.id)) visit(child);
  };
  roots.forEach(visit);
  return result;
}

export function nodeResponsibility(node) {
  if (node.kind === 'subflow') return 'Linked workflow';
  if (node.kind === 'gateway') return 'Decision rule';
  if (node.kind === 'approval') return 'Human approval required';
  if (node.ai_persona) return `AI · ${node.ai_persona}`;
  return 'Assignee set on the job';
}

// A request in the company inbox is not automatically assigned to every
// card. Only recorded flow + node links may be presented as assigned work.
export function workItemsForNode(flowId, nodeId, items = []) {
  if (flowId == null || nodeId == null) return [];
  return items.filter(item => (item?.requestId || item?.dealId)
    && String(item.flowId ?? item.sourceFlowId ?? '') === String(flowId)
    && String(item.nodeId ?? item.sourceNodeId ?? '') === String(nodeId));
}

const KIND_LABELS = {
  step: 'Manual work',
  ai_step: 'AI work',
  gateway: 'Decision',
  touchpoint: 'Customer touch',
  payment: 'Payment',
  document: 'Document',
  approval: 'Approval',
  wait: 'Wait',
  comms: 'Message',
  subflow: 'Linked flow',
};

const PERSONA_LABELS = {
  bixso: 'Sela',
  planner: 'Admin Agent',
  negotiator: 'Sales Agent',
  care: 'Customer Care Agent',
  marketer: 'Marketing Agent',
  bookkeeper: 'Finance Agent',
  contract_drafter: 'Contract Agent',
  flow_designer: 'Flow Designer Agent',
  concierge: 'Sela',
  copilot: 'Sela',
};

function shortText(value, fallback = 'Not recorded yet') {
  const text = String(value || '').trim();
  return text || fallback;
}

function firstDetailLabel(items) {
  return Array.isArray(items) && items.length ? shortText(items[0]?.label, '') : '';
}

export function nodeOperatingCard(node = {}, events = []) {
  const detail = node.detail || {};
  const operation = node.operation || {};
  const lastEvent = [...events].reverse().find((event) => String(event.nodeId) === String(node.id));
  const persona = node.ai_persona ? (PERSONA_LABELS[node.ai_persona] || `${node.ai_persona} Agent`) : null;
  const owner = (() => {
    if (node.sampleOnly && node.sampleOwner) return node.sampleOwner;
    if (node.assignee?.name || node.owner?.name || node.assignee_name) return node.assignee?.name || node.owner?.name || node.assignee_name;
    if (node.kind === 'subflow') return 'Flow owner';
    if (node.kind === 'gateway') return 'Owner decides';
    if (node.kind === 'approval' || node.kind === 'payment') return 'Approval owner';
    if (persona) return persona;
    if (node.kind === 'touchpoint') return 'Provider + customer';
    return 'Person in charge';
  })();
  const purpose = shortText(
    operation.action_key || detail.description || firstDetailLabel(detail.actions) || firstDetailLabel(detail.client_interactions),
    node.kind === 'subflow' ? 'Open and manage the linked workflow.' : 'Move this job to the next clear state.'
  );
  const input = shortText(
    operation.input || node.done_check || node.suggested_template_key,
    node.kind === 'subflow' ? 'Linked ProviderFlow record.' : 'Job context and documents attached to this step.'
  );
  const output = shortText(
    operation.output || operation.completion_evidence || firstDetailLabel(detail.decisions),
    node.kind === 'gateway' ? 'A named branch is selected and recorded.' : 'Result is saved back to the job record.'
  );
  return {
    kindLabel: KIND_LABELS[node.kind] || shortText(node.kind, 'Work'),
    owner,
    purpose,
    input,
    output,
    energy: operation.energy_per_run != null && operation.energy_per_run !== '' && Number.isFinite(Number(operation.energy_per_run)) && Number(operation.energy_per_run) >= 0 ? `${Number(operation.energy_per_run)} Energy / run · configured` : 'Task cost not confirmed',
    status: lastEvent ? `${eventVerb(lastEvent)} · ${shortText(lastEvent.source, 'source unknown')}` : 'No run recorded',
    actionLabel: node.action ? `Opens ${node.action}` : node.flow_ref ? 'Opens linked flow' : 'Choose a job to work on',
  };
}

export function eventVerb(event = {}) {
  const value = String(event.event || '').trim();
  if (value === 'enter') return 'Entered step';
  if (value === 'exit') return 'Completed step';
  if (value === 'branch') return event.branchTaken ? `Chose ${event.branchTaken}` : 'Chose branch';
  return value || 'Recorded activity';
}

export function flowOperatingSummary(flow = {}, events = []) {
  const nodes = Array.isArray(flow?.nodes) ? flow.nodes : [];
  const ai = nodes.filter((node) => node.ai_persona || node.kind === 'ai_step').length;
  const human = nodes.filter((node) => ['step', 'approval', 'payment', 'touchpoint', 'document', 'comms'].includes(node.kind)).length;
  const decisions = nodes.filter((node) => node.kind === 'gateway').length;
  const jobs = new Set(events.map((event) => event.dealId).filter(Boolean)).size;
  return [
    { label: 'Steps', value: String(nodes.length) },
    { label: 'AI owned', value: String(ai) },
    { label: 'Human gates', value: String(human) },
    { label: 'Decisions', value: String(decisions) },
    { label: 'Jobs seen', value: jobs ? String(jobs) : '0' },
  ];
}
