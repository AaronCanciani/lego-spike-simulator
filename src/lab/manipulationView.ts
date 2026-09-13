import * as THREE from 'three';
import { cubeParts, forkParts, deliveryZone, type ManipulationSnapshot } from './manipulation.ts';
export function createManipulationView() {
    const group = new THREE.Group(),
        cube = new THREE.Group(),
        fork = new THREE.Group(),
        mast = new THREE.Group();
    let forkLength = 0;
    const create = (parent: THREE.Group, parts: typeof cubeParts, color: string) => {
        for (const p of parts) {
            const mesh = new THREE.Mesh(
                new THREE.BoxGeometry(...(p.size as [number, number, number])),
                new THREE.MeshStandardMaterial({ color, roughness: 0.65 })
            );
            mesh.position.fromArray(p.offset);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            const edges = new THREE.LineSegments(
                new THREE.EdgesGeometry(mesh.geometry),
                new THREE.LineBasicMaterial({ color: '#183148' })
            );
            mesh.add(edges);
            parent.add(mesh);
        }
    };
    create(cube, cubeParts, '#ff923d');
    // Decorative guide frame. Contact geometry is the fork + chassis, not these rails.
    create(
        mast,
        [
            { size: [8, 160, 8], offset: [-29, 80, -94] },
            { size: [8, 160, 8], offset: [29, 80, -94] },
            { size: [66, 12, 12], offset: [0, 160, -94] }
        ],
        '#485b73'
    );
    group.add(cube, fork, mast);
    const zoneMaterial = new THREE.MeshBasicMaterial({
        color: '#30cba0',
        transparent: true,
        opacity: 0.27,
        depthWrite: false
    });
    const zone = new THREE.Mesh(
        new THREE.BoxGeometry(deliveryZone.width, 1, deliveryZone.depth),
        zoneMaterial
    );
    zone.position.set(deliveryZone.x, 1, -deliveryZone.y);
    group.add(zone);
    const border = new THREE.LineSegments(
        new THREE.EdgesGeometry(zone.geometry),
        new THREE.LineBasicMaterial({ color: '#18bd92' })
    );
    zone.add(border);
    return {
        group,
        update(state: ManipulationSnapshot | null) {
            group.visible = !!state;
            if (!state) return;
            if (forkLength !== state.config.forkLength) {
                fork.traverse((obj) => {
                    if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
                        obj.geometry.dispose();
                        (obj.material as THREE.Material).dispose();
                    }
                });
                fork.clear();
                forkLength = state.config.forkLength;
                create(fork, forkParts(forkLength), '#ffcf38');
            }
            for (const [mesh, body] of [
                [cube, state.cube],
                [fork, state.fork]
            ] as const) {
                mesh.position.fromArray(body.position);
                mesh.quaternion.fromArray(body.quaternion);
            }
            mast.position.set(state.fork.position[0], 0, state.fork.position[2]);
            mast.quaternion.fromArray(state.fork.quaternion);
            zoneMaterial.opacity = state.delivered ? 0.7 : 0.27;
        }
    };
}
