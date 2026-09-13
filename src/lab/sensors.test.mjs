import test from 'node:test';
import assert from 'node:assert/strict';
import { SensorBank, defaultSensors, raycast, mountPoint } from './sensors.ts';
import { Engine, defaultProfile, inspect } from './engine.ts';
import { sensorExample } from './sensorExamples.ts';
import { blocks as definitions } from '../lib/blockly/blocks.ts';

const white = () => ({ color: 10, reflection: 90 });
const pose = { x: 0, y: 0, heading: 0 };
function config(kind = 'color', errors = false) {
    const c = structuredClone(defaultSensors);
    c.errors = errors;
    c.ports.B = { kind, forward: 100, side: 0, height: kind === 'color' ? 16 : 35 };
    return c;
}
function bank(kind, errors = false, seed = 42) {
    return new SensorBank(config(kind, errors), seed);
}
function read(b, p = pose, tick = 0, surface = white, walls) {
    b.sample(tick, p, surface, {}, walls);
    return b.readings.B;
}
function run(kind, profile, surface = white, start = { x: 0, y: -400, heading: 0 }) {
    const e = new Engine(sensorExample(kind), profile, start);
    e.colorAt = surface;
    e.start();
    while (e.state === 'running') e.step();
    return e;
}
const idealDrive = {
    ...defaultProfile,
    mismatch: 0,
    motorMismatch: 0,
    slip: 0,
    gyroNoise: 0,
    gyroBias: 0,
    response: 0.005
};

test('sensor sample-and-hold is 100 Hz; repeated reads do not advance noise', () => {
    const b = bank('color');
    assert.equal(read(b).reflection, 90);
    assert.equal(read(b, pose, 1, () => ({ color: 0, reflection: 5 })).reflection, 90);
    assert.equal(read(b, pose, 2, () => ({ color: 0, reflection: 5 })).reflection, 5);
    const before = structuredClone(b.readings);
    read(b, pose, 2);
    assert.deepEqual(b.readings, before);
});
test('mount transforms follow robot heading and finite footprint blends a line edge', () => {
    assert.deepEqual(mountPoint(pose, { forward: 100, side: -45, height: 8, kind: 'color' }), {
        x: -45,
        y: 100
    });
    const right = mountPoint(
        { ...pose, heading: 90 },
        { forward: 100, side: 0, height: 8, kind: 'color' }
    );
    assert.ok(Math.abs(right.x - 100) < 1e-9 && Math.abs(right.y) < 1e-9);
    const s = read(bank('color'), pose, 0, (x) => ({
        color: x < 0 ? 0 : 10,
        reflection: x < 0 ? 0 : 100
    }));
    assert.ok(s.reflection > 20 && s.reflection < 80);
});
test('8 mm black misclassification is a tunable stress assumption; raising to 16 mm removes it', () => {
    const c = config('color', true);
    c.lowMountDropout = 1;
    c.ports.B.height = 8;
    const black = () => ({ color: 0, reflection: 5 });
    assert.equal(read(new SensorBank(c), pose, 0, black).color, -1);
    c.ports.B.height = 16;
    assert.equal(read(new SensorBank(c), pose, 0, black).color, 0);
});
test('distance respects face offset, 50–2000 mm range, integer resolution and no echo', () => {
    assert.equal(read(bank('distance')).distance, 472);
    assert.equal(read(bank('distance'), { x: 0, y: 450, heading: 0 }).distance, null);
    assert.equal(read(bank('distance'), pose, 0, white, []).valid, false);
    const far = [{ ax: -10000, ay: 3000, bx: 10000, by: 3000 }];
    assert.equal(read(bank('distance'), pose, 0, white, far).distance, null);
    assert.equal(raycast(0, 0, 0).distance, 571.5);
});
test('nearest surface occludes; cone can miss off-axis small targets', () => {
    const near = { ax: -200, ay: 300, bx: 200, by: 300 },
        far = { ax: -500, ay: 800, bx: 500, by: 800 };
    assert.equal(read(bank('distance'), pose, 0, white, [far, near]).distance, 200);
    assert.equal(
        read(bank('distance'), pose, 0, white, [{ ax: 800, ay: 300, bx: 850, by: 300 }]).distance,
        null
    );
});
test('distance bias/noise stays within its accuracy envelope and is reproducible', () => {
    const a = bank('distance', true),
        b = bank('distance', true);
    a.config.distanceDropout = b.config.distanceDropout = 0;
    for (let tick = 0; tick < 200; tick += 2) {
        const one = read(a, pose, tick),
            two = read(b, pose, tick);
        assert.deepEqual(one, two);
        assert.ok(Math.abs(one.distance - 471.5) <= 20);
        assert.equal(one.distance, Math.round(one.distance));
    }
});
test('per-port streams isolate color noise from other attached sensor types', () => {
    const a = bank('color', true),
        b = bank('color', true);
    b.config.ports.F.kind = 'distance';
    for (let tick = 0; tick < 100; tick += 2)
        assert.deepEqual(read(a, pose, tick), read(b, pose, tick));
});
test('force touch has independent travel threshold; force saturates at 10 N', () => {
    const b = bank('force');
    assert.equal(read(b, { x: 0, y: 464, heading: 0 }).pressed, false); // .5 mm compression
    const touched = read(b, { x: 0, y: 465, heading: 0 }, 2); // 1.5 mm, touch before force zone
    assert.equal(touched.pressed, true);
    assert.equal(touched.force, 0);
    const full = read(b, { x: 0, y: 471.5, heading: 0 }, 4);
    assert.equal(full.force, 10);
    assert.equal(full.compression, 8);
    assert.equal(read(b, { x: 0, y: -471.5, heading: 0 }, 6).pressed, false); // rear contact
});
test('force accuracy stays within ±0.65 N and resolution is 0.1 N', () => {
    for (let seed = 1; seed < 20; seed++) {
        const b = bank('force', true, seed);
        const r = read(b, { x: 0, y: 467.5, heading: 0 }); // compression4 =>5N
        assert.ok(Math.abs(r.force - 5) <= 0.65);
        assert.ok(Math.abs(r.force * 10 - Math.round(r.force * 10)) < 1e-9);
    }
});
test('encoders report sampled one-degree values within ±3° without cumulative drift', () => {
    const b = bank('color', true);
    for (let i = 0; i < 500; i++) {
        const position = i * 17.43;
        b.sample(i * 2, pose, white, { A: { position, velocity: 405 } });
        assert.ok(Math.abs(b.encoders.A.position - position) <= 3);
        assert.equal(b.encoders.A.position, Math.round(b.encoders.A.position));
        assert.equal(b.encoders.A.speed, 50);
    }
});
test('all three examples use native blocks and stop using sensor inputs', () => {
    const native = new Set(definitions.map((b) => b.type));
    for (const kind of ['color', 'distance', 'force']) {
        const p = sensorExample(kind);
        assert.deepEqual(inspect(p).unsupported, []);
        for (const b of Object.values(p.targets[0].blocks))
            assert.ok(native.has(b.opcode) || b.opcode.startsWith('control_'), b.opcode);
        const e = run(kind, { ...idealDrive, sensorConfig: config(kind) }, (_x, y) => ({
            color: y > 0 ? 0 : 10,
            reflection: y > 0 ? 5 : 90
        }));
        assert.equal(e.state, 'finished', e.error);
        assert.ok(e.distance > 100);
        if (kind === 'distance') assert.ok(e.y > 260 && e.y < 285);
        if (kind === 'force') assert.ok(e.sensors.B.pressed && e.y > 463 && e.y < 472);
        if (kind === 'color') assert.ok(e.y > -103 && e.y < -85);
    }
});
test('distance units and predicates, force units, and wrong-port errors run through real reporters', () => {
    const e = new Engine(
        sensorExample('distance'),
        { ...idealDrive, sensorConfig: config('distance') },
        pose
    );
    e.start();
    const blocks = e.info.blocks;
    blocks.read = {
        opcode: 'flippersensors_distance',
        inputs: { PORT: [1, 'port'] },
        fields: { UNIT: ['cm'] }
    };
    assert.equal(e.value('read', {}), 47.2);
    blocks.read.fields.UNIT = ['%'];
    assert.equal(e.value('read', {}), 23.6);
    blocks.read.fields.UNIT = ['inches'];
    assert.equal(e.value('read', {}), 472 / 25.4);
    e.sensorBank.readings.B.distance = null;
    assert.equal(e.value('read', {}), -1);
    assert.equal(e.value('condition', {}), false);
    const wrong = run('distance', defaultProfile);
    assert.equal(wrong.state, 'error');
    assert.match(wrong.error, /No distance sensor on port B/);
    blocks.read.opcode = 'flippersensors_force';
    blocks.read.fields.UNIT = ['%'];
    e.sensorBank.readings.B = { ...e.sensors.B, kind: 'force', force: 6, pressed: true };
    assert.equal(e.value('read', {}), 60);
    blocks.read.opcode = 'flippersensors_isPressed';
    blocks.read.fields.OPTION = ['hard-pressed'];
    assert.equal(e.value('read', {}), true);
});
test('malformed sensor settings and motor-port conflicts are rejected', () => {
    const c = config();
    c.ports.A = c.ports.B;
    assert.throws(() => new SensorBank(c), /A\/C\/D\/E are motors/);
    const d = config();
    d.ports.B.height = NaN;
    assert.throws(() => new SensorBank(d), /mounting dimensions/);
    const f = config();
    f.distanceDropout = 2;
    assert.throws(() => new SensorBank(f), /dropout/);
});
