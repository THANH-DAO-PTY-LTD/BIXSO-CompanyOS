import assert from 'node:assert/strict';
import test from 'node:test';
import { read } from '../src/local.js';
import { createFlow, draftFlowAI, getFlow, publishFlow, saveFlow } from '../src/lib/spFlowApi.js';

test('local Studio drafts are editable, saved explicitly and activated separately', async () => {
  const values = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) },
  });
  assert.equal(read().flows.length, 1);
  const draft = await draftFlowAI('Photo request');
  assert.equal(draft.nodes.length, 3);
  assert.equal(values.size, 0);
  const saved = await createFlow({ ...draft, name: 'Reviewed photo request' });
  assert.equal(saved.state, 'draft');
  assert.equal((await publishFlow(saved.id)).state, 'active');
  assert.equal((await getFlow(saved.id)).name, 'Reviewed photo request');
  const sample = (await getFlow('FLOW-1'));
  await assert.rejects(saveFlow(sample.id, { ...sample, nodes: [sample.nodes[1]], edges: [] }), /referenced/);
  assert.equal((await getFlow(sample.id)).revision, 1);
});
