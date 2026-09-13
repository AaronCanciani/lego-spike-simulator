import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createAdvancedRig, updateAdvancedRig } from './advancedRig.ts';
import { disposeRig } from './robotRig.ts';
import { Engine, defaultProfile, inspect } from './engine.ts';
import { jointExample } from './jointExample.ts';
import { blocks as definitions } from '../lib/blockly/blocks.ts';

test('ADB-style wheel centers and diameters follow the physical profile', () => {
    const rig = createAdvancedRig();
    for (const [wheel, track] of [
        [87.95, 160],
        [100, 180],
        [70, 130]
    ]) {
        updateAdvancedRig(rig, {}, { ...defaultProfile, wheel, track }, {});
        assert.equal(rig.joints[0].pivot.position.x, -track / 2);
        assert.equal(rig.joints[1].pivot.position.x, track / 2);
        assert.equal(rig.joints[0].pivot.position.y, wheel / 2);
        const bounds = new THREE.Box3().setFromObject(rig.joints[0].pivot);
        assert.ok(Math.abs(bounds.getSize(new THREE.Vector3()).y - wheel) < 2);
        assert.ok(bounds.min.y > -1);
    }
    disposeRig(rig);
});
test('all four moving joints animate independently and return exactly to rest', () => {
    const rig = createAdvancedRig();
    updateAdvancedRig(
        rig,
        { A: { position: -90 }, E: { position: 180 }, C: { position: 75 }, D: { position: -55 } },
        defaultProfile,
        {}
    );
    assert.deepEqual(
        rig.joints.map((j) => j.role),
        ['left', 'right', 'C', 'D']
    );
    for (const [i, angle] of [-90, -180, 75, -55].entries())
        assert.ok(Math.abs(rig.joints[i].pivot.rotation.x - (angle * Math.PI) / 180) < 1e-10);
    updateAdvancedRig(rig, {}, defaultProfile, {});
    assert.ok(rig.joints.every((j) => Math.abs(j.pivot.rotation.x) < 1e-10));
    disposeRig(rig);
});
test('sensor bodies match configured face positions and optional probe compression', () => {
    const rig = createAdvancedRig(),
        profile = structuredClone(defaultProfile);
    profile.sensorConfig.ports.B = { kind: 'force', side: 10, forward: 105, height: 35 };
    profile.sensorConfig.ports.F.kind = 'none';
    updateAdvancedRig(rig, {}, profile, { B: { compression: 6 } });
    const mount = rig.group.getObjectByName('sensor-B');
    assert.deepEqual(mount.position.toArray(), [10, 35, -105]);
    assert.equal(mount.getObjectByName('force-plunger').position.z, -1);
    assert.equal(mount.getObjectByName('force-plunger').scale.z, 0.25);
    assert.equal(rig.group.getObjectByName('sensor-F').visible, false);
    disposeRig(rig);
});
test('joint showcase uses native Scratch blocks and actual motor positions without changing physics', () => {
    const project = jointExample(),
        native = new Set(definitions.map((b) => b.type));
    assert.deepEqual(inspect(project).unsupported, []);
    for (const b of Object.values(project.targets[0].blocks))
        assert.ok(native.has(b.opcode) || b.opcode.startsWith('control_'), b.opcode);
    const rig = createAdvancedRig(),
        a = new Engine(project),
        b = new Engine(project);
    const profileBefore = structuredClone(defaultProfile);
    a.start();
    b.start();
    let cPeak = 0,
        dPeak = 0,
        wheelPeak = 0;
    while (a.state === 'running') {
        a.step();
        b.step();
        updateAdvancedRig(rig, a.motors, a.profile, a.sensors);
        cPeak = Math.max(cPeak, a.motors.C.position);
        dPeak = Math.max(dPeak, a.motors.D.position);
        wheelPeak = Math.max(wheelPeak, Math.abs(a.motors.A.position));
    }
    assert.equal(a.state, 'finished', a.error);
    assert.equal(cPeak, 75);
    assert.equal(dPeak, 55);
    assert.ok(wheelPeak > 90);
    assert.equal(a.motors.C.position, 0);
    assert.equal(a.motors.D.position, 0);
    assert.deepEqual(a.snapshot(), b.snapshot());
    assert.deepEqual(defaultProfile, profileBefore);
    disposeRig(rig);
});
