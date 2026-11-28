// Readiness is diagnostic only. The server remains the execution authority.
export function workSetupIssues({ node = {}, task = {}, hasRecordedWork = false } = {}) {
  const issues = [];
  if (!hasRecordedWork) issues.push({ id: 'instance', label: 'Link a real job to this process', area: 'Work' });
  if (!(node.assignee?.id || node.assignee_id || node.owner?.id)) issues.push({ id: 'worker', label: 'Confirm the named Human or AI assigned', area: 'Assignment' });
  if (!String(task.input || '').trim()) issues.push({ id: 'input', label: 'Define the information needed to start', area: 'Design' });
  if (!String(task.output || '').trim()) issues.push({ id: 'output', label: 'Define the result to deliver', area: 'Design' });
  if (!String(task.evidence || '').trim()) issues.push({ id: 'evidence', label: 'Define how the result will be accepted', area: 'Design' });
  if (!String(task.sla || '').trim()) issues.push({ id: 'time', label: 'Set the expected completion time', area: 'Work' });
  const energy = node.operation?.energy_per_run;
  if (energy == null || energy === '' || !Number.isFinite(Number(energy)) || Number(energy) < 0) issues.push({ id: 'energy', label: 'Confirm task cost before execution', area: 'Cost' });
  return issues;
}
