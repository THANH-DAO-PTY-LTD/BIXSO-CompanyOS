// Process definitions are not job progress. Never promote template `done` to live completion.
export function processTasks(node = {}) {
  const detail = node.detail || {};
  const groups = [['actions', 'Task'], ['decisions', 'Decision'], ['client_interactions', 'Customer interaction']];
  const tasks = groups.flatMap(([key, kind]) => (detail[key] || []).map((task, index) => ({
    id: `${key}:${task.id || index}`, title: task.label || task.q || kind, kind,
    input: node.operation?.input || '', output: task.output || node.operation?.output || '',
    evidence: node.operation?.completion_evidence || '', sla: node.operation?.sla || '',
  })));
  return tasks.length ? tasks : [{ id: String(node.id), title: node.label || 'Work definition', kind: 'Process task',
    input: node.operation?.input || '', output: node.operation?.output || '',
    evidence: node.operation?.completion_evidence || '', sla: node.operation?.sla || '', }];
}
