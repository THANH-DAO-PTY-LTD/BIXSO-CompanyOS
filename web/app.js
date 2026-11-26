const records = document.querySelector('#records');
const intake = document.querySelector('#intake');
const feedback = document.querySelector('#feedback');
const labels = { planned: 'Planned', in_progress: 'In progress', handed_over: 'Handed over' };

function element(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

async function request(path, options) {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error);
  return data;
}

function bind(form, command, id, message) {
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const submit = form.querySelector('button');
    submit.disabled = true;
    feedback.textContent = '';
    try {
      const input = Object.fromEntries(new FormData(form));
      if (id) input.id = id;
      await request(`/api/${command}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      form.reset();
      feedback.textContent = message;
      try {
        await refresh();
      } catch {
        feedback.textContent = `${message} Reload this page to refresh the list.`;
      }
    } catch (error) {
      feedback.textContent = error.message;
      feedback.scrollIntoView({ block: 'nearest' });
    } finally {
      submit.disabled = false;
    }
  });
}

function action(command, id, caption, inputs = []) {
  const form = element('form', '');
  for (const [name, caption, optional] of inputs) {
    const label = element('label', caption);
    const input = element('input', '');
    input.name = name;
    input.required = !optional;
    input.maxLength = 2000;
    label.append(input);
    form.append(label);
  }
  form.append(element('button', caption));
  bind(form, command, id, { open: 'Job created.', start: 'Job started.', handover: 'Handover saved.' }[command]);
  return form;
}

async function refresh() {
  const state = await request('/api/state');
  const jobs = new Map(state.jobs.map(job => [job.requestId, job]));
  records.replaceChildren();
  if (!state.requests.length) records.append(element('p', 'Saved requests will appear here.'));
  for (const entry of state.requests) {
    const card = element('article', '');
    const job = jobs.get(entry.id);
    card.append(element('h3', entry.customer), element('p', entry.outcome));
    const status = element('span', job ? `${job.id} · ${labels[job.status]}` : `${entry.id} · Request received`);
    status.className = 'status';
    card.append(status);
    if (!job) {
      card.append(action('open', entry.id, 'Create job', [['deliverable', 'Agreed deliverable']]));
      records.append(card);
      continue;
    }
    card.append(element('p', job.deliverable));
    if (job.status === 'planned') card.append(action('start', job.id, 'Start job'));
    if (job.status === 'in_progress') {
      card.append(action('handover', job.id, 'Save handover', [
        ['delivered', 'Delivered result'], ['location', 'Where to find it'],
        ['verify', 'How the client can check it'], ['followUp', 'Follow-up (optional)', true],
      ]));
    }
    if (job.handover) {
      card.append(element('h4', 'Handover'));
      const { delivered, location, verify, followUp } = job.handover;
      card.append(element('p', [delivered, location, verify, followUp].filter(Boolean).join('\n')));
    }
    records.append(card);
  }
}

bind(intake, 'intake', null, 'Request saved.');
document.querySelector('#example').addEventListener('click', () => {
  intake.elements.customer.value = 'Juniper Studio';
  intake.elements.outcome.value = 'One square product photo for a catalogue listing';
});
refresh().catch(error => { feedback.textContent = error.message; });
