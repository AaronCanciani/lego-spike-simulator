import { toolbox } from '../lib/blockly/toolbox';
import { statementOps, expressionOps } from './engine';

const names: Record<string, string> = {
    MOTOR: 'Motors',
    MOVEMENT: 'Driving',
    EVENT: 'Events',
    CONTROL: 'Control',
    SENSOR: 'Sensors',
    OPERATOR: 'Operators',
    'MORE-MOTOR': 'Motor readings'
};
// Only offer blocks the simulator can execute. Imported unsupported blocks remain visible.
export const editorToolbox = {
    kind: 'categoryToolbox',
    contents: toolbox.contents
        .filter((c) => !c.custom)
        .map((c) => ({
            ...c,
            name: names[c.name] || c.name,
            contents: c.contents?.filter(
                (b) => statementOps.has(b.type) || expressionOps.has(b.type)
            )
        }))
        .filter((c) => c.contents?.length)
        .concat([
            { kind: 'category', name: 'Variables', custom: 'LAB_VARIABLES', colour: '#ff9835' },
            { kind: 'category', name: 'My Blocks', custom: 'SPIKE_BLOCKS', colour: '#ff5d64' }
        ] as any)
};
