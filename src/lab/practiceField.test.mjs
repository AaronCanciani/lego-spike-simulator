import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
    boardSize,
    perimeterWalls,
    obstaclesForBoard,
    clampBoardPosition
} from './boardGeometry.ts';
import { createTableWalls, fitBoardCamera, fitStraightRunCamera } from './boardView.ts';
import { drivingExample, straightRunSetup } from './examples.ts';
import { makePracticeField, practiceLines } from './practiceField.ts';
import { samplePixels } from './colorSampling.ts';
import { Engine, defaultProfile } from './engine.ts';
import { adbAttachments, toolPreset } from './attachments.ts';
import { sensorExample, sensorExampleSetup } from './sensorExamples.ts';
import { jointExample, jointShowcaseSetup } from './jointExample.ts';
const pixels = makePracticeField(),
    size = boardSize('practice');
const noTools = { C: toolPreset('none'), D: toolPreset('none') };
function drive(seconds = 12) {
    return {
        targets: [
            {
                isStage: true,
                variables: {},
                blocks: {
                    start: {
                        opcode: 'flipperevents_whenProgramStarts',
                        inputs: {},
                        fields: {},
                        topLevel: true,
                        next: 'speed'
                    },
                    speed: {
                        opcode: 'flippermove_movementSpeed',
                        inputs: { SPEED: [1, [4, '75']] },
                        fields: {},
                        next: 'go'
                    },
                    go: {
                        opcode: 'flippermove_startSteer',
                        inputs: { STEERING: [1, [4, '0']] },
                        fields: {},
                        next: 'wait'
                    },
                    wait: {
                        opcode: 'control_wait',
                        inputs: { DURATION: [1, [4, String(seconds)]] },
                        fields: {},
                        next: 'stop'
                    },
                    stop: { opcode: 'flippermove_stopMove', inputs: {}, fields: {} }
                }
            }
        ]
    };
}
const run = (e) => {
    e.start();
    while (e.state === 'running' && e.time < 25) e.step();
    return e;
};

test('15-second gyro and open-loop runs share a long clear runway; only sensor feedback corrects drift', () => {
    for (const seed of [1, 42, 79]) {
        const trials = [false, true].map((feedback) =>
            run(
                new Engine(
                    drivingExample(feedback, straightRunSetup.seconds),
                    { ...defaultProfile, seed },
                    straightRunSetup.start,
                    null,
                    null,
                    0.45,
                    adbAttachments,
                    'practice'
                )
            )
        );
        const [open, closed] = trials;
        assert.ok(Math.abs(open.time - closed.time) < 0.02);
        assert.ok(closed.x - straightRunSetup.start.x > 4000);
        assert.ok(Math.abs(closed.y - straightRunSetup.start.y) < 80);
        assert.ok(Math.abs(open.y - straightRunSetup.start.y) > 1000);
        for (const aspect of [0.7, 1, 2, 3]) {
            const camera = new THREE.PerspectiveCamera(43, aspect, 10, 140000);
            fitStraightRunCamera(camera, straightRunSetup.start);
            for (const e of trials)
                for (const [x, y] of e.path) {
                    const p = new THREE.Vector3(x, 0, -y).project(camera);
                    assert.ok(Math.abs(p.x) < 1 && Math.abs(p.y) < 1);
                }
        }
    }
});

test('only the free-drive field is 10x in each dimension, with five repeatable solid wall pieces', () => {
    assert.deepEqual(size, { width: 23620, height: 11430 });
    for (const map of ['2018', '2024', '2025', 'sensor-course', 'cargo-harbor'])
        assert.deepEqual(boardSize(map), { width: 2362, height: 1143 });
    assert.equal(obstaclesForBoard('practice').length, 5);
    const e = new Engine(
        drive(),
        defaultProfile,
        { x: 0, y: -3500, heading: 90 },
        null,
        null,
        0.45,
        noTools,
        'practice'
    );
    assert.deepEqual(e.competition.items.get('floor').size, [23620, 20, 11430]);
    const walls = createTableWalls('practice');
    for (const wall of perimeterWalls('practice')) {
        assert.deepEqual(
            e.competition.items
                .get(wall.id)
                .body.position.toArray()
                .map((n) => n * 1000),
            wall.position
        );
        assert.deepEqual(
            walls.getObjectByName(`wall-${wall.id}`).position.toArray(),
            wall.position
        );
    }
    walls.traverse((o) => {
        o.geometry?.dispose();
        if (o.material)
            (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    });
});
test('native movement travels well beyond the old boundary, but scattered walls still block and reflect sonar', () => {
    const profile = { ...structuredClone(defaultProfile), mismatch: 0, motorMismatch: 0, slip: 0 };
    const e = run(
        new Engine(
            drive(),
            profile,
            { x: 0, y: -3500, heading: 90 },
            null,
            null,
            0.45,
            noTools,
            'practice'
        )
    );
    assert.equal(e.state, 'finished');
    assert.ok(e.x > 4500);
    assert.ok(Math.abs(e.y + 3500) < 10);
    const blocked = new Engine(
        drive(),
        profile,
        { x: 2000, y: 1600, heading: 90 },
        null,
        null,
        0.45,
        noTools,
        'practice'
    );
    assert.ok(Math.abs(blocked.competition.ray(2100, 1600, 90, 35).distance - 670) < 1);
    run(blocked);
    assert.ok(blocked.x < 2700);
});
test('both long lines are real black pixels at far-field coordinates, with white grid and open floor', () => {
    assert.equal(practiceLines.length, 2);
    assert.ok(pixels.width <= 4096 && pixels.height <= 4096);
    for (const [x, y] of [
        [8000, 800],
        [-8000, 800],
        [-5000, -4000],
        [-5000, 3000],
        [2500, 3500]
    ]) {
        const read = samplePixels(pixels, x, y, size);
        assert.equal(read.color, 0);
        assert.ok(read.reflection < 20);
    }
    assert.equal(samplePixels(pixels, 8000, 1000, size).color, 10);
    assert.equal(samplePixels(pixels, 12000, 0, size).color, -1);
});
test('camera overview and placement cover the whole enlarged field and switch back to competition dimensions', () => {
    assert.deepEqual(clampBoardPosition(9000, 4000, 'practice'), { x: 9000, y: 4000 });
    assert.deepEqual(clampBoardPosition(9000, 4000, '2024'), { x: 1081, y: 471.5 });
    for (const aspect of [0.7, 1, 2, 3])
        for (const mode of ['home', 'top']) {
            const camera = new THREE.PerspectiveCamera(43, aspect, 10, 14000);
            fitBoardCamera(camera, mode, 'practice');
            for (const x of [-11810, 11810])
                for (const z of [-5715, 5715]) {
                    const p = new THREE.Vector3(x, 78, z).project(camera);
                    assert.ok(Math.abs(p.x) < 1 && Math.abs(p.y) < 1 && Math.abs(p.z) < 1);
                }
            fitBoardCamera(camera, mode, '2024');
            assert.equal(camera.far, 14000);
        }
});
test('color, distance and force examples use reachable starts and still stop using live sensors on the larger field', () => {
    for (const kind of ['color', 'distance', 'force']) {
        const profile = structuredClone(defaultProfile),
            setup = sensorExampleSetup(kind, adbAttachments);
        profile.sensorConfig.ports.B = {
            kind,
            forward: 100,
            side: 0,
            height: kind === 'color' ? 8 : 35
        };
        const e = new Engine(
            sensorExample(kind),
            profile,
            setup.start,
            null,
            null,
            0.45,
            setup.attachments,
            'practice'
        );
        e.colorAt = (x, y) => samplePixels(pixels, x, y, size);
        run(e);
        assert.equal(e.state, 'finished', kind);
        assert.ok(e.time < 10, kind);
        if (kind === 'force') assert.equal(e.sensors.B.pressed, true);
        if (kind === 'color') assert.ok(e.sensors.B.reflection < 25);
        if (kind === 'distance') assert.ok(e.y < -200 && e.y > -400);
    }
});
test('showcase setup installs physical tools even after an empty setup, and all four motors really move', () => {
    const empty = structuredClone(noTools),
        setup = jointShowcaseSetup();
    assert.equal(setup.attachments.C.kind, 'dozer');
    assert.equal(setup.attachments.D.kind, 'lift');
    assert.deepEqual(empty, noTools);
    const e = new Engine(
        jointExample(),
        defaultProfile,
        setup.start,
        null,
        null,
        0.45,
        setup.attachments,
        'practice'
    );
    e.start();
    let travel = 0,
        c = 0,
        d = 0;
    while (e.state === 'running') {
        e.step();
        travel = Math.max(travel, Math.abs(e.y - setup.start.y));
        c = Math.max(c, Math.abs(e.motors.C.position));
        d = Math.max(d, Math.abs(e.motors.D.position));
    }
    assert.equal(e.state, 'finished');
    assert.ok(travel > 70);
    assert.ok(c > 70);
    assert.ok(d > 50);
    assert.equal(e.competition.attachments.joints.size, 2);
    assert.ok(Math.abs(e.motors.C.position) < 2 && Math.abs(e.motors.D.position) < 2);
    setup.attachments.C.length = 300;
    assert.equal(jointShowcaseSetup().attachments.C.length, 119);
});
