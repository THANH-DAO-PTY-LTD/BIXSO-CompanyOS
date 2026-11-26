import { emptyState, execute } from './workflow.js';
import { readState, update } from './store.js';

const usage = `Commands:
  demo
  intake <customer alias> <requested outcome>
  open <request id> <agreed deliverable>
  start <job id>
  list
  handover <job id> <delivered result> <location> <customer check> [follow-up]`;

function demo() {
  const state = emptyState();
  const request = execute(state, 'intake', ['Juniper Studio', 'One square product photo']);
  const job = execute(state, 'open', [request.id, '1200 × 1200 JPEG']);
  execute(state, 'start', [job.id]);
  execute(state, 'handover', [
    job.id, 'product-square.jpg', 'Agreed shared folder', 'Check the crop in the catalogue preview',
    'Juniper confirms the crop by Monday',
  ]);
  return state;
}

const [command, ...args] = process.argv.slice(2);
try {
  if (!command || command === '--help') {
    console.log(usage);
  } else {
    const counts = { demo: [0], intake: [2], open: [2], start: [1], list: [0], handover: [4, 5] };
    if (!Object.hasOwn(counts, command) || !counts[command].includes(args.length)) {
      throw new Error(usage);
    }
    let result;
    if (command === 'demo') result = demo();
    else if (command === 'list') result = execute(readState(), command, args);
    else result = update(command, args);
    console.log(JSON.stringify(result, null, 2));
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
