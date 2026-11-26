import { read, write } from '../local.js';

function unavailable() {
  throw new Error('This feature is outside the local extract.');
}

export const getExpertBft = unavailable;
export const saveExpertBft = unavailable;
export const submitExpertBft = unavailable;
export const draftBftAI = unavailable;
export const AI_DESIGNER_COST = 0;
export async function getFlowVisualStandard() { return {}; }
export async function getFlow(id) { return read().flows.find(flow => flow.id === id); }

function validate(flow) {
  if (!flow.name?.trim() || !flow.nodes?.length) throw new Error('Enter a flow name and add at least one step.');
  const ids = new Set(flow.nodes.map(node => node.id));
  if (ids.size !== flow.nodes.length || flow.nodes.some(node => !node.label?.trim())) {
    throw new Error('Every step needs a unique identifier and a label.');
  }
  if (flow.edges.some(edge => !ids.has(edge.from) || !ids.has(edge.to))) {
    throw new Error('Connect only existing steps.');
  }
}

export async function createFlow(flow) {
  validate(flow);
  return write(state => {
    const created = { ...flow, id: crypto.randomUUID(), state: 'draft', revision: 1 };
    state.flows.push(created);
    return created;
  });
}

export async function saveFlow(id, flow) {
  validate(flow);
  return write(state => {
    const position = state.flows.findIndex(item => item.id === id);
    if (position < 0) throw new Error('Flow is no longer available.');
    const previous = state.flows[position];
    if (state.work.some(work => work.flowId === id && !flow.nodes.some(node => node.id === work.nodeId))) {
      throw new Error('Keep the step referenced by existing Work.');
    }
    const updated = { ...previous, ...flow, id, revision: previous.revision + 1 };
    state.flows[position] = updated;
    return updated;
  });
}

export async function publishFlow(id) {
  return write(state => {
    const flow = state.flows.find(item => item.id === id);
    if (!flow) throw new Error('Flow is no longer available.');
    flow.state = 'active';
    return flow;
  });
}

export async function draftFlowAI(description) {
  const labels = ['Review the request', 'Complete the work', 'Hand over the result'];
  const nodes = labels.map((label, index) => ({ id: `draft-${index + 1}`, kind: 'step', label }));
  return { name: description.trim().slice(0, 90), nodes, edges: nodes.slice(1).map((node, index) => ({ from: nodes[index].id, to: node.id })) };
}
