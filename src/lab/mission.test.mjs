import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine, defaultProfile, inspect } from './engine.ts';
import { coralExample } from './missionExample.ts';
import { MissionMonitor, coralMission, insideLeftLaunch } from './mission.ts';
import { blocks as blockDefinitions } from '../lib/blockly/blocks.ts';

function trial(feedback, profile = defaultProfile) {
    const engine = new Engine(coralExample(feedback), profile, coralMission.start),
        monitor = new MissionMonitor(coralMission.start);
    engine.start();
    while (engine.state === 'running') {
        engine.step();
        monitor.observe(engine);
    }
    assert.equal(engine.state, 'finished', engine.error);
    return { engine, result: monitor.snapshot() };
}
test('mission uses supported Scratch blocks and a fully contained nominal launch footprint', () => {
    const native = new Set(blockDefinitions.map((b) => b.type));
    for (const block of Object.values(coralExample().targets[0].blocks))
        assert.ok(
            native.has(block.opcode) ||
                block.opcode.startsWith('operator_') ||
                block.opcode.startsWith('control_'),
            `Missing visible block: ${block.opcode}`
        );
    assert.deepEqual(inspect(coralExample()).unsupported, []);
    assert.ok(insideLeftLaunch(coralMission.start.x, coralMission.start.y));
    assert.equal(insideLeftLaunch(-1010, -390), false);
    assert.equal(insideLeftLaunch(-600, 0), false);
});
test('gyro route aligns, operates C and returns across four seeded mismatch trials', () => {
    for (const seed of [1, 42, 79, 120]) {
        const profile = { ...defaultProfile, mismatch: 6, motorMismatch: 2, seed };
        assert.equal(trial(true, profile).result.returned, true, `seed ${seed}`);
        assert.equal(trial(false, profile).result.activated, false, `open loop seed ${seed}`);
    }
});
test('ordinary default profile completes the representative training route', () =>
    assert.equal(trial(true).result.returned, true));
test('tool motion away from the target does not activate it', () => {
    const m = new MissionMonitor(coralMission.start);
    m.observe({ ...coralMission.start, motors: { C: { position: 75 } } });
    assert.equal(m.activated, false);
    m.observe({ ...coralMission.target, motors: { C: { position: 75 } } });
    m.observe({ ...coralMission.target, motors: { C: { position: 75 } } });
    assert.equal(m.activated, false);
});
test('target approach without tool motion or with wrong heading is not completion', () => {
    const m = new MissionMonitor(coralMission.start);
    m.observe({ ...coralMission.target, motors: { C: { position: 0 } } });
    assert.equal(m.aligned, true);
    assert.equal(m.activated, false);
    m.observe({ ...coralMission.target, heading: 90, motors: { C: { position: 75 } } });
    assert.equal(m.activated, false);
});
test('an invalid launch cannot earn training completion', () => {
    const m = new MissionMonitor(coralMission.target);
    m.observe({ ...coralMission.target, motors: { C: { position: 75 } } });
    assert.equal(m.activated, false);
});
