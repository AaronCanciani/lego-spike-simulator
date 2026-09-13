import * as THREE from 'three';
import { LDrawLoader } from 'three/addons/loaders/LDrawLoader.js';
import { LDrawConditionalLineMaterial } from 'three/addons/materials/LDrawConditionalLineMaterial.js';
import { ldrawColours } from '../lib/ldraw/colours.ts';
import type { Profile } from './engine.ts';

export type Joint = { pivot: THREE.Group; role: 'left' | 'right' | 'C' | 'D'; ratio: number };
export type RobotRig = { group: THREE.Group; joints: Joint[] };
const material = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.55 });

// Encoder-driven joints are independent of chassis travel, including during slip.
export function updateRig(
    rig: RobotRig,
    motors: Record<string, { position: number }>,
    profile: Profile
) {
    for (const joint of rig.joints) {
        const port =
            joint.role === 'left'
                ? profile.left
                : joint.role === 'right'
                  ? profile.right
                  : joint.role;
        const polarity =
            joint.role === 'left'
                ? profile.leftSign
                : joint.role === 'right'
                  ? profile.rightSign
                  : 1;
        const direction = joint.role === 'C' || joint.role === 'D' ? 1 : -1;
        joint.pivot.rotation.x =
            (direction * (motors[port]?.position || 0) * polarity * joint.ratio * Math.PI) / 180;
    }
}

export function addDemoTools(group: THREE.Group): Joint[] {
    return (['C', 'D'] as const).map((role, i) => {
        const mount = new THREE.Mesh(new THREE.BoxGeometry(26, 34, 65), material('#f1eee4'));
        mount.position.set(i === 0 ? -42 : 42, 63, -54);
        mount.castShadow = true;
        group.add(mount);
        const pivot = new THREE.Group();
        pivot.name = `tool-${role}`;
        pivot.position.set(i === 0 ? -42 : 42, 78, -74);
        group.add(pivot);
        const arm = new THREE.Mesh(
            new THREE.BoxGeometry(13, 13, 105),
            material(i === 0 ? '#ffcb35' : '#dc64bb')
        );
        arm.position.z = -46;
        arm.castShadow = true;
        pivot.add(arm);
        const tip = new THREE.Mesh(new THREE.BoxGeometry(36, 12, 13), material('#253a4a'));
        tip.position.z = -100;
        tip.castShadow = true;
        pivot.add(tip);
        return { pivot, role, ratio: 1 };
    });
}

export async function parseReferenceRig(text: string): Promise<RobotRig> {
    text = text.replaceAll('\\', '/').replaceAll('\r', '');
    // The packed upstream file omits LDraw type metadata. Add it in memory so
    // Three.js merges primitive geometry but preserves top-level movable parts.
    const first = text.split(/\r?\n0 FILE /i)[0];
    const topParts = new Set(
        first
            .split(/\r?\n/)
            .filter((l) => l.startsWith('1 '))
            .map((l) => l.trim().split(/\s+/).slice(14).join(' ').toLowerCase())
    );
    const packed = new Set(
        [...text.matchAll(/^0 FILE (.+)$/gm)].map((m) =>
            m[1].trim().replaceAll('\\', '/').toLowerCase()
        )
    );
    for (const line of text.split(/\r?\n/))
        if (line.startsWith('1 ')) {
            const name = line
                .trim()
                .split(/\s+/)
                .slice(14)
                .join(' ')
                .replaceAll('\\', '/')
                .toLowerCase();
            if (!packed.has(name))
                throw new Error(`Reference model is not self-contained: ${name}`);
        }
    const colors = ldrawColours
        .map(
            (c) =>
                `0 !COLOUR ${c.NAME.replaceAll(' ', '_')} CODE ${c.CODE} VALUE ${c.VALUE} EDGE ${c.EDGE}${c.ALPHA ? ' ALPHA ' + c.ALPHA : ''}`
        )
        .join('\n');
    const normalized = text.replace(/^0 FILE (.+)$/gm, (_, name: string) => {
        const n = name.trim();
        return `0 FILE ${n}\n0 !LDRAW_ORG ${n.endsWith('.ldr') ? 'Model' : topParts.has(n.toLowerCase()) ? 'Part' : 'Primitive'}${n === 'main.ldr' ? '\n' + colors : ''}`;
    });
    const loader = new LDrawLoader();
    loader.setFileMap(Object.fromEntries([...packed].map((name) => [name, name])));
    loader.setConditionalLineMaterial(LDrawConditionalLineMaterial);
    loader.addDefaultMaterials();
    const loaded = await new Promise<THREE.Group>((resolve, reject) =>
        loader.parse(normalized, resolve, reject)
    );
    const group = new THREE.Group();
    group.name = 'upstream-reference-build';
    // LDraw: 0.4 mm/unit, +Y downward. Center the drive axle at the origin.
    const conversion = new THREE.Matrix4().set(
        0.4,
        0,
        0,
        -64.4,
        0,
        -0.4,
        0,
        24.8,
        0,
        0,
        0.4,
        28,
        0,
        0,
        0,
        1
    );
    for (const child of [...loaded.children]) {
        loaded.remove(child);
        child.applyMatrix4(conversion);
        group.add(child);
    }
    const tires = group.children
        .filter((c) => c.name === '39367p01.dat')
        .sort((a, b) => a.position.x - b.position.x);
    if (tires.length !== 2)
        throw new Error('Expected two separately addressable reference wheels.');
    const joints: Joint[] = [];
    tires.forEach((tire, i) => {
        const pivot = new THREE.Group();
        pivot.name = i === 0 ? 'wheel-left' : 'wheel-right';
        pivot.position.copy(tire.position);
        group.add(pivot);
        const rim = group.children.find(
            (c) => c.name === '48267.dat' && Math.sign(c.position.x) === Math.sign(tire.position.x)
        );
        group.updateMatrixWorld(true);
        pivot.attach(tire);
        if (rim) pivot.attach(rim);
        joints.push({ pivot, role: i === 0 ? 'left' : 'right', ratio: 1 });
    });
    joints.push(...addDemoTools(group));
    group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
            obj.castShadow = true;
            obj.receiveShadow = true;
        }
    });
    return { group, joints };
}

export function disposeRig(rig: RobotRig) {
    const geometries = new Set<THREE.BufferGeometry>(),
        materials = new Set<THREE.Material>();
    rig.group.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
            geometries.add(obj.geometry);
            for (const m of Array.isArray(obj.material) ? obj.material : [obj.material])
                materials.add(m);
        }
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
}
