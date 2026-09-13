import test from 'node:test';
import assert from 'node:assert/strict';
import { Body, Box, Vec3 } from 'cannon-es';
import { adbAttachments, toolPreset, toolParts, validateAttachments } from './attachments.ts';
import { CompetitionWorld } from './competitionWorld.ts';
import { wallMission, missionCatalog } from './missionCatalog.ts';
import { Engine, defaultProfile, DT } from './engine.ts';
import { jointExample } from './jointExample.ts';
const motor = () => ({ position: 0, velocity: 0, command: 0, target: null });
const rig = (tools = structuredClone(adbAttachments)) =>
    new CompetitionWorld(wallMission, { x: 0, y: 0, heading: 0 }, 0.45, tools);
function step(w, seconds, C = motor(), D = motor(), vy = 0) {
    for (let i = 0; i < seconds / DT; i++) w.step(DT, 0, vy, 0, C, D);
}

test('stock pair places physical C dozer behind and D lift in front; every rendered part has a collider', () => {
    const w = rig();
    for (const [port, j] of w.attachments.joints) {
        assert.equal(j.body.shapes.length, toolParts(adbAttachments[port]).length);
        assert.equal(
            w.snapshot().parts.filter((p) => p.id.startsWith(`attachment-${port}-`)).length,
            j.body.shapes.length
        );
    }
    const parts = w.snapshot().parts;
    assert.ok(parts.find((p) => p.id === 'attachment-C-blade').position[2] > 150);
    assert.ok(parts.find((p) => p.id === 'attachment-D-tip').position[2] < -150);
});
test('both physical motors reach targets with geared shaft encoders, independently', () => {
    const w = rig(),
        C = motor(),
        D = motor();
    C.command = 90;
    C.target = 60;
    D.command = 120;
    D.target = 90;
    step(w, 4, C, D);
    assert.ok(Math.abs(C.position - 60) < 2, `C ${C.position}`);
    assert.ok(Math.abs(D.position - 90) < 2, `D ${D.position}`);
    assert.ok(Math.abs(w.attachments.joints.get('D').angle - 45) < 1);
    assert.equal(C.target, null);
    assert.equal(D.target, null);
});
test('mechanical stops stall unreachable commands and do not invent encoder travel', () => {
    const w = rig(),
        C = motor();
    C.command = 300;
    C.target = 720;
    step(w, 5, C);
    assert.ok(C.position <= 150.1, `C ${C.position}`);
    assert.equal(C.target, 720);
    assert.ok(Math.abs(C.velocity) < 1);
});
test('reversed wiring and alternative port assignment retain geometric motion', () => {
    const tools = { C: toolPreset('lift'), D: toolPreset('none') };
    tools.C.polarity = -1;
    const w = rig(tools),
        C = motor();
    C.command = -90;
    C.target = -60;
    step(w, 4, C);
    assert.ok(Math.abs(C.position + 60) < 2);
    assert.ok(w.attachments.joints.get('C').angle > 34);
    assert.equal(w.attachments.has('D'), false);
});
test('real Scratch motor blocks move both attachments on the free field and return them', () => {
    const e = new Engine(
        jointExample(),
        defaultProfile,
        { x: 0, y: 0, heading: 0 },
        null,
        null,
        0.45,
        adbAttachments
    );
    e.start();
    while (e.state === 'running') e.step();
    assert.equal(e.state, 'finished', e.error);
    assert.ok(Math.abs(e.motors.C.position) < 2);
    assert.ok(Math.abs(e.motors.D.position) < 2);
    assert.equal(e.competition.snapshot().id, 'free-field');
});
test('configuration rejects invalid gearing and travel ranges', () => {
    for (const change of [{ ratio: 0 }, { min: 90, max: 30 }, { width: NaN }, { initial: 190 }]) {
        const tools = structuredClone(adbAttachments);
        Object.assign(tools.C, change);
        assert.throws(() => validateAttachments(tools));
    }
});
function payload(w, position, size, mass = 0.08) {
    const b = new Body({
        mass,
        material: w.material,
        shape: new Box(new Vec3(...size.map((n) => n / 2))),
        position: new Vec3(...position),
        collisionFilterGroup: 2
    });
    w.world.addBody(b);
    return b;
}
test('rear dozer pushes a cube through blade contact; raising the blade misses it', () => {
    const run = (initial) => {
        const tools = structuredClone(adbAttachments);
        tools.C.initial = initial;
        const w = rig(tools),
            b = payload(w, [0, 0.03, 0.3], [0.06, 0.06, 0.06]);
        step(w, 1.2, motor(), motor(), -80);
        return b.position.z;
    };
    assert.ok(run(0) > 0.33);
    assert.ok(Math.abs(run(80) - 0.3) < 0.005);
});
test('front finger physically raises a supported plate; a missed plate stays down', () => {
    const run = (z) => {
        const tools = structuredClone(adbAttachments);
        tools.D.initial = 0;
        const w = rig(tools),
            b = payload(w, [0, 0.021, z], [0.06, 0.012, 0.07], 0.03),
            D = motor();
        step(w, 0.2, motor(), D);
        D.command = 45;
        D.target = 90;
        let highest = 0;
        for (let i = 0; i < 3 / DT; i++) {
            w.step(DT, 0, 0, 0, motor(), D);
            highest = Math.max(highest, b.position.y);
        }
        return highest;
    };
    assert.ok(run(-0.245) > 0.055);
    assert.ok(run(-0.4) < 0.025);
});
test('a port without a tool remains an unloaded motor, not an unreachable physical target', () => {
    const tools = { C: toolPreset('none'), D: toolPreset('none') };
    const e = new Engine(
        jointExample(),
        defaultProfile,
        { x: 0, y: 0, heading: 0 },
        null,
        null,
        0.45,
        tools
    );
    e.start();
    while (e.state === 'running') e.step();
    assert.equal(e.state, 'finished', e.error);
});
test('season models share one world, render all colliders, and appear in sensor rays', () => {
    for (const mission of missionCatalog) {
        const e = new Engine(
            { targets: [] },
            defaultProfile,
            mission.start,
            null,
            mission,
            0.45,
            adbAttachments
        );
        const w = e.competition,
            expected = missionCatalog.filter((m) => m.map === mission.map);
        assert.equal(w.snapshot().missions.length, expected.length);
        const ids = w.snapshot().parts.map((p) => p.id);
        assert.equal(new Set(ids).size, ids.length);
        for (const other of w.companions) assert.equal(other.world, w.world);
        step(w, 0.5);
        assert.ok(
            w.snapshot().parts.every((p) => [...p.position, ...p.quaternion].every(Number.isFinite))
        );
        assert.ok(w.snapshot().missions.every((m) => !m.complete));
    }
    const crane = missionCatalog.find((m) => m.kind === 'crane');
    const w = new CompetitionWorld(crane, crane.start, 0.45, adbAttachments, { season: true });
    assert.ok(w.ray(-710, -350, 0, 25).distance < 150, 'ray hits the OTHER mission’s red building');
});
test('other season mechanisms respond to physical contact without being the selected objective', () => {
    const solar = missionCatalog.find((m) => m.kind === 'solar'),
        wind = missionCatalog.find((m) => m.kind === 'wind');
    const w = new CompetitionWorld(solar, wind.approach, 0.45, adbAttachments, { season: true });
    const windWorld = w.companions.find((other) => other.mission.id === wind.id);
    step(w, 2, motor(), motor(), 150);
    assert.ok(windWorld.sliders[0].count >= 1);
    assert.equal(w.sliders.length, 0);
});
