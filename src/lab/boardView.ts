import * as THREE from 'three';
import { perimeterWalls, boardSize } from './boardGeometry.ts';
export function createTableWalls(map = '') {
    const group = new THREE.Group();
    group.name = 'solid-table-walls';
    for (const wall of perimeterWalls(map)) {
        const geometry = new THREE.BoxGeometry(...(wall.size as [number, number, number]));
        const face = new THREE.MeshStandardMaterial({ color: '#bac5ce', roughness: 0.75 });
        const top = new THREE.MeshStandardMaterial({ color: '#e2bd7d', roughness: 0.8 });
        const mesh = new THREE.Mesh(geometry, [face, face, top, face, face, face]);
        mesh.name = `wall-${wall.id}`;
        mesh.position.fromArray(wall.position);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const outline = new THREE.LineSegments(
            new THREE.EdgesGeometry(geometry),
            new THREE.LineBasicMaterial({ color: '#f3ddaf' })
        );
        mesh.add(outline);
        group.add(mesh);
    }
    return group;
}
export function fitBoardCamera(camera: THREE.PerspectiveCamera, mode: 'home' | 'top', map = '') {
    const { width, height } = boardSize(map);
    camera.far = map === 'practice' ? 140000 : 14000;
    camera.updateProjectionMatrix();
    const direction =
        mode === 'top'
            ? new THREE.Vector3(0, 1, 0.0001).normalize()
            : new THREE.Vector3(1.3, 1.9, 2).normalize();
    const target = new THREE.Vector3(0, 20, 0);
    const right = new THREE.Vector3()
        .crossVectors(new THREE.Vector3(0, 1, 0), direction)
        .normalize();
    const up = new THREE.Vector3().crossVectors(direction, right).normalize();
    const v = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)),
        h = v * camera.aspect;
    let distance = 0;
    for (const x of [-width / 2 - 59, width / 2 + 59])
        for (const y of [0, 220])
            for (const z of [-height / 2 - 48.5, height / 2 + 48.5]) {
                const p = new THREE.Vector3(x, y, z).sub(target);
                distance = Math.max(
                    distance,
                    p.dot(direction) +
                        Math.max(Math.abs(p.dot(right)) / h, Math.abs(p.dot(up)) / v) * 1.1
                );
            }
    camera.position.copy(target).addScaledVector(direction, distance);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    return target;
}

// A long overhead runway view makes lateral drift visible without shrinking the
// demonstration to a dot in the full 23 m field overview.
export function fitStraightRunCamera(
    camera: THREE.PerspectiveCamera,
    start: { x: number; y: number }
) {
    const target = new THREE.Vector3(start.x + 2200, 0, -start.y + 600);
    const v = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const height = Math.max(6000 / (2 * v * camera.aspect), 4000 / (2 * v)) * 1.12;
    camera.far = 140000;
    camera.updateProjectionMatrix();
    camera.position.set(target.x, height, target.z + 0.01);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    return target;
}
