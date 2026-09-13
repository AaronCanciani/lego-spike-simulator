import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { Engine, inspect, defaultProfile } from './engine.ts';
import { drivingExample } from './examples.ts';
import { jointExample } from './jointExample.ts';
import { colorExample } from './colorExamples.ts';

// Bundle the existing alias-based converter, testing the same module used by the UI.
const bundle = await build({
    stdin: {
        contents: `export { convertToBlockly } from './src/lib/scratch/blockly.ts'; export { editedProject, blankProject, inspectForEditor } from './src/lab/editorProject.ts'; export { editorToolbox } from './src/lab/editorToolbox.ts';`,
        resolveDir: process.cwd()
    },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    alias: { $lib: resolve('src/lib') }
});
const { convertToBlockly, editedProject, blankProject, editorToolbox, inspectForEditor } =
    await import(
        `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
    );
function assignIds(state) {
    let id = 0;
    function walk(b) {
        b.id ||= `generated-${++id}`;
        for (const input of Object.values(b.inputs || {})) {
            if (input.block) walk(input.block);
            if (input.shadow) walk(input.shadow);
        }
        if (b.next?.block) walk(b.next.block);
    }
    state.blocks.blocks.forEach(walk);
    return state;
}
const roundtrip = (p) => editedProject(assignIds(convertToBlockly(p)), p);
function run(p) {
    const e = new Engine(p, structuredClone(defaultProfile));
    e.start();
    for (let n = 0; n < 3000 && e.state === 'running'; n++) e.step();
    return e.snapshot();
}
test('all bundled driving/control programs keep identical runtime behavior through the editor', () => {
    for (const p of [
        drivingExample(false),
        drivingExample(true),
        jointExample(),
        colorExample('red'),
        colorExample('blue'),
        colorExample('line')
    ]) {
        assert.deepEqual(run(roundtrip(p)), run(p));
    }
});
test('exploratory import preserves all seven My Block signatures and program behavior', () => {
    const p = JSON.parse(readFileSync('static/samples/new-code-blocks.json', 'utf8'));
    const edited = roundtrip(p);
    assert.deepEqual([...inspect(edited).procedures.keys()], [...inspect(p).procedures.keys()]);
    assert.equal(inspect(edited).procedures.size, 7);
    assert.deepEqual(run(edited), run(p));
});
test('initial variable values, target ownership, assets and metadata survive edits', () => {
    const fixture = JSON.parse(readFileSync('src/lab/fixtures/editor-backup.spikelab', 'utf8'));
    assert.equal(fixture.format, 'spike-lab');
    assert.deepEqual(roundtrip(fixture.project).targets[0].variables.target, [
        'target heading',
        17
    ]);
    const p = blankProject();
    p.meta = { custom: 'retained' };
    p.targets[0].costumes = [{ name: 'original' }];
    p.targets[0].variables = { score: ['score', 42] };
    const original = structuredClone(p),
        edited = roundtrip(p);
    assert.deepEqual(edited.targets[0].variables.score, ['score', 42]);
    assert.deepEqual(edited.meta, p.meta);
    assert.deepEqual(edited.targets[0].costumes, p.targets[0].costumes);
    assert.deepEqual(p, original);
});
test('obscured shadows survive roundtrip; removing a reporter restores its literal', () => {
    const p = blankProject(),
        blocks = p.targets[0].blocks;
    blocks['lab-start'].next = 'wait';
    blocks.wait = {
        opcode: 'control_wait',
        inputs: { DURATION: [3, 'timer', [4, '2']] },
        fields: {}
    };
    blocks.timer = { opcode: 'flippersensors_timer', inputs: {}, fields: {} };
    const state = assignIds(convertToBlockly(p));
    assert.deepEqual(editedProject(state, p).targets[0].blocks.wait.inputs.DURATION, [
        3,
        'timer',
        [4, '2']
    ]);
    delete state.blocks.blocks[0].next.block.inputs.DURATION.block;
    assert.deepEqual(editedProject(state, p).targets[0].blocks.wait.inputs.DURATION, [1, [4, '2']]);
});
test('a new connected block executes, editing its number changes runtime, deletion removes it', () => {
    const p = blankProject(),
        state = assignIds(convertToBlockly(p));
    state.blocks.blocks[0].next = {
        block: {
            id: 'wait',
            type: 'control_wait',
            fields: {},
            inputs: {
                DURATION: { shadow: { id: 'seconds', type: 'math_number', fields: { NUM: 1 } } }
            }
        }
    };
    assert.ok(run(editedProject(state, p)).time >= 1);
    state.blocks.blocks[0].next.block.inputs.DURATION.shadow.fields.NUM = 2;
    assert.ok(run(editedProject(state, p)).time >= 2);
    delete state.blocks.blocks[0].next;
    assert.equal(editedProject(state, p).targets[0].blocks.wait, undefined);
});
test('palette omits unsupported hardware blocks while retaining custom block and variable categories', () => {
    const types = editorToolbox.contents.flatMap((c) => c.contents?.map((b) => b.type) || []);
    assert.ok(types.includes('flippersensors_distance'));
    assert.ok(types.includes('flippersensors_isColor'));
    assert.ok(!types.includes('flippersensors_isTilted'));
    assert.ok(editorToolbox.contents.some((c) => c.custom === 'SPIKE_BLOCKS'));
});
test('unfinished functions can be restored for editing without being accepted by the runner', () => {
    const p = blankProject();
    p.targets[0].blocks['lab-start'].next = 'call';
    p.targets[0].blocks.call = {
        opcode: 'procedures_call',
        inputs: {},
        fields: {},
        mutation: {
            proccode: 'unfinished',
            argumentids: '[]',
            warp: 'false'
        }
    };
    const restored = roundtrip(JSON.parse(JSON.stringify(p)));
    assert.equal(inspectForEditor(restored).total, 2);
    assert.throws(() => inspect(restored), /custom block definition is missing/);
});
test('loose variable reporters and edited variable names retain their identity and initial value', () => {
    const p = blankProject();
    p.targets[0].variables = { v: ['before', 17] };
    const state = assignIds(convertToBlockly(p));
    state.variables[0].name = 'after';
    state.blocks.blocks.push({
        id: 'loose',
        type: 'data_variable',
        fields: { VARIABLE: { id: 'v' } },
        inputs: {},
        x: 0,
        y: 100
    });
    const edited = editedProject(state, p);
    assert.deepEqual(edited.targets[0].variables.v, ['after', 17]);
    assert.deepEqual(edited.targets[0].blocks.loose.fields.VARIABLE, ['after', 'v']);
    assert.equal(edited.targets[0].blocks.loose.x, 0);
    assert.deepEqual(roundtrip(edited).targets[0].blocks.loose, edited.targets[0].blocks.loose);
});
