#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { transform } from './index.js';
const [, , inputPath = '../capture/raw-capture.json', outputPath = 'ir.json'] = process.argv;
const raw = JSON.parse(readFileSync(inputPath, 'utf8'));
const doc = transform(raw);
writeFileSync(outputPath, JSON.stringify(doc, null, 2));
function countTypes(nodes) {
    const counts = {};
    for (const node of nodes) {
        counts[node.type] = (counts[node.type] ?? 0) + 1;
        if (node.type === 'frame') {
            for (const [t, n] of Object.entries(countTypes(node.children))) {
                counts[t] = (counts[t] ?? 0) + n;
            }
        }
    }
    return counts;
}
const counts = countTypes(doc.nodes);
// Subtract the root frame from the frame count for a cleaner summary
const childCounts = { ...counts, frame: (counts['frame'] ?? 1) - 1 };
const total = Object.values(counts).reduce((a, b) => a + b, 0) - 1; // minus root
console.log(`${outputPath} written — ${total} content nodes:`);
for (const [type, count] of Object.entries(childCounts).sort()) {
    if (count > 0)
        console.log(`  ${type}: ${count}`);
}
//# sourceMappingURL=cli.js.map