import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { readState, update } from './store.js';

const assets = new Map([
  ['/', ['index.html', 'text/html']],
  ['/app.js', ['app.js', 'text/javascript']],
  ['/style.css', ['style.css', 'text/css']],
]);
const fields = {
  intake: ['customer', 'outcome'],
  open: ['id', 'deliverable'],
  start: ['id'],
  handover: ['id', 'delivered', 'location', 'verify', 'followUp'],
};

function send(res, status, data, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    ...headers,
  });
  res.end(Buffer.isBuffer(data) ? data : JSON.stringify(data));
}

async function readInput(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 32768) {
      req.resume();
      return null;
    }
    chunks.push(chunk);
  }
  const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
}

const server = createServer(async (req, res) => {
  const host = `127.0.0.1:${server.address().port}`;
  if (req.headers.host !== host) return send(res, 403, { error: 'Open the loopback URL printed in the terminal.' });
  const path = req.url;
  if (req.method === 'GET') {
    try {
      if (assets.has(path)) {
        const [file, type] = assets.get(path);
        return send(res, 200, readFileSync(new URL(`../web/${file}`, import.meta.url)), {
          'Content-Type': `${type}; charset=utf-8`,
        });
      }
      if (path === '/api/state') return send(res, 200, readState());
      if (path === '/api/export') return send(res, 200, { ...readState(), schemaVersion: 1 }, {
        'Content-Disposition': 'attachment; filename="company-os-export.json"',
      });
    } catch {
      return send(res, 500, { error: 'Could not read the local workspace. See the README.' });
    }
  }
  const command = path?.startsWith('/api/') ? path.slice(5) : '';
  if (req.method === 'POST' && Object.hasOwn(fields, command)) {
    if (req.headers.origin !== `http://${host}` || req.headers['content-type'] !== 'application/json') {
      return send(res, 403, { error: 'Write requests must come from this local workspace.' });
    }
    let body;
    try {
      body = await readInput(req);
    } catch {
      return send(res, 400, { error: 'Invalid request.' });
    }
    if (!body) return send(res, 400, { error: 'Invalid request or request too large.' });
    const args = fields[command].map(field => body[field] ?? '');
    if (args.some(value => typeof value !== 'string' || value.length > 2000)) {
      return send(res, 400, { error: 'Use text fields of at most 2,000 characters.' });
    }
    try {
      return send(res, 200, update(command, args));
    } catch (error) {
      if (!error.code && !(error instanceof SyntaxError)) return send(res, 400, { error: error.message });
      return send(res, 500, { error: 'Could not save the local workspace. See the README.' });
    }
  }
  return send(res, 404, { error: 'Not found.' });
});

const port = Number(process.argv[2] ?? 4310);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid port.');
server.listen(port, '127.0.0.1', () => console.log(`BIXSO Company OS: http://127.0.0.1:${server.address().port}`));
