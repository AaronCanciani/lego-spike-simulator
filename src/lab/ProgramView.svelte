<script lang="ts">
    import { onMount, onDestroy, createEventDispatcher } from 'svelte';
    import * as Blockly from 'blockly/core';
    import 'blockly/blocks';
    import * as En from 'blockly/msg/en';
    import '$lib/blockly/render';
    import '$lib/blockly/theme';
    import '$lib/blockly/field_variable_getter';
    import '$lib/blockly/field-bitmap';
    import '$lib/blockly/field-grid-dropdown';
    import '$lib/blockly/field-ultra-sound';
    import '$lib/blockly/field-sound';
    import '$lib/blockly/field_metadata';
    import { registerFieldAngle } from '$lib/blockly/field_angle';
    import { registerFieldColour } from '@blockly/field-colour';
    import { procedureBlocks } from '$lib/blockly/procedure_blocks';
    import {
        registerInputShadowExtension,
        applyInputShadowExtension
    } from '$lib/blockly/shadow_input';
    import { registerProcedureCallExtension } from '$lib/blockly/procedure_call_extension';
    import { blocks } from '$lib/blockly/blocks';
    import { convertToBlockly } from '$lib/scratch/blockly';
    import type { Project } from './engine';
    import { editedProject } from './editorProject';
    import { editorToolbox } from './editorToolbox';
    import {
        registerProcedureFlyout,
        type ProcedureCreateCallback
    } from '$lib/blockly/procedure_flyout';
    import type { BlocklyState } from '$lib/blockly/state';
    const dispatch = createEventDispatcher<{ edit: void }>();
    export let project: Project | null = null;
    export let building = false;
    export let active: string[] = [];
    export let follow = true;
    let host: HTMLDivElement, workspace: Blockly.WorkspaceSvg, observer: ResizeObserver;
    let loaded: Project | null = null,
        lastRoot = '',
        lastActive = '',
        issue = '';
    // Non-reactive identity bookkeeping prevents a child update from reloading the
    // old parent prop between capture() and the parent's next Svelte flush.
    const acceptedProjects = new WeakSet<Project>();
    let loadingWorkspace = false,
        appliedMode: boolean | undefined;
    let dialog: HTMLDialogElement,
        dialogKind = '',
        newName = '',
        dialogError = '';
    let parameters: { name: string; type: string[] }[] = [];
    let createProcedure: ProcedureCreateCallback | undefined;
    let permissions = new Map<
        string,
        { editable: boolean; movable: boolean; deletable: boolean }
    >();
    export function capture() {
        if (!workspace || !loaded || loadingWorkspace || issue)
            throw new Error(issue || 'The block editor is still loading.');
        return editedProject(
            Blockly.serialization.workspaces.save(workspace) as BlocklyState,
            loaded
        );
    }
    // Acknowledge an edit without reloading the workspace and losing its undo history.
    export function acknowledge(p: Project) {
        acceptedProjects.add(p);
        loaded = p;
    }
    export function undo(redo = false) {
        if (building) workspace?.undo(redo);
    }
    function openDialog(kind: string) {
        dialogKind = kind;
        newName = '';
        parameters = [];
        dialogError = '';
        dialog.showModal();
    }
    function makeItem() {
        const name = newName.trim();
        if (!name || /%[sb]/.test(name)) {
            dialogError = 'Enter a name without %s or %b.';
            return;
        }
        if (dialogKind === 'Variable') {
            if (
                workspace.getAllVariables().some((v) => v.name.toLowerCase() === name.toLowerCase())
            ) {
                dialogError = 'A variable with that name already exists.';
                return;
            }
            workspace.createVariable(name, 'Number');
        } else {
            if (
                workspace
                    .getAllBlocks(false)
                    .some(
                        (b) => b.type === 'procedures_prototype' && b.getFieldValue('NAME') === name
                    )
            ) {
                dialogError = 'A custom block with that name already exists.';
                return;
            }
            const names = parameters.map((p) => p.name.trim());
            if (names.some((n) => !n) || new Set(names).size !== names.length) {
                dialogError = 'Give each input a different, non-empty name.';
                return;
            }
            const params = parameters.map((p) => ({ ...p, name: p.name.trim() }));
            if (!createProcedure?.({ name, parameters: params, prototype: params })) return;
        }
        workspace.refreshToolboxSelection();
        dialog.close();
    }
    function setMode(editable: boolean) {
        if (!workspace || appliedMode === editable) return;
        appliedMode = editable;
        Blockly.hideChaff();
        workspace.getToolbox()?.setVisible(editable);
        workspace.getFlyout()?.hide();
        // Keep one workspace alive: undo history and block positions survive tab switches.
        workspace.options.readOnly = false;
        for (const b of workspace.getAllBlocks(false)) {
            if (!editable) {
                permissions.set(b.id, {
                    editable: b.isEditable(),
                    movable: b.isMovable(),
                    deletable: b.isDeletable()
                });
                b.setEditable(false);
                b.setMovable(false);
                b.setDeletable(false);
            } else {
                const p = permissions.get(b.id);
                if (p) {
                    b.setEditable(p.editable);
                    b.setMovable(p.movable);
                    b.setDeletable(p.deletable);
                }
            }
        }
        workspace.options.readOnly = !editable;
        Blockly.svgResize(workspace);
    }
    export function focus(id: string) {
        if (workspace?.getBlockById(id)) {
            workspace.centerOnBlock(id);
            lastRoot = workspace.getBlockById(id)!.getRootBlock().id;
        }
    }
    export function zoom(delta: number) {
        workspace?.zoomCenter(delta);
    }
    export function fit() {
        workspace?.zoomToFit();
    }
    function load(p: Project) {
        acceptedProjects.add(p);
        loaded = p;
        issue = '';
        loadingWorkspace = true;
        Blockly.Events.disable();
        try {
            workspace.options.readOnly = false;
            permissions.clear();
            appliedMode = undefined;
            workspace.clear();
            const state = convertToBlockly(p as any);
            if (!state) throw new Error('Unable to display this project.');
            Blockly.serialization.workspaces.load(state, workspace);
            const tops = workspace
                .getTopBlocks(false)
                .sort((a, b) =>
                    a.type === 'flipperevents_whenProgramStarts'
                        ? -1
                        : b.type === 'flipperevents_whenProgramStarts'
                          ? 1
                          : 0
                );
            let defY = 30,
                looseY = 30;
            for (const b of tops) {
                const saved =
                    (p as Project & { labEditorLayout?: boolean }).labEditorLayout &&
                    p.targets.some((t) => Number.isFinite((t.blocks[b.id] as any)?.x));
                if (saved) continue;
                const point = b.getRelativeToSurfaceXY(),
                    isMain = b.type === 'flipperevents_whenProgramStarts',
                    def = b.type === 'procedures_definition';
                b.moveBy(
                    (isMain ? 40 : def ? 820 : 1750) - point.x,
                    (isMain ? 30 : def ? defY : looseY) - point.y
                );
                if (def) defY += b.getHeightWidth().height + 70;
                else if (!isMain) looseY += b.getHeightWidth().height + 60;
            }
            workspace.setScale(0.72);
            Blockly.svgResize(workspace);
            if (tops[0]) {
                workspace.scroll(28, 28);
                lastRoot = tops[0].id;
            }
            lastActive = '';
            workspace.clearUndo();
        } catch (e) {
            issue = e instanceof Error ? e.message : String(e);
        } finally {
            setMode(building);
            Blockly.Events.enable();
            // Blockly's loader can leave undo recording off if loading throws.
            Blockly.Events.setRecordUndo(true);
            loadingWorkspace = false;
        }
    }
    function highlight(ids: string[]) {
        if (!workspace) return;
        const key = ids.join('|');
        if (lastActive === key) return;
        lastActive = key;
        workspace.highlightBlock(null);
        for (const id of ids) workspace.highlightBlock(id, true);
        const b = workspace.getBlockById(ids[0]);
        if (follow && b) {
            const root = b.getRootBlock().id;
            const rect = b.getSvgRoot()?.getBoundingClientRect(),
                viewport = host.getBoundingClientRect();
            if (
                root !== lastRoot ||
                (rect && (rect.top < viewport.top + 20 || rect.bottom > viewport.bottom - 40))
            )
                focus(b.id);
        }
    }
    onMount(() => {
        registerFieldAngle();
        registerFieldColour();
        Blockly.setLocale(En as any);
        Blockly.common.defineBlocksWithJsonArray(procedureBlocks);
        registerInputShadowExtension(Blockly);
        registerProcedureCallExtension(Blockly);
        Blockly.defineBlocksWithJsonArray(blocks);
        applyInputShadowExtension(Blockly);
        workspace = Blockly.inject(host, {
            renderer: 'spike_renderer',
            theme: 'spike',
            readOnly: false,
            toolbox: editorToolbox,
            disable: false,
            trashcan: false,
            media: '/blockly/media/',
            grid: { spacing: 24, length: 2, colour: '#cbd4dd', snap: false },
            zoom: { controls: false, wheel: true, startScale: 0.72, minScale: 0.25, maxScale: 1.5 },
            move: { scrollbars: true, drag: true, wheel: true }
        });
        registerProcedureFlyout(workspace, (callback) => {
            createProcedure = callback;
            openDialog('My Block');
        });
        workspace.registerButtonCallback('LAB_CREATE_VARIABLE', () => openDialog('Variable'));
        workspace.registerToolboxCategoryCallback('LAB_VARIABLES', () => {
            const items: any[] = [
                { kind: 'button', text: 'Make a variable', callbackkey: 'LAB_CREATE_VARIABLE' }
            ];
            const variables = workspace
                .getAllVariables()
                .filter((v) => !['list', 'broadcast'].includes(v.type));
            for (const variable of variables)
                items.push({
                    kind: 'block',
                    type: 'data_variable',
                    fields: { VARIABLE: { id: variable.getId() } }
                });
            if (variables[0])
                for (const type of ['data_setvariableto', 'data_changevariableby'])
                    items.push({
                        kind: 'block',
                        type,
                        fields: { VARIABLE: { id: variables[0].getId() } }
                    });
            return items;
        });
        workspace.addChangeListener((event) => {
            if (
                !loadingWorkspace &&
                building &&
                !event.isUiEvent &&
                event.type !== Blockly.Events.FINISHED_LOADING
            )
                dispatch('edit');
        });
        observer = new ResizeObserver(() => Blockly.svgResize(workspace));
        observer.observe(host);
        if (project) load(project);
    });
    onDestroy(() => {
        observer?.disconnect();
        workspace?.dispose();
    });
    $: if (workspace && project && !acceptedProjects.has(project)) load(project);
    $: if (workspace) highlight(active);
    $: if (workspace) setMode(building);
</script>

<div class="program-canvas" bind:this={host}></div>
{#if issue}<div class="display-error" role="alert">Block viewer: {issue}</div>{/if}
<dialog class="builder-dialog" bind:this={dialog} on:close={() => (dialogKind = '')}>
    <form on:submit|preventDefault={makeItem}>
        <span class="eyebrow">BUILD SOMETHING NEW</span>
        <h2>Make a {dialogKind === 'Variable' ? 'variable' : 'custom block'}</h2>
        <label>Name <input aria-label="Name" bind:value={newName} required maxlength="80" /></label>
        {#if dialogKind === 'My Block'}
            <p>Give your function inputs, then drag their pink reporters into its code.</p>
            {#each parameters as parameter, i}
                <label
                    >{parameter.type[0] === 'Boolean' ? 'True / false' : 'Number / text'} input
                    <input
                        aria-label={`Input ${i + 1} name`}
                        bind:value={parameter.name}
                        required
                    />
                </label>
            {/each}
            <div class="dialog-actions">
                <button
                    type="button"
                    on:click={() =>
                        (parameters = [
                            ...parameters,
                            { name: `input${parameters.length + 1}`, type: ['Number', 'String'] }
                        ])}>＋ Number / text</button
                >
                <button
                    type="button"
                    on:click={() =>
                        (parameters = [
                            ...parameters,
                            { name: `input${parameters.length + 1}`, type: ['Boolean'] }
                        ])}>＋ True / false</button
                >
            </div>
        {/if}
        {#if dialogError}<p role="alert">{dialogError}</p>{/if}
        <div class="dialog-actions">
            <button type="button" on:click={() => dialog.close()}>Cancel</button><button
                class="run-button"
                type="submit">Create</button
            >
        </div>
    </form>
</dialog>

<style>
    .program-canvas {
        width: 100%;
        height: 100%;
        min-height: 250px;
    }
    .display-error {
        position: absolute;
        inset: 30px;
        background: #fff0ef;
        padding: 24px;
        color: #a32929;
        z-index: 4;
    }
</style>
