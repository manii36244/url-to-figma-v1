# figma-plugin

Reads an IR JSON document and creates Figma nodes from it.

## Loading in Figma Desktop

1. Open **Figma Desktop** (the native app, not the browser).
2. Open any file (or create a blank one).
3. Go to **Main menu → Plugins → Development → Import plugin from manifest…**
4. In the file picker, navigate to this folder and select **`manifest.json`**.
5. The plugin now appears under **Plugins → Development → URL to Figma**.
6. Click it to open the panel.

## Building

```bash
# from the repo root
pnpm build
# or just this package
cd packages/figma-plugin
node build.mjs
```

Output: `dist/code.js` (bundled sandbox) + `dist/ui.html` (panel).  
Figma reads both files directly — no dev server needed.

## Quick test with the hand-written IR

```bash
# Terminal 1 — serve test-fixtures on port 3001
pnpm serve:ir   # serves packages/transformer/ — or:
npx serve test-fixtures -l 3001 --cors

# In Figma — paste this URL into the plugin panel:
http://localhost:3001/test-ir.json
```

`test-fixtures/test-ir.json` contains 4 nodes: a root frame, a white card
rectangle (with a drop shadow), a bold "Hello, Figma!" text layer, and an
image placeholder.

## Full pipeline

```bash
# Terminal 1 — serve the target web page
pnpm serve:fixtures          # http://localhost:3000/simple.html

# Terminal 2 — capture + transform
pnpm capture http://localhost:3000/simple.html
pnpm transform               # writes packages/transformer/ir.json

# Terminal 3 — serve the IR for Figma to fetch
pnpm serve:ir                # http://localhost:3001/ir.json
```

Then open the plugin in Figma and click **Import** with the default URL
(`http://localhost:3001/ir.json`).

## Node mapping

| IR type   | Figma node          | Notes                                      |
|-----------|---------------------|--------------------------------------------|
| `frame`   | `FrameNode`         | children appended recursively              |
| `rect`    | `RectangleNode`     | fill, stroke, cornerRadius, opacity        |
| `text`    | `TextNode`          | font loaded with `loadFontAsync` first     |
| `image`   | `RectangleNode`     | image fill; grey placeholder if src empty  |
| `vector`  | `RectangleNode`     | SVG path data not captured yet             |

Effects: `IRDropShadow` entries map to Figma `DROP_SHADOW` effects.

## esbuild config

[`build.mjs`](build.mjs) — runs `esbuild` to bundle `src/code.ts` into a
single `dist/code.js` (IIFE format, ES2017 target). The UI HTML is copied
to `dist/ui.html` and its contents are also inlined into the bundle as the
`__html__` constant used by `figma.showUI(__html__)`.
