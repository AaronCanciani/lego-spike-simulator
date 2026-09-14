import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine, defaultProfile, inspect } from './engine.ts';
import { colorExample, resultVariable } from './colorExamples.ts';
import { makeSensorCourse, courseStart, lineCenter } from './sensorCourse.ts';
import { classifyRgb, samplePixels } from './colorSampling.ts';
import { blocks as definitions } from '../lib/blockly/blocks.ts';

const pixels = makeSensorCourse();
test('line controller exposes target, measured brightness, error and steering as ordinary named variables', () => {
    const project = colorExample('line'),
        target = project.targets[0],
        blocks = target.blocks;
    const names = Object.values(target.variables).map((v) => v[0]);
    for (const name of [
        'Target brightness',
        'Steering gain',
        'Measured brightness',
        'Brightness error',
        'Steering correction'
    ])
        assert.ok(names.includes(name));
    assert.equal(blocks.check.inputs.SUBSTACK2[1], 'readBrightness');
    assert.equal(blocks.readBrightness.next, 'setError');
    assert.equal(blocks.setError.next, 'setCorrection');
    assert.equal(blocks.setCorrection.next, 'steer');
    assert.equal(blocks.steer.inputs.STEERING[1], 'correctionValue');
    assert.equal(blocks.setTarget.inputs.VALUE[1][1], '50');
    assert.equal(blocks.setStrength.inputs.VALUE[1][1], '-0.9');
});
function trial(kind, options = {}) {
    const profile = structuredClone(defaultProfile);
    profile.seed = options.seed ?? 42;
    profile.mismatch = 6;
    profile.motorMismatch = 2;
    profile.sensorConfig.ports.B.height = options.height ?? 16;
    profile.sensorConfig.ports.F.height = options.height ?? 16;
    const project = colorExample(kind, options.feedback ?? true);
    if (options.speed)
        project.targets[0].blocks.speed.inputs.SPEED = [1, [4, String(options.speed)]];
    const e = new Engine(project, profile, { ...courseStart[kind], ...options.start });
    const image = options.pixels ?? pixels;
    e.colorAt = (x, y) => {
        const sample = samplePixels(image, x, y);
        if (options.dropAfterDetection && e.variables[resultVariable] === 'Target detected')
            return { ...sample, color: -1 };
        return options.blind ? { ...sample, reflection: 50 } : sample;
    };
    let count = 0,
        sum = 0,
        max = 0;
    e.start();
    while (e.state === 'running') {
        e.step();
        const s = e.sensors.B;
        if (kind === 'line' && e.tick % 2 === 0 && s.y >= -350 && s.y < 250) {
            // Ground truth is used ONLY by the test's grader, never the program.
            const error = Math.abs(s.x - lineCenter(s.y) - 12);
            count++;
            sum += error;
            max = Math.max(max, error);
        }
    }
    assert.equal(e.state, 'finished', e.error);
    return { e, mean: sum / Math.max(1, count), max, count };
}
test('all eight canonical color swatches classify through the real RGB and pixel pipeline', () => {
    for (const [id, rgb] of [
        [0, [0, 0, 0]],
        [1, [144, 31, 118]],
        [3, [30, 90, 168]],
        [4, [104, 195, 226]],
        [6, [0, 133, 43]],
        [7, [250, 200, 10]],
        [9, [180, 0, 0]],
        [10, [244, 244, 244]]
    ]) {
        assert.equal(classifyRgb(...rgb).color, id);
        const image = { width: 1, height: 1, data: new Uint8ClampedArray([...rgb, 255]) };
        assert.equal(samplePixels(image, 0, 0).color, id);
    }
    assert.equal(classifyRgb(120, 120, 120).color, -1);
    assert.equal(samplePixels(pixels, 2000, 0).color, -1);
});
test('color and line graphs contain native blocks, well-formed references and no simulator shortcuts', () => {
    const native = new Set(definitions.map((b) => b.type));
    for (const kind of ['red', 'blue', 'line']) {
        const project = colorExample(kind),
            info = inspect(project);
        assert.deepEqual(info.unsupported, []);
        assert.equal(info.reachable.size, info.total);
        for (const [id, b] of Object.entries(info.blocks)) {
            assert.ok(
                native.has(b.opcode) || /^(operator_|control_|data_)/.test(b.opcode),
                b.opcode
            );
            for (const child of [
                b.next,
                ...Object.values(b.inputs).map((i) => (typeof i[1] === 'string' ? i[1] : null))
            ].filter(Boolean)) {
                assert.ok(info.blocks[child], `${id} references ${child}`);
                assert.equal(info.blocks[child].parent, id);
            }
        }
        const serialized = JSON.stringify(project);
        assert.ok(!serialized.includes('lineCenter') && !serialized.includes('orientationAxis'));
    }
});
test('red and blue stopping work on raster targets across four noisy seeds and both mount heights', () => {
    for (const kind of ['red', 'blue'])
        for (const seed of [1, 42, 79, 120])
            for (const height of [8, 16]) {
                const { e } = trial(kind, { seed, height });
                assert.equal(
                    e.variables[resultVariable],
                    'Target detected',
                    `${kind} seed ${seed} height ${height}`
                );
                const targetY = kind === 'red' ? 220 : -50;
                assert.ok(e.sensors.B.y >= targetY - 3 && e.sensors.B.y < targetY + 25);
                assert.ok(e.sensors.B.x >= -650 && e.sensors.B.x <= -280);
                assert.ok(e.distance > (kind === 'red' ? 400 : 150));
                assert.equal(e.sensors.B.color, kind === 'red' ? 9 : 3);
                assert.ok(Object.values(e.motors).every((m) => m.command === 0));
            }
});
test('moving the printed red marker changes stopping position, rather than just waiting a fixed time', () => {
    const a = trial('red', { pixels: makeSensorCourse(-60), speed: 12 }).e;
    const b = trial('red', { pixels: makeSensorCourse(60), speed: 30 }).e;
    assert.equal(a.variables[resultVariable], 'Target detected');
    assert.equal(b.variables[resultVariable], 'Target detected');
    assert.ok(Math.abs(b.sensors.B.y - a.sensors.B.y - 120) < 10);
    assert.ok(a.time > b.time, 'slower drive to nearer marker should still take longer');
});
test('continuous reflected-light feedback follows both bends to red under seeded drivetrain errors', () => {
    for (const seed of [1, 42, 79, 120]) {
        const result = trial('line', { seed });
        assert.equal(result.e.variables[resultVariable], 'Target detected');
        assert.ok(result.count > 300);
        assert.ok(result.mean < 4, `seed ${seed}: mean edge error ${result.mean} mm`);
        assert.ok(result.max < 10, `seed ${seed}: maximum edge error ${result.max} mm`);
        assert.ok(result.e.distance > 600 && result.e.distance < 800);
        assert.ok(result.e.sensors.B.y > 265 && result.e.sensors.B.y < 310);
        assert.ok(result.e.trace.filter((t) => t.id === 'steer').length > 100);
    }
});
test('open-loop and frozen reflection cannot pass the line course by using hidden path knowledge', () => {
    for (const mode of [{ feedback: false }, { blind: true }]) {
        const result = trial('line', mode);
        assert.equal(result.e.variables[resultVariable], 'Timed out — target not detected');
        assert.ok(result.mean > 20);
        assert.ok(result.max > 50);
        assert.ok(result.e.time >= 12 && result.e.time < 12.2);
    }
});
test('missing red target does not treat the earlier blue marker or timeout as success', () => {
    const image = makeSensorCourse();
    for (let i = 0; i < image.data.length; i += 4)
        if (image.data[i] === 180 && image.data[i + 1] === 0 && image.data[i + 2] === 0) {
            image.data[i] = 248;
            image.data[i + 1] = 250;
            image.data[i + 2] = 252;
        }
    const { e } = trial('red', { pixels: image });
    assert.equal(e.variables[resultVariable], 'Timed out — target not detected');
    assert.ok(e.time >= 12 && e.time < 12.2);
    assert.ok(!e.trace.some((t) => t.id === 'success'));
});
test('same seed reproduces the complete line-following run and captured result', () => {
    const a = trial('line'),
        b = trial('line');
    assert.deepEqual(a.e.snapshot(), b.e.snapshot());
    assert.deepEqual(a.e.path, b.e.path);
    assert.deepEqual(a.e.trace, b.e.trace);
});
test('a detected finish stays latched when color is lost during braking', () => {
    const { e } = trial('line', { dropAfterDetection: true });
    assert.equal(e.sensors.B.color, -1);
    assert.equal(e.variables[resultVariable], 'Target detected');
    assert.ok(e.time < 8);
    assert.ok(!e.trace.some((t) => t.id === 'failure'));
});
