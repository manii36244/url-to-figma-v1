/**
 * CORS-enabled server for the Figma plugin.
 *
 * Serves on http://localhost:3001
 *   GET  /              → dashboard UI (enter a URL, start capture)
 *   POST /pipeline      → start capture + transform pipeline  { url }
 *   GET  /pipeline/status → poll pipeline progress
 *   GET  /ir.json       → packages/transformer/ir.json
 *   GET  /test-ir.json  → test-fixtures/test-ir.json
 *   GET  /assets/<file> → packages/transformer/assets/<file>
 *
 * Usage: node scripts/serve-ir.mjs
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const ROOT      = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT      = process.env.PORT ?? 3001;
const ASSETS_DIR = join(ROOT, 'packages', 'transformer', 'assets');

const ROUTES = {
  '/ir.json':      join(ROOT, 'packages', 'transformer', 'ir.json'),
  '/test-ir.json': join(ROOT, 'test-fixtures', 'test-ir.json'),
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const MIME = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png',  '.gif':  'image/gif',
  '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.avif': 'image/avif',
  '.woff': 'font/woff',  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',    '.otf':  'font/otf',
  '.json': 'application/json',
};

// ---------------------------------------------------------------------------
// Pipeline state (one job at a time)
// ---------------------------------------------------------------------------

let pipeline = { status: 'idle', message: 'No capture run yet.', url: '' };

function startPipeline(siteUrl) {
  if (pipeline.status === 'running') return;
  pipeline = { status: 'running', message: 'Starting…', url: siteUrl };

  const proc = spawn(
    process.execPath,
    ['scripts/pipeline.mjs', siteUrl],
    { cwd: ROOT, shell: false, env: process.env },
  );

  proc.stdout.on('data', (d) => {
    const line = d.toString().trim();
    if (line) pipeline.message = line;
  });
  proc.stderr.on('data', (d) => {
    const line = d.toString().trim();
    if (line) pipeline.message = line;
  });
  proc.on('close', (code) => {
    pipeline = code === 0
      ? { status: 'done',  message: 'Done! You can now import in Figma.', url: siteUrl }
      : { status: 'error', message: `Pipeline failed (exit ${code}). Check your URL and try again.`, url: siteUrl };
  });
  proc.on('error', (err) => {
    pipeline = { status: 'error', message: `Could not start pipeline: ${err.message}`, url: siteUrl };
  });
}

// ---------------------------------------------------------------------------
// Dashboard HTML (served at GET /)
// ---------------------------------------------------------------------------

const DASHBOARD = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>URL → Figma</title>
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,sans-serif;background:#0f0f0f;color:#f0f0f0;
         min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
    .card{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:16px;
          padding:40px;width:100%;max-width:520px;display:flex;flex-direction:column;gap:20px}
    h1{font-size:22px;font-weight:700;letter-spacing:-0.5px}
    p{font-size:13px;color:#888;line-height:1.6}
    label{font-size:11px;font-weight:600;color:#666;text-transform:uppercase;
          letter-spacing:.5px;display:block;margin-bottom:6px}
    input{width:100%;padding:10px 14px;background:#111;border:1.5px solid #333;
          border-radius:8px;font-size:14px;color:#f0f0f0;outline:none;transition:border-color .15s}
    input:focus{border-color:#18a0fb}
    input::placeholder{color:#444}
    button{width:100%;padding:12px;background:#18a0fb;color:#fff;border:none;
           border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;transition:background .15s}
    button:hover:not(:disabled){background:#0d8de8}
    button:disabled{opacity:.45;cursor:default}
    #status{font-size:13px;padding:14px;border-radius:8px;background:#111;
            border:1px solid #2a2a2a;min-height:48px;line-height:1.5;color:#888;white-space:pre-wrap}
    #status.running{color:#f5a623;border-color:#4a3a10}
    #status.done   {color:#2d9e5e;border-color:#1a3d2a}
    #status.error  {color:#d93025;border-color:#4a1a1a}
    .hint{font-size:12px;color:#555;line-height:1.5}
    code{background:#222;padding:2px 6px;border-radius:4px;font-size:12px;color:#aaa}
  </style>
</head>
<body>
<div class="card">
  <div>
    <h1>URL → Figma</h1>
    <p style="margin-top:6px">Enter any website URL. The server captures it and generates an IR JSON that your Figma plugin can import.</p>
  </div>

  <div>
    <label for="url">Website URL</label>
    <input id="url" type="url" placeholder="https://example.com" autofocus/>
  </div>

  <button id="btn">Capture &amp; Generate IR</button>

  <div id="status">Idle — enter a URL above and click Capture.</div>

  <div class="hint">
    After capture completes, open the <strong>Figma plugin</strong> and import from<br/>
    <code>http://localhost:${PORT}/ir.json</code>
  </div>
</div>

<script>
  var urlInput  = document.getElementById('url');
  var btn       = document.getElementById('btn');
  var statusEl  = document.getElementById('status');
  var polling   = null;

  function setStatus(msg, cls) {
    statusEl.textContent = msg;
    statusEl.className   = cls || '';
  }

  function pollStatus() {
    fetch('/pipeline/status').then(function(r) { return r.json(); }).then(function(d) {
      var cls = d.status === 'running' ? 'running' : d.status === 'done' ? 'done' : d.status === 'error' ? 'error' : '';
      setStatus(d.message, cls);
      if (d.status !== 'running') {
        clearInterval(polling);
        polling = null;
        btn.disabled = false;
      }
    }).catch(function() {});
  }

  btn.addEventListener('click', function() {
    var url = urlInput.value.trim();
    if (!url) { setStatus('Please enter a URL.', 'error'); return; }
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    urlInput.value = url;
    btn.disabled = true;
    setStatus('Starting capture… (30–60 s)', 'running');
    fetch('/pipeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url }),
    }).then(function(r) {
      return r.json().then(function(d) {
        if (!r.ok) { setStatus('Error: ' + (d.error || r.status), 'error'); btn.disabled = false; return; }
        polling = setInterval(pollStatus, 1500);
      });
    }).catch(function(e) {
      setStatus('Cannot reach server: ' + e.message, 'error');
      btn.disabled = false;
    });
  });

  // On page load, sync with current pipeline state
  fetch('/pipeline/status').then(function(r) { return r.json(); }).then(function(d) {
    if (d.status === 'running') {
      setStatus(d.message, 'running');
      btn.disabled = true;
      polling = setInterval(pollStatus, 1500);
    } else {
      btn.disabled = false;
      setStatus(d.message, d.status === 'done' ? 'done' : d.status === 'error' ? 'error' : '');
    }
  }).catch(function() {});
</script>
</body>
</html>`;

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------

createServer((req, res) => {
  const url = req.url ?? '/';

  // CORS pre-flight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  // ── Dashboard UI ────────────────────────────────────────────────────────
  if (req.method === 'GET' && url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...CORS_HEADERS });
    res.end(DASHBOARD);
    return;
  }

  // ── Start pipeline ───────────────────────────────────────────────────────
  if (req.method === 'POST' && url === '/pipeline') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        let { url: siteUrl } = JSON.parse(body);
        if (!siteUrl) throw new Error('Missing url field');
        if (!/^https?:\/\//i.test(siteUrl)) siteUrl = 'https://' + siteUrl;
        startPipeline(siteUrl);
        res.writeHead(200, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // ── Pipeline status ──────────────────────────────────────────────────────
  if (req.method === 'GET' && url === '/pipeline/status') {
    res.writeHead(200, { 'Content-Type': 'application/json', ...CORS_HEADERS });
    res.end(JSON.stringify(pipeline));
    return;
  }

  // ── Downloaded image/font assets ─────────────────────────────────────────
  if (req.method === 'GET' && url.startsWith('/assets/')) {
    const filename = basename(url);
    const filePath = join(ASSETS_DIR, filename);
    if (existsSync(filePath)) {
      const body = readFileSync(filePath);
      const mime = MIME[extname(filename).toLowerCase()] ?? 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime, 'Content-Length': body.length, 'Cache-Control': 'no-cache', ...CORS_HEADERS });
      res.end(body);
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain', ...CORS_HEADERS });
    res.end(`404 — asset not found: ${filename}\n`);
    return;
  }

  // ── Named JSON routes ────────────────────────────────────────────────────
  const filePath = ROUTES[url];
  if (!filePath) {
    res.writeHead(404, { 'Content-Type': 'text/plain', ...CORS_HEADERS });
    res.end(`404 — unknown route "${url}"\n`);
    return;
  }

  if (!existsSync(filePath)) {
    const hint = url === '/ir.json' ? '\nRun a capture first via the dashboard at http://localhost:' + PORT : '';
    res.writeHead(404, { 'Content-Type': 'text/plain', ...CORS_HEADERS });
    res.end(`404 — file not found: ${filePath}${hint}\n`);
    return;
  }

  const body = readFileSync(filePath);
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': body.length, 'Cache-Control': 'no-cache', ...CORS_HEADERS });
  res.end(body);

}).listen(PORT, '127.0.0.1', () => {
  console.log(`
┌─────────────────────────────────────────────────────┐
│  URL → Figma  server running                        │
├─────────────────────────────────────────────────────┤
│  Dashboard  →  http://localhost:${PORT}                │
│  IR JSON    →  http://localhost:${PORT}/ir.json         │
│  Assets     →  http://localhost:${PORT}/assets/<file>   │
└─────────────────────────────────────────────────────┘

  1. Open the dashboard in your browser
  2. Enter a website URL and click "Capture & Generate IR"
  3. Wait for capture to complete (30–60 s)
  4. In Figma Desktop plugin → import http://localhost:${PORT}/ir.json
`);
});
