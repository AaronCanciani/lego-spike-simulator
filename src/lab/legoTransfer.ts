import JSZip from 'jszip';
import type { Project } from './engine.ts';

type Archive = {
    manifest: Record<string, any>;
    outer: Record<string, string>;
    inner: Record<string, string>;
};
type TransferProject = Project & { labArchive?: Archive; [key: string]: any };
const limit = 32 * 1024 * 1024;
const emptyAsset = 'b6229967372e473079438136d6e7f144.svg';
const emptySvg = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>';
const icon =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80" rx="18" fill="#ffd346"/><path d="M30 35h40v30H30zM20 42v16m60-16v16" fill="none" stroke="#23344a" stroke-width="8"/></svg>';
async function members(zip: JSZip, exclude: string[]) {
    const result: Record<string, string> = {};
    let bytes = 0;
    const entries = Object.values(zip.files).filter((f) => !f.dir && !exclude.includes(f.name));
    if (entries.length > 1000) throw new Error('Too many project assets.');
    for (const entry of entries) {
        const data = await entry.async('uint8array');
        bytes += data.length;
        if (bytes > limit) throw new Error('Unpacked project assets exceed 32 MB.');
        result[entry.name] = await entry.async('base64');
    }
    return result;
}
export async function importLego(
    data: ArrayBuffer | Uint8Array | Blob
): Promise<{ project: Project; name: string }> {
    const outer = await JSZip.loadAsync(data);
    const scratch = outer.file('scratch.sb3');
    if (!scratch)
        throw new Error(
            'Choose a LEGO Word Blocks .llsp3 file. Python projects are not supported.'
        );
    const manifest = JSON.parse((await outer.file('manifest.json')?.async('text')) || '{}');
    if (manifest.type && manifest.type !== 'word-blocks')
        throw new Error('Only Word Blocks projects are supported.');
    const sb3 = await scratch.async('uint8array');
    if (sb3.length > limit) throw new Error('Unpacked project exceeds 32 MB.');
    const inner = await JSZip.loadAsync(sb3);
    const json = await inner.file('project.json')?.async('text');
    if (!json || json.length > 5000000) throw new Error('Missing or oversized block data.');
    const project = JSON.parse(json) as TransferProject;
    if (!Array.isArray(project.targets) || !project.targets.length)
        throw new Error('No Scratch targets in this project.');
    // Only local backups retain this archive. Export strips all simulator metadata.
    project.labArchive = {
        manifest,
        outer: await members(outer, ['manifest.json', 'scratch.sb3']),
        inner: await members(inner, ['project.json'])
    };
    return { project, name: String(manifest.name || 'My robot program') };
}
function defaults(stage: boolean, index: number) {
    return {
        isStage: stage,
        name: stage ? 'Stage' : `Robot-${index}`,
        variables: {},
        lists: {},
        broadcasts: {},
        blocks: {},
        comments: {},
        currentCostume: 0,
        costumes: [
            {
                assetId: emptyAsset.slice(0, -4),
                name: 'blank',
                bitmapResolution: 1,
                md5ext: emptyAsset,
                dataFormat: 'svg',
                rotationCenterX: 0,
                rotationCenterY: 0
            }
        ],
        sounds: [],
        volume: 100,
        ...(stage
            ? { tempo: 60, videoTransparency: 50, videoState: 'on', textToSpeechLanguage: null }
            : {
                  visible: true,
                  x: 0,
                  y: 0,
                  size: 100,
                  direction: 90,
                  draggable: false,
                  rotationStyle: 'all around'
              })
    };
}
export async function exportLego(input: Project, name: string): Promise<Uint8Array> {
    const original = structuredClone(input) as TransferProject;
    const archive = original.labArchive;
    const project: any = Object.fromEntries(
        Object.entries(original).filter(([key]) => !key.startsWith('lab'))
    );
    if (!Array.isArray(project.targets) || !project.targets.length)
        throw new Error('No program to export.');
    // Native presets have only a minimal target. LEGO expects a stage plus a robot sprite.
    if (!archive && project.targets.every((t: any) => t.isStage))
        project.targets.forEach((t: any) => (t.isStage = false));
    if (!project.targets.some((t: any) => t.isStage)) project.targets.unshift(defaults(true, 0));
    if (!project.targets.some((t: any) => !t.isStage)) project.targets.push(defaults(false, 1));
    project.targets = project.targets.map((t: any, index: number) => ({
        ...defaults(!!t.isStage, index),
        ...t
    }));
    const extensions = new Set<string>(project.extensions || []);
    for (const t of project.targets) {
        let rootIndex = 0;
        for (const [id, b] of Object.entries(t.blocks) as [string, any][]) {
            if (!b || typeof b.opcode !== 'string') throw new Error(`Invalid block ${id}.`);
            if (b.opcode.startsWith('flipper')) extensions.add(b.opcode.split('_')[0]);
            b.inputs ??= {};
            b.fields ??= {};
            b.next ??= null;
            b.parent ??= null;
            b.shadow ??= false;
            b.topLevel ??= !b.parent;
            if (b.topLevel) {
                b.x ??= 80 + rootIndex++ * 420;
                b.y ??= 80;
            }
            // Scratch expects field IDs even for ordinary non-variable fields.
            for (const field of Object.values(b.fields) as any[][])
                if (field.length === 1) field.push(null);
        }
    }
    project.extensions = [...extensions].sort();
    project.monitors ??= [];
    project.meta ??= { semver: '3.0.0', vm: '0.2.0-prerelease.20200512204241', agent: 'SPIKE Lab' };
    const inner = new JSZip();
    for (const [file, data] of Object.entries(archive?.inner || {}))
        inner.file(file, data, { base64: true });
    if (!inner.file(emptyAsset)) inner.file(emptyAsset, emptySvg);
    for (const target of project.targets)
        for (const asset of [...target.costumes, ...target.sounds]) {
            if (!inner.file(asset.md5ext))
                throw new Error(
                    `Missing original asset ${asset.md5ext}. Reopen the original LEGO file before exporting this program.`
                );
        }
    inner.file('project.json', JSON.stringify(project));
    const now = new Date().toISOString();
    const manifest = {
        type: 'word-blocks',
        autoDelete: false,
        created: now,
        size: 0,
        slotIndex: 0,
        workspaceX: 0,
        workspaceY: 0,
        zoomLevel: 0.675,
        showAllBlocks: false,
        version: 38,
        hardware: { 'spike-lab-hub': { type: 'flipper' } },
        state: { playMode: 'download', canvasDrawerTab: 'monitorTab', canvasDrawerOpen: false },
        extraFiles: [],
        toolboxFilter: 'prime',
        ...archive?.manifest,
        id: crypto.randomUUID().replaceAll('-', '').slice(0, 12),
        lastsaved: now,
        name,
        extensions: project.extensions
    };
    const outer = new JSZip();
    for (const [file, data] of Object.entries(archive?.outer || {}))
        outer.file(file, data, { base64: true });
    if (!outer.file('icon.svg')) outer.file('icon.svg', icon);
    outer.file('manifest.json', JSON.stringify(manifest));
    outer.file(
        'scratch.sb3',
        await inner.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
    );
    return outer.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
