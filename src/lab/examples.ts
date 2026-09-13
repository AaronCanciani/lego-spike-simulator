import type { Block, Project } from './engine.ts';

// Scratch graphs take exactly the same interpreter path as uploaded projects.
// The controller reads sensed yaw, never the engine's true heading.
export function drivingExample(feedback: boolean): Project {
    const num = (value: number) => [1, [4, String(value)]];
    const ref = (id: string) => [2, id];
    const b = (
        opcode: string,
        inputs: Block['inputs'] = {},
        fields: Block['fields'] = {},
        next?: string
    ): Block => ({ opcode, inputs, fields, next, shadow: false, topLevel: false });
    const blocks: Record<string, Block> = {
        start: { ...b('flipperevents_whenProgramStarts', {}, {}, 'pair'), topLevel: true },
        pair: b('flippermove_setMovementPair', { PAIR: [1, 'ports'] }, {}, 'speed'),
        ports: {
            ...b(
                'flippermove_movement-port-selector',
                {},
                { 'field_flippermove_movement-port-selector': ['AE'] }
            ),
            shadow: true
        },
        speed: b('flippermove_movementSpeed', { SPEED: num(50) }, {}, 'zero'),
        zero: b('flippersensors_resetYaw', {}, {}, 'timer'),
        timer: b('flippersensors_resetTimer', {}, {}, 'drive'),
        stop: b('flippermove_stopMove')
    };
    if (feedback) {
        Object.assign(blocks, {
            drive: b(
                'control_repeat_until',
                { CONDITION: ref('elapsed'), SUBSTACK: ref('correct') },
                {},
                'stop'
            ),
            elapsed: b('operator_gt', { OPERAND1: ref('clock'), OPERAND2: num(2) }),
            clock: b('flippersensors_timer'),
            correct: b('flippermove_startSteer', { STEERING: ref('gain') }),
            gain: b('operator_multiply', { NUM1: num(3), NUM2: ref('error') }),
            error: b('operator_subtract', { NUM1: num(0), NUM2: ref('yaw') }),
            yaw: b('flippersensors_orientationAxis', {}, { AXIS: ['yaw'] })
        });
    } else {
        blocks.drive = b('flippermove_startSteer', { STEERING: num(0) }, {}, 'wait');
        blocks.wait = b('control_wait', { DURATION: num(2) }, {}, 'stop');
    }
    for (const [id, block] of Object.entries(blocks)) {
        if (block.next) blocks[block.next].parent = id;
        for (const input of Object.values(block.inputs))
            if (typeof input[1] === 'string') blocks[input[1]].parent = id;
    }
    return { targets: [{ isStage: true, variables: {}, blocks }] };
}
