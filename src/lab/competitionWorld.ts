import {
    Body,
    Box,
    Cylinder,
    ContactMaterial,
    HingeConstraint,
    Material,
    Quaternion,
    RaycastResult,
    Vec3,
    World
} from 'cannon-es';
import { CargoSolver } from './manipulation.ts';
import type { MissionDefinition } from './missionCatalog.ts';
import type { Pose } from './sensors.ts';

type Motor = { position: number; velocity: number; command: number; target: number | null };
export type Part = {
    id: string;
    size: number[];
    color: string;
    shape: 'box' | 'tire' | 'cart';
    position: number[];
    quaternion: number[];
};
type Item = { body: Body; size: number[]; color: string; shape: Part['shape'] };
type Slider = {
    item: Item;
    origin: Vec3;
    axis: Vec3;
    travel: number;
    spring: number;
    pressed: boolean;
    count: number;
    touched: boolean;
};
const cap = (v: number, n: number) => Math.max(-n, Math.min(n, v));
const box = (v: number[]) => new Box(new Vec3(v[0] / 2000, v[1] / 2000, v[2] / 2000));
const rad = Math.PI / 180;
const wrap = (a: number) => (((a % 360) + 540) % 360) - 180;

// SI physics. Every visible solid is a collider; colored target rings are assessment overlays.
// These are ORIGINAL functional teaching proxies, not brick-accurate FLL mission mechanisms.
export class CompetitionWorld {
    world = new World({ gravity: new Vec3(0, -9.81, 0), allowSleep: false });
    material = new Material('mission surfaces');
    chassis: Body;
    arm: Body;
    hinge: HingeConstraint;
    items = new Map<string, Item>();
    sliders: Slider[] = [];
    mission: MissionDefinition;
    contact = false;
    complete = false;
    failed = '';
    progress = 0;
    message = 'Reach the mission and interact with the solid model.';
    elapsed = 0;
    private heading: number;
    private armAngle = 0;
    private armHold = 0;
    private released = new Set<string>();
    private dwell = 0;
    private wallSquared = false;
    private wallX = 0;
    private payloadOrigins = new Map<string, Vec3>();
    constructor(mission: MissionDefinition, start: Pose, friction = 0.45) {
        this.mission = structuredClone(mission);
        this.heading = start.heading;
        this.world.solver = new CargoSolver(friction);
        this.world.addContactMaterial(
            new ContactMaterial(this.material, this.material, {
                friction,
                restitution: 0,
                contactEquationStiffness: 1e7,
                contactEquationRelaxation: 4
            })
        );
        this.solid('floor', [2362, 20, 1143], [0, -10, 0], '#344252', 0, 1);
        for (const [id, size, pos] of [
            ['south', [2414, 78, 26], [0, 39, 584.5]],
            ['north', [2414, 78, 26], [0, 39, -584.5]],
            ['west', [26, 78, 1143], [-1194, 39, 0]],
            ['east', [26, 78, 1143], [1194, 39, 0]]
        ] as [string, number[], number[]][])
            this.solid(id, size, pos, '#536276', 0, 1);
        this.chassis = new Body({
            mass: 1.2,
            shape: box([190, 90, 180]),
            material: this.material,
            position: new Vec3(start.x / 1000, 0.06, -start.y / 1000),
            linearFactor: new Vec3(1, 0, 1),
            angularFactor: new Vec3(0, 1, 0),
            collisionFilterGroup: 4,
            collisionFilterMask: 3
        });
        this.chassis.quaternion.setFromAxisAngle(new Vec3(0, 1, 0), -start.heading * rad);
        this.world.addBody(this.chassis);
        // One finite-torque C lift paddle. Hinge constraints transfer loads to the chassis.
        const armPos = this.chassis.pointToWorldFrame(new Vec3(0, -0.035, -0.15));
        this.arm = this.solid(
            'arm-C',
            [80, 8, 120],
            armPos.scale(1000).toArray(),
            '#ffc84a',
            0.12,
            8
        ).body;
        this.arm.collisionFilterMask = 3;
        this.arm.quaternion.copy(this.chassis.quaternion);
        this.hinge = new HingeConstraint(this.chassis, this.arm, {
            pivotA: new Vec3(0, -0.035, -0.09),
            pivotB: new Vec3(0, 0, 0.06),
            axisA: new Vec3(1, 0, 0),
            axisB: new Vec3(1, 0, 0),
            collideConnected: false
        });
        this.hinge.enableMotor();
        this.hinge.setMotorMaxForce(0.35);
        this.world.addConstraint(this.hinge);
        this.build();
    }
    private solid(
        id: string,
        size: number[],
        position: number[],
        color: string,
        mass = 0,
        group = 2,
        shape: 'box' | 'tire' = 'box'
    ) {
        const body = new Body({
            mass,
            material: this.material,
            position: new Vec3(...(position.map((n) => n / 1000) as [number, number, number])),
            shape:
                shape === 'tire'
                    ? new Cylinder(size[0] / 2000, size[0] / 2000, size[1] / 1000, 24)
                    : box(size),
            collisionFilterGroup: group,
            linearDamping: 0.04,
            angularDamping: 0.08
        });
        const item: Item = { body, size, color, shape };
        this.items.set(id, item);
        this.world.addBody(body);
        return item;
    }
    private payload(
        id: string,
        x: number,
        y: number,
        color: string,
        height = 25,
        size = [45, 45, 45]
    ) {
        const item = this.solid(id, size, [x, height, -y], color, 0.08);
        this.payloadOrigins.set(id, item.body.position.clone());
        return item;
    }
    private slider(
        id: string,
        x: number,
        y: number,
        color: string,
        travel = 55,
        axis = new Vec3(0, 0, -1),
        spring = 12
    ) {
        const item = this.solid(id, [85, 45, 24], [x, 24, -y], color, 0.12);
        item.body.linearFactor.set(Math.abs(axis.x), 0, Math.abs(axis.z));
        item.body.angularFactor.set(0, 0, 0);
        const slider = {
            item,
            origin: item.body.position.clone(),
            axis,
            travel: travel / 1000,
            spring,
            pressed: false,
            count: 0,
            touched: false
        };
        this.sliders.push(slider);
        return slider;
    }
    private build() {
        const {
            kind,
            target: { x, y }
        } = this.mission;
        if (kind === 'wall') return;
        if (kind === 'build') {
            this.payload('building-red', -710, -200, '#dc3047');
            return;
        }
        if (kind === 'solar') {
            for (let i = 0; i < 3; i++) this.payload(`energy-${i}`, x + (i - 1) * 90, y, '#f5c82f');
            return;
        }
        if (kind === 'tire') {
            const tire = this.solid(
                'heavy-tire',
                [90, 25, 90],
                [x, 14, -y],
                '#202d36',
                0.18,
                2,
                'tire'
            );
            tire.body.quaternion.setFromAxisAngle(new Vec3(1, 0, 0), Math.PI);
            return;
        }
        if (kind === 'dock') {
            this.payload('vessel', x, y, '#e8f0f5', 31, [85, 60, 160]);
            this.solid('dock-left', [20, 60, 200], [x - 65, 30, -y - 70], '#25b9b3');
            this.solid('dock-right', [20, 60, 200], [x + 65, 30, -y - 70], '#25b9b3');
            this.slider('dock-latch', x, y + 175, '#ffd048', 15, new Vec3(0, 0, -1), 0);
            return;
        }
        if (kind === 'step') {
            this.slider('counter', x, y, '#39c79f', 230, new Vec3(1, 0, 0), 0);
            this.solid('rail', [330, 8, 18], [x + 110, 4, -y + 35], '#dfe8f0');
            return;
        }
        if (kind === 'boccia') {
            for (const [i, color] of ['#ec4769', '#3a8eff'].entries()) {
                this.slider(`release-${i}`, x + (i - 0.5) * 120, y, color);
                this.payload(`cube-${i}`, x + (i - 0.5) * 120, y + 65, color, 125);
                this.solid(
                    `shelf-${i}`,
                    [60, 10, 60],
                    [x + (i - 0.5) * 120, 97, -y - 65],
                    '#71839b'
                );
            }
            return;
        }
        this.slider(
            'activator',
            x,
            y,
            kind === 'crane' ? '#4692ff' : kind === 'screens' ? '#b091ef' : '#ed4a56'
        );
        if (kind === 'crane') {
            this.solid('rack', [75, 10, 65], [x, 130, -y - 80], '#5a6e83');
            this.payload('blue-unit', x, y + 80, '#3b8bef', 159);
            this.solid('tower', [20, 160, 20], [x + 65, 80, -y - 80], '#ffc743');
        } else if (kind === 'wind') {
            for (let i = 0; i < 3; i++) {
                this.payload(`energy-${i}`, x + (i - 1) * 55, y + 100, '#ffd048', 125);
                this.solid(`shelf-${i}`, [50, 10, 50], [x + (i - 1) * 55, 97, -y - 100], '#63748d');
            }
            this.solid('mast', [20, 210, 20], [x + 110, 105, -y - 100], '#edf2f7');
        } else if (kind === 'screens') {
            for (let i = 0; i < 3; i++)
                this.solid(`screen-${i}`, [55, 8, 75], [x + (i - 1) * 65, 7, -y - 85], '#ad89ed');
        } else if (kind === 'space') {
            const ramp = this.solid('ramp', [310, 12, 90], [x + 160, 45, -y - 110], '#9babc0');
            ramp.body.quaternion.setFromAxisAngle(new Vec3(0, 0, 1), -0.18);
            const cart = this.payload('cart', x + 45, y + 110, '#fcaa3c', 92, [55, 40, 50]);
            // Rolling cart proxy: two rigidly connected wheels, not independent axles.
            cart.shape = 'cart';
            cart.body.shapes.forEach((shape) => cart.body.removeShape(shape));
            const wheelRotation = new Quaternion();
            wheelRotation.setFromAxisAngle(new Vec3(1, 0, 0), Math.PI / 2);
            cart.body.addShape(
                new Cylinder(0.023, 0.023, 0.008, 20),
                new Vec3(0, -0.005, -0.021),
                wheelRotation
            );
            cart.body.addShape(
                new Cylinder(0.023, 0.023, 0.008, 20),
                new Vec3(0, -0.005, 0.021),
                wheelRotation
            );
            this.solid('cart-stop', [10, 90, 95], [x + 80, 70, -y - 110], '#ea5274');
        }
    }
    private touching(a: Body, b?: Body) {
        return this.world.contacts.some(
            (e) => (e.bi === a && (!b || e.bj === b)) || (e.bj === a && (!b || e.bi === b))
        );
    }
    private remove(id: string) {
        const item = this.items.get(id);
        if (!item) return;
        this.world.removeBody(item.body);
        this.items.delete(id);
    }
    private release(id: string) {
        if (this.released.has(id)) return;
        this.released.add(id);
        if (id === 'activator') {
            if (this.mission.kind === 'crane') this.remove('rack');
            if (this.mission.kind === 'space') this.remove('cart-stop');
            if (this.mission.kind === 'screens') {
                for (let i = 0; i < 3; i++) {
                    const b = this.items.get(`screen-${i}`)!.body;
                    b.position.y = 0.044;
                    b.quaternion.setFromAxisAngle(new Vec3(1, 0, 0), Math.PI / 2);
                    b.aabbNeedsUpdate = true;
                }
            }
        }
        if (id.startsWith('release-')) {
            const i = id.slice(-1);
            this.remove(`shelf-${i}`);
            // Stored-energy launcher approximation, triggered ONLY by physical plate travel.
            this.items.get(`cube-${i}`)!.body.velocity.set(0, 0.8, -1.5);
        }
    }
    step(dt: number, vx: number, vy: number, angular: number, motor: Motor) {
        this.elapsed += dt;
        const c = this.chassis;
        c.force.set(
            cap((vx / 1000 - c.velocity.x) * 30, 8),
            0,
            cap((-vy / 1000 - c.velocity.z) * 30, 8)
        );
        c.torque.y = cap((-angular - c.angularVelocity.y) * 0.08, 0.12);
        const requested =
            motor.target !== null
                ? cap((motor.target - this.armAngle) * 8, Math.abs(motor.command))
                : motor.command || cap((this.armHold - this.armAngle) * 8, 180);
        if (motor.command) this.armHold = this.armAngle;
        this.hinge.setMotorSpeed(-requested * rad);
        for (const s of this.sliders) {
            const d = s.item.body.position.vsub(s.origin).dot(s.axis);
            s.item.body.force.vadd(s.axis.scale(-Math.max(0, d) * s.spring), s.item.body.force);
        }
        this.world.step(dt);
        const relative = c.quaternion.inverse().mult(this.arm.quaternion);
        const rawAngle = (2 * Math.atan2(relative.x, relative.w)) / rad;
        const change = wrap(rawAngle - this.armAngle);
        this.armAngle += change;
        motor.position = this.armAngle;
        motor.velocity = change / dt;
        if (
            motor.target !== null &&
            Math.abs(motor.target - motor.position) < 1 &&
            Math.abs(motor.velocity) < 10
        ) {
            motor.command = 0;
            motor.target = null;
            this.armHold = this.armAngle;
        }
        const q = c.quaternion;
        const rawHeading =
            -Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.z * q.z)) / rad;
        this.heading += wrap(rawHeading - this.heading);
        this.contact = this.world.contacts.some(
            (e) => (e.bi === c || e.bj === c) && e.bi !== this.arm && e.bj !== this.arm
        );
        for (const s of this.sliders) {
            const b = s.item.body;
            let d = b.position.vsub(s.origin).dot(s.axis);
            const touching =
                this.touching(b, c) ||
                this.touching(b, this.arm) ||
                (this.mission.kind === 'dock' && this.touching(b, this.items.get('vessel')!.body));
            if (touching) s.touched = true;
            if (d < 0 || d > s.travel) {
                d = Math.max(0, Math.min(s.travel, d));
                s.origin.vadd(s.axis.scale(d), b.position);
                b.velocity.set(0, 0, 0);
                b.aabbNeedsUpdate = true;
            }
            if (d > s.travel * 0.65 && !s.pressed && s.touched) {
                s.pressed = true;
                s.count++;
                const id = [...this.items].find(([, v]) => v === s.item)![0];
                this.release(id);
                if (this.mission.kind === 'wind' && s.count <= 3)
                    this.remove(`shelf-${s.count - 1}`);
            }
            if (d < s.travel * 0.15) {
                s.pressed = false;
                s.touched = false;
            }
        }
        this.assess(dt);
        return { x: c.position.x * 1000, y: -c.position.z * 1000, heading: this.heading };
    }
    private resting(id: string) {
        const b = this.items.get(id)!.body;
        return (
            this.touching(b, this.items.get('floor')!.body) &&
            !this.touching(b, this.chassis) &&
            !this.touching(b, this.arm) &&
            b.velocity.length() < 0.02 &&
            b.angularVelocity.length() < 0.15
        );
    }
    private contained(id: string, x: number, y: number, width: number, depth: number) {
        const b = this.items.get(id)!.body;
        b.updateAABB();
        const lo = b.aabb.lowerBound,
            hi = b.aabb.upperBound;
        return (
            lo.x * 1000 >= x - width / 2 &&
            hi.x * 1000 <= x + width / 2 &&
            -hi.z * 1000 >= y - depth / 2 &&
            -lo.z * 1000 <= y + depth / 2
        );
    }
    private inCircle(id: string, x: number, y: number, radius: number) {
        const b = this.items.get(id)!.body;
        b.updateAABB();
        const lo = b.aabb.lowerBound,
            hi = b.aabb.upperBound;
        return [lo.x, hi.x].every((px) =>
            [lo.z, hi.z].every((pz) => Math.hypot(px * 1000 - x, -pz * 1000 - y) <= radius)
        );
    }
    private assess(dt: number) {
        const {
            kind,
            target: { x, y }
        } = this.mission;
        let success = false;
        this.progress = 0;
        if (kind === 'crane') {
            success = this.released.has('activator') && this.resting('blue-unit');
            this.progress = this.released.has('activator') ? 0.8 : 0;
        } else if (kind === 'boccia') {
            if (this.released.size > 1)
                this.failed = 'Both cubes were released. Choose just one plate.';
            const sent = [0, 1].filter(
                (i) => -this.items.get(`cube-${i}`)!.body.position.z > 0.585
            );
            success = !this.failed && this.released.size === 1 && sent.length === 1;
            this.progress = this.released.size === 1 ? 0.5 : 0;
        } else if (kind === 'step') {
            this.progress = Math.min(
                1,
                this.sliders[0].item.body.position
                    .vsub(this.sliders[0].origin)
                    .dot(this.sliders[0].axis) / 0.15
            );
            success = this.progress >= 1 && this.sliders[0].touched;
        } else if (kind === 'wind') {
            const n = [0, 1, 2].filter(
                (i) => this.items.get(`energy-${i}`)!.body.position.y < 0.06
            ).length;
            this.progress = n / 3;
            success = n === 3 && this.sliders[0].count >= 3;
        } else if (kind === 'screens') {
            const touching = [...this.items.entries()]
                .filter(([id]) => id === 'activator' || id.startsWith('screen'))
                .some(
                    ([, item]) =>
                        this.touching(item.body, this.chassis) || this.touching(item.body, this.arm)
                );
            this.progress = this.released.has('activator') ? 0.8 : 0;
            success = this.released.has('activator') && !touching;
        } else if (kind === 'solar') {
            let n = 0;
            for (const [id, origin] of this.payloadOrigins) {
                const b = this.items.get(id)!.body;
                if (Math.hypot(b.position.x - origin.x, b.position.z - origin.z) > 0.065) n++;
            }
            this.progress = n / 3;
            success = n === 3;
        } else if (kind === 'build') {
            success = this.inCircle('building-red', x, y, 70) && this.resting('building-red');
        } else if (kind === 'tire') {
            const b = this.items.get('heavy-tire')!.body;
            b.updateAABB();
            if (b.aabb.lowerBound.x < 0.36) this.failed = 'The heavy tire crossed the red limit.';
            success =
                !this.failed &&
                b.quaternion.vmult(new Vec3(0, 1, 0)).y > 0.85 &&
                this.inCircle('heavy-tire', x, y - 120, 90) &&
                this.resting('heavy-tire');
        } else if (kind === 'dock') {
            success =
                this.sliders[0].count > 0 &&
                this.contained('vessel', x, y + 100, 110, 190) &&
                this.resting('vessel');
        } else if (kind === 'space') {
            success =
                this.released.has('activator') &&
                this.items.get('cart')!.body.position.x * 1000 > x + 280;
        } else if (kind === 'wall') {
            const c = this.chassis;
            if (
                this.touching(c, this.items.get('south')!.body) &&
                Math.abs(wrap(this.heading)) < 3
            ) {
                this.wallSquared = true;
                this.wallX = c.position.x;
            }
            this.progress = this.wallSquared ? 0.5 : 0;
            success =
                this.wallSquared &&
                -c.position.z * 1000 > -375 &&
                Math.abs(wrap(this.heading)) < 3 &&
                Math.abs(c.position.x - this.wallX) < 0.03;
        }
        this.dwell = success ? this.dwell + dt : 0;
        this.complete = this.dwell >= 0.3 && !this.failed;
        if (this.complete) this.progress = 1;
        this.message =
            this.failed ||
            (this.complete
                ? 'Teaching objective complete'
                : this.progress > 0
                  ? 'Making progress — finish the objective'
                  : this.elapsed > 0
                    ? 'Objective not complete yet'
                    : this.message);
    }
    ray(x: number, y: number, heading: number, height: number) {
        const a = heading * rad;
        const from = new Vec3(x / 1000, height / 1000, -y / 1000);
        const to = from.vadd(new Vec3(Math.sin(a) * 3, 0, -Math.cos(a) * 3));
        const result = new RaycastResult();
        this.world.raycastClosest(
            from,
            to,
            { collisionFilterMask: 3, skipBackfaces: false },
            result
        );
        return result.hasHit
            ? {
                  distance: result.distance * 1000,
                  incidence: Math.abs(
                      result.hitNormalWorld.x * Math.sin(a) - result.hitNormalWorld.z * Math.cos(a)
                  )
              }
            : { distance: Infinity, incidence: 0 };
    }
    snapshot() {
        return {
            id: this.mission.id,
            complete: this.complete,
            failed: this.failed,
            progress: this.progress,
            message: this.message,
            parts: [...this.items]
                .filter(([id]) => !['floor', 'north', 'south', 'west', 'east'].includes(id))
                .map(
                    ([id, item]): Part => ({
                        id,
                        size: item.size,
                        color: item.color,
                        shape: item.shape,
                        position: item.body.position.toArray().map((n) => n * 1000),
                        quaternion: item.body.quaternion.toArray()
                    })
                )
        };
    }
}
export type CompetitionSnapshot = ReturnType<CompetitionWorld['snapshot']>;
