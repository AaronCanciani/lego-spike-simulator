import type { Block, Project } from './engine.ts';
export type MissionStarter = 'line' | 'distance' | 'contact' | 'wall';
// Ordinary editable Word Blocks. No scene coordinates, success flags or simulator-only opcodes.
export function missionProgram(kind: MissionStarter): Project {
    const blocks: Record<string, Block> = {};
    let serial = 0;
    const n = (v: number) => [1, [4, String(v)]];
    const make = (opcode: string, inputs: Block['inputs'] = {}, fields: Block['fields'] = {}) => {
        const id = `mission-${serial++}`;
        blocks[id] = { opcode, inputs, fields };
        return id;
    };
    const ref = (id: string) => [2, id];
    const chain = (...ids: string[]) => {
        ids.forEach((id, i) => {
            if (ids[i + 1]) blocks[id].next = ids[i + 1];
        });
        return ids[0];
    };
    const speed = (v: number) => make('flippermove_movementSpeed', { SPEED: n(v) });
    const steer = (v: any[]) => make('flippermove_startSteer', { STEERING: v });
    const wait = (v: number) => make('control_wait', { DURATION: n(v) });
    const stop = () => make('flippermove_stopMove');
    const yaw = () => ref(make('flippersensors_orientationAxis', {}, { AXIS: ['yaw'] }));
    const gyro = () =>
        ref(
            make('operator_multiply', {
                NUM1: n(3),
                NUM2: ref(make('operator_subtract', { NUM1: n(0), NUM2: yaw() }))
            })
        );
    const clockOver = (v: number) =>
        ref(make('operator_gt', { OPERAND1: ref(make('flippersensors_timer')), OPERAND2: n(v) }));
    const sensor = (type: string, port: string) => {
        const op = `flippersensors_${type}-sensor-selector`;
        const id = make(op, {}, { [`field_${op}`]: [port] });
        blocks[id].shadow = true;
        return [1, id];
    };
    const start = make('flipperevents_whenProgramStarts');
    blocks[start].topLevel = true;
    const pair = make(
        'flippermove_movement-port-selector',
        {},
        { 'field_flippermove_movement-port-selector': ['AE'] }
    );
    blocks[pair].shadow = true;
    const wiring = make('flippermove_setMovementPair', { PAIR: [1, pair] });
    const zero = () => make('flippersensors_resetYaw');
    const timer = () => make('flippersensors_resetTimer');
    if (kind === 'wall') {
        const forward = make('control_repeat_until', {
            CONDITION: clockOver(1.5),
            SUBSTACK: ref(steer(gyro()))
        });
        chain(
            start,
            wiring,
            speed(-15),
            steer(n(0)),
            wait(3),
            stop(),
            wait(0.3),
            zero(),
            speed(20),
            timer(),
            forward,
            stop(),
            wait(0.4)
        );
    } else {
        let detected: any[];
        if (kind === 'contact')
            detected = ref(
                make(
                    'flippersensors_isPressed',
                    { PORT: sensor('force', 'F') },
                    { OPTION: ['pressed'] }
                )
            );
        else
            detected = ref(
                make(
                    'flippersensors_isDistance',
                    { PORT: sensor('distance', 'F'), VALUE: n(20) },
                    { UNIT: ['cm'], COMPARATOR: ['<'] }
                )
            );
        const done = ref(make('operator_or', { OPERAND1: detected, OPERAND2: clockOver(8) }));
        const steering =
            kind === 'line'
                ? ref(
                      make('operator_multiply', {
                          NUM1: n(-0.7),
                          NUM2: ref(
                              make('operator_subtract', {
                                  NUM1: ref(
                                      make('flippersensors_reflectivity', {
                                          PORT: sensor('color', 'B')
                                      })
                                  ),
                                  NUM2: n(50)
                              })
                          )
                      })
                  )
                : gyro();
        const loop = make('control_repeat_until', {
            CONDITION: done,
            SUBSTACK: ref(steer(steering))
        });
        const sequence = [start, wiring, zero(), speed(15), timer(), loop, stop(), wait(0.2)];
        if (kind === 'contact') {
            // Only push if the probe actually made contact; timeout never pretends success.
            const touched = ref(
                make(
                    'flippersensors_isPressed',
                    { PORT: sensor('force', 'F') },
                    { OPTION: ['pressed'] }
                )
            );
            const push = chain(
                speed(8),
                steer(gyro()),
                wait(1.2),
                stop(),
                wait(0.2),
                speed(-18),
                steer(n(0)),
                wait(1),
                stop(),
                wait(0.5)
            );
            sequence.push(make('control_if', { CONDITION: touched, SUBSTACK: ref(push) }));
        }
        chain(...sequence);
    }
    for (const [id, b] of Object.entries(blocks)) {
        if (b.next) blocks[b.next].parent = id;
        for (const input of Object.values(b.inputs))
            if (typeof input[1] === 'string') blocks[input[1]].parent = id;
    }
    return { targets: [{ isStage: true, variables: {}, blocks }] };
}
