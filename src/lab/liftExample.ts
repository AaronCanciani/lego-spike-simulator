import type { Block, Project } from './engine.ts';
// Ordinary editable Word Blocks. Timed baseline, intentionally not a robust controller.
export function liftExample(): Project {
    const blocks: Record<string, Block> = {};
    const num = (n: number) => [1, [4, String(n)]];
    const sequence: string[] = [];
    const add = (
        id: string,
        opcode: string,
        inputs: Block['inputs'] = {},
        fields: Block['fields'] = {}
    ) => {
        blocks[id] = { opcode, inputs, fields };
        sequence.push(id);
    };
    const wait = (id: string, duration: number) =>
        add(id, 'control_wait', { DURATION: num(duration) });
    const drive = (id: string, speed: number, seconds: number) => {
        add(id + 'speed', 'flippermove_movementSpeed', { SPEED: num(speed) });
        add(id + 'go', 'flippermove_startSteer', { STEERING: num(0) });
        wait(id + 'time', seconds);
        add(id + 'stop', 'flippermove_stopMove');
        wait(id + 'settle', 0.4);
    };
    const lift = (id: string, direction: string) => {
        blocks[id + 'port'] = {
            opcode: 'flippermotor_single-motor-selector',
            inputs: {},
            fields: { 'field_flippermotor_single-motor-selector': ['C'] },
            shadow: true
        };
        blocks[id + 'direction'] = {
            opcode: 'flippermotor_custom-icon-direction',
            inputs: {},
            fields: { 'field_flippermotor_custom-icon-direction': [direction] },
            shadow: true
        };
        add(
            id,
            'flippermotor_motorTurnForDirection',
            { PORT: [1, id + 'port'], DIRECTION: [1, id + 'direction'], VALUE: num(180) },
            { UNIT: ['degrees'] }
        );
        wait(id + 'settle', 0.8);
    };
    add('start', 'flipperevents_whenProgramStarts');
    blocks.start.topLevel = true;
    drive('approach', 15, 1.4);
    lift('raise', 'clockwise');
    drive('carry', 18, 2.25);
    lift('lower', 'counterclockwise');
    drive('withdraw', -15, 1.3);
    wait('rest', 1);
    sequence.forEach((id, i) => {
        if (sequence[i + 1]) blocks[id].next = sequence[i + 1];
    });
    for (const [id, b] of Object.entries(blocks)) {
        if (b.next) blocks[b.next].parent = id;
        for (const input of Object.values(b.inputs))
            if (typeof input[1] === 'string') blocks[input[1]].parent = id;
    }
    return { targets: [{ isStage: true, variables: {}, blocks }] };
}
