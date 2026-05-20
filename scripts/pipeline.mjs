/**
 * One-command pipeline: capture a URL → transform → ready to serve.
 *
 * Usage:
 *   node scripts/pipeline.mjs [url]
 *   node scripts/pipeline.mjs http://localhost:3000/simple.html
 *
 * Defaults to http://localhost:3000/simple.html if no URL is given.
 */
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT   = join(dirname(fileURLToPath(import.meta.url)), '..');
const capDir = join(ROOT, 'packages', 'capture');
const txDir  = join(ROOT, 'packages', 'transformer');

const url = process.argv[2] ?? 'http://localhost:3000/simple.html';

function run(cmd, args, cwd, label) {
  console.log(`\n── ${label} ──────────────────────────`);
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: true });
  if (r.status !== 0) {
    console.error(`\nFailed (exit ${r.status})`);
    process.exit(r.status ?? 1);
  }
}

// ── Step 1: capture ──────────────────────────────────────────────────────────
run(
  'npx', ['tsx', 'src/cli.ts', url, 'raw-capture.json'],
  capDir,
  `Capturing  ${url}`,
);

// ── Step 2: transform ────────────────────────────────────────────────────────
run(
  'npx', ['tsx', 'src/cli.ts', '../capture/raw-capture.json', 'ir.json'],
  txDir,
  'Transforming → ir.json',
);

console.log(`
── Done ──────────────────────────────────────────────────────
  ir.json → packages/transformer/ir.json

Next steps:
  1. node scripts/serve-ir.mjs        (keep this running)
  2. Open the Figma plugin
  3. URL: http://localhost:3001/ir.json  → Import
`);
