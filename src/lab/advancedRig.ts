import * as THREE from 'three';
import { addDemoTools, updateRig, type RobotRig } from './robotRig.ts';
import type { Profile } from './engine.ts';
import type { Reading } from './sensors.ts';

// Original simplified geometry inspired by the user's ADB reference photograph.
// NOT a brick-for-brick LEGO assembly or a collision/attachment CAD model.
export type AdvancedRig = RobotRig & {
    configure: (profile: Profile, sensors: Record<string, Reading>) => void;
};
export function createAdvancedRig(): AdvancedRig {
    const group = new THREE.Group();
    group.name = 'advanced-driving-base-approximation';
    const chassis = new THREE.Group();
    group.add(chassis);
    const materials = new Map<string, THREE.MeshStandardMaterial>();
    const mat = (color: string) => {
        if (!materials.has(color))
            materials.set(
                color,
                new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.06 })
            );
        return materials.get(color)!;
    };
    const box = (
        parent: THREE.Object3D,
        name: string,
        color: string,
        size: number[],
        at: number[]
    ) => {
        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(...(size as [number, number, number])),
            mat(color)
        );
        mesh.name = name;
        mesh.position.set(...(at as [number, number, number]));
        parent.add(mesh);
        return mesh;
    };
    const cylinder = (
        parent: THREE.Object3D,
        color: string,
        radius: number,
        length: number,
        at: number[]
    ) => {
        const mesh = new THREE.Mesh(
            new THREE.CylinderGeometry(radius, radius, length, 32),
            mat(color)
        );
        mesh.rotation.z = Math.PI / 2;
        mesh.position.set(...(at as [number, number, number]));
        parent.add(mesh);
        return mesh;
    };
    // Technic-like rails: original beam geometry with actual through-holes.
    function beam(length: number, color: string) {
        const shape = new THREE.Shape();
        shape.moveTo(-7, -length / 2);
        shape.lineTo(7, -length / 2);
        shape.lineTo(7, length / 2);
        shape.lineTo(-7, length / 2);
        shape.closePath();
        for (let y = -length / 2 + 8; y <= length / 2 - 8; y += 16) {
            const hole = new THREE.Path();
            hole.absarc(0, y, 3.6, 0, Math.PI * 2, true);
            shape.holes.push(hole);
        }
        const geometry = new THREE.ExtrudeGeometry(shape, {
            depth: 8,
            bevelEnabled: true,
            bevelSize: 1,
            bevelThickness: 1,
            bevelSegments: 1,
            steps: 1,
            curveSegments: 8
        });
        geometry.translate(0, 0, -4);
        const mesh = new THREE.Mesh(geometry, mat(color));
        mesh.rotation.x = Math.PI / 2;
        chassis.add(mesh);
        return mesh;
    }
    for (const side of [-1, 1]) {
        const rail = beam(176, '#c83c97');
        rail.position.set(side * 57, 39, -23);
        const diagonal = beam(112, '#5ec8de');
        diagonal.position.set(side * 61, 62, 6);
        diagonal.rotation.x = 0.86;
        const rear = beam(96, '#5ec8de');
        rear.position.set(side * 61, 45, 68);
        rear.rotation.x = 2.15;
        box(
            chassis,
            `drive-motor-${side < 0 ? 'A' : 'E'}`,
            '#e5e9e9',
            [36, 38, 64],
            [side * 34, 16, 0]
        );
        cylinder(chassis, '#ffcf32', 16, 8, [side * 56, 0, 0]);
    }
    for (const z of [-107, -59, 67]) {
        const cross = beam(120, z === 67 ? '#5ec8de' : '#c83c97');
        cross.position.set(0, 39, z);
        cross.rotation.z = Math.PI / 2;
    }
    box(chassis, 'front-bumper', '#253647', [124, 13, 13], [0, 8, -111]);
    box(chassis, 'hub-yellow-base', '#ffcd31', [86, 25, 55], [0, 65, 30]);
    box(chassis, 'hub-white-top', '#f5f6ee', [88, 18, 57], [0, 85, 30]);
    // Legible light matrix and run button; appearance only, not hub output emulation.
    box(chassis, 'hub-display', '#e4e7dd', [44, 1, 40], [0, 94.6, 29]);
    for (let row = 0; row < 5; row++)
        for (let col = 0; col < 5; col++) {
            const on = (row === 1 && (col === 1 || col === 3)) || (row === 3 && col > 0 && col < 4);
            box(
                chassis,
                'display-pixel',
                on ? '#fff6b7' : '#c1c5bc',
                [4, 1.3, 4],
                [(col - 2) * 7, 95.3, 29 + (row - 2) * 7]
            );
        }
    box(chassis, 'hub-button', '#c6dce2', [10, 2, 10], [32, 95, 30]);
    // Passive rear support, distinct from measured drive-wheel motion.
    const caster = new THREE.Mesh(new THREE.SphereGeometry(12, 20, 12), mat('#c9d5dc'));
    caster.name = 'rear-caster';
    caster.position.set(0, 12, 88);
    group.add(caster);
    box(group, 'caster-mount', '#f3f1e9', [28, 18, 28], [0, 28, 88]);
    const joints: RobotRig['joints'] = [];
    for (const side of [-1, 1]) {
        const pivot = new THREE.Group();
        pivot.name = side < 0 ? 'wheel-left' : 'wheel-right';
        group.add(pivot);
        const wheel = new THREE.Group();
        wheel.name = 'wheel-scalable-geometry';
        pivot.add(wheel);
        cylinder(wheel, '#171d25', 44, 20, [0, 0, 0]);
        for (const face of [-1, 1]) {
            cylinder(wheel, '#909ca5', 33, 1, [face * 10.5, 0, 0]);
            cylinder(wheel, '#26313e', 28, 2, [face * 11, 0, 0]);
            for (let i = 0; i < 6; i++) {
                const spoke = box(wheel, 'wheel-spoke', '#d9e0e3', [2, 52, 5], [face * 12, 0, 0]);
                spoke.rotation.x = (i * Math.PI) / 3;
            }
            cylinder(wheel, '#ffce38', 9, 3, [face * 13, 0, 0]);
        }
        for (let i = 0; i < 32; i++) {
            const angle = (i * Math.PI) / 16;
            const tread = box(
                wheel,
                'tire-tread',
                '#28313a',
                [21, 2, 5],
                [0, 43.5 * Math.cos(angle), 43.5 * Math.sin(angle)]
            );
            tread.rotation.x = angle;
        }
        // Asymmetric tire marks make rotation visible even from a distant camera.
        box(wheel, 'wheel-rotation-marker', '#f8e49b', [2, 9, 5], [side * 14, 35, 0]);
        joints.push({ pivot, role: side < 0 ? 'left' : 'right', ratio: 1 });
    }
    const tools = new THREE.Group();
    tools.name = 'illustrative-attachments';
    group.add(tools);
    joints.push(...addDemoTools(tools));
    const mounts = (['B', 'F'] as const).map((port) => {
        const mount = new THREE.Group();
        mount.name = `sensor-${port}`;
        group.add(mount);
        const body = box(mount, 'sensor-body', '#f2f3ed', [24, 18, 22], [0, 10, 0]);
        const color = cylinder(mount, '#19283a', 5, 1, [0, 0.5, 0]);
        color.rotation.z = 0;
        const distance = new THREE.Group();
        mount.add(distance);
        for (const side of [-1, 1]) {
            const eye = cylinder(distance, '#25394a', 7, 2, [side * 7, 0, 0]);
            eye.rotation.z = 0;
            eye.rotation.x = Math.PI / 2;
        }
        const force = box(mount, 'force-plunger', '#dd4b64', [13, 13, 8], [0, 0, -4]);
        return { port, mount, body, color, distance, force };
    });
    group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
            obj.castShadow = true;
            obj.receiveShadow = true;
        }
    });
    return {
        group,
        joints,
        configure(profile, readings) {
            const radius = profile.wheel / 2;
            chassis.position.y = radius;
            chassis.scale.x = profile.track / 160;
            // Tools remain independent hinges; lift their mounting group with axle height.
            tools.position.y = radius - 44;
            for (const joint of joints.slice(0, 2)) {
                joint.pivot.position.set(
                    ((joint.role === 'left' ? -1 : 1) * profile.track) / 2,
                    radius,
                    0
                );
                joint.pivot.children[0].scale.set(1, profile.wheel / 88, profile.wheel / 88);
            }
            for (const s of mounts) {
                const cfg = profile.sensorConfig.ports[s.port];
                s.mount.visible = cfg.kind !== 'none';
                s.mount.position.set(cfg.side, cfg.height, -cfg.forward);
                s.color.visible = cfg.kind === 'color';
                s.body.position.set(
                    0,
                    cfg.kind === 'color' ? 10 : 0,
                    cfg.kind === 'color' ? 0 : 12
                );
                s.distance.visible = cfg.kind === 'distance';
                s.force.visible = cfg.kind === 'force';
                const extension = Math.max(0.1, 8 - (readings[s.port]?.compression ?? 0));
                s.force.scale.z = extension / 8;
                s.force.position.z = -extension / 2;
            }
        }
    };
}
export function updateAdvancedRig(
    rig: AdvancedRig,
    motors: Record<string, { position: number }>,
    profile: Profile,
    sensors: Record<string, Reading>
) {
    rig.configure(profile, sensors);
    updateRig(rig, motors, profile);
}
