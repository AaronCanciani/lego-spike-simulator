import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compile, preprocess } from 'svelte/compiler';
import { transform, build } from 'esbuild';
import { defaultProfile } from './engine.ts';

const source = readFileSync(new URL('./StudentRobotSetup.svelte', import.meta.url), 'utf8');
const processed = await preprocess(source, {
    script: async ({ content }) => transform(content, { loader: 'ts' })
});
const compiled = compile(processed.code, { generate: 'ssr' });
const bundled = await build({
    stdin: { contents: compiled.js.code, resolveDir: process.cwd() },
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm'
});
const { default: Setup } = await import(
    `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`
);
test('student setup exposes B and F independently without teacher simulation controls', () => {
    const { html } = Setup.render({ profile: structuredClone(defaultProfile) });
    assert.match(html, /aria-label="Port B sensor"/);
    assert.match(html, /aria-label="Port F sensor"/);
    assert.doesNotMatch(
        html,
        /Gyro drift|Surface slip|Repeatable random seed|Simulation profile|Reflection noise/
    );
    assert.match(html, /Where are my sensors mounted/);
    assert.match(html, /Drive motor connections/);
});
test('mixed sensor configurations render the correct independent choices', () => {
    const profile = structuredClone(defaultProfile);
    profile.sensorConfig.ports.F.kind = 'distance';
    const { html } = Setup.render({ profile });
    assert.match(html, /Looks down at colors and lines/);
    assert.match(html, /Looks ahead to measure distance/);
    // Svelte applies select values on the client; SSR descriptions validate prop isolation.
    // Actual selection -> engine wiring is additionally checked in the browser.
    assert.match(html, /aria-label="Port B setup"[\s\S]*?Looks down at colors and lines/);
    assert.match(html, /aria-label="Port F setup"[\s\S]*?Looks ahead to measure distance/);
});
test('student equipment changes are disabled during a run', () => {
    const { html } = Setup.render({ profile: structuredClone(defaultProfile), busy: true });
    assert.match(html, /<fieldset disabled/);
    assert.match(html, /Pause the run/);
});
