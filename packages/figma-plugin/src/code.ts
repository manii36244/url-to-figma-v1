import type {
  IRDocument,
  IRDropShadow,
  IRNode,
  IRFrameNode,
  IRTextNode,
  IRRectNode,
  IRImageNode,
  IRVectorNode,
  IRFill,
  IRLinearGradient,
  IRRadialGradient,
} from '@url-to-figma/shared';
import { parseColor } from './parse-color';

// ---------------------------------------------------------------------------
// Startup — wrapped so any init error is shown instead of a silent crash
// ---------------------------------------------------------------------------

try {
  figma.showUI(__html__, { width: 420, height: 310 });
} catch (startupErr) {
  // If showUI itself fails (e.g. HTML parse error), surface it via notify
  figma.notify(
    'Plugin failed to start: ' + (startupErr instanceof Error ? startupErr.message : String(startupErr)),
    { error: true },
  );
}

figma.ui.onmessage = async (raw: unknown) => {
  const msg = raw as {
    type: string;
    url?: string;
    doc?: IRDocument;
    imageData?: Record<string, number[]>;
  };

  if (msg.type !== 'apply' || !msg.doc) return;

  const imageData: Record<string, Uint8Array> = {};
  for (const [src, bytes] of Object.entries(msg.imageData ?? {})) {
    imageData[src] = new Uint8Array(bytes);
  }

  try {
    const { nodeCount, frameName } = await applyDocument(
      msg.url ?? msg.doc.sourceUrl ?? 'Imported page',
      msg.doc,
      imageData,
    );
    figma.ui.postMessage({ type: 'done', nodeCount, frameName });
  } catch (err) {
    figma.ui.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    });
  }
};

// ---------------------------------------------------------------------------
// Document entry
// ---------------------------------------------------------------------------

async function applyDocument(
  url: string,
  doc: IRDocument,
  imageData: Record<string, Uint8Array>,
): Promise<{ nodeCount: number; frameName: string }> {
  const page = figma.currentPage;

  const wrapper = figma.createFrame();
  wrapper.name = url;
  wrapper.resize(Math.max(doc.pageWidth, 1), Math.max(doc.pageHeight, 1));
  wrapper.x = 0;
  wrapper.y = 0;
  wrapper.fills = [];
  wrapper.clipsContent = false;

  let nodeCount = 0;
  for (const node of doc.nodes) {
    const built = await buildNode(node, imageData);
    if (built) {
      wrapper.appendChild(built);
      nodeCount += countAll(built);
    }
  }

  page.appendChild(wrapper);
  figma.viewport.scrollAndZoomIntoView([wrapper]);

  return { nodeCount, frameName: wrapper.name };
}

function countAll(node: SceneNode): number {
  return 1 + ('children' in node
    ? (node as ChildrenMixin).children.reduce((s, c) => s + countAll(c), 0)
    : 0);
}

// ---------------------------------------------------------------------------
// Node dispatch
// ---------------------------------------------------------------------------

async function buildNode(
  node: IRNode,
  imageData: Record<string, Uint8Array>,
): Promise<SceneNode | null> {
  switch (node.type) {
    case 'frame':  return buildFrame(node, imageData);
    case 'rect':   return buildRect(node, imageData);
    case 'text':   return buildText(node);
    case 'image':  return buildImage(node, imageData);
    case 'vector': return buildVector(node);
    default:       return null;
  }
}

// ---------------------------------------------------------------------------
// Frame
// ---------------------------------------------------------------------------

async function buildFrame(
  node: IRFrameNode,
  imageData: Record<string, Uint8Array>,
): Promise<FrameNode> {
  const frame = figma.createFrame();
  frame.name = `frame-${node.id}`;
  place(frame, node);
  frame.clipsContent = node.clipContent ?? false;
  applyFill(frame, node.fill);
  applyStroke(frame, node.stroke, node.strokeWidth);
  applyCornerRadius(frame, node.borderRadius, node.cornerRadii);
  if (node.opacity !== undefined) frame.opacity = node.opacity;
  applyEffects(frame, node.effects);

  for (const child of node.children) {
    const built = await buildNode(child, imageData);
    if (built) frame.appendChild(built);
  }
  return frame;
}

// ---------------------------------------------------------------------------
// Rectangle
// ---------------------------------------------------------------------------

function buildRect(node: IRRectNode, imageData: Record<string, Uint8Array>): RectangleNode {
  const rect = figma.createRectangle();
  rect.name = `rect-${node.id}`;
  place(rect, node);
  applyFill(rect, node.fill);
  applyCornerRadius(rect, node.borderRadius, node.cornerRadii);
  applyStroke(rect, node.stroke, node.strokeWidth);
  if (node.opacity !== undefined) rect.opacity = node.opacity;
  applyEffects(rect, node.effects);

  // background-image: url(…) applied on top of the fill
  if (node.backgroundSrc) {
    const bytes = imageData[node.backgroundSrc];
    if (bytes && bytes.length > 0) {
      const img = figma.createImage(bytes);
      const imgPaint: ImagePaint = {
        type: 'IMAGE',
        imageHash: img.hash,
        scaleMode: 'FILL',
        visible: true,
        opacity: 1,
        blendMode: 'NORMAL',
      };
      rect.fills = [...(rect.fills as Paint[]), imgPaint];
    }
  }

  return rect;
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

async function buildText(node: IRTextNode): Promise<TextNode | null> {
  const content = node.content.trim();
  if (!content) return null;

  const family = firstFontFamily(node.fontFamily ?? 'Inter');
  const italic = node.fontStyle === 'italic';
  const style  = weightToStyle(node.fontWeight ?? 400, italic);
  const nonItalicStyle = italic ? weightToStyle(node.fontWeight ?? 400, false) : null;

  const loaded =
    (await tryLoad(family, style)) ??
    (nonItalicStyle ? await tryLoad(family, nonItalicStyle) : null) ??
    (await tryLoad('Inter', italic ? 'Italic' : 'Regular')) ??
    (await tryLoad('Inter', 'Regular'));

  if (!loaded) return null;

  const text = figma.createText();
  text.name   = content.slice(0, 60);
  text.x      = node.x;
  text.y      = node.y;
  text.fontName = loaded;

  if (node.fontSize)      text.fontSize = node.fontSize;
  if (node.lineHeight && node.fontSize) {
    const ratio = node.lineHeight / node.fontSize;
    text.lineHeight = (ratio > 0.5 && ratio < 6)
      ? { value: node.lineHeight, unit: 'PIXELS' }
      : { unit: 'AUTO' };
  }
  if (node.letterSpacing) text.letterSpacing = { value: node.letterSpacing, unit: 'PIXELS' };

  if (node.textAlign) {
    const map: Record<string, typeof text.textAlignHorizontal> = {
      left: 'LEFT', center: 'CENTER', right: 'RIGHT', justify: 'JUSTIFIED',
    };
    text.textAlignHorizontal = map[node.textAlign] ?? 'LEFT';
  }

  if (node.textDecoration === 'underline')    text.textDecoration = 'UNDERLINE';
  if (node.textDecoration === 'line-through') text.textDecoration = 'STRIKETHROUGH';

  if (node.color) {
    const rgba = parseColor(node.color);
    if (rgba && rgba.a > 0) text.fills = [solidPaint(rgba)];
  }

  text.characters = content;
  text.resize(Math.max(node.width, 1), Math.max(node.height, 1));
  text.textAutoResize = 'NONE';
  applyEffects(text, node.effects);
  return text;
}

// ---------------------------------------------------------------------------
// Image
// ---------------------------------------------------------------------------

async function buildImage(
  node: IRImageNode,
  imageData: Record<string, Uint8Array>,
): Promise<RectangleNode> {
  const rect = figma.createRectangle();
  rect.name = `image-${node.id}`;
  place(rect, node);
  applyEffects(rect, node.effects);

  const bytes = node.src ? imageData[node.src] : undefined;
  if (bytes && bytes.length > 0) {
    const img = figma.createImage(bytes);
    const scaleMode: Record<string, ImagePaint['scaleMode']> = {
      fill: 'FILL', contain: 'FIT', cover: 'FILL', none: 'CROP', 'scale-down': 'FIT',
    };
    rect.fills = [{
      type: 'IMAGE',
      imageHash: img.hash,
      scaleMode: scaleMode[node.objectFit ?? 'cover'] ?? 'FILL',
      visible: true,
      opacity: 1,
      blendMode: 'NORMAL',
    }];
  } else {
    rect.fills = [{
      type: 'SOLID',
      color: { r: 0.87, g: 0.87, b: 0.87 },
      opacity: 1,
      visible: true,
      blendMode: 'NORMAL',
    }];
  }

  return rect;
}

// ---------------------------------------------------------------------------
// Vector (SVG placeholder)
// ---------------------------------------------------------------------------

function buildVector(node: IRVectorNode): RectangleNode {
  const rect = figma.createRectangle();
  rect.name = `vector-${node.id}`;
  place(rect, node);
  if (node.fill && typeof node.fill === 'string') applyFill(rect, node.fill);
  applyStroke(rect, node.stroke, node.strokeWidth);
  if (node.opacity !== undefined) rect.opacity = node.opacity;
  applyEffects(rect, node.effects);
  return rect;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function place(
  node: SceneNode & { x: number; y: number; resize(w: number, h: number): void },
  ir: IRNode,
) {
  node.x = ir.x;
  node.y = ir.y;
  node.resize(Math.max(ir.width, 1), Math.max(ir.height, 1));
}

function solidPaint(rgba: { r: number; g: number; b: number; a: number }): SolidPaint {
  return {
    type: 'SOLID',
    color: { r: rgba.r, g: rgba.g, b: rgba.b },
    opacity: rgba.a,
    visible: true,
    blendMode: 'NORMAL',
  };
}

// ---------------------------------------------------------------------------
// Gradient helpers
// ---------------------------------------------------------------------------

function linearGradientPaint(grad: IRLinearGradient): GradientPaint {
  // gradientTransform maps FROM gradient-space (y=0 → stop 0, y=1 → stop 1)
  // TO normalized layer space (0,0 = top-left, 1,1 = bottom-right).
  // CSS angle 0° = to-top, 90° = to-right, 180° = to-bottom.
  const θ = (grad.angle * Math.PI) / 180;
  const sinθ = Math.sin(θ);
  const cosθ = Math.cos(θ);
  const startX = 0.5 - 0.5 * sinθ;
  const startY = 0.5 + 0.5 * cosθ;
  // Row 0: x = cosθ*gx + sinθ*gy + startX
  // Row 1: y = sinθ*gx - cosθ*gy + startY
  const transform: Transform = [
    [cosθ,  sinθ, startX],
    [sinθ, -cosθ, startY],
  ];
  return {
    type: 'GRADIENT_LINEAR',
    gradientTransform: transform,
    gradientStops: toColorStops(grad.stops),
    visible: true,
    opacity: 1,
    blendMode: 'NORMAL',
  };
}

function radialGradientPaint(grad: IRRadialGradient): GradientPaint {
  // Centered radial gradient filling the bounding box.
  // gradientTransform scales the unit circle (radius 1 at origin) to
  // a circle of radius 0.5 centred at (0.5, 0.5) in normalized layer space.
  const transform: Transform = [
    [0.5, 0, 0.5],
    [0, 0.5, 0.5],
  ];
  return {
    type: 'GRADIENT_RADIAL',
    gradientTransform: transform,
    gradientStops: toColorStops(grad.stops),
    visible: true,
    opacity: 1,
    blendMode: 'NORMAL',
  };
}

function toColorStops(
  stops: Array<{ color: string; position: number }>,
): ColorStop[] {
  const result: ColorStop[] = [];
  for (const s of stops) {
    const rgba = parseColor(s.color);
    if (!rgba) continue;
    result.push({
      position: Math.max(0, Math.min(1, s.position)),
      color: { r: rgba.r, g: rgba.g, b: rgba.b, a: rgba.a },
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Fill application (handles solid, linear-gradient, radial-gradient)
// ---------------------------------------------------------------------------

function applyFill(node: MinimalFillsMixin, fill: IRFill | undefined): void {
  if (!fill) { node.fills = []; return; }

  if (typeof fill === 'string') {
    const rgba = parseColor(fill);
    if (!rgba || rgba.a === 0) { node.fills = []; return; }
    node.fills = [solidPaint(rgba)];
    return;
  }

  if (fill.type === 'linear-gradient') {
    node.fills = [linearGradientPaint(fill)];
    return;
  }

  if (fill.type === 'radial-gradient') {
    node.fills = [radialGradientPaint(fill)];
    return;
  }

  node.fills = [];
}

function applyStroke(
  node: MinimalStrokesMixin,
  css: string | undefined,
  width: number | undefined,
): void {
  if (!css || !width) { node.strokes = []; return; }
  const rgba = parseColor(css);
  if (!rgba || rgba.a === 0) { node.strokes = []; return; }
  node.strokes = [solidPaint(rgba)];
  node.strokeWeight = width;
}

function applyCornerRadius(
  node: RectangleNode | FrameNode,
  radius: number | undefined,
  radii: [number, number, number, number] | undefined,
): void {
  if (radii) {
    node.topLeftRadius     = radii[0];
    node.topRightRadius    = radii[1];
    node.bottomRightRadius = radii[2];
    node.bottomLeftRadius  = radii[3];
  } else if (radius) {
    node.cornerRadius = radius;
  }
}

function applyEffects(node: BlendMixin, shadows: IRDropShadow[] | undefined): void {
  if (!shadows || shadows.length === 0) return;
  const effects: Effect[] = [];
  for (const s of shadows) {
    const rgba = parseColor(s.color);
    if (!rgba) continue;
    effects.push({
      type: 'DROP_SHADOW',
      color: { r: rgba.r, g: rgba.g, b: rgba.b, a: rgba.a },
      offset: { x: s.offsetX, y: s.offsetY },
      radius: s.blur,
      spread: s.spread,
      visible: true,
      blendMode: 'NORMAL',
    });
  }
  if (effects.length) node.effects = effects;
}

async function tryLoad(family: string, style: string): Promise<FontName | null> {
  try {
    await figma.loadFontAsync({ family, style });
    return { family, style };
  } catch {
    return null;
  }
}

function firstFontFamily(css: string): string {
  return css.split(',')[0].trim().replace(/['"]/g, '') || 'Inter';
}

function weightToStyle(w: number, italic = false): string {
  const base =
    w <= 100 ? 'Thin' :
    w <= 200 ? 'ExtraLight' :
    w <= 300 ? 'Light' :
    w <= 400 ? 'Regular' :
    w <= 500 ? 'Medium' :
    w <= 600 ? 'SemiBold' :
    w <= 700 ? 'Bold' :
    w <= 800 ? 'ExtraBold' : 'Black';

  if (!italic) return base;
  return base === 'Regular' ? 'Italic' : `${base} Italic`;
}
