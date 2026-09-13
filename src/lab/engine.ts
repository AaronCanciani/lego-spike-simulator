// Fixed-clock SPIKE Word Blocks runner. Rendering never advances this clock.
// Steering and paired motor polarity follow the upstream Hardy VM conventions.
export type Block = {
    opcode: string;
    next?: string;
    parent?: string;
    inputs: Record<string, any[]>;
    fields: Record<string, any[]>;
    topLevel?: boolean;
    shadow?: boolean;
    mutation?: any;
};
export type Project = {
    targets: {
        blocks: Record<string, Block>;
        variables?: Record<string, any[]>;
        isStage?: boolean;
    }[];
};
export type Profile = {
    wheel: number;
    track: number;
    mismatch: number;
    motorMismatch: number;
    slip: number;
    gyroBias: number;
    gyroNoise: number;
    response: number;
    left: string;
    right: string;
    leftSign: number;
    rightSign: number;
    seed: number;
};
export const defaultProfile: Profile = {
    wheel: 87.95,
    track: 160,
    mismatch: 1.5,
    motorMismatch: 1,
    slip: 2,
    gyroBias: 0.12,
    gyroNoise: 0.2,
    response: 0.09,
    left: 'A',
    right: 'E',
    leftSign: -1,
    rightSign: 1,
    seed: 42
};
export const DT = 0.005;
export const WIDTH = 2362,
    HEIGHT = 1143;
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const truth = (v: any) =>
    typeof v === 'string' ? !['', '0', 'false'].includes(v.toLowerCase()) : Boolean(v);
export const wrap = (x: number) => ((((x + 180) % 360) + 360) % 360) - 180;
type Motor = {
    position: number;
    velocity: number;
    command: number;
    speed: number;
    target: number | null;
};
type Thread = {
    generator: Generator<void>;
    active: string;
    calls: string[];
    args: Record<string, any>;
    done: boolean;
};
const statementOps = new Set([
    'flipperevents_whenProgramStarts',
    'procedures_definition',
    'procedures_prototype',
    'procedures_call',
    'control_repeat',
    'control_repeat_until',
    'control_forever',
    'control_if',
    'control_if_else',
    'control_wait',
    'control_wait_until',
    'control_stop',
    'data_setvariableto',
    'data_changevariableby',
    'flippermove_setMovementPair',
    'flippermove_movementSpeed',
    'flippermove_startMove',
    'flippermove_startSteer',
    'flippermove_move',
    'flippermove_steer',
    'flippermove_stopMove',
    'flippermotor_motorTurnForDirection',
    'flippermotor_motorSetSpeed',
    'flippermotor_motorStartDirection',
    'flippermotor_motorStop',
    'flippersensors_resetYaw',
    'flippersensors_resetTimer'
]);
const expressionOps = new Set([
    'argument_reporter_string_number',
    'argument_reporter_boolean',
    'operator_add',
    'operator_subtract',
    'operator_multiply',
    'operator_divide',
    'operator_gt',
    'operator_lt',
    'operator_equals',
    'operator_and',
    'operator_or',
    'operator_not',
    'operator_random',
    'operator_mod',
    'operator_round',
    'data_variable',
    'flippersensors_orientationAxis',
    'flippersensors_timer',
    'flippersensors_isColor',
    'flippersensors_color',
    'flippersensors_reflectivity',
    'flippermotor_relativePosition',
    'flippermotor_absolutePosition',
    'flippermotor_speed'
]);
const selectorOps = new Set([
    'flippermotor_custom-icon-direction',
    'flippermotor_multiple-port-selector',
    'flippermotor_single-motor-selector',
    'flippermove_custom-icon-direction',
    'flippermove_movement-port-selector',
    'flippermove_rotation-wheel',
    'flippersensors_color-sensor-selector',
    'flippersensors_color-selector',
    'flippersensors_distance-sensor-selector'
]);

export function flatten(project: Project): Record<string, Block> {
    return Object.assign({}, ...project.targets.map((t) => t.blocks));
}

export function inspect(project: Project) {
    const blocks = flatten(project),
        starts = Object.keys(blocks).filter(
            (id) => blocks[id].opcode === 'flipperevents_whenProgramStarts'
        );
    const procedures = new Map<string, string>();
    for (const [id, b] of Object.entries(blocks))
        if (b.opcode === 'procedures_definition') {
            const proto = blocks[b.inputs.custom_block?.[1]];
            if (proto?.mutation) procedures.set(proto.mutation.proccode, id);
        }
    const reachable = new Set<string>();
    const visit = (id?: string) => {
        if (!id || reachable.has(id)) return;
        const b = blocks[id];
        if (!b) throw new Error('The program contains a missing block reference.');
        reachable.add(id);
        if (reachable.size > 12000) throw new Error('This project is too large for this preview.');
        visit(b.next);
        for (const input of Object.values(b.inputs || {}))
            if (typeof input?.[1] === 'string') visit(input[1]);
        if (b.opcode === 'procedures_call') {
            const def = procedures.get(b.mutation?.proccode);
            if (!def) throw new Error('A custom block definition is missing.');
            visit(def);
        }
    };
    starts.forEach(visit);
    const supported = (b: Block) =>
        statementOps.has(b.opcode) || expressionOps.has(b.opcode) || selectorOps.has(b.opcode);
    const unsupported = [
        ...new Set(
            [...reachable].filter((id) => !supported(blocks[id])).map((id) => blocks[id].opcode)
        )
    ];
    const unusedUnsupported = [
        ...new Set(
            Object.entries(blocks)
                .filter(([id, b]) => !reachable.has(id) && !supported(b))
                .map(([, b]) => b.opcode)
        )
    ];
    return {
        blocks,
        starts,
        procedures,
        reachable,
        unsupported,
        unusedUnsupported,
        total: Object.keys(blocks).length
    };
}

export class Engine {
    profile: Profile;
    info: ReturnType<typeof inspect>;
    motors: Record<string, Motor> = {};
    variables: Record<string, any> = {};
    threads: Thread[] = [];
    time = 0;
    tick = 0;
    timerStart = 0;
    yawOffset = 0;
    yaw = 0;
    drift = 0;
    x = -950;
    y = -330;
    heading = 180;
    pair = 'AE';
    speed = 50;
    state: 'ready' | 'running' | 'paused' | 'finished' | 'error' = 'ready';
    error = '';
    path: [number, number][] = [];
    trace: { time: number; id: string; calls: string[] }[] = [];
    distance = 0;
    collision = false;
    slipNow = 0;
    seed: number;
    colorAt: (x: number, y: number) => { color: number; reflection: number } = () => ({
        color: 10,
        reflection: 90
    });
    sensors: Record<string, { color: number; reflection: number }> = {
        B: { color: 10, reflection: 90 },
        F: { color: 10, reflection: 90 }
    };
    private noise = 0;
    private sampleHeading = 180;
    constructor(
        project: Project,
        profile: Profile = defaultProfile,
        start = { x: -950, y: -330, heading: 180 }
    ) {
        for (const key of [
            'wheel',
            'track',
            'mismatch',
            'motorMismatch',
            'slip',
            'gyroBias',
            'gyroNoise',
            'response',
            'seed',
            'leftSign',
            'rightSign'
        ] as const)
            if (!Number.isFinite(profile[key]))
                throw new Error('Robot settings must be finite numbers.');
        if (profile.wheel < 20 || profile.track < 50 || profile.response <= 0)
            throw new Error('Check wheel diameter, axle track and motor response time.');
        if (
            profile.left === profile.right ||
            !['A', 'E'].includes(profile.left) ||
            !['A', 'E'].includes(profile.right)
        )
            throw new Error('The left and right drive motors must use different ports A and E.');
        if (
            !Number.isFinite(start.x) ||
            !Number.isFinite(start.y) ||
            !Number.isFinite(start.heading)
        )
            throw new Error('Choose a numeric start position and heading.');
        this.info = inspect(project);
        this.profile = { ...profile };
        this.seed = profile.seed >>> 0;
        Object.assign(this, start);
        this.sampleHeading = this.heading;
        this.yawOffset = this.heading;
        for (const port of ['A', 'C', 'D', 'E'])
            this.motors[port] = { position: 0, velocity: 0, command: 0, speed: 50, target: null };
        for (const target of project.targets)
            for (const [id, v] of Object.entries(target.variables || {})) this.variables[id] = v[1];
        this.path = [[this.x, this.y]];
    }
    random() {
        this.seed = (Math.imul(1664525, this.seed) + 1013904223) >>> 0;
        return this.seed / 4294967296;
    }
    start() {
        if (this.info.unsupported.length) {
            this.state = 'error';
            this.error = 'Not supported yet: ' + this.info.unsupported.join(', ');
            return;
        }
        if (!this.info.starts.length) {
            this.state = 'error';
            this.error = 'No “when program starts” block was found.';
            return;
        }
        if (this.state === 'paused') {
            this.state = 'running';
            return;
        }
        this.threads = this.info.starts.map((id) => {
            const t = { active: id, calls: [], args: {}, done: false } as unknown as Thread;
            t.generator = this.run(id, {}, t);
            return t;
        });
        this.state = 'running';
    }
    halt() {
        for (const motor of Object.values(this.motors)) {
            motor.command = 0;
            motor.target = null;
            motor.velocity = 0;
        }
    }
    field(b: Block, key: string) {
        return b.fields?.[key]?.[0];
    }
    value(raw: any, args: Record<string, any>, depth = 0): any {
        if (depth > 80) throw new Error('Expression nesting is too deep.');
        if (raw == null) return 0;
        if (Array.isArray(raw))
            return raw[0] === 12
                ? (this.variables[raw[2]] ?? 0)
                : raw[0] >= 4 && raw[0] <= 8
                  ? Number(raw[1]) || 0
                  : raw[1];
        if (typeof raw !== 'string' || !this.info.blocks[raw]) return raw;
        const b = this.info.blocks[raw],
            op = b.opcode;
        const v = (key: string) => this.value(b.inputs[key]?.[1], args, depth + 1),
            n = (key: string) => Number(v(key)) || 0;
        if (selectorOps.has(op)) return Object.values(b.fields)[0]?.[0] ?? '';
        if (op.startsWith('argument_reporter')) return args[this.field(b, 'VALUE')] ?? 0;
        if (op === 'data_variable') return this.variables[b.fields.VARIABLE?.[1]] ?? 0;
        if (op === 'operator_add') return n('NUM1') + n('NUM2');
        if (op === 'operator_subtract') return n('NUM1') - n('NUM2');
        if (op === 'operator_multiply') return n('NUM1') * n('NUM2');
        if (op === 'operator_divide') return n('NUM1') / n('NUM2');
        if (op === 'operator_mod') return ((n('NUM1') % n('NUM2')) + n('NUM2')) % n('NUM2');
        if (op === 'operator_round') return Math.round(n('NUM'));
        if (op === 'operator_gt') return this.compare(v('OPERAND1'), v('OPERAND2')) > 0;
        if (op === 'operator_lt') return this.compare(v('OPERAND1'), v('OPERAND2')) < 0;
        if (op === 'operator_equals') return this.compare(v('OPERAND1'), v('OPERAND2')) === 0;
        if (op === 'operator_and') return truth(v('OPERAND1')) && truth(v('OPERAND2'));
        if (op === 'operator_or') return truth(v('OPERAND1')) || truth(v('OPERAND2'));
        if (op === 'operator_not') return !truth(v('OPERAND'));
        if (op === 'operator_random') {
            const a = n('FROM'),
                z = n('TO');
            return Math.floor(Math.min(a, z) + this.random() * (Math.abs(z - a) + 1));
        }
        if (op === 'flippersensors_orientationAxis') {
            if (this.field(b, 'AXIS') !== 'yaw')
                throw new Error('This flat-field preview supports yaw only.');
            return this.yaw;
        }
        if (op === 'flippersensors_timer') return this.time - this.timerStart;
        if (
            op === 'flippersensors_isColor' ||
            op === 'flippersensors_color' ||
            op === 'flippersensors_reflectivity'
        ) {
            const port = String(v('PORT')),
                sensor = this.sensors[port];
            if (!sensor)
                throw new Error(
                    'No color sensor on port ' + port + '. Advanced Driving Base uses B and F.'
                );
            return op === 'flippersensors_isColor'
                ? sensor.color === Number(v('VALUE'))
                : op === 'flippersensors_color'
                  ? sensor.color
                  : sensor.reflection;
        }
        if (op.startsWith('flippermotor_')) {
            const m = this.motor(String(v('PORT')));
            return op.endsWith('speed')
                ? m.velocity / 8.1
                : op.endsWith('absolutePosition')
                  ? ((m.position % 360) + 360) % 360
                  : m.position;
        }
        throw new Error('Unsupported expression: ' + op);
    }
    compare(a: any, b: any) {
        const x = Number(a),
            y = Number(b);
        if (
            String(a).trim() !== '' &&
            String(b).trim() !== '' &&
            Number.isFinite(x) &&
            Number.isFinite(y)
        )
            return x - y;
        return String(a).toLowerCase().localeCompare(String(b).toLowerCase());
    }
    motor(port: string) {
        const m = this.motors[port];
        if (!m) throw new Error('No motor configured on port ' + port);
        return m;
    }
    command(port: string, percent: number, target: number | null = null) {
        const m = this.motor(port);
        m.command = clamp(percent, -100, 100) * 8.1;
        m.target = target;
    }
    drive(steer = 0, direction = 1) {
        const s = clamp(steer, -100, 100);
        const l = s >= 0 ? 1 : 1 + s / 50,
            r = s >= 0 ? 1 - s / 50 : 1;
        this.command(this.pair[0], -this.speed * l * direction);
        this.command(this.pair[1], this.speed * r * direction);
    }
    stopPair() {
        for (const p of this.pair) this.command(p, 0);
    }
    mark(id: string, t: Thread, args: Record<string, any>) {
        t.active = id;
        t.args = { ...args };
        this.trace.push({ time: this.time, id, calls: [...t.calls] });
        if (this.trace.length > 4000) this.trace.shift();
    }
    *run(
        first: string | undefined,
        args: Record<string, any>,
        t: Thread,
        depth = 0
    ): Generator<void> {
        if (depth > 80) throw new Error('Custom block calls are nested too deeply.');
        let id = first;
        while (id) {
            const b = this.info.blocks[id];
            if (!b) throw new Error('Missing block.');
            this.mark(id, t, args);
            const v = (key: string) => this.value(b.inputs[key]?.[1], args),
                n = (key: string) => Number(v(key)) || 0,
                sub = (key: string) => b.inputs[key]?.[1] as string | undefined;
            const op = b.opcode;
            if (op === 'procedures_call') {
                const name = b.mutation.proccode,
                    def = this.info.blocks[this.info.procedures.get(name)!];
                const proto = this.info.blocks[def.inputs.custom_block[1]],
                    names = JSON.parse(proto.mutation.argumentnames),
                    keys = JSON.parse(proto.mutation.argumentids);
                const params: Record<string, any> = {};
                keys.forEach((key: string, i: number) => (params[names[i]] = v(key)));
                t.calls.push(name.replace(/%[sb]/g, '').replace(/\s+/g, ' ').trim());
                yield;
                yield* this.run(def.next, params, t, depth + 1);
                t.calls.pop();
            } else if (op === 'control_repeat') {
                for (let i = 0, count = Math.max(0, Math.round(n('TIMES'))); i < count; i++) {
                    yield;
                    yield* this.run(sub('SUBSTACK'), args, t, depth);
                    this.mark(id, t, args);
                }
            } else if (op === 'control_repeat_until' || op === 'control_forever') {
                while (op === 'control_forever' || !truth(v('CONDITION'))) {
                    yield;
                    yield* this.run(sub('SUBSTACK'), args, t, depth);
                    this.mark(id, t, args);
                }
            } else if (op === 'control_if' || op === 'control_if_else') {
                yield;
                yield* this.run(
                    sub(truth(v('CONDITION')) ? 'SUBSTACK' : 'SUBSTACK2'),
                    args,
                    t,
                    depth
                );
            } else if (op === 'control_wait') {
                const until = this.time + Math.max(0, n('DURATION'));
                while (this.time + 1e-9 < until) yield;
            } else if (op === 'control_wait_until') {
                while (!truth(v('CONDITION'))) yield;
            } else if (op === 'control_stop') {
                if (this.field(b, 'STOP_OPTION') === 'all') {
                    this.state = 'finished';
                    this.halt();
                }
                return;
            } else if (op === 'data_setvariableto')
                this.variables[b.fields.VARIABLE[1]] = v('VALUE');
            else if (op === 'data_changevariableby')
                this.variables[b.fields.VARIABLE[1]] =
                    (Number(this.variables[b.fields.VARIABLE[1]]) || 0) + n('VALUE');
            else if (op === 'flippermove_setMovementPair') {
                const pair = String(v('PAIR'));
                if (pair.length !== 2 || pair[0] === pair[1])
                    throw new Error('Choose two different movement motors.');
                for (const p of pair) this.motor(p);
                this.pair = pair;
            } else if (op === 'flippermove_movementSpeed')
                this.speed = clamp(n('SPEED'), -100, 100);
            else if (op === 'flippermove_startMove')
                this.drive(0, String(v('DIRECTION')) === 'back' ? -1 : 1);
            else if (op === 'flippermove_startSteer') this.drive(this.steering(v('STEERING')));
            else if (op === 'flippermove_stopMove') this.stopPair();
            else if (op === 'flippermove_move' || op === 'flippermove_steer') {
                const amount = n('VALUE'),
                    unit = this.field(b, 'UNIT');
                const start = this.pair.split('').map((p) => this.motor(p).position),
                    begin = this.time;
                this.drive(
                    op === 'flippermove_steer' ? this.steering(v('STEERING')) : 0,
                    (String(v('DIRECTION')) === 'back' ? -1 : 1) * (amount < 0 ? -1 : 1)
                );
                const degrees =
                    Math.abs(amount) *
                    (unit === 'rotations'
                        ? 360
                        : unit === 'degrees'
                          ? 1
                          : unit === 'inches'
                            ? (25.4 * 360) / (this.profile.wheel * Math.PI)
                            : (10 * 360) / (this.profile.wheel * Math.PI));
                while (
                    unit === 'seconds'
                        ? this.time - begin < Math.abs(amount)
                        : this.pair
                              .split('')
                              .reduce(
                                  (sum, p, i) => sum + Math.abs(this.motor(p).position - start[i]),
                                  0
                              ) /
                              2 <
                          degrees
                )
                    yield;
                this.stopPair();
            } else if (op === 'flippermotor_motorSetSpeed') {
                for (const p of String(v('PORT')))
                    this.motor(p).speed = clamp(n('SPEED'), -100, 100);
            } else if (op === 'flippermotor_motorStop') {
                for (const p of String(v('PORT'))) this.command(p, 0);
            } else if (op === 'flippermotor_motorStartDirection') {
                for (const p of String(v('PORT')))
                    this.command(
                        p,
                        this.motor(p).speed * (v('DIRECTION') === 'counterclockwise' ? -1 : 1)
                    );
            } else if (op === 'flippermotor_motorTurnForDirection') {
                const ports = String(v('PORT')),
                    amount = n('VALUE'),
                    unit = this.field(b, 'UNIT'),
                    sign = (v('DIRECTION') === 'counterclockwise' ? -1 : 1) * (amount < 0 ? -1 : 1);
                for (const p of ports) {
                    const m = this.motor(p);
                    this.command(
                        p,
                        m.speed * sign,
                        unit === 'seconds'
                            ? null
                            : m.position +
                                  Math.abs(amount) *
                                      (unit === 'rotations' ? 360 : 1) *
                                      sign *
                                      Math.sign(m.speed || 1)
                    );
                }
                if (unit === 'seconds') {
                    const end = this.time + Math.abs(amount);
                    while (this.time < end) yield;
                    for (const p of ports) this.command(p, 0);
                } else while ([...ports].some((p) => this.motor(p).target !== null)) yield;
            } else if (op === 'flippersensors_resetYaw') {
                this.yawOffset = this.heading + this.drift;
                this.yaw = 0;
            } else if (op === 'flippersensors_resetTimer') this.timerStart = this.time;
            else if (op !== 'flipperevents_whenProgramStarts')
                throw new Error('Unsupported statement: ' + op);
            yield;
            id = b.next;
        }
    }
    steering(value: any) {
        const s = String(value);
        return s.includes(':')
            ? (s.startsWith('left') ? -1 : 1) * Number(s.split(':')[1])
            : Number(value) || 0;
    }
    step() {
        if (this.state !== 'running') return;
        try {
            for (const t of this.threads) if (!t.done) t.done = !!t.generator.next().done;
            if (this.state !== 'running') return;
            this.physics();
            this.tick++;
            this.time = this.tick * DT;
            if (this.threads.every((t) => t.done)) {
                this.state = 'finished';
                this.halt();
            }
            if (this.time > 180) {
                this.state = 'error';
                this.error =
                    'Stopped after 180 simulated seconds. Check a loop or sensor condition.';
                this.halt();
            }
        } catch (e) {
            this.state = 'error';
            this.error = e instanceof Error ? e.message : String(e);
            this.halt();
        }
    }
    physics() {
        for (const [port, m] of Object.entries(this.motors)) {
            const side = port === this.profile.left ? 1 : port === this.profile.right ? -1 : 0;
            const gain = 1 + (side * this.profile.motorMismatch) / 200;
            const tau =
                Math.max(0.005, this.profile.response) *
                (1 + (side * this.profile.motorMismatch) / 100);
            m.velocity += (m.command * gain - m.velocity) * (1 - Math.exp(-DT / tau));
            const next = m.position + m.velocity * DT;
            if (
                m.target !== null &&
                ((m.velocity >= 0 && next >= m.target) || (m.velocity < 0 && next <= m.target))
            ) {
                m.position = m.target;
                m.target = null;
                m.command = 0;
                m.velocity = 0;
            } else m.position = next;
        }
        if (this.tick % 20 === 0) this.noise += (this.random() * 2 - 1 - this.noise) * 0.35;
        const p = this.profile,
            left = this.motor(p.left).velocity * p.leftSign,
            right = this.motor(p.right).velocity * p.rightSign;
        const uneven = (Math.sin(this.x / 190 + this.y / 310) + 1) / 2;
        this.slipNow = (p.slip / 100) * (0.3 + uneven * 0.7 + Math.abs(left - right) / 1620);
        const vl =
            ((left * p.wheel * Math.PI) / 360) *
            (1 + p.mismatch / 200) *
            (1 - this.slipNow * (1 + this.noise));
        const vr =
            ((right * p.wheel * Math.PI) / 360) *
            (1 - p.mismatch / 200) *
            (1 - this.slipNow * (1 - this.noise));
        const angular = (vl - vr) / p.track,
            mid = (this.heading * Math.PI) / 180 + (angular * DT) / 2;
        const dx = ((vl + vr) / 2) * Math.sin(mid) * DT,
            dy = ((vl + vr) / 2) * Math.cos(mid) * DT;
        const nx = clamp(this.x + dx, -WIDTH / 2 + 100, WIDTH / 2 - 100),
            ny = clamp(this.y + dy, -HEIGHT / 2 + 100, HEIGHT / 2 - 100);
        this.collision = Math.abs(nx - this.x - dx) > 0.01 || Math.abs(ny - this.y - dy) > 0.01;
        this.distance += Math.hypot(nx - this.x, ny - this.y);
        this.x = nx;
        this.y = ny;
        this.heading += (angular * DT * 180) / Math.PI;
        this.drift += p.gyroBias * DT;
        if (this.tick % 4 === 0) {
            this.yaw = Math.round(
                wrap(
                    this.sampleHeading +
                        this.drift -
                        this.yawOffset +
                        (this.random() * 2 - 1) * p.gyroNoise
                )
            );
            this.sampleHeading = this.heading;
        }
        if (this.tick % 8 === 0) {
            const theta = (this.heading * Math.PI) / 180;
            for (const [port, side] of [
                ['B', -1],
                ['F', 1]
            ] as [string, number][])
                this.sensors[port] = this.colorAt(
                    this.x + Math.sin(theta) * 100 + Math.cos(theta) * side * 45,
                    this.y + Math.cos(theta) * 100 - Math.sin(theta) * side * 45
                );
        }
        if (
            this.tick % 10 === 0 &&
            Math.hypot(this.x - this.path.at(-1)![0], this.y - this.path.at(-1)![1]) > 2
        )
            this.path.push([this.x, this.y]);
    }
    snapshot() {
        return {
            time: this.time,
            x: this.x,
            y: this.y,
            heading: this.heading,
            yaw: this.yaw,
            state: this.state,
            error: this.error,
            distance: this.distance,
            collision: this.collision,
            slip: this.slipNow,
            motors: structuredClone(this.motors),
            active: this.threads.filter((t) => !t.done).map((t) => t.active),
            calls: this.threads[0]?.calls.slice() || [],
            args: { ...this.threads[0]?.args },
            sensors: structuredClone(this.sensors)
        };
    }
}
