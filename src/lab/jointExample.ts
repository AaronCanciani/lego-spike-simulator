import type { Block, Project } from './engine.ts';
// Joint showcase is a real Scratch program, not an animation that bypasses motors.
export function jointExample(): Project {
    const blocks: Record<string, Block> = {};
    const num = (n: number) => [1, [4, String(n)]];
    const block = (
        opcode: string,
        inputs: Block['inputs'] = {},
        fields: Block['fields'] = {}
    ): Block => ({ opcode, inputs, fields });
    const sequence: [string, Block][] = [
        ['start', { ...block('flipperevents_whenProgramStarts'), topLevel: true }],
        ['speed', block('flippermove_movementSpeed', { SPEED: num(20) })],
        ['forward', block('flippermove_startSteer', { STEERING: num(0) })],
        ['driveTime', block('control_wait', { DURATION: num(0.8) })],
        ['reverseSpeed', block('flippermove_movementSpeed', { SPEED: num(-20) })],
        ['reverse', block('flippermove_startSteer', { STEERING: num(0) })],
        ['reverseTime', block('control_wait', { DURATION: num(0.8) })],
        ['stop', block('flippermove_stopMove')]
    ];
    for (const [i, port] of ['C', 'D', 'C', 'D'].entries()) {
        const id = `tool${i}`,
            selector = `port${i}`,
            direction = `direction${i}`;
        blocks[selector] = {
            ...block(
                'flippermotor_single-motor-selector',
                {},
                { 'field_flippermotor_single-motor-selector': [port] }
            ),
            shadow: true
        };
        blocks[direction] = {
            ...block(
                'flippermotor_custom-icon-direction',
                {},
                {
                    'field_flippermotor_custom-icon-direction': [
                        i < 2 ? 'clockwise' : 'counterclockwise'
                    ]
                }
            ),
            shadow: true
        };
        sequence.push([
            id,
            block(
                'flippermotor_motorTurnForDirection',
                {
                    PORT: [1, selector],
                    DIRECTION: [1, direction],
                    VALUE: num(port === 'C' ? 75 : 55)
                },
                { UNIT: ['degrees'] }
            )
        ]);
        sequence.push([`pause${i}`, block('control_wait', { DURATION: num(0.35) })]);
    }
    sequence.forEach(([id, b], i) => {
        blocks[id] = b;
        if (i < sequence.length - 1) b.next = sequence[i + 1][0];
    });
    for (const [id, b] of Object.entries(blocks)) {
        if (b.next) blocks[b.next].parent = id;
        for (const input of Object.values(b.inputs))
            if (typeof input[1] === 'string') blocks[input[1]].parent = id;
    }
    return { targets: [{ isStage: true, variables: {}, blocks }] };
}
