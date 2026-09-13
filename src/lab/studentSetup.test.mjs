import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compile, preprocess, parse } from 'svelte/compiler';
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
test('live simulation diagnostics appear only inside the Advanced settings panel', async () => {
    const app = readFileSync(new URL('../App.svelte', import.meta.url), 'utf8');
    const processedApp = await preprocess(app, {
        script: async ({ content }) => transform(content, { loader: 'ts' })
    });
    const tree = parse(processedApp.code).html;
    const attribute = (node, name) =>
        node.attributes?.find((a) => a.name === name)?.value?.[0]?.data;
    const found = [];
    function visit(node, ancestors = []) {
        if (!node || typeof node !== 'object') return;
        if (attribute(node, 'aria-label') === 'Live simulation diagnostics') found.push(ancestors);
        for (const child of Object.values(node)) {
            if (Array.isArray(child)) child.forEach((c) => visit(c, [...ancestors, node]));
            else if (child && typeof child === 'object') visit(child, [...ancestors, node]);
        }
    }
    visit(tree);
    assert.equal(found.length, 1);
    assert.ok(found[0].some((node) => attribute(node, 'id') === 'advanced-settings-panel'));
    assert.doesNotMatch(app, /class="telemetry"/);
});
