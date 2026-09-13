import { convertToScratch } from '../lib/scratch/blockly';
import type { BlocklyState } from '../lib/blockly/state';
import type { Project } from './engine';
import { flatten, inspect } from './engine';

/** Incomplete programs must still reopen for editing, even when they cannot run. */
export function inspectForEditor(project: Project): ReturnType<typeof inspect> {
    try {
        return inspect(project);
    } catch {
        const blocks = flatten(project);
        return {
            blocks,
            total: Object.keys(blocks).length,
            starts: [],
            procedures: new Map(),
            reachable: new Set(),
            unsupported: [],
            unusedUnsupported: []
        };
    }
}

/** Update code, not the imported project's assets, target metadata or initial variable values. */
export function editedProject(state: BlocklyState, original: Project): Project {
    const converted = convertToScratch(state);
    const result = structuredClone(original) as typeof converted;
    const destination = Math.max(
        0,
        result.targets.findIndex((t) => !t.isStage)
    );
    for (const target of result.targets) {
        target.blocks = {};
        target.variables = {};
    }
    for (const [id, block] of Object.entries(converted.targets[1].blocks)) {
        const owner = original.targets.findIndex((t) => id in t.blocks);
        const old = original.targets[owner]?.blocks[id];
        // Retain mutation attributes (e.g. warp) that the block UI does not edit.
        if (old?.mutation && block.mutation)
            block.mutation = { ...old.mutation, ...block.mutation, warp: old.mutation.warp };
        result.targets[owner < 0 ? destination : owner].blocks[id] = block;
    }
    for (const [id, variable] of Object.entries(converted.targets[1].variables)) {
        const owner = original.targets.findIndex((t) => id in (t.variables || {}));
        const old = original.targets[owner]?.variables?.[id];
        result.targets[owner < 0 ? destination : owner].variables[id] = [
            variable[0],
            old ? structuredClone(old[1]) : 0
        ];
    }
    return { ...result, labEditorLayout: true } as Project;
}

export function blankProject(): Project {
    return {
        targets: [
            {
                isStage: false,
                variables: {},
                blocks: {
                    'lab-start': {
                        opcode: 'flipperevents_whenProgramStarts',
                        topLevel: true,
                        inputs: {},
                        fields: {}
                    }
                }
            }
        ]
    };
}
