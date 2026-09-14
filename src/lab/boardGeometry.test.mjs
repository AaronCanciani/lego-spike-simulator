import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Engine, defaultProfile, DT } from './engine.ts';
import { adbAttachments, toolPreset } from './attachments.ts';
import { archivedMaps, missionCatalog } from './missionCatalog.ts';
import { tableWalls, obstaclesForBoard } from './boardGeometry.ts';
import { createTableWalls, fitBoardCamera } from './boardView.ts';
import { createCompetitionView } from './competitionView.ts';
const idle = () => ({ position: 0, velocity: 0, command: 0, target: null });
const engine = (map, start = { x: 0, y: -300, heading: 0 }, mission = null) =>
    new Engine(
        { targets: [] },
        defaultProfile,
        start,
        null,
        mission,
        0.45,
        { C: toolPreset('none'), D: toolPreset('none') },
        map
    );
test('every archived map loads physical obstacles without selecting an objective', () => {
    for (const { id } of archivedMaps) {
        const w = engine(id).competition,
            s = w.snapshot();
        assert.ok(s.parts.length > 0, `${id} must not be only a photo`);
        assert.equal(s.missions.length, missionCatalog.filter((m) => m.map === id).length);
        assert.equal(
            s.parts.filter((p) => p.id.startsWith('obstacle-')).length,
            obstaclesForBoard(id).length
        );
        for (const wall of tableWalls) assert.equal(w.items.get(wall.id).body.mass, 0);
    }
    assert.equal(engine('practice').competition.snapshot().parts.length, 5);
});
test('perimeter meshes exactly match collision dimensions and wall tops at 78 mm', () => {
    const w = engine('2024').competition,
        view = createTableWalls();
    for (const wall of tableWalls) {
        const mesh = view.getObjectByName(`wall-${wall.id}`),
            b = w.items.get(wall.id).body;
        assert.deepEqual(
            mesh.position.toArray(),
            b.position.toArray().map((n) => n * 1000)
        );
        assert.deepEqual(
            [
                mesh.geometry.parameters.width,
                mesh.geometry.parameters.height,
                mesh.geometry.parameters.depth
            ],
            wall.size
        );
        assert.equal(mesh.position.y + mesh.geometry.parameters.height / 2, 78);
    }
});
test('static obstacles stop robot travel and are detected at sensor height, not above their top', () => {
    const start = { x: -900, y: -200, heading: 0 },
        w = engine('2025', start).competition;
    assert.ok(Math.abs(w.ray(-900, -100, 0, 25).distance - 142.5) < 0.01);
    assert.ok(w.ray(-900, -100, 0, 400).distance > 300);
    for (let i = 0; i < 3 / DT; i++) w.step(DT, 0, 200, 0, idle(), idle());
    assert.ok(-w.chassis.position.z * 1000 < -45, 'chassis must stop at the obstacle');
    const free = engine('practice', start).competition;
    for (let i = 0; i < 3 / DT; i++) free.step(DT, 0, 200, 0, idle(), idle());
    assert.ok(-free.chassis.position.z * 1000 > 300, 'control run crosses the same location');
});
test('visible obstacle box positions and sizes are the actual collision shapes', () => {
    const w = engine('2024').competition,
        view = createCompetitionView();
    view.update(w.snapshot());
    for (const obstacle of obstaclesForBoard('2024')) {
        const id = `obstacle-${obstacle.id}`,
            mesh = view.group.getObjectByName(id),
            b = w.items.get(id).body;
        assert.deepEqual(
            mesh.position.toArray(),
            b.position.toArray().map((n) => n * 1000)
        );
        assert.deepEqual(
            [
                mesh.geometry.parameters.width,
                mesh.geometry.parameters.height,
                mesh.geometry.parameters.depth
            ],
            [obstacle.width, obstacle.height, obstacle.depth]
        );
    }
    view.dispose();
});
test('switching objectives on the same season keeps the complete obstacle geometry', () => {
    const geometry = (w) =>
        w
            .snapshot()
            .parts.filter((p) => !p.id.startsWith('attachment-'))
            .map((p) => JSON.stringify([p.size, p.position, p.quaternion]))
            .sort();
    for (const m of missionCatalog)
        assert.deepEqual(
            geometry(engine(m.map, m.start, m).competition),
            geometry(engine(m.map, m.start).competition),
            m.id
        );
});
test('overview cameras frame all table corners across split-screen aspect ratios', () => {
    for (const aspect of [0.7, 1, 2, 3])
        for (const mode of ['home', 'top']) {
            const camera = new THREE.PerspectiveCamera(43, aspect, 10, 14000);
            fitBoardCamera(camera, mode);
            for (const x of [-1207, 1207])
                for (const y of [0, 78])
                    for (const z of [-598, 598]) {
                        const p = new THREE.Vector3(x, y, z).project(camera);
                        assert.ok(
                            Math.abs(p.x) < 1 && Math.abs(p.y) < 1,
                            `${aspect}/${mode}: ${p.toArray()}`
                        );
                    }
        }
});
