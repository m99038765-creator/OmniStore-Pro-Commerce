import fs from 'fs';

const content = fs.readFileSync('src/data/sampleOrders.ts', 'utf8');
const matches = [...content.matchAll(/id:\s*'([^']+)'|id:\s*`([^`]+)`/g)];
const ids = matches.map(m => m[1] || m[2]);
const unique = new Set(ids);
console.log(`Total IDs: ${ids.length}, Unique IDs: ${unique.size}`);
if (ids.length !== unique.size) {
    const counts = {};
    for (const id of ids) {
        counts[id] = (counts[id] || 0) + 1;
        if (counts[id] > 1) console.log('Duplicate:', id);
    }
}
