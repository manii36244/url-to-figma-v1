// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
let _id = 0;
function nextId() {
    return `n${++_id}`;
}
function px(val) {
    if (!val)
        return undefined;
    const n = parseFloat(val);
    return isFinite(n) ? n : undefined;
}
function isTransparent(color) {
    if (!color || color === 'transparent')
        return true;
    const m = color.match(/rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(?:,\s*([\d.]+))?\s*\)/);
    if (!m)
        return false;
    return (m[1] !== undefined ? parseFloat(m[1]) : 1) === 0;
}
function hasVisibleBg(s) {
    return !isTransparent(s.backgroundColor);
}
function hasVisibleBorder(s) {
    const widths = s.borderWidth.trim().split(/\s+/).map(parseFloat);
    const styles = s.borderStyle.trim().split(/\s+/);
    return widths.some((w, i) => w > 0 && (styles[i] ?? styles[0]) !== 'none');
}
function hasVisibleRadius(s) {
    return [
        s.borderTopLeftRadius, s.borderTopRightRadius,
        s.borderBottomRightRadius, s.borderBottomLeftRadius,
    ].some((v) => v && parseFloat(v) > 0);
}
function hasVisualProps(s) {
    return hasVisibleBg(s) || hasVisibleBorder(s) || hasVisibleRadius(s);
}
function borderStroke(s) {
    const widths = s.borderWidth.trim().split(/\s+/).map(parseFloat);
    const styles = s.borderStyle.trim().split(/\s+/);
    const colorMatches = s.borderColor.match(/rgba?\([^)]+\)|#[0-9a-f]{3,8}/gi) ?? [s.borderColor];
    for (let i = 0; i < widths.length; i++) {
        if (widths[i] > 0 && (styles[i] ?? styles[0]) !== 'none') {
            return { stroke: colorMatches[i] ?? colorMatches[0], strokeWidth: widths[i] };
        }
    }
    return {};
}
function mapAlign(val) {
    if (val === 'center')
        return 'center';
    if (val === 'right' || val === 'end')
        return 'right';
    if (val === 'justify')
        return 'justify';
    return 'left';
}
// ---------------------------------------------------------------------------
// Per-corner border radius
// ---------------------------------------------------------------------------
function cornerRadii(s) {
    const tl = px(s.borderTopLeftRadius) ?? 0;
    const tr = px(s.borderTopRightRadius) ?? 0;
    const br = px(s.borderBottomRightRadius) ?? 0;
    const bl = px(s.borderBottomLeftRadius) ?? 0;
    if (tl === 0 && tr === 0 && br === 0 && bl === 0)
        return {};
    if (tl === tr && tr === br && br === bl)
        return { borderRadius: tl };
    return { cornerRadii: [tl, tr, br, bl] };
}
// ---------------------------------------------------------------------------
// Box-shadow parser
// ---------------------------------------------------------------------------
function parseBoxShadow(css) {
    if (!css || css === 'none')
        return [];
    const parts = css.split(/,(?![^(]*\))/);
    const result = [];
    for (const part of parts) {
        const s = part.trim();
        if (!s || s === 'none' || s.includes('inset'))
            continue;
        const colorMatch = s.match(/rgba?\([^)]+\)|#[0-9a-f]{3,8}/i);
        if (!colorMatch)
            continue;
        const color = colorMatch[0];
        const lengths = s.replace(color, '').trim().match(/-?[\d.]+px/g);
        if (!lengths || lengths.length < 2)
            continue;
        result.push({
            color,
            offsetX: parseFloat(lengths[0]),
            offsetY: parseFloat(lengths[1]),
            blur: lengths[2] ? parseFloat(lengths[2]) : 0,
            spread: lengths[3] ? parseFloat(lengths[3]) : 0,
        });
    }
    return result;
}
// ---------------------------------------------------------------------------
// Gradient parser
// ---------------------------------------------------------------------------
function splitCommaOutsideParens(s) {
    const parts = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < s.length; i++) {
        if (s[i] === '(')
            depth++;
        else if (s[i] === ')')
            depth--;
        else if (s[i] === ',' && depth === 0) {
            parts.push(s.slice(start, i).trim());
            start = i + 1;
        }
    }
    parts.push(s.slice(start).trim());
    return parts.filter(Boolean);
}
function directionToAngle(dir) {
    const d = dir.trim().toLowerCase();
    if (d === 'to top')
        return 0;
    if (d === 'to top right' || d === 'to right top')
        return 45;
    if (d === 'to right')
        return 90;
    if (d === 'to bottom right' || d === 'to right bottom')
        return 135;
    if (d === 'to bottom')
        return 180;
    if (d === 'to bottom left' || d === 'to left bottom')
        return 225;
    if (d === 'to left')
        return 270;
    if (d === 'to top left' || d === 'to left top')
        return 315;
    return 180;
}
function parseGradientStops(parts) {
    const raw = parts.map((p) => {
        p = p.trim();
        // Position at end: "rgb(…) 25%"
        const posMatch = p.match(/\s+([\d.]+)%\s*$/);
        if (posMatch) {
            return {
                color: p.slice(0, p.length - posMatch[0].length).trim(),
                position: parseFloat(posMatch[1]) / 100,
            };
        }
        return { color: p, position: -1 };
    });
    // Anchor endpoints
    if (raw.length > 0 && raw[0].position < 0)
        raw[0].position = 0;
    if (raw.length > 1 && raw[raw.length - 1].position < 0)
        raw[raw.length - 1].position = 1;
    // Interpolate remaining undefined positions
    for (let i = 1; i < raw.length - 1; i++) {
        if (raw[i].position >= 0)
            continue;
        let prevI = i - 1;
        while (prevI >= 0 && raw[prevI].position < 0)
            prevI--;
        let nextI = i + 1;
        while (nextI < raw.length && raw[nextI].position < 0)
            nextI++;
        const prevPos = raw[prevI]?.position ?? 0;
        const nextPos = raw[nextI]?.position ?? 1;
        const count = nextI - prevI;
        raw[i].position = prevPos + ((nextPos - prevPos) * (i - prevI)) / count;
    }
    return raw.filter((r) => r.position >= 0);
}
function parseGradient(css) {
    const linearM = css.match(/^linear-gradient\((.+)\)$/is);
    const radialM = css.match(/^radial-gradient\((.+)\)$/is);
    if (linearM) {
        const parts = splitCommaOutsideParens(linearM[1]);
        if (parts.length < 2)
            return null;
        let angle = 180;
        let stopParts = parts;
        const first = parts[0].trim();
        if (first.startsWith('to ')) {
            angle = directionToAngle(first);
            stopParts = parts.slice(1);
        }
        else if (/^-?[\d.]+deg$/i.test(first)) {
            angle = parseFloat(first);
            stopParts = parts.slice(1);
        }
        else if (/^-?[\d.]+turn$/i.test(first)) {
            angle = parseFloat(first) * 360;
            stopParts = parts.slice(1);
        }
        else if (/^-?[\d.]+rad$/i.test(first)) {
            angle = (parseFloat(first) * 180) / Math.PI;
            stopParts = parts.slice(1);
        }
        const stops = parseGradientStops(stopParts);
        if (stops.length < 2)
            return null;
        return { type: 'linear-gradient', angle, stops };
    }
    if (radialM) {
        const parts = splitCommaOutsideParens(radialM[1]);
        // Skip shape / size / position tokens at the start (they don't start with color syntax)
        let stopParts = parts;
        const first = parts[0].trim();
        if (!first.match(/^rgba?\(/i) &&
            !first.match(/^#/) &&
            !first.match(/^[\d.]+%$/)) {
            stopParts = parts.slice(1);
        }
        const stops = parseGradientStops(stopParts);
        if (stops.length < 2)
            return null;
        return { type: 'radial-gradient', stops };
    }
    return null;
}
// ---------------------------------------------------------------------------
// backgroundImage → fill / backgroundSrc
// ---------------------------------------------------------------------------
function parseBgImage(css, assets) {
    if (!css || css === 'none')
        return {};
    // CSS background-image can be layered; take the first non-none layer.
    const layers = splitCommaOutsideParens(css);
    for (const layer of layers) {
        const t = layer.trim();
        if (!t || t === 'none')
            continue;
        // Gradient?
        const gradient = parseGradient(t);
        if (gradient)
            return { fill: gradient };
        // URL?
        const urlM = t.match(/^url\(['"]?([^'")\s]+)['"]?\)$/i);
        if (urlM) {
            const imgUrl = urlM[1];
            const asset = assets.find((a) => a.url === imgUrl || a.url.endsWith(imgUrl) || imgUrl.endsWith(a.localPath.split('/').pop()));
            const backgroundSrc = asset
                ? `http://localhost:3001/assets/${asset.localPath.split('/').pop()}`
                : imgUrl;
            return { backgroundSrc };
        }
    }
    return {};
}
// ---------------------------------------------------------------------------
// Node builders
// ---------------------------------------------------------------------------
function textNode(el, id) {
    const s = el.styles;
    const effects = parseBoxShadow(s.boxShadow);
    const decLine = s.textDecorationLine ?? '';
    const textDecoration = decLine.includes('underline') ? 'underline'
        : decLine.includes('line-through') ? 'line-through'
            : 'none';
    const fontStyleRaw = s.fontStyle ?? '';
    const fontStyle = fontStyleRaw.includes('italic') || fontStyleRaw.includes('oblique') ? 'italic' : 'normal';
    const node = {
        id,
        type: 'text',
        x: el.rect.x,
        y: el.rect.y,
        width: el.rect.width,
        height: el.rect.height,
        content: el.text ?? '',
        fontFamily: s.fontFamily || undefined,
        fontSize: px(s.fontSize),
        fontWeight: px(s.fontWeight),
        fontStyle,
        color: s.color || undefined,
        textAlign: mapAlign(s.textAlign),
        lineHeight: px(s.lineHeight),
        letterSpacing: px(s.letterSpacing),
        textDecoration,
    };
    if (effects.length)
        node.effects = effects;
    return node;
}
function rectNode(el, id, assets) {
    const s = el.styles;
    const { stroke, strokeWidth } = borderStroke(s);
    const { borderRadius, cornerRadii: perCorner } = cornerRadii(s);
    const opacity = px(s.opacity);
    const effects = parseBoxShadow(s.boxShadow);
    // backgroundImage takes precedence over backgroundColor for fill
    let fill;
    let backgroundSrc;
    if (s.backgroundImage && s.backgroundImage !== 'none') {
        const bg = parseBgImage(s.backgroundImage, assets);
        if (bg.fill)
            fill = bg.fill;
        if (bg.backgroundSrc)
            backgroundSrc = bg.backgroundSrc;
    }
    // Fall back to solid background color
    if (!fill && hasVisibleBg(s)) {
        fill = s.backgroundColor;
    }
    const node = {
        id,
        type: 'rect',
        x: el.rect.x,
        y: el.rect.y,
        width: el.rect.width,
        height: el.rect.height,
        fill,
        backgroundSrc,
        stroke,
        strokeWidth,
        borderRadius,
        cornerRadii: perCorner,
        opacity: opacity !== undefined && opacity !== 1 ? opacity : undefined,
    };
    if (effects.length)
        node.effects = effects;
    return node;
}
function imageNode(el, id, assets) {
    const rawSrc = el.src ?? '';
    // Prefer local downloaded asset over external URL (avoids CORS issues)
    const asset = rawSrc ? assets.find((a) => a.url === rawSrc) : undefined;
    const src = asset
        ? `http://localhost:3001/assets/${asset.localPath.split('/').pop()}`
        : rawSrc;
    return {
        id,
        type: 'image',
        x: el.rect.x,
        y: el.rect.y,
        width: el.rect.width,
        height: el.rect.height,
        src,
        objectFit: el.styles.objectFit || 'cover',
    };
}
// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------
function classify(el, assets) {
    const { tag, text } = el;
    const id = nextId();
    if (tag === 'img')
        return imageNode(el, id, assets);
    if (tag === 'svg') {
        const node = {
            id,
            type: 'rect',
            x: el.rect.x,
            y: el.rect.y,
            width: el.rect.width,
            height: el.rect.height,
        };
        return node;
    }
    if (text)
        return textNode(el, id);
    // Also emit a rect when there's a visible background-image (gradient or URL)
    const hasBgImage = el.styles.backgroundImage &&
        el.styles.backgroundImage !== 'none';
    if (hasVisualProps(el.styles) || hasBgImage)
        return rectNode(el, id, assets);
    return null;
}
// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export function transform(raw) {
    _id = 0;
    const { viewport, elements, url, assets } = raw;
    // Sort elements by CSS z-index so stacking order matches the browser.
    // Elements with z-index "auto" get 0.
    const sorted = [...elements].sort((a, b) => {
        const za = parseFloat(a.styles.zIndex) || 0;
        const zb = parseFloat(b.styles.zIndex) || 0;
        return za - zb;
    });
    const pageHeight = elements.reduce((max, el) => Math.max(max, el.rect.y + el.rect.height), viewport.height);
    const children = [];
    for (const el of sorted) {
        const node = classify(el, assets);
        if (node)
            children.push(node);
    }
    const root = {
        id: 'root',
        type: 'frame',
        x: 0,
        y: 0,
        width: viewport.width,
        height: pageHeight,
        children,
    };
    return {
        version: '1.0.0',
        sourceUrl: url,
        pageWidth: viewport.width,
        pageHeight,
        nodes: [root],
    };
}
//# sourceMappingURL=index.js.map