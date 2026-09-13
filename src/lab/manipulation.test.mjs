import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine, defaultProfile, inspect, DT } from './engine.ts';
import { ManipulationWorld, defaultLift, liftStart } from './manipulation.ts';
import { liftExample } from './liftExample.ts';
import { SensorBank, defaultSensors } from './sensors.ts';
import { createManipulationView } from './manipulationView.ts';

const motor = () => ({ position: 0, velocity: 0, command: 0, target: null });
function run(
    project = liftExample(),
    profile = defaultProfile,
    start = liftStart,
    config = defaultLift
) {
    const e = new Engine(project, profile, start, config);
    e.start();
    let maxHeight = 0;
    for (let i = 0; i < 4000 && e.state === 'running'; i++) {
        e.step();
        maxHeight = Math.max(maxHeight, e.manipulation.cube.position.y);
    }
    return { e, maxHeight };
}
function steps(w, m, seconds, vx = 0, vy = 0, angular = 0) {
    for (let i = 0; i < seconds / DT; i++) w.step(DT, vx, vy, angular, m);
}
test('ordinary editable Scratch program physically lifts, carries, releases and delivers', () => {
    assert.deepEqual(inspect(liftExample()).unsupported, []);
    const { e, maxHeight } = run();
    assert.equal(e.state, 'finished');
    assert.equal(e.error, '');
    assert.ok(maxHeight > 0.08, 'payload must really leave the floor');
    assert.equal(e.manipulation.delivered, true);
    assert.ok(Math.abs(e.manipulation.cube.position.y - 0.033) < 0.001);
    assert.ok(Math.abs(e.motors.C.position) < 2);
});
test('same seed and fixed steps reproduce the complete payload trajectory', () => {
    assert.deepEqual(run().e.snapshot(), run().e.snapshot());
});
test('a missed approach never magnetically picks up the payload', () => {
    const { e, maxHeight } = run(liftExample(), defaultProfile, { ...liftStart, x: 130 });
    assert.equal(e.state, 'finished');
    assert.ok(maxHeight < 0.04);
    assert.equal(e.manipulation.delivered, false);
});
test('raising before reaching the payload does not pick it up', () => {
    const w = new ManipulationWorld(),
        m = motor();
    m.command = 200;
    m.target = 180;
    steps(w, m, 3);
    assert.ok(m.position > 170);
    assert.ok(w.cube.position.y < 0.04);
});
test('chassis contact pushes a free cube, not just the visual mesh', () => {
    const w = new ManipulationWorld({ x: 0, y: -240, heading: 0 }),
        m = motor();
    // Raise out of the way, then push with the solid chassis.
    m.command = 200;
    m.target = 300;
    steps(w, m, 3);
    steps(w, m, 2, 0, 100);
    assert.ok(w.cube.position.z < 0, 'cube is pushed forward');
    assert.ok(w.chassis.position.z < 0.18, 'chassis advances');
});
test('overweight payload stalls the finite-force lift; encoders do not fake completion', () => {
    const w = new ManipulationWorld({ x: 0, y: -230, heading: 0 }, { ...defaultLift, mass: 0.7 }),
        m = motor();
    steps(w, m, 0.4);
    m.command = 300;
    m.target = 180;
    steps(w, m, 4);
    assert.ok(m.position < 40);
    assert.equal(m.target, 180);
    assert.ok(w.cube.position.y < 0.045);
    assert.equal(w.stalled, true);
});
test('hard travel stop blocks an impossible motor target', () => {
    const w = new ManipulationWorld(),
        m = motor();
    m.command = 400;
    m.target = 800;
    steps(w, m, 4);
    assert.equal(w.fork.position.y, 0.144);
    assert.equal(m.target, 800);
    assert.equal(w.stalled, true);
});
test('withdrawing the forks rapidly leaves an unsupported cube to fall', () => {
    const w = new ManipulationWorld(
            { x: 0, y: -230, heading: 0 },
            { ...defaultLift, friction: 0.05 }
        ),
        m = motor();
    steps(w, m, 0.3);
    m.command = 200;
    m.target = 180;
    steps(w, m, 3);
    assert.ok(w.cube.position.y > 0.08);
    steps(w, m, 0.4, 0, -900);
    steps(w, m, 2);
    assert.ok(w.cube.position.y < 0.045, 'unsupported payload falls under gravity');
    assert.ok(w.fork.position.y > 0.06, 'fork remains raised');
});
test('distance rays hit real payload geometry and pass above it when raised', () => {
    const w = new ManipulationWorld();
    const hit = w.ray(0, -260, 0, 35);
    assert.ok(Math.abs(hit.distance - 145) < 0.01);
    assert.equal(w.ray(0, -260, 0, 100).distance, 831.5);
});
test('low-friction sliding decelerates near mu*g at both tested timesteps', () => {
    const speeds = [];
    for (const dt of [0.005, 0.0025]) {
        const w = new ManipulationWorld(liftStart, { ...defaultLift, friction: 0.05 }),
            m = motor();
        w.cube.position.x = -0.7;
        w.cube.velocity.x = 0.2;
        for (let t = 0; t < 0.2 - 1e-9; t += dt) w.step(dt, 0, 0, 0, m);
        speeds.push(w.cube.velocity.x);
        assert.ok(Math.abs(w.cube.velocity.x - (0.2 - 0.05 * 9.81 * 0.2)) < 0.006);
    }
    assert.ok(Math.abs(speeds[0] - speeds[1]) < 0.003);
});
test('an aggressive turn can throw cargo off the forks', () => {
    const p = liftExample();
    p.targets[0].blocks.carryspeed.inputs.SPEED = [1, [4, '100']];
    p.targets[0].blocks.carrygo.inputs.STEERING = [1, [4, '100']];
    const { e, maxHeight } = run(p);
    assert.ok(maxHeight > 0.08);
    assert.equal(e.manipulation.delivered, false);
    assert.ok(e.manipulation.cube.position.y < 0.05);
});
test('delivery needs the whole payload inside, resting on the floor, not on forks', () => {
    const w = new ManipulationWorld(),
        m = motor();
    w.cube.position.set(0.09, 0.033, -0.16);
    steps(w, m, 1);
    assert.equal(w.delivered, false, 'a protruding cube does not count');
    w.cube.position.x = 0;
    w.cube.aabbNeedsUpdate = true;
    steps(w, m, 0.2);
    assert.equal(w.delivered, false, 'must settle for half a second');
    steps(w, m, 0.5);
    assert.equal(w.delivered, true);
    const held = new ManipulationWorld({ x: 0, y: 15, heading: 0 }),
        liftMotor = motor();
    held.cube.position.z = -0.16;
    held.cube.aabbNeedsUpdate = true;
    liftMotor.command = 200;
    liftMotor.target = 180;
    steps(held, liftMotor, 3);
    assert.ok(held.cube.position.y > 0.08);
    assert.equal(held.delivered, false);
});
test('rendered fork geometry tracks adjustable physical fork length', () => {
    const view = createManipulationView();
    for (const forkLength of [70, 110, 160]) {
        const w = new ManipulationWorld(liftStart, { ...defaultLift, forkLength });
        view.update(w.snapshot());
        const renderedFork = view.group.children[1];
        assert.equal(renderedFork.children[0].geometry.parameters.depth, forkLength);
        assert.ok(Math.abs(w.fork.shapes[0].halfExtents.z * 2000 - forkLength) < 1e-9);
    }
    view.update(null);
    assert.equal(view.group.visible, false);
    view.group.traverse((o) => {
        o.geometry?.dispose();
        o.material?.dispose();
    });
});
test('distance and touch reporters read payload contacts at their mounting height', () => {
    const w = new ManipulationWorld();
    const config = structuredClone(defaultSensors);
    config.errors = false;
    config.cone = 0;
    config.ports.B = { kind: 'distance', forward: 100, side: 0, height: 35 };
    config.ports.F = { kind: 'force', forward: 100, side: 0, height: 35 };
    const bank = new SensorBank(config);
    bank.sample(0, liftStart, () => ({ color: 10, reflection: 90 }), {}, undefined, w.ray.bind(w));
    assert.equal(bank.readings.B.distance, 145);
    bank.sample(
        2,
        { x: 0, y: -219, heading: 0 },
        () => ({ color: 10, reflection: 90 }),
        {},
        undefined,
        w.ray.bind(w)
    );
    assert.equal(bank.readings.F.pressed, true);
    assert.ok(bank.readings.F.force > 0);
});
test('pause freezes physics, and a new engine resets the full exercise', () => {
    const e = new Engine(liftExample(), defaultProfile, liftStart, defaultLift);
    e.start();
    for (let i = 0; i < 600; i++) e.step();
    e.state = 'paused';
    const before = e.snapshot();
    for (let i = 0; i < 200; i++) e.step();
    assert.deepEqual(e.snapshot(), before);
    const fresh = new Engine(liftExample(), defaultProfile, liftStart, defaultLift);
    assert.deepEqual(fresh.manipulation.snapshot(), new ManipulationWorld().snapshot());
});
test('cargo simulation is opt-in and settings reject invalid physical values', () => {
    assert.equal(new Engine(liftExample()).manipulation, null);
    for (const change of [{ mass: NaN }, { friction: -1 }, { maxLiftForce: 0 }, { mmPerDegree: 0 }])
        assert.throws(() => new ManipulationWorld(liftStart, { ...defaultLift, ...change }));
});
