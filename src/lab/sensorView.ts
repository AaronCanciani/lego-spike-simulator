import * as THREE from 'three';
import type { SensorConfig, Reading } from './sensors.ts';

export function createSensorView() {
    const group = new THREE.Group();
    const parts = ['B', 'F'].map((port) => {
        const body = new THREE.Mesh(
            new THREE.BoxGeometry(18, 14, 18),
            new THREE.MeshBasicMaterial({ color: '#21e6e0', depthTest: false })
        );
        body.renderOrder = 5;
        const footprint = new THREE.Mesh(
            new THREE.RingGeometry(1, 1.3, 32),
            new THREE.MeshBasicMaterial({
                color: '#21e6e0',
                side: THREE.DoubleSide,
                depthTest: false
            })
        );
        footprint.rotation.x = -Math.PI / 2;
        footprint.renderOrder = 5;
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(18), 3));
        const beam = new THREE.LineSegments(
            geometry,
            new THREE.LineBasicMaterial({
                color: '#68baff',
                transparent: true,
                opacity: 0.6,
                depthTest: false
            })
        );
        beam.frustumCulled = false;
        beam.renderOrder = 5;
        const probe = new THREE.Mesh(
            new THREE.BoxGeometry(8, 8, 1),
            new THREE.MeshBasicMaterial({ color: '#ffae55', depthTest: false })
        );
        probe.renderOrder = 5;
        group.add(body, footprint, beam, probe);
        return { port, body, footprint, beam, probe };
    });
    return {
        group,
        update(config: SensorConfig, readings: Record<string, Reading>) {
            for (const part of parts) {
                const mount = config.ports[part.port as 'B' | 'F'],
                    reading = readings[part.port];
                part.body.visible = mount.kind !== 'none';
                part.body.position.set(mount.side, mount.height, -mount.forward);
                part.body.material.color.set(
                    mount.kind === 'color'
                        ? '#21e6e0'
                        : mount.kind === 'distance'
                          ? '#68baff'
                          : reading?.pressed
                            ? '#ff5353'
                            : '#ffae55'
                );
                part.footprint.visible = mount.kind === 'color';
                part.footprint.position.set(mount.side, 3, -mount.forward);
                part.footprint.scale.setScalar(2 + mount.height * 0.18);
                part.beam.visible = mount.kind === 'distance';
                const points = part.beam.geometry.attributes.position as THREE.BufferAttribute;
                const length = reading?.distance ?? 2000;
                [-1, 0, 1].forEach((side, i) => {
                    const angle = (side * config.cone * Math.PI) / 180;
                    points.setXYZ(i * 2, mount.side, mount.height, -mount.forward);
                    points.setXYZ(
                        i * 2 + 1,
                        mount.side + Math.sin(angle) * length,
                        mount.height,
                        -mount.forward - Math.cos(angle) * length
                    );
                });
                points.needsUpdate = true;
                part.beam.material.opacity = reading?.valid ? 0.65 : 0.2;
                part.probe.visible = mount.kind === 'force';
                const extension = Math.max(0.1, 8 - (reading?.compression ?? 0));
                part.probe.scale.z = extension;
                part.probe.position.set(mount.side, mount.height, -mount.forward - extension / 2);
            }
        }
    };
}
