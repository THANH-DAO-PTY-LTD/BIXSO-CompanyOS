import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const path = fileURLToPath(new URL('../src/server.js', import.meta.url));
async function start(cwd) {
  const proc = spawn(process.execPath, [path, '0'], { cwd });
  const [message] = await once(proc.stdout, 'data');
  const url = message.toString().trim().split(' ').at(-1);
  return {
    url,
    async stop() {
      const closed = once(proc, 'exit');
      proc.kill();
      await closed;
    },
    post(command, data) {
      return fetch(`${url}/api/${command}`, {
        method: 'POST',
        headers: { Origin: url, 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    },
  };
}

test('web workflow, persistent state and interoperable export', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'company-os-web-'));
  let app = await start(cwd);
  try {
    const page = await fetch(app.url);
    assert.match(await page.text(), /New request/);
    assert.equal((await fetch(`${app.url}/app.js`)).status, 200);
    const before = await app.post('intake', { customer: 'Juniper', outcome: ' ' });
    assert.equal(before.status, 400);
    assert.equal((await app.post('intake', { customer: 'Juniper', outcome: 'Square photo' })).status, 200);
    assert.equal((await app.post('open', { id: 'ENQ-1', deliverable: 'A square JPEG' })).status, 200);
    assert.equal((await app.post('handover', { id: 'JOB-1' })).status, 400);
    assert.equal((await app.post('start', { id: 'JOB-1' })).status, 200);
    assert.equal((await app.post('handover', { id: 'JOB-1', delivered: 'Photo', location: 'Shared folder', verify: 'Check crop' })).status, 200);
    await app.stop();
    app = await start(cwd);
    const state = await (await fetch(`${app.url}/api/state`)).json();
    assert.equal(state.requests.length, 1);
    assert.equal(state.jobs[0].requestId, state.requests[0].id);
    assert.equal(state.jobs[0].status, 'handed_over');
    assert.equal(state.jobs[0].handover.verify, 'Check crop');
    const exported = await fetch(`${app.url}/api/export`);
    assert.match(exported.headers.get('content-disposition'), /attachment/);
    assert.equal(state.schemaVersion, 1);
    assert.deepEqual(await exported.json(), state);
  } finally {
    await app.stop();
    await rm(cwd, { recursive: true, force: true });
  }
});

test('versionless CLI records remain readable and acquire a schema version on write', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'company-os-v0-'));
  await mkdir(join(cwd, '.company-os'));
  await writeFile(join(cwd, '.company-os', 'records.json'), JSON.stringify({
    requests: [{ id: 'ENQ-1', customer: 'Juniper', outcome: 'Photo' }], jobs: [],
  }));
  const app = await start(cwd);
  try {
    assert.equal((await app.post('open', { id: 'ENQ-1', deliverable: 'JPEG' })).status, 200);
    const data = await (await fetch(`${app.url}/api/export`)).json();
    assert.equal(data.schemaVersion, 1);
    assert.equal(data.requests[0].customer, 'Juniper');
    assert.equal(data.jobs[0].requestId, 'ENQ-1');
  } finally {
    await app.stop();
    await rm(cwd, { recursive: true, force: true });
  }
});
