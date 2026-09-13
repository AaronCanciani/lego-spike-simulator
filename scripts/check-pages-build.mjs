import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const allowed = new Set([
    'assets',
    'index.html',
    'lab-icon.svg',
    '404.html',
    'robots.txt',
    '.nojekyll',
    'COPYING.md',
    'THIRD_PARTY_ASSETS.md',
    'blockly',
    'icons',
    'colours'
]);
for (const name of readdirSync('dist'))
    assert.ok(allowed.has(name), `Unreviewed public asset: ${name}`);
for (const forbidden of ['maps', 'models', 'samples'])
    assert.equal(
        existsSync(path.join('dist', forbidden)),
        false,
        `${forbidden} must not be deployed`
    );
const html = readFileSync('dist/index.html', 'utf8');
assert.ok(
    html.includes('/lego-spike-simulator/lab-icon.svg'),
    'Favicon must use the Pages subpath'
);
assert.ok(html.includes('/lego-spike-simulator/'), 'Pages base path missing');
assert.ok(!html.includes('Z03erC+1qH~L0wD8-x*G'), 'Personal sample must not be embedded');
for (const asset of [
    'icons/FieldCw.svg',
    'colours/Circle0.svg',
    'blockly/media/sprites.png',
    'COPYING.md'
])
    assert.ok(existsSync(path.join('dist', asset)), `Missing public asset: ${asset}`);
console.log(
    'Pages artifact verified: project subpath, required assets, license, and publication allowlist.'
);
