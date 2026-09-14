import type { Block, Project } from './engine.ts';
export const resultVariable = 'sensorlab-result-v1';
export type ColorExperiment = 'red' | 'blue' | 'line';

// All decisions live in ordinary Scratch blocks: no access to pose, route or mat.
export function colorExample(kind: ColorExperiment, feedback = true): Project {
    const variables: Record<string, [string, string | number]> = {
        [resultVariable]: ['Sensor result', 'Ready']
    };
    const num = (n: number) => [1, [4, String(n)]];
    const str = (s: string) => [1, [10, s]];
    const ref = (id: string) => [2, id];
    const b = (
        opcode: string,
        inputs: Block['inputs'] = {},
        fields: Block['fields'] = {},
        next?: string
    ): Block => ({ opcode, inputs, fields, next });
    const colorPort = (id: string): Block => ({
        ...b(
            'flippersensors_color-sensor-selector',
            {},
            { 'field_flippersensors_color-sensor-selector': ['B'] }
        ),
        shadow: true,
        parent: id
    });
    const blocks: Record<string, Block> = {
        start: { ...b('flipperevents_whenProgramStarts', {}, {}, 'pending'), topLevel: true },
        pending: b(
            'data_setvariableto',
            { VALUE: str('Running') },
            { VARIABLE: ['Sensor result', resultVariable] },
            'speed'
        ),
        speed: b('flippermove_movementSpeed', { SPEED: num(20) }, {}, 'timer'),
        timer: b('flippersensors_resetTimer', {}, {}, 'loop'),
        loop: b(
            'control_repeat_until',
            { CONDITION: ref('done'), SUBSTACK: ref('check') },
            {},
            'stop'
        ),
        done: b('operator_or', { OPERAND1: ref('latched'), OPERAND2: ref('timeout') }),
        latched: b('operator_equals', {
            OPERAND1: ref('result'),
            OPERAND2: str('Target detected')
        }),
        result: b('data_variable', {}, { VARIABLE: ['Sensor result', resultVariable] }),
        check: b('control_if_else', {
            CONDITION: ref('marker'),
            SUBSTACK: ref('success'),
            SUBSTACK2: ref('steer')
        }),
        marker: b('flippersensors_isColor', { PORT: [1, 'colorPort'], VALUE: [1, 'targetColor'] }),
        colorPort: colorPort('marker'),
        targetColor: {
            ...b(
                'flippersensors_color-selector',
                {},
                { 'field_flippersensors_color-selector': [String(kind === 'blue' ? 3 : 9)] }
            ),
            shadow: true
        },
        timeout: b('operator_gt', { OPERAND1: ref('clock'), OPERAND2: num(12) }),
        clock: b('flippersensors_timer'),
        steer: b('flippermove_startSteer', {
            STEERING: kind === 'line' && feedback ? ref('gain') : num(0)
        }),
        stop: b('flippermove_stopMove', {}, {}, 'outcome'),
        outcome: b('control_if', { CONDITION: ref('notFound'), SUBSTACK: ref('failure') }),
        notFound: b('operator_not', { OPERAND: ref('found') }),
        found: b('operator_equals', {
            OPERAND1: ref('finalResult'),
            OPERAND2: str('Target detected')
        }),
        finalResult: b('data_variable', {}, { VARIABLE: ['Sensor result', resultVariable] }),
        success: b(
            'data_setvariableto',
            { VALUE: str('Target detected') },
            { VARIABLE: ['Sensor result', resultVariable] },
            'brake'
        ),
        brake: b('flippermove_stopMove'),
        failure: b(
            'data_setvariableto',
            { VALUE: str('Timed out — target not detected') },
            { VARIABLE: ['Sensor result', resultVariable] }
        )
    };
    if (kind === 'line' && feedback) {
        const names: Record<string, string> = {
            target: 'Target brightness',
            strength: 'Steering gain',
            measured: 'Measured brightness',
            difference: 'Brightness error',
            correction: 'Steering correction'
        };
        const field = (name: string) => ({ VARIABLE: [names[name], `line-${name}`] });
        for (const name of Object.keys(names)) variables[`line-${name}`] = [names[name], 0];
        blocks.speed.next = 'setTarget';
        blocks.check.inputs.SUBSTACK2 = ref('readBrightness');
        blocks.steer.inputs.STEERING = ref('correctionValue');
        Object.assign(blocks, {
            setTarget: b('data_setvariableto', { VALUE: num(50) }, field('target'), 'setStrength'),
            setStrength: b('data_setvariableto', { VALUE: num(-0.9) }, field('strength'), 'timer'),
            readBrightness: b(
                'data_setvariableto',
                { VALUE: ref('reflection') },
                field('measured'),
                'setError'
            ),
            setError: b(
                'data_setvariableto',
                { VALUE: ref('error') },
                field('difference'),
                'setCorrection'
            ),
            setCorrection: b(
                'data_setvariableto',
                { VALUE: ref('gain') },
                field('correction'),
                'steer'
            ),
            gain: b('operator_multiply', {
                NUM1: ref('strengthValue'),
                NUM2: ref('differenceValue')
            }),
            error: b('operator_subtract', { NUM1: ref('measuredValue'), NUM2: ref('targetValue') }),
            strengthValue: b('data_variable', {}, field('strength')),
            differenceValue: b('data_variable', {}, field('difference')),
            measuredValue: b('data_variable', {}, field('measured')),
            targetValue: b('data_variable', {}, field('target')),
            correctionValue: b('data_variable', {}, field('correction')),
            reflection: b('flippersensors_reflectivity', { PORT: [1, 'reflectionPort'] }),
            reflectionPort: colorPort('reflection')
        });
    }
    for (const [id, block] of Object.entries(blocks)) {
        if (block.next) blocks[block.next].parent = id;
        for (const input of Object.values(block.inputs))
            if (typeof input[1] === 'string') blocks[input[1]].parent = id;
    }
    return {
        targets: [{ isStage: true, variables, blocks }]
    };
}
