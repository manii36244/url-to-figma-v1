"use strict";
(() => {
  // src/parse-color.ts
  function parseColor(css) {
    var _a;
    if (!css || css === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
    const rgb = css.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)/);
    if (rgb) {
      return {
        r: Math.min(parseFloat(rgb[1]) / 255, 1),
        g: Math.min(parseFloat(rgb[2]) / 255, 1),
        b: Math.min(parseFloat(rgb[3]) / 255, 1),
        a: rgb[4] !== void 0 ? parseFloat(rgb[4]) : 1
      };
    }
    const hex = (_a = css.match(/^#([0-9a-f]{3,8})$/i)) == null ? void 0 : _a[1];
    if (hex) {
      if (hex.length === 3) {
        return {
          r: parseInt(hex[0] + hex[0], 16) / 255,
          g: parseInt(hex[1] + hex[1], 16) / 255,
          b: parseInt(hex[2] + hex[2], 16) / 255,
          a: 1
        };
      }
      if (hex.length === 6) {
        return {
          r: parseInt(hex.slice(0, 2), 16) / 255,
          g: parseInt(hex.slice(2, 4), 16) / 255,
          b: parseInt(hex.slice(4, 6), 16) / 255,
          a: 1
        };
      }
      if (hex.length === 8) {
        return {
          r: parseInt(hex.slice(0, 2), 16) / 255,
          g: parseInt(hex.slice(2, 4), 16) / 255,
          b: parseInt(hex.slice(4, 6), 16) / 255,
          a: parseInt(hex.slice(6, 8), 16) / 255
        };
      }
    }
    return null;
  }

  // src/code.ts
  try {
    figma.showUI(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Inter, system-ui, sans-serif;
      font-size: 13px;
      color: #111;
      background: #fff;
      padding: 20px 16px 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    h2 { font-size: 14px; font-weight: 600; letter-spacing: -0.2px; }
    label {
      display: block; font-size: 11px; font-weight: 600; color: #666;
      text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 5px;
    }
    input[type="text"], input[type="url"] {
      width: 100%; padding: 7px 10px;
      border: 1.5px solid #ddd; border-radius: 6px;
      font-size: 12px; outline: none;
      transition: border-color 0.15s;
    }
    input:focus { border-color: #18a0fb; }
    button {
      width: 100%; padding: 9px;
      background: #18a0fb; color: #fff;
      border: none; border-radius: 6px;
      font-size: 13px; font-weight: 600;
      cursor: pointer; transition: background 0.15s;
    }
    button:hover:not(:disabled) { background: #0d8de8; }
    button:disabled { opacity: 0.45; cursor: default; }
    #status {
      font-size: 12px; min-height: 16px; line-height: 1.5;
      color: #666; white-space: pre-wrap;
    }
    #status.ok      { color: #2d9e5e; }
    #status.error   { color: #d93025; }
    #status.working { color: #f5a623; }
    .divider {
      display: flex; align-items: center; gap: 8px;
      font-size: 11px; color: #bbb;
    }
    .divider::before, .divider::after {
      content: ''; flex: 1; height: 1px; background: #eee;
    }
    .advanced { display: flex; flex-direction: column; gap: 4px; }
    .advanced-toggle {
      font-size: 11px; color: #aaa; cursor: pointer;
      text-decoration: underline; background: none; border: none;
      padding: 0; text-align: left; width: auto;
    }
    .advanced-toggle:hover { color: #666; background: none; }
    #advanced-row { display: none; flex-direction: column; gap: 4px; }
    #advanced-row.open { display: flex; }
  </style>
</head>
<body>
  <h2>URL &#x2192; Figma</h2>

  <!-- Primary: website URL -->
  <div>
    <label for="site-url">Website URL</label>
    <input id="site-url" type="url" placeholder="https://example.com" />
  </div>

  <button id="capture-btn">Capture &amp; Apply</button>

  <div id="status"></div>

  <!-- Advanced: manual IR JSON URL override -->
  <div class="advanced">
    <div class="divider">advanced</div>
    <div id="advanced-row">
      <label for="ir-url">IR JSON URL (skip capture)</label>
      <input id="ir-url" type="text" value="http://localhost:3001/ir.json"
             placeholder="http://localhost:3001/ir.json" />
      <button id="load-btn" style="margin-top:4px">Load IR JSON</button>
    </div>
    <button class="advanced-toggle" id="toggle-advanced">Show advanced options</button>
  </div>

  <script>
    var siteUrlInput = document.getElementById('site-url');
    var captureBtn   = document.getElementById('capture-btn');
    var irUrlInput   = document.getElementById('ir-url');
    var loadBtn      = document.getElementById('load-btn');
    var statusEl     = document.getElementById('status');
    var advRow       = document.getElementById('advanced-row');
    var toggleBtn    = document.getElementById('toggle-advanced');

    var SERVER = 'http://localhost:3001';
    var polling = null;

    function setStatus(msg, cls) {
      statusEl.textContent = msg;
      statusEl.className   = cls || '';
    }

    toggleBtn.addEventListener('click', function() {
      var open = advRow.classList.toggle('open');
      toggleBtn.textContent = open ? 'Hide advanced options' : 'Show advanced options';
    });

    function collectImageSrcs(nodes) {
      var srcs = new Set();
      function walk(list) {
        for (var i = 0; i < list.length; i++) {
          var n = list[i];
          if (n.type === 'image' && n.src) srcs.add(n.src);
          if (n.type === 'rect' && n.backgroundSrc) srcs.add(n.backgroundSrc);
          if (n.children) walk(n.children);
        }
      }
      walk(nodes);
      return Array.from(srcs);
    }

    function fetchImageData(srcs) {
      var imageData = {};
      return Promise.all(srcs.map(function(src) {
        return fetch(src).then(function(res) {
          if (!res.ok) return;
          return res.arrayBuffer().then(function(buf) {
            imageData[src] = Array.from(new Uint8Array(buf));
          });
        }).catch(function() {});
      })).then(function() { return imageData; });
    }

    function applyFromUrl(irUrl) {
      setStatus('Fetching IR JSON\u2026', 'working');
      return fetch(irUrl).then(function(res) {
        if (!res.ok) throw new Error('HTTP ' + res.status + ' from ' + irUrl);
        return res.json();
      }).then(function(doc) {
        var srcs = collectImageSrcs(doc.nodes || []);
        if (srcs.length) setStatus('Fetching ' + srcs.length + ' image(s)\u2026', 'working');
        return fetchImageData(srcs).then(function(imageData) {
          setStatus('Sending to Figma\u2026', 'working');
          parent.postMessage({ pluginMessage: { type: 'apply', url: irUrl, doc: doc, imageData: imageData } }, '*');
        });
      });
    }

    captureBtn.addEventListener('click', function() {
      var siteUrl = siteUrlInput.value.trim();
      if (!siteUrl) { setStatus('Enter a website URL first.', 'error'); return; }
      if (!siteUrl.match(/^https?:\\/\\//i)) siteUrl = 'https://' + siteUrl;

      captureBtn.disabled = true;
      setStatus('Connecting to local server\u2026', 'working');

      fetch(SERVER + '/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: siteUrl }),
      }).then(function(r) {
        if (!r.ok) {
          return r.json().catch(function() { return { error: 'Unknown error' }; }).then(function(err) {
            throw new Error(err.error || 'HTTP ' + r.status);
          });
        }
        setStatus('Capturing page (this takes ~30\u201360 s)\u2026', 'working');
        polling = setInterval(function() {
          fetch(SERVER + '/pipeline/status').then(function(sr) {
            return sr.json();
          }).then(function(d) {
            if (d.status === 'running') {
              setStatus(d.message || 'Capturing\u2026', 'working');
            } else if (d.status === 'done') {
              clearInterval(polling); polling = null;
              applyFromUrl(SERVER + '/ir.json').catch(function(e) {
                setStatus('Error: ' + e.message, 'error');
                captureBtn.disabled = false;
              });
            } else if (d.status === 'error') {
              clearInterval(polling); polling = null;
              setStatus('Error: ' + d.message, 'error');
              captureBtn.disabled = false;
            }
          }).catch(function() {});
        }, 2000);
      }).catch(function(e) {
        var msg = e.message && e.message.toLowerCase().indexOf('fetch') !== -1
          ? 'Cannot reach server. Run:  node scripts/serve-ir.mjs'
          : e.message;
        setStatus('Error: ' + msg, 'error');
        captureBtn.disabled = false;
      });
    });

    loadBtn.addEventListener('click', function() {
      var url = irUrlInput.value.trim();
      if (!url) { setStatus('Enter a URL first.', 'error'); return; }
      loadBtn.disabled = true;
      applyFromUrl(url).catch(function(err) {
        var msg = err.message && err.message.toLowerCase().indexOf('fetch') !== -1
          ? 'Cannot reach server. Run:  node scripts/serve-ir.mjs'
          : err.message;
        setStatus('Error: ' + msg, 'error');
        loadBtn.disabled = false;
      });
    });

    window.onmessage = function(e) {
      var msg = e.data && e.data.pluginMessage;
      if (!msg) return;
      if (msg.type === 'done') {
        setStatus('\u2713 Created ' + msg.nodeCount + ' nodes in "' + msg.frameName + '"', 'ok');
        captureBtn.disabled = false;
        loadBtn.disabled    = false;
      } else if (msg.type === 'error') {
        setStatus('Error: ' + msg.message, 'error');
        captureBtn.disabled = false;
        loadBtn.disabled    = false;
      }
    };
  <\/script>
</body>
</html>
`, { width: 420, height: 310 });
  } catch (startupErr) {
    figma.notify(
      "Plugin failed to start: " + (startupErr instanceof Error ? startupErr.message : String(startupErr)),
      { error: true }
    );
  }
  figma.ui.onmessage = async (raw) => {
    var _a, _b, _c;
    const msg = raw;
    if (msg.type !== "apply" || !msg.doc) return;
    const imageData = {};
    for (const [src, bytes] of Object.entries((_a = msg.imageData) != null ? _a : {})) {
      imageData[src] = new Uint8Array(bytes);
    }
    try {
      const { nodeCount, frameName } = await applyDocument(
        (_c = (_b = msg.url) != null ? _b : msg.doc.sourceUrl) != null ? _c : "Imported page",
        msg.doc,
        imageData
      );
      figma.ui.postMessage({ type: "done", nodeCount, frameName });
    } catch (err) {
      figma.ui.postMessage({
        type: "error",
        message: err instanceof Error ? err.message : String(err)
      });
    }
  };
  async function applyDocument(url, doc, imageData) {
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
  function countAll(node) {
    return 1 + ("children" in node ? node.children.reduce((s, c) => s + countAll(c), 0) : 0);
  }
  async function buildNode(node, imageData) {
    switch (node.type) {
      case "frame":
        return buildFrame(node, imageData);
      case "rect":
        return buildRect(node, imageData);
      case "text":
        return buildText(node);
      case "image":
        return buildImage(node, imageData);
      case "vector":
        return buildVector(node);
      default:
        return null;
    }
  }
  async function buildFrame(node, imageData) {
    var _a;
    const frame = figma.createFrame();
    frame.name = `frame-${node.id}`;
    place(frame, node);
    frame.clipsContent = (_a = node.clipContent) != null ? _a : false;
    applyFill(frame, node.fill);
    applyStroke(frame, node.stroke, node.strokeWidth);
    applyCornerRadius(frame, node.borderRadius, node.cornerRadii);
    if (node.opacity !== void 0) frame.opacity = node.opacity;
    applyEffects(frame, node.effects);
    for (const child of node.children) {
      const built = await buildNode(child, imageData);
      if (built) frame.appendChild(built);
    }
    return frame;
  }
  function buildRect(node, imageData) {
    const rect = figma.createRectangle();
    rect.name = `rect-${node.id}`;
    place(rect, node);
    applyFill(rect, node.fill);
    applyCornerRadius(rect, node.borderRadius, node.cornerRadii);
    applyStroke(rect, node.stroke, node.strokeWidth);
    if (node.opacity !== void 0) rect.opacity = node.opacity;
    applyEffects(rect, node.effects);
    if (node.backgroundSrc) {
      const bytes = imageData[node.backgroundSrc];
      if (bytes && bytes.length > 0) {
        const img = figma.createImage(bytes);
        const imgPaint = {
          type: "IMAGE",
          imageHash: img.hash,
          scaleMode: "FILL",
          visible: true,
          opacity: 1,
          blendMode: "NORMAL"
        };
        rect.fills = [...rect.fills, imgPaint];
      }
    }
    return rect;
  }
  async function buildText(node) {
    var _a, _b, _c, _d, _e, _f, _g;
    const content = node.content.trim();
    if (!content) return null;
    const family = firstFontFamily((_a = node.fontFamily) != null ? _a : "Inter");
    const italic = node.fontStyle === "italic";
    const style = weightToStyle((_b = node.fontWeight) != null ? _b : 400, italic);
    const nonItalicStyle = italic ? weightToStyle((_c = node.fontWeight) != null ? _c : 400, false) : null;
    const loaded = (_f = (_e = (_d = await tryLoad(family, style)) != null ? _d : nonItalicStyle ? await tryLoad(family, nonItalicStyle) : null) != null ? _e : await tryLoad("Inter", italic ? "Italic" : "Regular")) != null ? _f : await tryLoad("Inter", "Regular");
    if (!loaded) return null;
    const text = figma.createText();
    text.name = content.slice(0, 60);
    text.x = node.x;
    text.y = node.y;
    text.fontName = loaded;
    if (node.fontSize) text.fontSize = node.fontSize;
    if (node.lineHeight && node.fontSize) {
      const ratio = node.lineHeight / node.fontSize;
      text.lineHeight = ratio > 0.5 && ratio < 6 ? { value: node.lineHeight, unit: "PIXELS" } : { unit: "AUTO" };
    }
    if (node.letterSpacing) text.letterSpacing = { value: node.letterSpacing, unit: "PIXELS" };
    if (node.textAlign) {
      const map = {
        left: "LEFT",
        center: "CENTER",
        right: "RIGHT",
        justify: "JUSTIFIED"
      };
      text.textAlignHorizontal = (_g = map[node.textAlign]) != null ? _g : "LEFT";
    }
    if (node.textDecoration === "underline") text.textDecoration = "UNDERLINE";
    if (node.textDecoration === "line-through") text.textDecoration = "STRIKETHROUGH";
    if (node.color) {
      const rgba = parseColor(node.color);
      if (rgba && rgba.a > 0) text.fills = [solidPaint(rgba)];
    }
    text.characters = content;
    text.resize(Math.max(node.width, 1), Math.max(node.height, 1));
    text.textAutoResize = "NONE";
    applyEffects(text, node.effects);
    return text;
  }
  async function buildImage(node, imageData) {
    var _a, _b;
    const rect = figma.createRectangle();
    rect.name = `image-${node.id}`;
    place(rect, node);
    applyEffects(rect, node.effects);
    const bytes = node.src ? imageData[node.src] : void 0;
    if (bytes && bytes.length > 0) {
      const img = figma.createImage(bytes);
      const scaleMode = {
        fill: "FILL",
        contain: "FIT",
        cover: "FILL",
        none: "CROP",
        "scale-down": "FIT"
      };
      rect.fills = [{
        type: "IMAGE",
        imageHash: img.hash,
        scaleMode: (_b = scaleMode[(_a = node.objectFit) != null ? _a : "cover"]) != null ? _b : "FILL",
        visible: true,
        opacity: 1,
        blendMode: "NORMAL"
      }];
    } else {
      rect.fills = [{
        type: "SOLID",
        color: { r: 0.87, g: 0.87, b: 0.87 },
        opacity: 1,
        visible: true,
        blendMode: "NORMAL"
      }];
    }
    return rect;
  }
  function buildVector(node) {
    const rect = figma.createRectangle();
    rect.name = `vector-${node.id}`;
    place(rect, node);
    if (node.fill && typeof node.fill === "string") applyFill(rect, node.fill);
    applyStroke(rect, node.stroke, node.strokeWidth);
    if (node.opacity !== void 0) rect.opacity = node.opacity;
    applyEffects(rect, node.effects);
    return rect;
  }
  function place(node, ir) {
    node.x = ir.x;
    node.y = ir.y;
    node.resize(Math.max(ir.width, 1), Math.max(ir.height, 1));
  }
  function solidPaint(rgba) {
    return {
      type: "SOLID",
      color: { r: rgba.r, g: rgba.g, b: rgba.b },
      opacity: rgba.a,
      visible: true,
      blendMode: "NORMAL"
    };
  }
  function linearGradientPaint(grad) {
    const \u03B8 = grad.angle * Math.PI / 180;
    const sin\u03B8 = Math.sin(\u03B8);
    const cos\u03B8 = Math.cos(\u03B8);
    const startX = 0.5 - 0.5 * sin\u03B8;
    const startY = 0.5 + 0.5 * cos\u03B8;
    const transform = [
      [cos\u03B8, sin\u03B8, startX],
      [sin\u03B8, -cos\u03B8, startY]
    ];
    return {
      type: "GRADIENT_LINEAR",
      gradientTransform: transform,
      gradientStops: toColorStops(grad.stops),
      visible: true,
      opacity: 1,
      blendMode: "NORMAL"
    };
  }
  function radialGradientPaint(grad) {
    const transform = [
      [0.5, 0, 0.5],
      [0, 0.5, 0.5]
    ];
    return {
      type: "GRADIENT_RADIAL",
      gradientTransform: transform,
      gradientStops: toColorStops(grad.stops),
      visible: true,
      opacity: 1,
      blendMode: "NORMAL"
    };
  }
  function toColorStops(stops) {
    const result = [];
    for (const s of stops) {
      const rgba = parseColor(s.color);
      if (!rgba) continue;
      result.push({
        position: Math.max(0, Math.min(1, s.position)),
        color: { r: rgba.r, g: rgba.g, b: rgba.b, a: rgba.a }
      });
    }
    return result;
  }
  function applyFill(node, fill) {
    if (!fill) {
      node.fills = [];
      return;
    }
    if (typeof fill === "string") {
      const rgba = parseColor(fill);
      if (!rgba || rgba.a === 0) {
        node.fills = [];
        return;
      }
      node.fills = [solidPaint(rgba)];
      return;
    }
    if (fill.type === "linear-gradient") {
      node.fills = [linearGradientPaint(fill)];
      return;
    }
    if (fill.type === "radial-gradient") {
      node.fills = [radialGradientPaint(fill)];
      return;
    }
    node.fills = [];
  }
  function applyStroke(node, css, width) {
    if (!css || !width) {
      node.strokes = [];
      return;
    }
    const rgba = parseColor(css);
    if (!rgba || rgba.a === 0) {
      node.strokes = [];
      return;
    }
    node.strokes = [solidPaint(rgba)];
    node.strokeWeight = width;
  }
  function applyCornerRadius(node, radius, radii) {
    if (radii) {
      node.topLeftRadius = radii[0];
      node.topRightRadius = radii[1];
      node.bottomRightRadius = radii[2];
      node.bottomLeftRadius = radii[3];
    } else if (radius) {
      node.cornerRadius = radius;
    }
  }
  function applyEffects(node, shadows) {
    if (!shadows || shadows.length === 0) return;
    const effects = [];
    for (const s of shadows) {
      const rgba = parseColor(s.color);
      if (!rgba) continue;
      effects.push({
        type: "DROP_SHADOW",
        color: { r: rgba.r, g: rgba.g, b: rgba.b, a: rgba.a },
        offset: { x: s.offsetX, y: s.offsetY },
        radius: s.blur,
        spread: s.spread,
        visible: true,
        blendMode: "NORMAL"
      });
    }
    if (effects.length) node.effects = effects;
  }
  async function tryLoad(family, style) {
    try {
      await figma.loadFontAsync({ family, style });
      return { family, style };
    } catch (e) {
      return null;
    }
  }
  function firstFontFamily(css) {
    return css.split(",")[0].trim().replace(/['"]/g, "") || "Inter";
  }
  function weightToStyle(w, italic = false) {
    const base = w <= 100 ? "Thin" : w <= 200 ? "ExtraLight" : w <= 300 ? "Light" : w <= 400 ? "Regular" : w <= 500 ? "Medium" : w <= 600 ? "SemiBold" : w <= 700 ? "Bold" : w <= 800 ? "ExtraBold" : "Black";
    if (!italic) return base;
    return base === "Regular" ? "Italic" : `${base} Italic`;
  }
})();
