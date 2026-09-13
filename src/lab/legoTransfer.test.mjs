import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { importLego, exportLego } from './legoTransfer.ts';
import { Engine, defaultProfile, inspect } from './engine.ts';
import { missionProgram } from './missionPrograms.ts';
import parser from 'scratch-parser';
import { createHash } from 'node:crypto';
const execute = (p) => {
    const e = new Engine(p, defaultProfile, { x: 0, y: 0, heading: 0 });
    e.start();
    while (e.state === 'running') e.step();
    return [e.time, e.x, e.y, e.heading, e.state, e.error];
};
test('new native programs export as nested LLSP3 archives and preserve runtime behavior', async () => {
    const input = missionProgram('wall');
    const data = await exportLego(input, 'Transfer check');
    const outer = await JSZip.loadAsync(data);
    const manifest = JSON.parse(await outer.file('manifest.json').async('text'));
    assert.equal(manifest.type, 'word-blocks');
    assert.equal(manifest.version, 38);
    assert.equal(manifest.name, 'Transfer check');
    const imported = await importLego(data);
    assert.equal(imported.project.targets.length, 2);
    assert.equal(imported.project.targets[0].isStage, true);
    assert.equal(Object.keys(imported.project.targets[0].blocks).length, 0);
    assert.deepEqual(inspect(imported.project).unsupported, []);
    assert.deepEqual(execute(imported.project), execute(input));
});
test('import/export preserves private archive assets and metadata without leaking simulator setup', async () => {
    const base = await exportLego(missionProgram('wall'), 'Original');
    const outer = await JSZip.loadAsync(base);
    const inner = await JSZip.loadAsync(await outer.file('scratch.sb3').async('uint8array'));
    inner.file('custom.wav', new Uint8Array([0, 1, 2, 3, 255]));
    const p = JSON.parse(await inner.file('project.json').async('text'));
    p.targets[1].sounds = [{ name: 'My sound', md5ext: 'custom.wav', dataFormat: 'wav' }];
    inner.file('project.json', JSON.stringify(p));
    outer.file('scratch.sb3', await inner.generateAsync({ type: 'uint8array' }));
    outer.file('extra.bin', new Uint8Array([7, 8, 9]));
    const imported = await importLego(await outer.generateAsync({ type: 'uint8array' }));
    imported.project.labEditorLayout = true;
    const exported = await JSZip.loadAsync(await exportLego(imported.project, 'Edited'));
    assert.deepEqual(
        await exported.file('extra.bin').async('uint8array'),
        new Uint8Array([7, 8, 9])
    );
    const roundtrip = await JSZip.loadAsync(await exported.file('scratch.sb3').async('uint8array'));
    assert.deepEqual(
        await roundtrip.file('custom.wav').async('uint8array'),
        new Uint8Array([0, 1, 2, 3, 255])
    );
    const json = JSON.parse(await roundtrip.file('project.json').async('text'));
    assert.equal(json.labArchive, undefined);
    assert.equal(json.labEditorLayout, undefined);
    assert.deepEqual(json.targets, imported.project.targets);
});
test('missing assets fail explicitly instead of exporting a damaged project', async () => {
    const imported = await importLego(await exportLego(missionProgram('wall'), 'Test'));
    imported.project.targets[1].sounds = [{ md5ext: 'missing.wav' }];
    await assert.rejects(exportLego(imported.project, 'Test'), /Missing original asset/);
});
test('nested Scratch archive passes the independent Scratch schema validator', async () => {
    const outer = await JSZip.loadAsync(await exportLego(missionProgram('wall'), 'Schema check'));
    const sb3 = await outer.file('scratch.sb3').async('nodebuffer');
    await new Promise((resolve, reject) =>
        parser(sb3, false, (error) => (error ? reject(error) : resolve()))
    );
    const inner = await JSZip.loadAsync(sb3),
        p = JSON.parse(await inner.file('project.json').async('text'));
    for (const target of p.targets)
        for (const asset of target.costumes) {
            const bytes = await inner.file(asset.md5ext).async('nodebuffer');
            assert.equal(createHash('md5').update(bytes).digest('hex'), asset.assetId);
            assert.match(bytes.toString(), /^<svg /);
        }
});
test('parameterized My Blocks and variable IDs survive LEGO archive transfer with identical execution', async () => {
    const b = (opcode, inputs = {}, fields = {}, extra = {}) => ({
        opcode,
        inputs,
        fields,
        ...extra
    });
    const mutation = {
        tagName: 'mutation',
        children: [],
        proccode: 'add %s',
        argumentids: '["amount"]',
        argumentnames: '["amount"]',
        argumentdefaults: '["0"]',
        warp: 'false'
    };
    const p = {
        targets: [
            {
                isStage: false,
                variables: { total: ['total', 0] },
                blocks: {
                    start: b(
                        'flipperevents_whenProgramStarts',
                        {},
                        {},
                        { topLevel: true, next: 'call' }
                    ),
                    call: b(
                        'procedures_call',
                        { amount: [1, [4, '7']] },
                        {},
                        { parent: 'start', mutation }
                    ),
                    definition: b(
                        'procedures_definition',
                        { custom_block: [1, 'prototype'] },
                        {},
                        { topLevel: true, next: 'change' }
                    ),
                    prototype: b(
                        'procedures_prototype',
                        { amount: [1, 'argument'] },
                        {},
                        { parent: 'definition', shadow: true, mutation }
                    ),
                    argument: b(
                        'argument_reporter_string_number',
                        {},
                        { VALUE: ['amount'] },
                        { parent: 'prototype', shadow: true }
                    ),
                    change: b(
                        'data_changevariableby',
                        { VALUE: [2, 'value'] },
                        { VARIABLE: ['total', 'total'] },
                        { parent: 'definition' }
                    ),
                    value: b(
                        'argument_reporter_string_number',
                        {},
                        { VALUE: ['amount'] },
                        { parent: 'change' }
                    )
                }
            }
        ]
    };
    const roundtrip = (await importLego(await exportLego(p, 'My Blocks check'))).project;
    assert.deepEqual([...inspect(roundtrip).procedures.keys()], ['add %s']);
    const run = (p) => {
        const e = new Engine(p);
        e.start();
        while (e.state === 'running') e.step();
        assert.equal(e.state, 'finished', e.error);
        return e.variables;
    };
    assert.deepEqual(run(roundtrip), run(p));
    assert.equal(run(roundtrip).total, 7);
});
