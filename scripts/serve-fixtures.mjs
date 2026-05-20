/**
 * Static file server for test-fixtures/ on port 3000.
 * Used as the capture target: http://localhost:3000/simple.html
 *
 * Usage: node scripts/serve-fixtures.mjs
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'test-fixtures');
const PORT = process.env.PORT ?? 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'text/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

createServer((req, res) => {
  let pathname = req.url?.split('?')[0] ?? '/';
  if (pathname === '/') pathname = '/simple.html';

  const filePath = join(FIXTURES, pathname);

  // Basic path traversal guard
  if (!filePath.startsWith(FIXTURES)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  if (!existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end(`404 — ${pathname} not found in test-fixtures/\n`);
    return;
  }

  const mime = MIME[extname(filePath)] ?? 'application/octet-stream';
  const body = readFileSync(filePath);
  res.writeHead(200, { 'Content-Type': mime, 'Content-Length': body.length });
  res.end(body);

}).listen(PORT, '127.0.0.1', () => {
  console.log(`\nFixtures server → http://localhost:${PORT}`);
  console.log(`  http://localhost:${PORT}/simple.html\n`);
});
