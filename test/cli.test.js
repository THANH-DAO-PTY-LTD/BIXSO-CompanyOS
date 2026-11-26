import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../src/cli.js', import.meta.url));

function setup(t) {
  const cwd = mkdtempSync(join(tmpdir(), 'company-os-test-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' });
  return {
    cwd,
    run,
    result(...args) {
      const response = run(...args);
      assert.equal(response.status, 0, response.stderr);
      return JSON.parse(response.stdout);
    },
  };
}

test('demo hands over a fictional job without creating a store', t => {
  const { cwd, result } = setup(t);
  assert.equal(result('demo').jobs[0].status, 'handed_over');
  assert.equal(existsSync(join(cwd, '.company-os')), false);
});

test('request becomes a tracked job and retains the handover across commands', t => {
  const { result } = setup(t);
  const request = result('intake', 'Juniper', '  Photo  ');
  assert.equal(request.outcome, 'Photo');
  const job = result('open', request.id, 'JPEG');
  assert.equal(job.status, 'planned');
  assert.equal(result('start', job.id).status, 'in_progress');
  result('handover', job.id, 'photo.jpg', 'Shared folder', 'Check crop', 'Reply Monday');
  assert.deepEqual(result('list').jobs[0], {
    ...job,
    status: 'handed_over',
    handover: { delivered: 'photo.jpg', location: 'Shared folder', verify: 'Check crop', followUp: 'Reply Monday' },
  });
});

test('invalid requests and transitions leave existing records intact', t => {
  const { cwd, result, run } = setup(t);
  const request = result('intake', 'Juniper', 'Photo');
  const job = result('open', request.id, 'JPEG');
  const file = join(cwd, '.company-os', 'records.json');
  const before = readFileSync(file, 'utf8');
  const invalid = [
    ['intake', 'Juniper', '   '],
    ['open', 'ENQ-999', 'JPEG'],
    ['open', request.id, 'Second job'],
    ['handover', job.id, 'photo.jpg', 'Shared folder', 'Check crop'],
  ];
  for (const args of invalid) assert.equal(run(...args).status, 1);
  assert.equal(readFileSync(file, 'utf8'), before);
});

test('a second writer respects the existing lock', t => {
  const { cwd, result, run } = setup(t);
  result('intake', 'Juniper', 'Photo');
  mkdirSync(join(cwd, '.company-os', 'write.lock'));
  const blocked = run('intake', 'Cedar', 'Photo');
  assert.equal(blocked.status, 1);
  assert.match(blocked.stderr, /locked/);
  assert.equal(result('list').requests.length, 1);
});
