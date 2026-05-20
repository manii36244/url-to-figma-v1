import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { createHash } from 'node:crypto';
const STYLE_NAMES = [
    'display', 'position', 'color', 'backgroundColor', 'backgroundImage',
    'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
    'textAlign', 'borderRadius', 'borderWidth', 'borderColor', 'borderStyle',
    'boxShadow', 'opacity', 'zIndex',
    'borderTopLeftRadius', 'borderTopRightRadius',
    'borderBottomRightRadius', 'borderBottomLeftRadius',
    'fontStyle', 'textDecorationLine',
    'overflow', 'objectFit',
];
const SKIP_TAGS = new Set([
    'script', 'style', 'link', 'meta', 'noscript', 'template', 'title', 'head',
]);
export async function capture(options) {
    const { url, outputPath, viewportWidth = 1440, viewportHeight = 900 } = options;
    const outputDir = dirname(outputPath);
    const assetsDir = join(outputDir, 'assets');
    mkdirSync(assetsDir, { recursive: true });
    const assets = [];
    const seenUrls = new Set();
    const browser = await chromium.launch({ headless: true });
    try {
        const context = await browser.newContext({
            viewport: { width: viewportWidth, height: viewportHeight },
        });
        const page = await context.newPage();
        page.on('response', async (response) => {
            if (!response.ok())
                return;
            const contentType = response.headers()['content-type'] ?? '';
            const isImage = /^image\//i.test(contentType);
            const isFont = /^font\//i.test(contentType) ||
                /application\/(x-font|font-woff|vnd\.ms-fontobject)/i.test(contentType);
            if (!isImage && !isFont)
                return;
            const responseUrl = response.url();
            if (seenUrls.has(responseUrl))
                return;
            seenUrls.add(responseUrl);
            try {
                const body = await response.body();
                const ext = extname(new URL(responseUrl).pathname) || (isImage ? '.bin' : '.bin');
                const hash = createHash('md5').update(responseUrl).digest('hex').slice(0, 8);
                const filename = `${hash}${ext}`;
                writeFileSync(join(assetsDir, filename), body);
                assets.push({
                    url: responseUrl,
                    type: isImage ? 'image' : 'font',
                    localPath: `assets/${filename}`,
                    mimeType: contentType.split(';')[0].trim(),
                });
            }
            catch {
                // response body already consumed or request failed
            }
        });
        console.log(`Navigating to ${url}…`);
        await page.goto(url, { waitUntil: 'networkidle' });
        console.log('Scrolling to trigger lazy loading…');
        await page.evaluate(async () => {
            const totalHeight = document.body.scrollHeight;
            for (let y = 0; y <= totalHeight; y += 500) {
                window.scrollTo(0, y);
                await new Promise((r) => setTimeout(r, 150));
            }
            window.scrollTo(0, 0);
            await new Promise((r) => setTimeout(r, 300));
        });
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);
        console.log('Capturing elements…');
        const rawElements = await page.evaluate(({ styleNames, skipTags }) => {
            const skip = new Set(skipTags);
            const results = [];
            for (const el of document.body.querySelectorAll('*')) {
                const tag = el.tagName.toLowerCase();
                if (skip.has(tag))
                    continue;
                const computed = window.getComputedStyle(el);
                if (computed.display === 'none' || computed.visibility === 'hidden')
                    continue;
                const r = el.getBoundingClientRect();
                if (r.width === 0 && r.height === 0)
                    continue;
                // Only direct text nodes, not descendant text
                let text = '';
                for (const node of el.childNodes) {
                    if (node.nodeType === 3)
                        text += node.textContent ?? '';
                }
                text = text.trim();
                const styles = {};
                for (const prop of styleNames) {
                    const css = prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
                    styles[prop] = computed.getPropertyValue(css);
                }
                const entry = {
                    tag,
                    rect: { x: r.x, y: r.y, width: r.width, height: r.height },
                    styles,
                };
                if (text)
                    entry.text = text;
                // Capture resolved image src for <img> elements
                if (tag === 'img') {
                    const imgEl = el;
                    entry.src = imgEl.currentSrc || imgEl.src || '';
                }
                results.push(entry);
            }
            return results;
        }, { styleNames: STYLE_NAMES, skipTags: [...SKIP_TAGS] });
        // Capture the page background color (body / html element)
        const pageBackground = await page.evaluate(() => {
            const bodyBg = window.getComputedStyle(document.body).backgroundColor;
            if (bodyBg && bodyBg !== 'rgba(0, 0, 0, 0)')
                return bodyBg;
            const htmlBg = window.getComputedStyle(document.documentElement).backgroundColor;
            if (htmlBg && htmlBg !== 'rgba(0, 0, 0, 0)')
                return htmlBg;
            return 'rgb(255, 255, 255)';
        });
        // Take a full-page screenshot — this becomes the exact visual base layer in Figma
        try {
            const screenshotBuf = await page.screenshot({ fullPage: true, type: 'jpeg', quality: 85 });
            writeFileSync(join(assetsDir, 'screenshot.jpg'), screenshotBuf);
            assets.unshift({
                url: '__screenshot__',
                type: 'image',
                localPath: 'assets/screenshot.jpg',
                mimeType: 'image/jpeg',
            });
            console.log(`Screenshot → assets/screenshot.jpg (${(screenshotBuf.length / 1024).toFixed(0)} KB)`);
        }
        catch (e) {
            console.warn('Screenshot failed:', e instanceof Error ? e.message : String(e));
        }
        const result = {
            url,
            viewport: { width: viewportWidth, height: viewportHeight },
            elements: rawElements,
            assets,
            pageBackground,
        };
        writeFileSync(outputPath, JSON.stringify(result, null, 2));
        console.log(`Captured ${result.elements.length} elements, ${result.assets.length} assets → ${outputPath}`);
        return result;
    }
    finally {
        await browser.close();
    }
}
//# sourceMappingURL=index.js.map