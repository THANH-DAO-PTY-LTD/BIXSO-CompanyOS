import { mkdirSync, readFileSync, renameSync, rmSync, rmdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { emptyState, execute } from './workflow.js';

const directory = '.company-os';
const store = join(directory, 'records.json');
const lock = join(directory, 'write.lock');
const pending = join(lock, 'records.json');
export function readState() {
  try {
    const state = JSON.parse(readFileSync(store, 'utf8'));
    if ((state.schemaVersion ?? 1) !== 1 || !Array.isArray(state.requests) || !Array.isArray(state.jobs)) {
      throw new Error('Unsupported record format. Preserve the record file before troubleshooting.');
    }
    return state;
  } catch (error) {
    if (error.code === 'ENOENT') return emptyState();
    throw error;
  }
}

export function update(command, args) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  try {
    mkdirSync(lock, { mode: 0o700 });
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error('The record store is locked. See README.');
    throw error;
  }

  try {
    const state = readState();
    const result = execute(state, command, args);
    state.schemaVersion = 1;
    writeFileSync(pending, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 });
    renameSync(pending, store);
    return result;
  } finally {
    // Remove the owned temporary directory, including any incomplete write.
    // A process interrupted before this point leaves a visible lock.
    rmSync(pending, { force: true });
    rmdirSync(lock);
  }
}
