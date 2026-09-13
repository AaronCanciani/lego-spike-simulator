import * as THREE from 'three';
import { coralMission as mission } from './mission.ts';

export function createMissionView() {
    const group = new THREE.Group();
    group.name = 'coral-training-overlay';
    const line = (points: THREE.Vector3[], color: string, dashed = false) => {
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const mesh = new THREE.Line(
            geometry,
            dashed
                ? new THREE.LineDashedMaterial({ color, dashSize: 16, gapSize: 12 })
                : new THREE.LineBasicMaterial({ color })
        );
        mesh.computeLineDistances();
        group.add(mesh);
        return mesh;
    };
    line(
        [
            new THREE.Vector3(mission.start.x, 3, -mission.start.y),
            new THREE.Vector3(mission.target.x, 3, -mission.target.y)
        ],
        '#29eeea',
        true
    );
    const target = new THREE.Mesh(
        new THREE.RingGeometry(mission.tolerance - 3, mission.tolerance, 64),
        new THREE.MeshBasicMaterial({ color: '#29eeea', side: THREE.DoubleSide })
    );
    target.rotation.x = -Math.PI / 2;
    target.position.set(mission.target.x, 3, -mission.target.y);
    group.add(target);
    const launch = mission.launch;
    line(
        Array.from({ length: 41 }, (_, i) => {
            const a = (i * Math.PI) / 80;
            return new THREE.Vector3(
                launch.x + Math.cos(a) * launch.radius,
                3,
                -launch.y - Math.sin(a) * launch.radius
            );
        }),
        '#60f0ae'
    );
    const startRing = new THREE.Mesh(
        new THREE.RingGeometry(96, 100, 48),
        new THREE.MeshBasicMaterial({ color: '#60f0ae', side: THREE.DoubleSide })
    );
    startRing.rotation.x = -Math.PI / 2;
    startRing.position.set(mission.start.x, 3, -mission.start.y);
    group.add(startRing);
    const label = (text: string, x: number, y: number) => {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 80;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#122b3c';
        ctx.fillRect(0, 0, 512, 80);
        ctx.font = 'bold 30px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#e8ffff';
        ctx.fillText(text, 256, 52);
        const texture = new THREE.CanvasTexture(canvas);
        const sprite = new THREE.Sprite(
            new THREE.SpriteMaterial({ map: texture, depthTest: false })
        );
        sprite.scale.set(235, 37, 1);
        sprite.position.set(x, 150, -y);
        group.add(sprite);
        return texture;
    };
    const textures = [
        label('START / RETURN', mission.start.x, mission.start.y),
        label('M01 · TRAINING TARGET', mission.landmark.x, mission.landmark.y)
    ];
    const base = new THREE.Mesh(
        new THREE.BoxGeometry(115, 8, 70),
        new THREE.MeshStandardMaterial({ color: '#a5b8bf' })
    );
    base.position.set(mission.landmark.x, 4, -mission.landmark.y);
    group.add(base);
    const buds = new THREE.Group();
    buds.position.set(mission.landmark.x, 10, -mission.landmark.y);
    group.add(buds);
    for (let i = 0; i < 3; i++) {
        const stem = new THREE.Mesh(
            new THREE.CylinderGeometry(4, 4, 44, 8),
            new THREE.MeshStandardMaterial({ color: '#ee68b6' })
        );
        stem.position.set((i - 1) * 35, 23, 0);
        buds.add(stem);
        const head = new THREE.Mesh(
            new THREE.SphereGeometry(12, 12, 8),
            new THREE.MeshStandardMaterial({ color: '#fa8bcd' })
        );
        head.position.set((i - 1) * 35, 45, 0);
        buds.add(head);
    }
    return {
        group,
        textures,
        update(activated: boolean) {
            buds.rotation.x = activated ? 0 : Math.PI / 2;
            target.material.color.set(activated ? '#60f0ae' : '#29eeea');
        }
    };
}
