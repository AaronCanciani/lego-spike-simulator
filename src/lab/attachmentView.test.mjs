import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { adbAttachments, toolParts } from './attachments.ts';
import { createAttachmentMesh } from './attachmentView.ts';
import { createCompetitionView } from './competitionView.ts';
import { Engine, defaultProfile, DT } from './engine.ts';

test('dozer uses two smooth open quarter-arches and lift ends in one narrow rack finger', () => {
    const dozer = toolParts(adbAttachments.C),
        lift = toolParts(adbAttachments.D);
    const arch = dozer.filter((p) => p.appearance === 'curved-rail');
    assert.equal(arch.length, 32);
    for (const side of [0, 1]) {
        const rail = arch.filter((p) => p.id.startsWith(`arch-${side}-`));
        assert.ok(Math.abs(rail[0].angle) < 0.05);
        assert.ok(Math.abs(rail.at(-1).angle) > 1.5);
        for (let i = 1; i < rail.length; i++) {
            assert.ok(Math.abs(rail[i].angle - rail[i - 1].angle) < 0.18);
            assert.ok(Math.abs(rail[i].position[0]) > 50, 'center stays open');
        }
    }
    assert.equal(lift.filter((p) => p.appearance === 'rack').length, 1);
    assert.equal(lift.find((p) => p.id === 'tip').size[0], adbAttachments.D.width / 2);
    assert.ok(Math.abs(lift.find((p) => p.id === 'upper-0').angle) > 0.7);
});

test('procedural beam holes and panel details generate finite meshes within solid outline bounds', () => {
    for (const config of Object.values(adbAttachments)) {
        for (const part of toolParts(config).filter((p) => p.appearance)) {
            const mesh = createAttachmentMesh(part);
            mesh.geometry.computeBoundingBox();
            const bounds = mesh.geometry.boundingBox.getSize(new THREE.Vector3());
            for (let i = 0; i < 3; i++)
                assert.ok(Math.abs(bounds.toArray()[i] - part.size[i]) < 0.001);
            mesh.traverse((obj) => {
                if (!(obj instanceof THREE.Mesh)) return;
                const positions = obj.geometry.getAttribute('position');
                if (positions) assert.ok(Array.from(positions.array).every(Number.isFinite));
                obj.geometry.dispose();
                obj.material.dispose();
            });
        }
    }
});

test('mounting brackets stay on the chassis while arm and driven gear rotate; view disposes details', () => {
    const e = new Engine(
        { targets: [] },
        defaultProfile,
        { x: 0, y: 0, heading: 0 },
        null,
        null,
        0.45,
        adbAttachments
    );
    const w = e.competition,
        view = createCompetitionView();
    const before = w.snapshot();
    view.update(before);
    const mount = view.group.getObjectByName('attachment-D-mount'),
        gear = mount.getObjectByName('driven-gear');
    const rotation = gear.rotation.x;
    const idle = { position: 0, velocity: 0, command: 0, target: null },
        motor = { ...idle, command: 120, target: 90 };
    for (let i = 0; i < 4 / DT; i++) w.step(DT, 0, 0, 0, idle, motor);
    const after = w.snapshot();
    view.update(after);
    const joint = w.attachments.joints.get('D');
    assert.deepEqual(
        after.parts.find((p) => p.id === 'attachment-D-mount').position,
        w.chassis.pointToWorldFrame(joint.pivot).scale(1000).toArray()
    );
    assert.deepEqual(
        after.parts.find((p) => p.id === 'attachment-D-mount').quaternion,
        w.chassis.quaternion.mult(joint.mount).toArray()
    );
    assert.ok(Math.abs(gear.rotation.x - rotation) > 0.4);
    assert.notDeepEqual(
        after.parts.find((p) => p.id === 'attachment-D-tip').position,
        before.parts.find((p) => p.id === 'attachment-D-tip').position
    );
    let disposed = 0,
        count = 0;
    view.group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
            count++;
            obj.geometry.addEventListener('dispose', () => disposed++);
        }
    });
    view.dispose();
    assert.equal(disposed, count);
    assert.equal(view.group.children.length, 0);
});
