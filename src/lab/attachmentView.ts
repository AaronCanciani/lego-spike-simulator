import * as THREE from 'three';
import type { ToolAppearance } from './attachments.ts';

type AppearancePart = { size: number[]; color: string; appearance?: ToolAppearance };
const material = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.62 });

// Original procedural Technic-style details, based on the user's assembly pictures.
// Pin holes, rack teeth and the mounting hardware are cosmetic, not extra colliders.
export function createAttachmentMesh(part: AppearancePart): THREE.Mesh {
    const [w, h, l] = part.size;
    const root = new THREE.Mesh(new THREE.BufferGeometry(), material(part.color));
    const add = (geometry: THREE.BufferGeometry, color: string, x = 0, y = 0, z = 0) => {
        const mesh = new THREE.Mesh(geometry, material(color));
        mesh.position.set(x, y, z);
        mesh.castShadow = mesh.receiveShadow = true;
        root.add(mesh);
        return mesh;
    };
    const box = (size: number[], color: string, x = 0, y = 0, z = 0) =>
        add(new THREE.BoxGeometry(size[0], size[1], size[2]), color, x, y, z);
    const axle = (radius: number, length: number, color: string, x = 0, y = 0, z = 0) =>
        add(
            new THREE.CylinderGeometry(radius, radius, length, 20).rotateZ(Math.PI / 2),
            color,
            x,
            y,
            z
        );

    if (part.appearance === 'mount') {
        // Fixed rectangular bracket and yellow connectors behind the moving arm.
        for (const side of [-1, 1]) {
            box([7, 8, 36], '#343c40', side * (w / 2 - 4), -10, 10);
            box([8, 18, 8], '#f6cf37', side * (w / 2 - 4), -5, 24);
            axle(3.5, 10, '#507ba8', side * (w / 2 - 3), -3, 24);
        }
        box([w, 7, 8], '#6d7781', 0, -10, 26);
        box([w * 0.65, 7, 12], '#a33287', 0, -9, 6);
        axle(3.5, w + 4, '#a5aeb0');
        const gear = new THREE.Group();
        gear.name = 'driven-gear';
        gear.position.x = w / 2 + 2;
        const wheel = new THREE.Mesh(
            new THREE.CylinderGeometry(12, 12, 4, 32).rotateZ(Math.PI / 2),
            material('#c4ae70')
        );
        gear.add(wheel);
        for (let i = 0; i < 24; i++) {
            const a = (i * Math.PI) / 12;
            const tooth = new THREE.Mesh(new THREE.BoxGeometry(4, 2.6, 2.5), material('#c4ae70'));
            tooth.position.set(0, Math.cos(a) * 12.5, Math.sin(a) * 12.5);
            tooth.rotation.x = a;
            gear.add(tooth);
        }
        for (let i = 0; i < 6; i++) {
            const a = (i * Math.PI) / 3;
            const hole = new THREE.Mesh(
                new THREE.CylinderGeometry(2, 2, 4.2, 12).rotateZ(Math.PI / 2),
                material('#756541')
            );
            hole.position.set(0, Math.cos(a) * 7, Math.sin(a) * 7);
            gear.add(hole);
        }
        root.add(gear);
        box([5, 20, 8], '#b34528', w / 2 + 8, 0, 8);
    } else if (part.appearance === 'blade') {
        root.geometry = new THREE.BoxGeometry(w, h, l);
        // Molded blue face with rounded pin recesses and reinforcing ribs.
        for (const x of [-0.36, -0.12, 0.12, 0.36].map((n) => n * w)) {
            for (const y of [-h * 0.23, h * 0.23]) {
                const recess = add(
                    new THREE.CylinderGeometry(3.5, 3.5, 0.3, 16).rotateX(Math.PI / 2),
                    '#347e9b',
                    x,
                    y,
                    -l / 2 - 0.12
                );
                recess.scale.x = 1.5;
                add(
                    new THREE.TorusGeometry(3.5, 0.6, 6, 16),
                    '#8bcde3',
                    x,
                    y,
                    -l / 2 - 0.3
                ).scale.x = 1.5;
            }
        }
        for (const x of [-w * 0.25, 0, w * 0.25])
            box([2, h - 6, 1.3], '#7bc7df', x, 0, -l / 2 - 0.65);
        box([w, 3, 2], '#92d7eb', 0, h / 2 - 1.5, -l / 2);
    } else {
        const shape = new THREE.Shape();
        const curved = part.appearance === 'curved-rail';
        const r = Math.min(h / 2, l / 2);
        if (curved) {
            shape.moveTo(-l / 2, -h / 2);
            shape.lineTo(l / 2, -h / 2);
            shape.lineTo(l / 2, h / 2);
            shape.lineTo(-l / 2, h / 2);
            shape.closePath();
        } else {
            shape.moveTo(-l / 2 + r, -r);
            shape.lineTo(l / 2 - r, -r);
            shape.absarc(l / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2, false);
            shape.lineTo(-l / 2 + r, r);
            shape.absarc(-l / 2 + r, 0, r, Math.PI / 2, Math.PI * 1.5, false);
            shape.closePath();
        }
        const holeRadius = Math.min(2.4, h / 2 - 1, l / 2 - 1);
        const count = curved ? 1 : Math.max(1, Math.floor((l - 8) / 8) + 1);
        if (holeRadius > 0) {
            for (let i = 0; i < count; i++) {
                const z = (i - (count - 1) / 2) * 8;
                const hole = new THREE.Path();
                hole.absarc(z, 0, holeRadius, 0, Math.PI * 2, true);
                shape.holes.push(hole);
                for (const side of [-1, 1]) {
                    const rim = add(
                        new THREE.TorusGeometry(holeRadius + 0.25, 0.35, 5, 12).rotateY(
                            Math.PI / 2
                        ),
                        '#788187',
                        side * (w / 2 + 0.02),
                        0,
                        -z
                    );
                    rim.name = 'pin-hole-rim';
                }
            }
        }
        root.geometry = new THREE.ExtrudeGeometry(shape, {
            depth: w,
            bevelEnabled: false,
            curveSegments: 8
        })
            .rotateY(Math.PI / 2)
            .translate(-w / 2, 0, 0);
        if (curved) box([w * 0.7, 1.6, 2], '#687176', 0, -h / 2 - 0.7, 0);
        if (part.appearance === 'rack') {
            for (let z = -l / 2 + 4; z < l / 2 - 3; z += 3.5)
                box([w, 1.6, 1.5], '#7d878b', 0, h / 2 + 0.8, z);
        }
    }
    root.traverse((obj) => {
        if (obj instanceof THREE.Mesh) obj.castShadow = obj.receiveShadow = true;
    });
    return root;
}
