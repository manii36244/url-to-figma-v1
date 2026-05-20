# url-to-figma

Tool that captures a webpage and reconstructs it as an editable Figma file.

## Architecture
- packages/capture: Playwright headless Chromium, captures DOM + computed styles + bounding boxes + assets → outputs raw-capture.json
- packages/transformer: walks raw capture, produces normalized IR JSON
- packages/shared: TypeScript types for the IR schema, imported by transformer and plugin
- packages/figma-plugin: Figma plugin, fetches IR, calls Figma Plugin API to create nodes

## Tech
- TypeScript everywhere, ESM
- pnpm workspaces
- Playwright for capture
- Figma Plugin API for output

## IR design
Tree of design nodes. Each node: id, type (frame/text/rect/vector/image), x, y, width, height, plus type-specific props (fill, stroke, fontFamily, src, etc.). Coordinates are absolute, not relative to parent.

## MVP scope
Render a simple static HTML page as a Figma file with correct positions, sizes, colors, and text. No auto-layout inference, no components, no font matching yet. Get the pipeline working end-to-end, then improve quality.

## Test target
test-fixtures/simple.html — handwritten page with header, hero, three cards, footer. Serve via `npx serve test-fixtures` on localhost:3000.