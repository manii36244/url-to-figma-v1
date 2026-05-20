import { build } from 'esbuild';
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';

mkdirSync('dist', { recursive: true });

const html = readFileSync('src/ui.html', 'utf8');
copyFileSync('src/ui.html', 'dist/ui.html');

await build({
  entryPoints: ['src/code.ts'],
  bundle: true,
  outfile: 'dist/code.js',
  target: 'es2017',
  format: 'iife',
  define: {
    '__html__': JSON.stringify(html),
  },
  external: [],
});

console.log('figma-plugin built → dist/code.js + dist/ui.html');
