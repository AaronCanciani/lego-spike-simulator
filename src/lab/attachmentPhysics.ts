import { Body, Box, HingeConstraint, Material, Quaternion, Vec3, World } from 'cannon-es';
import type { Part } from './competitionWorld.ts';
import {
    toolParts,
    validateAttachments,
    type Attachments,
    type ToolConfig,
    type ToolPart
} from './attachments.ts';
export type AttachmentMotor = {
    position: number;
    velocity: number;
    command: number;
    target: number | null;
};
const rad = Math.PI / 180;
const cap = (x: number, n: number) => Math.max(-n, Math.min(n, x));
const wrap = (a: number) => (((a % 360) + 540) % 360) - 180;
type Joint = {
    config: ToolConfig;
    parts: ToolPart[];
    body: Body;
    hinge: HingeConstraint;
    center: Vec3;
    pivot: Vec3;
    mount: Quaternion;
    angle: number;
    hold: number;
    previous: number;
    integral: number;
};
export class AttachmentPhysics {
    joints = new Map<string, Joint>();
    private chassis: Body;
    constructor(world: World, chassis: Body, material: Material, tools: Attachments) {
        this.chassis = chassis;
        validateAttachments(tools);
        for (const [port, config] of Object.entries(tools)) {
            const parts = toolParts(config);
            if (!parts.length) continue;
            const center = new Vec3();
            let volume = 0;
            for (const p of parts) {
                const v = p.size.reduce((a, b) => a * b, 1);
                center.vadd(new Vec3(...p.position).scale(v / 1000), center);
                volume += v;
            }
            center.scale(1 / volume, center);
            const pivot = new Vec3(
                config.side / 1000,
                (config.height - 60) / 1000,
                -config.forward / 1000
            );
            const mount = new Quaternion();
            mount.setFromAxisAngle(new Vec3(0, 1, 0), config.facing === 'rear' ? Math.PI : 0);
            const rest = new Quaternion();
            rest.setFromAxisAngle(new Vec3(1, 0, 0), config.initial * rad);
            const orientation = chassis.quaternion.mult(mount).mult(rest);
            const position = chassis.pointToWorldFrame(pivot).vadd(orientation.vmult(center));
            const body = new Body({
                mass: config.mass,
                material,
                position,
                quaternion: orientation,
                collisionFilterGroup: 8,
                collisionFilterMask: 3,
                linearDamping: 0.04,
                angularDamping: 0.08
            });
            for (const p of parts) {
                const q = new Quaternion();
                q.setFromAxisAngle(new Vec3(1, 0, 0), p.angle);
                body.addShape(
                    new Box(new Vec3(...(p.size.map((n) => n / 2000) as [number, number, number]))),
                    new Vec3(...(p.position.map((n) => n / 1000) as [number, number, number])).vsub(
                        center
                    ),
                    q
                );
            }
            world.addBody(body);
            const hinge = new HingeConstraint(chassis, body, {
                pivotA: pivot,
                pivotB: center.negate(),
                axisA: mount.vmult(new Vec3(1, 0, 0)),
                axisB: new Vec3(1, 0, 0),
                collideConnected: false
            });
            hinge.enableMotor();
            hinge.setMotorMaxForce(config.torque * config.ratio * 0.8);
            world.addConstraint(hinge);
            this.joints.set(port, {
                config,
                parts,
                body,
                hinge,
                center,
                pivot,
                mount,
                angle: config.initial,
                hold: config.initial,
                previous: config.initial,
                integral: 0
            });
        }
    }
    has(port: string) {
        return this.joints.has(port);
    }
    bodies() {
        return [...this.joints.values()].map((j) => j.body);
    }
    before(motors: Record<string, AttachmentMotor>, dt: number) {
        for (const [port, j] of this.joints) {
            const m = motors[port];
            if (!m) continue;
            const c = j.config;
            const wanted = m.target === null ? null : c.initial + m.target / (c.ratio * c.polarity);
            const error = (wanted ?? j.hold) - j.angle;
            // Integral action offsets gravity-induced steady error, while the hinge still
            // enforces finite torque. Clamp accumulation near a target to avoid stall wind-up.
            if (wanted !== null || !m.command)
                j.integral = cap(j.integral + (Math.abs(error) < 8 ? error * dt * 12 : 0), 30);
            else j.integral = 0;
            let speed =
                wanted === null
                    ? m.command / (c.ratio * c.polarity) || cap(error * 12 + j.integral, 180)
                    : cap(error * 12 + j.integral, Math.abs(m.command) / c.ratio);
            if (m.command) j.hold = j.angle;
            if ((j.angle <= c.min + 0.05 && speed < 0) || (j.angle >= c.max - 0.05 && speed > 0)) {
                speed = 0;
                j.integral = 0;
            }
            j.hinge.setMotorSpeed(-speed * rad);
        }
    }
    after(dt: number, motors: Record<string, AttachmentMotor>) {
        for (const [port, j] of this.joints) {
            const m = motors[port];
            if (!m) continue;
            const base = this.chassis.quaternion.mult(j.mount);
            const rel = base.inverse().mult(j.body.quaternion);
            j.angle += wrap((2 * Math.atan2(rel.x, rel.w)) / rad - j.angle);
            const c = j.config,
                bounded = Math.max(c.min, Math.min(c.max, j.angle));
            if (bounded !== j.angle) {
                // Mechanical travel stop: constrain the joint, not the robot's world pose.
                j.angle = bounded;
                const q = new Quaternion();
                q.setFromAxisAngle(new Vec3(1, 0, 0), j.angle * rad);
                j.body.quaternion.copy(base.mult(q));
                j.body.position.copy(
                    this.chassis.pointToWorldFrame(j.pivot).vadd(j.body.quaternion.vmult(j.center))
                );
                j.body.angularVelocity.copy(this.chassis.angularVelocity);
                j.body.velocity.copy(this.chassis.velocity);
                j.body.aabbNeedsUpdate = true;
            }
            m.position = (j.angle - c.initial) * c.ratio * c.polarity;
            m.velocity = ((j.angle - j.previous) / dt) * c.ratio * c.polarity;
            j.previous = j.angle;
            if (
                m.target !== null &&
                Math.abs(m.target - m.position) < 1 &&
                Math.abs(m.velocity) < 10
            ) {
                m.command = 0;
                m.target = null;
                j.hold = j.angle;
            }
        }
    }
    snapshot(): Part[] {
        return [...this.joints].flatMap(([port, j]) => {
            const parts: Part[] = j.parts.map((p) => {
                const q = new Quaternion();
                q.setFromAxisAngle(new Vec3(1, 0, 0), p.angle);
                return {
                    id: `attachment-${port}-${p.id}`,
                    size: p.size,
                    color: p.color,
                    appearance: p.appearance,
                    shape: 'box' as const,
                    position: j.body
                        .pointToWorldFrame(
                            new Vec3(
                                ...(p.position.map((n) => n / 1000) as [number, number, number])
                            ).vsub(j.center)
                        )
                        .scale(1000)
                        .toArray(),
                    quaternion: j.body.quaternion.mult(q).toArray()
                };
            });
            if (j.config.kind === 'lift' || j.config.kind === 'dozer') {
                parts.push({
                    id: `attachment-${port}-mount`,
                    size: [j.config.kind === 'dozer' ? 48 : 32, 32, 36],
                    color: '#343c40',
                    shape: 'box',
                    appearance: 'mount',
                    decorative: true,
                    hingeAngle: j.angle,
                    position: this.chassis.pointToWorldFrame(j.pivot).scale(1000).toArray(),
                    quaternion: this.chassis.quaternion.mult(j.mount).toArray()
                });
            }
            return parts;
        });
    }
}
