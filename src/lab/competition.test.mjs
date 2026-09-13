import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine, defaultProfile, inspect, DT } from './engine.ts';
import { CompetitionWorld } from './competitionWorld.ts';
import { missionCatalog, wallMission } from './missionCatalog.ts';
import { missionProgram } from './missionPrograms.ts';
import { runTrial, trialConditions } from './reliability.ts';

const motor = () => ({ position: 0, velocity: 0, command: 0, target: null });
const profile = () => {
    const p = structuredClone(defaultProfile);
    p.sensorConfig.ports.F = { kind: 'force', forward: 220, side: 0, height: 25 };
    return p;
};
function steps(w, seconds, vx = 0, vy = 0, angular = 0, m = motor()) {
    for (let i = 0; i < seconds / DT; i++) w.step(DT, vx, vy, angular, m);
}
function run(m, kind = 'contact', p = profile(), start = m.approach) {
    const e = new Engine(missionProgram(kind), p, start, null, m);
    e.start();
    while (e.state === 'running') e.step();
    return e;
}
test('ten sourced missions plus a separate wall drill use valid unique definitions', () => {
    assert.equal(missionCatalog.length, 10);
    assert.equal(new Set(missionCatalog.map((m) => m.id)).size, 10);
    for (const m of missionCatalog) {
        assert.match(m.source, /^https:/);
        assert.ok(m.goal && m.route && m.skills);
    }
    for (const kind of ['line', 'distance', 'contact', 'wall'])
        assert.deepEqual(inspect(missionProgram(kind)).unsupported, []);
});
test('all ten mechanisms remain finite and never complete just from waiting at launch', () => {
    for (const m of missionCatalog) {
        const w = new CompetitionWorld(m, m.start);
        steps(w, 1);
        assert.equal(w.complete, false, m.id);
        for (const p of w.snapshot().parts)
            assert.ok([...p.position, ...p.quaternion].every(Number.isFinite), `${m.id}/${p.id}`);
    }
});
test('contact starter drives actual Scratch sensor blocks and releases crane and screens', () => {
    for (const kind of ['crane', 'screens']) {
        const m = missionCatalog.find((m) => m.kind === kind);
        const e = run(m);
        assert.equal(e.state, 'finished', e.error);
        assert.equal(
            e.competition.complete,
            true,
            `${kind}: ${e.competition.message}; y=${e.y}; plate=${e.competition.sliders[0].count}`
        );
    }
});
test('wall contact rotates both rear corners into alignment and a Scratch program drives away', () => {
    const e = run(wallMission, 'wall');
    assert.equal(e.state, 'finished', e.error);
    assert.equal(e.competition.complete, true, `heading ${e.heading}, y ${e.y}`);
    assert.ok(Math.abs(e.heading) < 3);
});
test('distance and force rays see mission objects, and a raised beam passes above them', () => {
    const m = missionCatalog.find((m) => m.kind === 'solar');
    const w = new CompetitionWorld(m, m.start);
    assert.ok(w.ray(m.target.x, m.target.y - 200, 0, 25).distance < 200);
    assert.equal(w.ray(m.target.x, m.target.y - 200, 0, 300).distance, Infinity);
});
test('physical C hinge moves and encoder reads the actual finite-torque joint', () => {
    const w = new CompetitionWorld(wallMission, { x: 0, y: 0, heading: 0 });
    const m = motor();
    m.command = 90;
    m.target = 45;
    steps(w, 2, 0, 0, 0, m);
    assert.ok(m.position > 40 && m.position < 50, `angle ${m.position}`);
});
test('reliability conditions repeat exactly, vary starts, and stay inside documented bounds', () => {
    const input = {
        project: missionProgram('wall'),
        profile: profile(),
        start: wallMission.start,
        mission: wallMission,
        count: 10
    };
    const a = trialConditions(input, 0),
        b = trialConditions(input, 1);
    assert.deepEqual(a, trialConditions(input, 0));
    assert.notDeepEqual(a.start, b.start);
    for (let i = 0; i < 30; i++) {
        const t = trialConditions(input, i);
        assert.ok(Math.abs(t.start.x - input.start.x) <= 10);
        assert.ok(Math.abs(t.start.heading - input.start.heading) <= 3);
        assert.ok(t.friction >= 0.36 && t.friction <= 0.54);
    }
    const color = () => ({ color: 10, reflection: 90 });
    assert.deepEqual(runTrial(input, 0, color), runTrial(input, 0, color));
});
test('a wrong sensor fails a reliability trial instead of counting a completed script as success', () => {
    const m = missionCatalog[0];
    const result = runTrial(
        {
            project: missionProgram('contact'),
            profile: defaultProfile,
            start: m.approach,
            mission: m,
            count: 10
        },
        0,
        () => ({ color: 10, reflection: 90 })
    );
    assert.equal(result.success, false);
    assert.match(result.reason, /No force sensor/);
});
test('mission friction rejects invalid saved settings before constructing physics', () => {
    for (const friction of [NaN, Infinity, -0.1, 1.6])
        assert.throws(
            () =>
                new Engine(
                    { targets: [] },
                    defaultProfile,
                    wallMission.start,
                    null,
                    wallMission,
                    friction
                ),
            /contact friction/
        );
});
test('a recorded trial replays its exact captured profile, placement and friction', () => {
    const input = {
        project: missionProgram('wall'),
        profile: profile(),
        start: wallMission.start,
        mission: wallMission,
        count: 10
    };
    const color = () => ({ color: 10, reflection: 90 });
    const result = runTrial(input, 2, color);
    const replay = new Engine(
        input.project,
        result.profile,
        result.start,
        null,
        wallMission,
        result.friction
    );
    replay.colorAt = color;
    replay.start();
    while (replay.state === 'running') replay.step();
    assert.equal(replay.time, result.seconds);
    assert.equal(replay.competition.complete, result.success);
    assert.equal(replay.competition.progress, result.progress);
});
test('Boccia releases only the contacted button; touching both is a permanent failure', () => {
    const m = missionCatalog.find((m) => m.kind === 'boccia');
    const e = run(m);
    assert.equal(
        e.competition.complete,
        true,
        `${e.competition.message}: ${e.competition.sliders.map((s) => s.count)}`
    );
    assert.deepEqual(
        e.competition.sliders.map((s) => s.count),
        [1, 0]
    );
    const both = run(m, 'contact', profile(), { ...m.approach, x: m.target.x });
    assert.equal(both.competition.complete, false);
    assert.match(both.competition.failed, /Both cubes/);
});
test('the step counter requires physical carriage travel, not a motor angle or location', () => {
    const m = missionCatalog.find((m) => m.kind === 'step');
    const w = new CompetitionWorld(m, m.approach);
    steps(w, 3, 120);
    assert.equal(w.complete, true, `progress ${w.progress}`);
});
test('wind turbine needs three separate physical presses; holding the plate counts once', () => {
    const m = missionCatalog.find((m) => m.kind === 'wind');
    const w = new CompetitionWorld(m, m.approach);
    steps(w, 2.4, 0, 90);
    steps(w, 1, 0, 90);
    assert.equal(w.sliders[0].count, 1);
    assert.equal(w.complete, false);
    for (let i = 0; i < 2; i++) {
        steps(w, 1.6, 0, -100);
        steps(w, 2.2, 0, 100);
    }
    steps(w, 1, 0, -100);
    assert.equal(w.sliders[0].count, 3);
    assert.equal(w.complete, true);
});
test('solar collection responds to physical pushes across the three starting circles', () => {
    const m = missionCatalog.find((m) => m.kind === 'solar');
    const w = new CompetitionWorld(m, { x: m.target.x, y: m.target.y - 310, heading: 0 });
    // Raise the narrow paddle, then sweep with the wider chassis.
    const arm = motor();
    arm.command = 90;
    arm.target = 80;
    steps(w, 1.5, 0, 0, 0, arm);
    steps(w, 3.8, 0, 100);
    assert.equal(w.complete, true, `progress ${w.progress}`);
});
test('delivery scoring requires the whole red unit inside the circle and released on the floor', () => {
    const m = missionCatalog.find((m) => m.kind === 'build');
    const w = new CompetitionWorld(m, m.start);
    const b = w.items.get('building-red').body;
    // Arrange a payload fixture, then let the physical world settle it.
    b.position.set((m.target.x + 55) / 1000, 0.025, -m.target.y / 1000);
    b.aabbNeedsUpdate = true;
    steps(w, 1);
    assert.equal(w.complete, false, 'center inside is not sufficient');
    b.position.set(m.target.x / 1000, 0.025, -m.target.y / 1000);
    b.velocity.set(0, 0, 0);
    b.aabbNeedsUpdate = true;
    steps(w, 1);
    assert.equal(w.complete, true);
});
test('tire target requires the white face up; red-line crossing cannot be undone', () => {
    const m = missionCatalog.find((m) => m.kind === 'tire');
    const w = new CompetitionWorld(m, m.start);
    const b = w.items.get('heavy-tire').body;
    b.position.set(m.target.x / 1000, 0.014, -(m.target.y - 120) / 1000);
    b.aabbNeedsUpdate = true;
    steps(w, 1);
    assert.equal(w.complete, false);
    b.quaternion.set(0, 0, 0, 1);
    b.aabbNeedsUpdate = true;
    steps(w, 1);
    assert.equal(w.complete, true);
    b.position.x = 0.38;
    b.aabbNeedsUpdate = true;
    steps(w, 0.1);
    assert.match(w.failed, /red limit/);
    b.position.x = m.target.x / 1000;
    b.aabbNeedsUpdate = true;
    steps(w, 1);
    assert.equal(w.complete, false);
});
test('vessel docks by contacting the latch and is scored only after the robot withdraws', () => {
    const m = missionCatalog.find((m) => m.kind === 'dock');
    const w = new CompetitionWorld(m, m.approach);
    steps(w, 2.5, 0, 100);
    assert.equal(w.complete, false, 'robot is still touching');
    steps(w, 2, 0, -100);
    steps(w, 1);
    assert.equal(
        w.complete,
        true,
        `${w.message}; latch=${w.sliders[0].count}; vessel=${w.items.get('vessel').body.position.toArray()}`
    );
});
test('space cart remains behind its stop until physical activation, then rolls past the finish', () => {
    const m = missionCatalog.find((m) => m.kind === 'space');
    const w = new CompetitionWorld(m, m.approach);
    steps(w, 1);
    assert.equal(w.complete, false);
    steps(w, 2.5, 0, 100);
    steps(w, 1.5, 0, -100);
    steps(w, 3);
    assert.equal(
        w.complete,
        true,
        `cart x=${w.items.get('cart').body.position.x * 1000}; plate=${w.sliders[0].count}`
    );
});
