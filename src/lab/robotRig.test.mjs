import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import * as THREE from 'three';
import { parseReferenceRig, updateRig, addDemoTools, disposeRig } from './robotRig.ts';
import { defaultProfile } from './engine.ts';

test('wheel and tool joints follow encoders and preserve independent port bindings', () => {
    const group = new THREE.Group(),
        left = new THREE.Group(),
        right = new THREE.Group();
    group.add(left, right);
    const rig = {
        group,
        joints: [
            { pivot: left, role: 'left', ratio: 1 },
            { pivot: right, role: 'right', ratio: 1 },
            ...addDemoTools(group)
        ]
    };
    updateRig(
        rig,
        { A: { position: -180 }, E: { position: 360 }, C: { position: 75 }, D: { position: 0 } },
        defaultProfile
    );
    assert.equal(left.rotation.x, -Math.PI);
    assert.equal(right.rotation.x, -2 * Math.PI);
    assert.ok(Math.abs(rig.joints[2].pivot.rotation.x - (75 * Math.PI) / 180) < 1e-10);
    assert.equal(rig.joints[3].pivot.rotation.x, 0);
    assert.deepEqual(group.position.toArray(), [0, 0, 0]);
    disposeRig(rig);
});
const asset = new URL('../../static/models/DrivingBase3.mpd', import.meta.url);
test(
    'pinned optional reference model has independently animatable wheel and rim groups',
    { skip: !existsSync(asset) },
    async () => {
        const rig = await parseReferenceRig(readFileSync(asset, 'utf8'));
        assert.deepEqual(
            rig.joints.map((j) => j.role),
            ['left', 'right', 'C', 'D']
        );
        assert.equal(rig.joints[0].pivot.children.length, 2);
        assert.equal(rig.joints[1].pivot.children.length, 2);
        assert.ok(
            new THREE.Box3().setFromObject(rig.group).getSize(new THREE.Vector3()).length() > 100
        );
        updateRig(rig, { A: { position: -90 }, E: { position: 90 } }, defaultProfile);
        assert.equal(rig.joints[0].pivot.rotation.x, -Math.PI / 2);
        disposeRig(rig);
    }
);
