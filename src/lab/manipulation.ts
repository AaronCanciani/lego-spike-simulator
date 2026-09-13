import {
    Body,
    Box,
    ContactMaterial,
    GSSolver,
    Material,
    RaycastResult,
    Vec3,
    World
} from 'cannon-es';
import { raycast, type Pose } from './sensors.ts';

// Original teaching fixture. SI units internally; the rest of SPIKE Lab uses mm.
// This is a linear carriage, NOT a reconstruction of a LEGO attachment.
export const liftStart = { x: 0, y: -360, heading: 0 };
export const cargoPickup = { x: 0, y: -85 };
export const deliveryZone = { x: 0, y: 160, width: 210, depth: 180 };
export const cubeParts = [
    { size: [60, 50, 60], offset: [0, 4, 0] },
    ...[-1, 1].flatMap((x) =>
        [-1, 1].map((z) => ({ size: [10, 12, 10], offset: [x * 25, -27, z * 25] }))
    )
];
export const forkParts = (length = 110) => [
    { size: [8, 4, length], offset: [-12, 0, -90 - length / 2] },
    { size: [8, 4, length], offset: [12, 0, -90 - length / 2] },
    { size: [46, 14, 8], offset: [0, 7, -94] }
];
export type LiftConfig = {
    mass: number;
    friction: number;
    maxLiftForce: number;
    mmPerDegree: number;
    forkLength: number;
};
export const defaultLift: LiftConfig = {
    mass: 0.08,
    friction: 0.45,
    maxLiftForce: 4,
    mmPerDegree: 0.35,
    forkLength: 110
};
type Motor = { position: number; velocity: number; command: number; target: number | null };
const limit = (n: number, max: number) => Math.max(-max, Math.min(max, n));
const box = (size: number[]) =>
    new Box(new Vec3(...(size.map((n) => n / 2000) as [number, number, number])));
const vector = (v: number[]) => new Vec3(...(v.map((n) => n / 1000) as [number, number, number]));

// cannon-es 0.20 GSSolver clamps lambda (impulse) directly to min/maxForce.
// Give its friction equations an impulse budget mu*m*g*dt, shared across the
// manifold, so changing timestep/contact count doesn't create sticky cargo.
// Normal load is a resting-weight approximation, not a tire/contact load model.
export class CargoSolver extends GSSolver {
    friction: number;
    constructor(friction: number) {
        super();
        this.friction = friction;
        this.iterations = 30;
    }
    solve(dt: number, world: World) {
        const key = (e: { bi: Body; bj: Body }) =>
            [e.bi.id, e.bj.id].sort((a, b) => a - b).join(':');
        const counts = new Map<string, number>();
        for (const e of world.frictionEquations) counts.set(key(e), (counts.get(key(e)) ?? 0) + 1);
        for (const e of world.frictionEquations) {
            const mass = Math.min(e.bi.mass || Infinity, e.bj.mass || Infinity);
            const impulse = (this.friction * mass * 9.81 * dt) / (counts.get(key(e))! / 2);
            e.maxForce = impulse;
            e.minForce = -impulse;
        }
        return super.solve(dt, world);
    }
}

export class ManipulationWorld {
    world = new World({ gravity: new Vec3(0, -9.81, 0), allowSleep: false });
    chassis: Body;
    fork: Body;
    cube: Body;
    config: LiftConfig;
    private hold = 0.004;
    private restTime = 0;
    private heading = 0;
    private liftIntegral = 0;
    stalled = false;
    delivered = false;
    contact = false;
    constructor(start: Pose = liftStart, config: LiftConfig = defaultLift) {
        this.config = { ...config };
        if (
            !Object.values(config).every(Number.isFinite) ||
            config.mass < 0.01 ||
            config.mass > 2 ||
            config.friction < 0 ||
            config.friction > 1.5 ||
            config.maxLiftForce < 0.2 ||
            config.maxLiftForce > 20 ||
            config.mmPerDegree < 0.05 ||
            config.mmPerDegree > 2 ||
            config.forkLength < 40 ||
            config.forkLength > 180
        )
            throw new Error(
                'Check the attachment mass, friction, force, fork length and gearing settings.'
            );
        this.world.solver = new CargoSolver(config.friction);
        const material = new Material('teaching surfaces');
        this.world.addContactMaterial(
            new ContactMaterial(material, material, {
                friction: config.friction,
                restitution: 0,
                contactEquationStiffness: 1e7,
                contactEquationRelaxation: 4,
                frictionEquationStiffness: 1e7
            })
        );
        const floor = new Body({
            mass: 0,
            shape: box([2362, 20, 1143]),
            position: new Vec3(0, -0.01, 0),
            material,
            collisionFilterGroup: 1
        });
        this.world.addBody(floor);
        for (const [size, pos] of [
            [
                [20, 200, 1183],
                [-1191, 100, 0]
            ],
            [
                [20, 200, 1183],
                [1191, 100, 0]
            ],
            [
                [2402, 200, 20],
                [0, 100, -581.5]
            ],
            [
                [2402, 200, 20],
                [0, 100, 581.5]
            ]
        ])
            this.world.addBody(
                new Body({
                    mass: 0,
                    shape: box(size),
                    position: vector(pos),
                    material,
                    collisionFilterGroup: 1
                })
            );
        this.chassis = new Body({
            mass: 1.2,
            shape: box([190, 90, 180]),
            position: new Vec3(start.x / 1000, 0.06, -start.y / 1000),
            material,
            linearFactor: new Vec3(1, 0, 1),
            angularFactor: new Vec3(0, 1, 0),
            collisionFilterGroup: 4,
            collisionFilterMask: 3
        });
        this.chassis.quaternion.setFromAxisAngle(
            new Vec3(0, 1, 0),
            (-start.heading * Math.PI) / 180
        );
        this.chassis.invInertia.x = 0;
        this.chassis.invInertia.z = 0;
        this.chassis.updateInertiaWorld(true);
        this.heading = start.heading;
        this.world.addBody(this.chassis);
        this.cube = new Body({
            mass: config.mass,
            position: new Vec3(cargoPickup.x / 1000, 0.033, -cargoPickup.y / 1000),
            material,
            collisionFilterGroup: 2
        });
        for (const part of cubeParts) this.cube.addShape(box(part.size), vector(part.offset));
        this.world.addBody(this.cube);
        this.fork = new Body({
            mass: 0.12,
            fixedRotation: true,
            position: new Vec3(start.x / 1000, 0.004, -start.y / 1000),
            material,
            linearFactor: new Vec3(0, 1, 0),
            angularFactor: new Vec3(0, 0, 0),
            collisionFilterGroup: 8,
            collisionFilterMask: 3
        });
        this.fork.quaternion.copy(this.chassis.quaternion);
        for (const part of forkParts(config.forkLength))
            this.fork.addShape(box(part.size), vector(part.offset));
        this.world.addBody(this.fork);
    }
    step(dt: number, vx: number, vy: number, angular: number, motor: Motor) {
        // Finite planar traction servo. Wheel encoders can keep turning against an obstacle.
        const c = this.chassis;
        c.force.set(
            limit((vx / 1000 - c.velocity.x) * 30, 8),
            0,
            limit((-vy / 1000 - c.velocity.z) * 30, 8)
        );
        c.torque.y = limit((-angular - c.angularVelocity.y) * 0.12, 0.15);
        // First-stage carriage guide: horizontal/yaw motion is prescribed from the chassis.
        // Vertical lift is dynamic and force-limited. Lateral tool loads do not feed back yet.
        this.fork.position.x = c.position.x;
        this.fork.position.z = c.position.z;
        this.fork.velocity.x = c.velocity.x;
        this.fork.velocity.z = c.velocity.z;
        this.fork.quaternion.copy(c.quaternion);
        this.fork.angularVelocity.set(0, c.angularVelocity.y, 0);
        this.fork.aabbNeedsUpdate = true;
        const scale = this.config.mmPerDegree / 1000;
        const position = (this.fork.position.y - 0.004) / scale;
        let desiredVelocity = motor.command * scale;
        if (motor.target !== null)
            desiredVelocity = limit(
                (motor.target - position) * scale * 12,
                Math.abs(desiredVelocity)
            );
        if (motor.command === 0)
            desiredVelocity = limit((this.hold - this.fork.position.y) * 20, 0.15);
        else this.hold = this.fork.position.y;
        if (
            (this.fork.position.y <= 0.004 && desiredVelocity < 0) ||
            (this.fork.position.y >= 0.144 && desiredVelocity > 0)
        )
            desiredVelocity = 0;
        const velocityError = desiredVelocity - this.fork.velocity.y;
        this.liftIntegral = limit(
            this.liftIntegral + velocityError * dt * 100,
            this.config.maxLiftForce
        );
        this.fork.force.y = limit(
            velocityError * 15 + this.liftIntegral + this.fork.mass * 9.81,
            this.config.maxLiftForce
        );
        this.world.step(dt);
        // Hard carriage travel stops. No teleporting the payload or attaching it to the robot.
        if (this.fork.position.y < 0.004 || this.fork.position.y > 0.144) {
            this.fork.position.y = Math.max(0.004, Math.min(0.144, this.fork.position.y));
            this.fork.velocity.y = 0;
        }
        motor.position = (this.fork.position.y - 0.004) / scale;
        motor.velocity = this.fork.velocity.y / scale;
        this.stalled = Math.abs(motor.command) > 10 && Math.abs(motor.velocity) < 3;
        if (
            motor.target !== null &&
            Math.abs(motor.target - motor.position) < 1 &&
            Math.abs(motor.velocity) < 15
        ) {
            motor.target = null;
            motor.command = 0;
            this.hold = this.fork.position.y;
        }
        const q = c.quaternion;
        const actualHeading =
            (-Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.z * q.z)) * 180) /
            Math.PI;
        const difference = actualHeading - this.heading;
        this.heading += (((difference % 360) + 540) % 360) - 180;
        this.contact = this.world.contacts.some((e) => e.bi === c || e.bj === c);
        this.cube.updateAABB();
        const { lowerBound: lo, upperBound: hi } = this.cube.aabb;
        const inside =
            lo.x * 1000 >= deliveryZone.x - deliveryZone.width / 2 &&
            hi.x * 1000 <= deliveryZone.x + deliveryZone.width / 2 &&
            -hi.z * 1000 >= deliveryZone.y - deliveryZone.depth / 2 &&
            -lo.z * 1000 <= deliveryZone.y + deliveryZone.depth / 2;
        const onFloor = this.world.contacts.some(
            (e) =>
                (e.bi === this.cube && e.bj.collisionFilterGroup === 1) ||
                (e.bj === this.cube && e.bi.collisionFilterGroup === 1)
        );
        const onFork = this.world.contacts.some(
            (e) =>
                (e.bi === this.cube && e.bj === this.fork) ||
                (e.bj === this.cube && e.bi === this.fork)
        );
        this.restTime =
            inside &&
            onFloor &&
            !onFork &&
            this.cube.velocity.length() < 0.015 &&
            this.cube.angularVelocity.length() < 0.1
                ? this.restTime + dt
                : 0;
        this.delivered = this.restTime >= 0.5;
        return { x: c.position.x * 1000, y: -c.position.z * 1000, heading: this.heading };
    }
    ray(x: number, y: number, heading: number, height: number) {
        const wall = raycast(x, y, heading);
        const angle = (heading * Math.PI) / 180;
        const from = new Vec3(x / 1000, height / 1000, -y / 1000);
        const to = new Vec3(from.x + 3 * Math.sin(angle), from.y, from.z - 3 * Math.cos(angle));
        const result = new RaycastResult();
        this.world.raycastClosest(
            from,
            to,
            { collisionFilterMask: 2, skipBackfaces: false },
            result
        );
        return result.hasHit && result.distance * 1000 < wall.distance
            ? {
                  distance: result.distance * 1000,
                  incidence: Math.abs(
                      result.hitNormalWorld.x * Math.sin(angle) -
                          result.hitNormalWorld.z * Math.cos(angle)
                  )
              }
            : wall;
    }
    snapshot() {
        const state = (b: Body) => ({
            position: b.position.toArray().map((n) => n * 1000),
            quaternion: b.quaternion.toArray()
        });
        return {
            cube: state(this.cube),
            fork: state(this.fork),
            config: { ...this.config },
            height: this.fork.position.y * 1000 - 4,
            stalled: this.stalled,
            delivered: this.delivered,
            lifted: this.cube.position.y > 0.058
        };
    }
}
export type ManipulationSnapshot = ReturnType<ManipulationWorld['snapshot']>;
