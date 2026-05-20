#!/usr/bin/env node
import { capture } from './index.js';

const [, , url, outputPath = 'raw-capture.json'] = process.argv;

if (!url) {
  console.error('Usage: capture <url> [output.json]');
  process.exit(1);
}

capture({ url, outputPath }).catch((err: unknown) => {
  console.error('Capture failed:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
