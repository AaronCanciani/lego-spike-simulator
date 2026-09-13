// Research provenance, conventions and unmeasured assumptions: SENSOR_MODELS.md.
// Millimeters, newtons, degrees. Sensor clocks are independent of rendering.
export type SensorKind = 'color' | 'distance' | 'force' | 'none';
export type SensorMount = { kind: SensorKind; forward: number; side: number; height: number };
export type SensorConfig = {
    ports: Record<'B' | 'F', SensorMount>;
    errors: boolean;
    reflectionNoise: number;
    reflectionBias: number;
    lowMountDropout: number;
    distanceError: number;
    distanceDropout: number;
    cone: number;
    forceError: number;
    encoderError: number;
};
export const defaultSensors: SensorConfig = {
    ports: {
        B: { kind: 'color', forward: 100, side: -45, height: 8 },
        F: { kind: 'color', forward: 100, side: 45, height: 8 }
    },
    errors: true,
    reflectionNoise: 1,
    reflectionBias: 2,
    lowMountDropout: 0.5,
    distanceError: 20,
    distanceDropout: 0.02,
    cone: 35,
    forceError: 0.65,
    encoderError: 3
};
export type Pose = { x: number; y: number; heading: number };
export type Surface = { color: number; reflection: number };
export type Reading = {
    kind: SensorKind;
    color: number;
    reflection: number;
    distance: number | null;
    force: number;
    pressed: boolean;
    compression: number;
    valid: boolean;
    quality: string;
    time: number;
    x: number;
    y: number;
};
export type Wall = { ax: number; ay: number; bx: number; by: number };
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
export const tableWalls: Wall[] = [
    { ax: -1181, ay: -571.5, bx: 1181, by: -571.5 },
    { ax: 1181, ay: -571.5, bx: 1181, by: 571.5 },
    { ax: 1181, ay: 571.5, bx: -1181, by: 571.5 },
    { ax: -1181, ay: 571.5, bx: -1181, by: -571.5 }
];
export function mountPoint(pose: Pose, mount: SensorMount) {
    const a = (pose.heading * Math.PI) / 180;
    return {
        x: pose.x + Math.sin(a) * mount.forward + Math.cos(a) * mount.side,
        y: pose.y + Math.cos(a) * mount.forward - Math.sin(a) * mount.side
    };
}
// Nearest physical surface first: a rejected echo never sees through that surface.
export function raycast(x: number, y: number, heading: number, walls = tableWalls) {
    const a = (heading * Math.PI) / 180,
        dx = Math.sin(a),
        dy = Math.cos(a);
    let distance = Infinity,
        incidence = 0;
    for (const w of walls) {
        const sx = w.bx - w.ax,
            sy = w.by - w.ay,
            denom = dx * sy - dy * sx;
        if (Math.abs(denom) < 1e-9) continue;
        const qx = w.ax - x,
            qy = w.ay - y;
        const t = (qx * sy - qy * sx) / denom,
            u = (qx * dy - qy * dx) / denom;
        if (t >= -1e-7 && u >= 0 && u <= 1 && t < distance) {
            distance = Math.max(0, t);
            incidence = Math.abs(denom) / Math.hypot(sx, sy);
        }
    }
    return { distance, incidence };
}
export class SensorBank {
    config: SensorConfig;
    readings: Record<string, Reading> = {};
    encoders: Record<string, { position: number; speed: number }> = {};
    private streams: Record<string, number> = {};
    private biases: Record<string, number> = {};
    private lastTick = -1;
    private seed: number;
    constructor(config = defaultSensors, seed = 42) {
        this.config = structuredClone(config);
        this.seed = seed >>> 0;
        for (const [key, value] of Object.entries(config)) {
            if (typeof value === 'number' && (!Number.isFinite(value) || value < 0))
                throw new Error('Sensor settings must be finite, nonnegative numbers: ' + key);
        }
        if (config.cone > 80 || config.distanceDropout > 1 || config.lowMountDropout > 1)
            throw new Error('Check sensor cone and dropout settings.');
        for (const [port, mount] of Object.entries(config.ports)) {
            if (
                !['B', 'F'].includes(port) ||
                !['color', 'distance', 'force', 'none'].includes(mount.kind)
            )
                throw new Error(
                    'Sensor ports B/F can replace the stock color sensors. A/C/D/E are motors.'
                );
            if (
                ![mount.forward, mount.side, mount.height].every(Number.isFinite) ||
                mount.height < 0
            )
                throw new Error(
                    'Sensor mounting dimensions must be finite; height cannot be negative.'
                );
            this.biases[port] = this.random(port) * 2 - 1;
        }
    }
    private random(key: string) {
        if (!(key in this.streams)) {
            let hash = this.seed;
            for (const c of key) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619) >>> 0;
            this.streams[key] = hash;
        }
        this.streams[key] = (Math.imul(1664525, this.streams[key]) + 1013904223) >>> 0;
        return this.streams[key] / 4294967296;
    }
    sample(
        tick: number,
        pose: Pose,
        colorAt: (x: number, y: number) => Surface,
        motors: Record<string, { position: number; velocity: number }>,
        walls = tableWalls,
        physicalRay?: (
            x: number,
            y: number,
            heading: number,
            height: number
        ) => { distance: number; incidence: number }
    ) {
        // LEGO publishes 100 Hz for color, distance, force and angular encoders.
        if (tick % 2 || tick === this.lastTick) return;
        this.lastTick = tick;
        const c = this.config,
            errors = c.errors;
        for (const [port, mount] of Object.entries(c.ports)) {
            const point = mountPoint(pose, mount);
            const r: Reading = {
                ...point,
                kind: mount.kind,
                color: -1,
                reflection: 0,
                distance: null,
                force: 0,
                pressed: false,
                compression: 0,
                valid: mount.kind !== 'none',
                quality: 'ok',
                time: tick * 0.005
            };
            const noise = () => this.random(port) * 2 - 1;
            if (mount.kind === 'color') {
                const votes = new Map<number, number>();
                const radius = 2 + mount.height * 0.18; // footprint estimate, not LEGO's optical PSF
                for (const [dx, dy] of [
                    [0, 0],
                    [-1, 0],
                    [1, 0],
                    [0, -1],
                    [0, 1],
                    [-0.7, -0.7],
                    [0.7, 0.7],
                    [-0.7, 0.7],
                    [0.7, -0.7]
                ]) {
                    const sample = colorAt(point.x + dx * radius, point.y + dy * radius);
                    r.reflection += sample.reflection / 9;
                    votes.set(sample.color, (votes.get(sample.color) || 0) + 1);
                }
                r.color = [...votes].sort((a, b) => b[1] - a[1])[0][0];
                const tooLow = clamp((16 - mount.height) / 8, 0, 1);
                if (errors) {
                    r.reflection +=
                        this.biases[port] * c.reflectionBias + noise() * c.reflectionNoise;
                    if (tooLow && r.color === 0 && this.random(port) < c.lowMountDropout * tooLow)
                        r.color = -1;
                }
                r.reflection = Math.round(clamp(r.reflection, 0, 100));
                r.quality = tooLow
                    ? 'Low mount: black classification at risk'
                    : 'Artwork approximation';
            } else if (mount.kind === 'distance') {
                let distance = Infinity;
                // Sparse planar cone; beam shape and incidence cutoff await physical measurements.
                for (let i = -4; i <= 4; i++) {
                    const angle = pose.heading + (i * c.cone) / 4;
                    const hit = physicalRay
                        ? physicalRay(point.x, point.y, angle, mount.height)
                        : raycast(point.x, point.y, angle, walls);
                    if (!errors || hit.incidence >= 0.25)
                        distance = Math.min(distance, hit.distance);
                }
                r.valid = distance >= 50 && distance <= 2000;
                if (errors && this.random(port) < c.distanceDropout) r.valid = false;
                if (r.valid) {
                    // Bounded envelope, NOT a measured statistical distribution.
                    const error = errors
                        ? Math.max(0, c.distanceError - 0.5) *
                          (0.6 * this.biases[port] + 0.4 * noise())
                        : 0;
                    r.distance = Math.round(clamp(distance + error, 50, 2000));
                }
                r.quality = r.valid
                    ? physicalRay
                        ? 'Walls + physical payload'
                        : 'Table walls only'
                    : 'No valid echo';
            } else if (mount.kind === 'force') {
                // Forward spring probe: mount is the backplate; tip extends eight mm.
                const base = mountPoint(pose, { ...mount, forward: 0 });
                const hit = physicalRay
                    ? physicalRay(base.x, base.y, pose.heading, mount.height)
                    : raycast(base.x, base.y, pose.heading, walls);
                r.compression = clamp(mount.forward + 8 - hit.distance, 0, 8);
                const threshold = 1 + (errors ? 0.5 * this.biases[port] : 0);
                const wasPressed = this.readings[port]?.pressed;
                r.pressed = r.compression >= threshold - (wasPressed ? 0.15 : 0);
                const force =
                    r.compression < 2 ? 0 : Math.min(10, 2.5 + (r.compression - 2) * 1.25);
                const error = errors
                    ? Math.max(0, c.forceError - 0.05) * (0.65 * this.biases[port] + 0.35 * noise())
                    : 0;
                r.force = force === 0 ? 0 : Math.round(clamp(force + error, 0, 10) * 10) / 10;
                r.quality = r.pressed ? 'Probe contact · spring approximation' : 'Probe released';
            } else r.quality = 'Disconnected';
            this.readings[port] = r;
        }
        for (const [port, motor] of Object.entries(motors)) {
            // Repeatable angular nonlinearity: bounded <=3° including rounding at defaults.
            const error = errors
                ? Math.max(0, c.encoderError - 0.5) * Math.sin((motor.position * Math.PI) / 180)
                : 0;
            this.encoders[port] = {
                position: Math.round(motor.position + error),
                speed: Math.round(motor.velocity / 8.1)
            };
        }
    }
    require(port: string, kind: SensorKind) {
        const sensor = this.readings[port];
        if (!sensor || sensor.kind !== kind)
            throw new Error(
                `No ${kind} sensor on port ${port}. Choose the attached sensor in Robot settings (B/F); A/C/D/E are motors.`
            );
        return sensor;
    }
}
