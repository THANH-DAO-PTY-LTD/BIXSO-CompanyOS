import assert from 'node:assert/strict';
import test from 'node:test';
import { spApi } from '../src/api/spApi.js';

test('flow activity returns an empty list in the local preview', async () => {
  assert.deepEqual(await spApi.get('flows/FLOW-1/events'), []);
});

test('routes outside the local preview are refused', async () => {
  await assert.rejects(spApi.get('jobs'), /outside the local extract/);
});
