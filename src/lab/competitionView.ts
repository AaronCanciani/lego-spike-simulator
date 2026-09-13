import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { CompetitionSnapshot } from './competitionWorld.ts';
import { findMission } from './missionCatalog.ts';

export function createCompetitionView() {
    const group = new THREE.Group();
    const meshes = new Map<string, THREE.Mesh>();
    let id = '';
    let geometryKey = '';
    const clear = () => {
        group.traverse((obj) => {
            const mesh = obj as THREE.Mesh;
            mesh.geometry?.dispose();
            if (mesh.material)
                for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
                    m.dispose();
        });
        group.clear();
        meshes.clear();
    };
    const ring = (x: number, y: number, radius: number, color: string) => {
        const mesh = new THREE.Mesh(
            new THREE.RingGeometry(radius - 3, radius, 64),
            new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })
        );
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(x, 1, -y);
        group.add(mesh);
    };
    function update(state: CompetitionSnapshot | null) {
        group.visible = !!state;
        if (!state) {
            if (id) {
                clear();
                id = '';
            }
            return;
        }
        const nextKey = JSON.stringify(state.parts.map((p) => [p.id, p.size, p.color, p.shape]));
        if (id !== state.id || geometryKey !== nextKey) {
            clear();
            id = state.id;
            geometryKey = nextKey;
            const m = findMission(id);
            if (m) {
                ring(m.start.x, m.start.y, 105, '#3ac5d8');
                ring(m.approach.x, m.approach.y, 105, '#ffd558');
                if (m.kind === 'build') ring(m.target.x, m.target.y, 70, '#ec3f56');
                if (m.kind === 'space') {
                    const finish = new THREE.Mesh(
                        new THREE.BoxGeometry(4, 2, 110),
                        new THREE.MeshBasicMaterial({ color: '#36ddbb' })
                    );
                    finish.position.set(m.target.x + 280, 1, -m.target.y - 110);
                    group.add(finish);
                }
                if (m.kind === 'tire') {
                    ring(m.target.x, m.target.y - 120, 90, '#36ddbb');
                    const line = new THREE.Mesh(
                        new THREE.BoxGeometry(4, 2, 1143),
                        new THREE.MeshBasicMaterial({ color: '#ff426b' })
                    );
                    line.position.set(360, 1, 0);
                    group.add(line);
                }
                if (m.kind === 'solar')
                    for (let i = 0; i < 3; i++)
                        ring(m.target.x + (i - 1) * 90, m.target.y, 33, '#ffcf48');
            }
        }
        const current = new Set(state.parts.map((p) => p.id));
        for (const [key, mesh] of meshes)
            if (!current.has(key)) {
                group.remove(mesh);
                mesh.geometry.dispose();
                for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
                    m.dispose();
                meshes.delete(key);
            }
        for (const part of state.parts) {
            let mesh = meshes.get(part.id);
            if (!mesh) {
                const mat = new THREE.MeshStandardMaterial({ color: part.color, roughness: 0.7 });
                mesh =
                    part.shape === 'tire'
                        ? new THREE.Mesh(
                              new THREE.CylinderGeometry(
                                  part.size[0] / 2,
                                  part.size[0] / 2,
                                  part.size[1],
                                  24
                              ),
                              [mat, new THREE.MeshStandardMaterial({ color: '#fafafa' }), mat]
                          )
                        : new THREE.Mesh(
                              new THREE.BoxGeometry(part.size[0], part.size[1], part.size[2]),
                              mat
                          );
                if (part.shape === 'cart') {
                    mesh.geometry.dispose();
                    const wheels = [-21, 21].map((z) =>
                        new THREE.CylinderGeometry(23, 23, 8, 20)
                            .rotateX(Math.PI / 2)
                            .translate(0, -5, z)
                    );
                    mesh.geometry = mergeGeometries(wheels)!;
                    wheels.forEach((wheel) => wheel.dispose());
                }
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.name = part.id;
                meshes.set(part.id, mesh);
                group.add(mesh);
            }
            mesh.position.fromArray(part.position);
            mesh.quaternion.fromArray(part.quaternion);
        }
    }
    return { group, update, dispose: clear };
}
