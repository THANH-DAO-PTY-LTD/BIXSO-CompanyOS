export function emptyState() {
  return { requests: [], jobs: [] };
}

function required(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} is required`);
  }
  return value.trim();
}

function find(records, id, kind) {
  const record = records.find(item => item.id === id);
  if (!record) throw new Error(`Unknown ${kind}: ${id}`);
  return record;
}

export function execute(state, command, args) {
  switch (command) {
    case 'intake': {
      const [customer, outcome] = args;
      const request = {
        id: `ENQ-${state.requests.length + 1}`,
        customer: required(customer, 'customer alias'),
        outcome: required(outcome, 'requested outcome'),
      };
      state.requests.push(request);
      return request;
    }
    case 'open': {
      const [requestId, deliverable] = args;
      find(state.requests, requestId, 'request');
      if (state.jobs.some(job => job.requestId === requestId)) {
        throw new Error(`Request ${requestId} already has a job`);
      }
      const job = {
        id: `JOB-${state.jobs.length + 1}`,
        requestId,
        deliverable: required(deliverable, 'agreed deliverable'),
        status: 'planned',
      };
      state.jobs.push(job);
      return job;
    }
    case 'start': {
      const job = find(state.jobs, args[0], 'job');
      if (job.status !== 'planned') throw new Error('Only planned jobs can start');
      job.status = 'in_progress';
      return job;
    }
    case 'handover': {
      const [id, delivered, location, verify, followUp = ''] = args;
      const job = find(state.jobs, id, 'job');
      if (job.status !== 'in_progress') {
        throw new Error('Only jobs in progress can be handed over');
      }
      job.handover = {
        delivered: required(delivered, 'delivered result'),
        location: required(location, 'delivery location'),
        verify: required(verify, 'customer check'),
        followUp: followUp.trim(),
      };
      job.status = 'handed_over';
      return job;
    }
    case 'list':
      return state;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}
