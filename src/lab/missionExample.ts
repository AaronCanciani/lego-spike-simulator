import type { Block, Project } from './engine.ts';

// Authored route, not LEGO's official guided mission. All movement is driven
// by standard Word Blocks, using encoder position and simulated yaw only.
export function coralExample(feedback = true): Project {
    const blocks: Record<string, Block> = {};
    const num = (n: number) => [1, [4, String(n)]];
    const ref = (id: string) => [2, id];
    const b = (
        id: string,
        opcode: string,
        inputs: Block['inputs'] = {},
        fields: Block['fields'] = {},
        next?: string
    ) => {
        blocks[id] = { opcode, inputs, fields, next, topLevel: id === 'start', shadow: false };
    };
    b('start', 'flipperevents_whenProgramStarts', {}, {}, 'pair');
    b('pair', 'flippermove_setMovementPair', { PAIR: [1, 'pairPorts'] }, {}, 'speed');
    b(
        'pairPorts',
        'flippermove_movement-port-selector',
        {},
        { 'field_flippermove_movement-port-selector': ['AE'] }
    );
    blocks.pairPorts.shadow = true;
    b('speed', 'flippermove_movementSpeed', { SPEED: num(35) }, {}, 'zero');
    b('zero', 'flippersensors_resetYaw', {}, {}, 'outbound');
    // Wheel rotations at 87.95 mm diameter: nominal 425 mm approach.
    const degrees = (425 / (87.95 * Math.PI)) * 360;
    b(
        'outbound',
        'control_repeat_until',
        { CONDITION: ref('outDone'), SUBSTACK: ref('outSteer') },
        {},
        'stopOut'
    );
    b('outDone', 'operator_gt', { OPERAND1: ref('outEncoder'), OPERAND2: num(degrees) });
    b('outEncoder', 'flippermoremotor_position', { PORT: [1, 'outPort'] });
    b(
        'outPort',
        'flippermoremotor_single-motor-selector',
        {},
        { 'field_flippermoremotor_single-motor-selector': ['E'] }
    );
    blocks.outPort.shadow = true;
    b('outSteer', 'flippermove_startSteer', { STEERING: feedback ? ref('outGain') : num(0) });
    if (feedback) {
        b('outGain', 'operator_multiply', { NUM1: num(-3), NUM2: ref('outYaw') });
        b('outYaw', 'flippersensors_orientationAxis', {}, { AXIS: ['yaw'] });
    }
    b('stopOut', 'flippermove_stopMove', {}, {}, 'settle');
    b('settle', 'control_wait', { DURATION: num(0.3) }, {}, 'lift');
    b(
        'lift',
        'flippermotor_motorTurnForDirection',
        { PORT: [1, 'toolPort'], DIRECTION: [1, 'toolDirection'], VALUE: num(75) },
        { UNIT: ['degrees'] },
        'hold'
    );
    b(
        'toolPort',
        'flippermotor_multiple-port-selector',
        {},
        { 'field_flippermotor_multiple-port-selector': ['C'] }
    );
    blocks.toolPort.shadow = true;
    b(
        'toolDirection',
        'flippermotor_custom-icon-direction',
        {},
        { 'field_flippermotor_custom-icon-direction': ['clockwise'] }
    );
    blocks.toolDirection.shadow = true;
    b('hold', 'control_wait', { DURATION: num(0.5) }, {}, 'reverseSpeed');
    b('reverseSpeed', 'flippermove_movementSpeed', { SPEED: num(-35) }, {}, 'return');
    b(
        'return',
        'control_repeat_until',
        { CONDITION: ref('backDone'), SUBSTACK: ref('backSteer') },
        {},
        'stopBack'
    );
    b('backDone', 'operator_lt', { OPERAND1: ref('backEncoder'), OPERAND2: num(5) });
    b('backEncoder', 'flippermoremotor_position', { PORT: [1, 'backPort'] });
    b(
        'backPort',
        'flippermoremotor_single-motor-selector',
        {},
        { 'field_flippermoremotor_single-motor-selector': ['E'] }
    );
    blocks.backPort.shadow = true;
    b('backSteer', 'flippermove_startSteer', { STEERING: feedback ? ref('backGain') : num(0) });
    if (feedback) {
        b('backGain', 'operator_multiply', { NUM1: num(3), NUM2: ref('backYaw') });
        b('backYaw', 'flippersensors_orientationAxis', {}, { AXIS: ['yaw'] });
    }
    b('stopBack', 'flippermove_stopMove');
    for (const [id, block] of Object.entries(blocks)) {
        if (block.next) blocks[block.next].parent = id;
        for (const input of Object.values(block.inputs))
            if (typeof input[1] === 'string') blocks[input[1]].parent = id;
    }
    return { targets: [{ isStage: true, variables: {}, blocks }] };
}
