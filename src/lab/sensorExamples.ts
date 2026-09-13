import type { Block, Project } from './engine.ts';
// Ordinary Scratch graphs; no privileged simulator controller.
export function sensorExample(kind: 'distance' | 'force' | 'color'): Project {
    const num = (n: number) => [1, [4, String(n)]];
    const ref = (id: string) => [2, id];
    const b = (
        opcode: string,
        inputs: Block['inputs'] = {},
        fields: Block['fields'] = {},
        next?: string
    ): Block => ({ opcode, inputs, fields, next });
    const selector = `flippersensors_${kind}-sensor-selector`;
    const blocks: Record<string, Block> = {
        start: { ...b('flipperevents_whenProgramStarts', {}, {}, 'speed'), topLevel: true },
        speed: b('flippermove_movementSpeed', { SPEED: num(kind === 'force' ? 15 : 25) }, {}, 'go'),
        go: b('flippermove_startSteer', { STEERING: num(0) }, {}, 'wait'),
        wait: b('control_wait_until', { CONDITION: ref('condition') }, {}, 'stop'),
        stop: b('flippermove_stopMove'),
        port: { ...b(selector, {}, { [`field_${selector}`]: ['B'] }), shadow: true },
        condition:
            kind === 'force'
                ? b('flippersensors_isPressed', { PORT: [1, 'port'] }, { OPTION: ['pressed'] })
                : b(
                      kind === 'color'
                          ? 'flippersensors_isReflectivity'
                          : 'flippersensors_isDistance',
                      { PORT: [1, 'port'], VALUE: num(kind === 'color' ? 25 : 20) },
                      { COMPARATOR: ['<'], ...(kind === 'distance' ? { UNIT: ['cm'] } : {}) }
                  )
    };
    for (const [id, block] of Object.entries(blocks)) {
        if (block.next) blocks[block.next].parent = id;
        for (const input of Object.values(block.inputs))
            if (typeof input[1] === 'string') blocks[input[1]].parent = id;
    }
    return { targets: [{ isStage: true, variables: {}, blocks }] };
}
