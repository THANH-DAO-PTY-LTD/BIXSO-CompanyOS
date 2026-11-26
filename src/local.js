const key = 'company-os.sp-extract.v1';
const sample = {
  company: 'Juniper Studio · Sample',
  flows: [{
    id: 'FLOW-1', name: 'Product photography', description: 'Prepare a photo and hand over the result.',
    companyArea: 'delivery', state: 'active', revision: 1,
    nodes: [{ id: 'prepare', kind: 'step', label: 'Prepare product photo' }, { id: 'deliver', kind: 'step', label: 'Deliver final image' }],
    edges: [{ from: 'prepare', to: 'deliver' }],
  }],
  work: [{ id: 'WORK-1', requestId: 'REQ-1', flowId: 'FLOW-1', flowRevision: 1, nodeId: 'prepare',
    customer: 'Acorn Catalogue · fictional', title: 'Square product image', status: 'Assigned', mapping: 'recorded' }],
};

export function read() {
  const saved = localStorage.getItem(key);
  return saved ? JSON.parse(saved) : structuredClone(sample);
}

export function write(change) {
  const state = read();
  const result = change(state);
  localStorage.setItem(key, JSON.stringify(state));
  return result;
}
