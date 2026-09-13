<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import JSZip from 'jszip';
    import ProgramView from './lab/ProgramView.svelte';
    import { blankProject, inspectForEditor } from './lab/editorProject';
    import WorldView from './lab/WorldView.svelte';
    import { drivingExample } from './lab/examples';
    import { sensorExample } from './lab/sensorExamples';
    import { colorExample, resultVariable, type ColorExperiment } from './lab/colorExamples';
    import { samplePixels } from './lab/colorSampling';
    import { courseStart } from './lab/sensorCourse';
    import { jointExample } from './lab/jointExample';
    import { defaultSensors } from './lab/sensors';
    import { coralExample } from './lab/missionExample';
    import { coralMission, MissionMonitor } from './lab/mission';
    import {
        Engine,
        defaultProfile,
        inspect,
        WIDTH,
        HEIGHT,
        DT,
        wrap,
        type Project,
        type Profile
    } from './lab/engine';
    import './lab/lab.css';
    let project: Project | null = null,
        engine: Engine,
        program: ProgramView,
        world: WorldView,
        fileInput: HTMLInputElement;
    let name = 'New code blocks',
        error = '',
        loading = true,
        settings = false,
        follow = true,
        showTrail = true,
        showSensors = false,
        placing = false,
        map = '2024',
        speed = 1,
        split = 50;
    let profile: Profile = structuredClone(defaultProfile),
        realism = 'illustrative',
        lastFile: File | null = null,
        example = '';
    let start = { x: -950, y: -330, heading: 180 },
        snapshot = new Engine({ targets: [] }).snapshot(),
        path: [number, number][] = [],
        info: ReturnType<typeof inspect> | null = null;
    let roots: { id: string; label: string }[] = [],
        selectedRoot = '',
        frame = 0,
        last = 0,
        accumulator = 0,
        resizeStart = false,
        steps = 0;
    let mapCanvas: HTMLCanvasElement | null = null,
        mapPixels: ImageData | null = null,
        mapReady = false;
    let readyMap = '';
    let mission = false,
        monitor: MissionMonitor | null = null,
        missionState = new MissionMonitor(start).snapshot();
    let appearance = 'advanced',
        modelStatus = 'Optional imported reference has not been loaded';
    let followRobot = false;
    let mode: 'build' | 'run' = 'run',
        dirty = false,
        unsaved = false;
    let draftStatus = '',
        draftTimer: ReturnType<typeof setTimeout>;
    const draftKey = 'spike-lab-program-draft-v1';
    function saveDraft() {
        try {
            const p = dirty ? program.capture() : project;
            localStorage.setItem(
                draftKey,
                JSON.stringify({ format: 'spike-lab', version: 1, name, project: p })
            );
            draftStatus = 'Draft saved in this browser';
        } catch (e) {
            draftStatus = 'Draft not saved — use Save program';
        }
    }
    function edited() {
        dirty = true;
        unsaved = true;
        draftStatus = 'Saving draft…';
        clearTimeout(draftTimer);
        draftTimer = setTimeout(saveDraft, 500);
    }
    function replaceAllowed() {
        return (
            !unsaved ||
            window.confirm(
                'Replace your edited program and its local draft? Make sure you have saved a copy if you want to keep it.'
            )
        );
    }
    function commitEdits() {
        if (!dirty) return true;
        try {
            const p = program.capture();
            inspect(p); // Validate before replacing the last runnable program.
            program.acknowledge(p);
            accept(p, name, true);
            saveDraft();
            return true;
        } catch (e) {
            error = `Check your blocks: ${e instanceof Error ? e.message : String(e)}`;
            return false;
        }
    }
    function switchMode(next: 'build' | 'run') {
        if (next === 'run' && !commitEdits()) return false;
        if (next === 'build' && engine?.state === 'running') {
            engine.state = 'paused';
            update();
        }
        placing = false;
        mode = next;
        return true;
    }
    function newProgram() {
        if (!replaceAllowed()) return;
        accept(blankProject(), 'My robot program');
        lastFile = null;
        mission = false;
        switchMode('build');
        saveDraft();
    }
    function downloadProgram() {
        try {
            const p = dirty ? program.capture() : project;
            const url = URL.createObjectURL(
                new Blob(
                    [
                        JSON.stringify(
                            { format: 'spike-lab', version: 1, name, project: p },
                            null,
                            2
                        )
                    ],
                    { type: 'application/json' }
                )
            );
            const link = document.createElement('a');
            link.href = url;
            link.download = `${name.replace(/[^a-z0-9 _-]/gi, '').trim() || 'My program'}.spikelab`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            saveDraft();
            announce(
                'Program download requested. If no file appears, open SPIKE Lab in a standard browser. Your local draft is kept.'
            );
        } catch (e) {
            error = String(e);
        }
    }
    let notice = '',
        noticeTimer: ReturnType<typeof setTimeout>;
    const fmt = (v: number, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '—');
    function update() {
        if (!engine) return;
        snapshot = engine.snapshot();
        path = engine.path.slice();
        steps = engine.trace.length;
        if (monitor) missionState = monitor.snapshot();
    }
    function activeProfile() {
        return realism === 'ideal'
            ? {
                  ...profile,
                  mismatch: 0,
                  motorMismatch: 0,
                  slip: 0,
                  gyroBias: 0,
                  gyroNoise: 0,
                  sensorConfig: { ...profile.sensorConfig, errors: false },
                  response: 0.005
              }
            : profile;
    }
    function sampleColor(x: number, y: number) {
        if (!mapPixels || !mapCanvas) return { color: 10, reflection: 90 };
        return samplePixels(mapPixels, x, y);
    }
    function reset() {
        if (!project) return;
        try {
            engine = new Engine(project, activeProfile(), start);
            monitor = mission ? new MissionMonitor(start) : null;
            missionState = new MissionMonitor(start).snapshot();
            engine.colorAt = sampleColor;
            engine.sampleSensors();
            accumulator = 0;
            error = '';
            update();
        } catch (e) {
            error = e instanceof Error ? e.message : String(e);
            if (engine) {
                engine.state = 'error';
                engine.halt();
                update();
            }
        }
    }
    function announce(message: string) {
        notice = message;
        clearTimeout(noticeTimer);
        noticeTimer = setTimeout(() => (notice = ''), 4500);
    }
    function accept(p: Project, title: string, fromEditor = false) {
        if (!Array.isArray(p.targets) || !p.targets.length)
            throw new Error('This file does not contain a Scratch block program.');
        const report = inspectForEditor(p);
        if (report.total > 12000)
            throw new Error('This project exceeds the preview’s 12,000-block limit.');
        project = p;
        clearTimeout(draftTimer);
        dirty = false;
        if (!fromEditor) {
            unsaved = false;
            draftStatus = '';
        }
        info = report;
        name = title;
        roots = Object.entries(report.blocks)
            .filter(
                ([, b]) =>
                    b.topLevel &&
                    (b.opcode === 'flipperevents_whenProgramStarts' ||
                        b.opcode === 'procedures_definition')
            )
            .map(([id, b]) => ({
                id,
                label:
                    b.opcode === 'flipperevents_whenProgramStarts'
                        ? 'When program starts'
                        : report.blocks[b.inputs.custom_block?.[1]]?.mutation?.proccode
                              .replace(/%[sb]/g, '')
                              .replace(/\s+/g, ' ')
                              .trim() || 'Custom block'
            }));
        roots.sort((a, b) =>
            a.label === 'When program starts' ? -1 : b.label === 'When program starts' ? 1 : 0
        );
        selectedRoot = roots[0]?.id || '';
        error = '';
        reset();
        loading = false;
        if (!fromEditor) saveDraft();
    }
    async function loadSample() {
        if (!replaceAllowed()) return;
        loading = true;
        try {
            const response = await fetch('/samples/new-code-blocks.json');
            if (!response.ok) throw new Error('Sample program could not be loaded.');
            accept(await response.json(), 'New code blocks');
        } catch (e) {
            error = String(e);
            loading = false;
        }
    }
    async function loadFile(file: File) {
        if (!replaceAllowed()) return;
        loading = true;
        try {
            if (file.size > 15 * 1024 * 1024)
                throw new Error('Choose a project smaller than 15 MB.');
            if (file.name.toLowerCase().endsWith('.spikelab')) {
                const saved = JSON.parse(await file.text());
                if (saved.format !== 'spike-lab' || saved.version !== 1)
                    throw new Error('This is not a supported SPIKE Lab program.');
                accept(saved.project, String(saved.name || 'My robot program'));
                lastFile = file;
                saveDraft();
                return;
            }
            const outer = await JSZip.loadAsync(file);
            const nested = outer.file('scratch.sb3');
            if (!nested)
                throw new Error(
                    'Choose a LEGO Word Blocks .llsp3 file. Python projects are not supported.'
                );
            const inner = await JSZip.loadAsync(await nested.async('arraybuffer'));
            const entry = inner.file('project.json');
            if (!entry) throw new Error('The project is missing its block data.');
            const text = await entry.async('text');
            if (text.length > 5000000) throw new Error('The project block data is too large.');
            accept(JSON.parse(text), file.name.replace(/\.llsp3$/i, ''));
            lastFile = file;
            announce('Program loaded. Your field and robot settings are kept.');
        } catch (e) {
            error = e instanceof Error ? e.message : String(e);
            loading = false;
        }
    }
    function loadExample() {
        if (!example) return;
        if (!replaceAllowed()) {
            example = '';
            return;
        }
        mission = example.startsWith('coral');
        if (example === 'joints') {
            start = { x: 0, y: -100, heading: 0 };
            if (map !== 'practice') {
                map = 'practice';
                mapReady = false;
            }
            appearance = 'advanced';
            lastFile = null;
            accept(jointExample(), 'Robot showcase · wheels & tools');
            world?.robotCloseup();
            announce(
                'Real motor commands: drive forward/back, raise C/D tools, then lower them. Geometry is an ADB-style approximation.'
            );
            example = '';
            return;
        }
        if (example.startsWith('course-')) {
            const kind = example.slice(7) as ColorExperiment;
            profile.sensorConfig = structuredClone(defaultSensors);
            profile.sensorConfig.ports.B.height = 16;
            profile.sensorConfig.ports.F.height = 16;
            start = { ...courseStart[kind] };
            if (map !== 'sensor-course') {
                map = 'sensor-course';
                mapReady = false;
            }
            lastFile = null;
            showSensors = true;
            accept(
                colorExample(kind),
                kind === 'line' ? 'Follow the curve · stop at red' : `Color mode · stop at ${kind}`
            );
            announce(
                'B/F color sensors raised to 16 mm. Uses live sensor feedback; times out after 12 seconds if the target is missed.'
            );
            example = '';
            return;
        }
        if (example.startsWith('sensor-')) {
            const kind = example.slice(7) as 'color' | 'distance' | 'force';
            profile.sensorConfig = structuredClone(defaultSensors);
            profile.sensorConfig.ports.B = {
                kind,
                forward: 100,
                side: 0,
                height: kind === 'color' ? 8 : 35
            };
            start = { x: 0, y: kind === 'color' ? -350 : -400, heading: 0 };
            if (map !== 'practice') {
                map = 'practice';
                mapReady = false;
            }
            lastFile = null;
            showSensors = true;
            accept(
                sensorExample(kind),
                kind === 'color'
                    ? 'Reflection · stop at the line'
                    : kind === 'distance'
                      ? 'Distance · stop before the wall'
                      : 'Force · stop on probe contact'
            );
            announce(
                'Port B is configured for this experiment. Sensor mounts and noise remain adjustable.'
            );
            example = '';
            return;
        }
        if (mission) {
            start = { ...coralMission.start };
            if (map !== '2024') {
                map = '2024';
                mapReady = false;
            }
            lastFile = null;
            accept(
                coralExample(example === 'coral'),
                example === 'coral'
                    ? 'Coral Nursery · gyro route'
                    : 'Coral Nursery · open-loop route'
            );
            announce(
                'Training route: approach the cyan target, raise tool C, then return to the green launch area.'
            );
            example = '';
            return;
        }
        start = { x: 0, y: -400, heading: 0 };
        if (map !== 'practice') {
            map = 'practice';
            mapReady = false;
        }
        lastFile = null;
        accept(
            drivingExample(example === 'gyro'),
            example === 'gyro' ? 'Gyro feedback · 2 seconds' : 'Open loop · 2 seconds'
        );
        announce('Same speed and duration. Compare the trail; try increasing wheel mismatch.');
        example = '';
    }
    function toggle() {
        if (mode === 'build' && !switchMode('run')) return;
        if (!engine || !mapReady) return;
        if (info?.unsupported.length) return;
        placing = false;
        if (snapshot.state === 'running') engine.state = 'paused';
        else {
            if (['finished', 'error'].includes(snapshot.state)) reset();
            if (error) return;
            engine.start();
        }
        update();
    }
    function step() {
        if (!engine || !mapReady) return;
        if (['ready', 'finished', 'error'].includes(engine.state)) {
            if (engine.state !== 'ready') reset();
            if (error) return;
            engine.start();
        } else engine.state = 'running';
        engine.step();
        monitor?.observe(engine);
        if (engine.state === 'running') engine.state = 'paused';
        update();
    }
    function tick(now: number) {
        frame = requestAnimationFrame(tick);
        const elapsed = Math.min((now - last) / 1000, 0.1);
        last = now;
        if (engine?.state === 'running') {
            accumulator += elapsed * speed;
            let ticks = 0;
            while (accumulator >= DT && ticks++ < 100) {
                engine.step();
                monitor?.observe(engine);
                accumulator -= DT;
            }
            update();
        } else accumulator = 0;
    }
    function fieldReady(event: CustomEvent<HTMLCanvasElement>) {
        mapCanvas = event.detail;
        mapPixels = mapCanvas
            .getContext('2d')!
            .getImageData(0, 0, mapCanvas.width, mapCanvas.height);
        mapReady = true;
        readyMap = map;
        reset();
    }
    function selectMap() {
        if (map !== '2024') mission = false;
        mapReady = map === readyMap;
        reset();
    }
    function placement(event: CustomEvent<{ x: number; y: number }>) {
        start = { ...start, ...event.detail };
        placing = false;
        reset();
        announce('Start position updated.');
    }
    function setProfile() {
        profile = { ...profile };
        reset();
    }
    const sensorPorts = ['B', 'F'] as const;
    function changeSensor(port: 'B' | 'F') {
        const mount = profile.sensorConfig.ports[port];
        Object.assign(mount, {
            forward: 100,
            side: mount.kind === 'color' ? (port === 'B' ? -45 : 45) : 0,
            height: mount.kind === 'color' ? 8 : 35
        });
        profile = { ...profile };
        reset();
    }
    function resize(event: PointerEvent) {
        if (resizeStart)
            split = Math.max(30, Math.min(70, (event.clientX / window.innerWidth) * 100));
    }
    function onKey(event: KeyboardEvent) {
        if (mode === 'build') return;
        if (
            event.code === 'Space' &&
            !['INPUT', 'SELECT', 'BUTTON', 'TEXTAREA'].includes(
                (event.target as HTMLElement).tagName
            )
        ) {
            event.preventDefault();
            toggle();
        }
    }
    onMount(() => {
        let restored = false;
        try {
            const draft = JSON.parse(localStorage.getItem(draftKey) || 'null');
            if (draft?.format === 'spike-lab' && draft.version === 1) {
                accept(draft.project, String(draft.name || 'My robot program'));
                mode = 'build';
                draftStatus = 'Restored your local draft';
                restored = true;
            }
        } catch {
            /* A corrupt or unavailable local draft must not block opening the app. */
        }
        if (!restored) loadSample();
        last = performance.now();
        frame = requestAnimationFrame(tick);
    });
    onDestroy(() => {
        cancelAnimationFrame(frame);
        clearTimeout(noticeTimer);
        clearTimeout(draftTimer);
    });
    $: busy = snapshot.state === 'running';
    $: status =
        snapshot.state === 'ready'
            ? 'Ready to run'
            : snapshot.state === 'running'
              ? 'Running'
              : snapshot.state === 'paused'
                ? 'Paused'
                : snapshot.state === 'finished'
                  ? 'Run complete'
                  : 'Needs attention';
</script>

<svelte:head
    ><title>SPIKE Lab · Robot simulator</title><meta
        name="description"
        content="Watch your SPIKE Word Blocks drive a virtual Advanced Driving Base. Explore motion, sensing and repeatable robot experiments."
    /><link rel="icon" href="/lab-icon.svg" /></svelte:head
>
<svelte:window
    on:pointermove={resize}
    on:pointerup={() => (resizeStart = false)}
    on:keydown={onKey}
    on:beforeunload={(event) => {
        if (unsaved) {
            saveDraft();
            event.preventDefault();
            event.returnValue = '';
        }
    }}
/>

<div class="lab-shell">
    <header class="topbar">
        <a class="brand" href="/" aria-label="SPIKE Lab home"
            ><span class="brand-mark">S<span>·</span></span><span
                >SPIKE<span class="brand-light">LAB</span></span
            ></a
        >
        <div class="project-title">
            <span class="eyebrow">WORKSPACE</span><strong>{name}</strong>
        </div>
        <div class="top-actions">
            <button class="quiet" disabled={busy || loading} on:click={newProgram}>New</button>
            <button class="quiet" disabled={loading || !project} on:click={downloadProgram}
                >Save program</button
            >
            <select
                aria-label="Load a driving experiment"
                bind:value={example}
                disabled={busy || loading}
                on:change={loadExample}
                ><option value="">Experiments</option><option value="open">Open-loop drive</option
                ><option value="gyro">Gyro feedback</option><option value="coral"
                    >Coral Nursery · gyro route</option
                ><option value="coral-open">Coral Nursery · open loop</option>
                <option value="sensor-color">Reflection · stop at line</option>
                <option value="sensor-distance">Distance · stop before wall</option>
                <option value="sensor-force">Force · stop on contact</option>
                <option value="course-red">Color · stop at red</option><option value="course-blue"
                    >Color · stop at blue</option
                ><option value="course-line">Line · follow curve to red</option>
                <option value="joints">Robot · wheels & tools</option></select
            ><button
                class="quiet"
                disabled={busy || loading}
                on:click={() => (lastFile ? loadFile(lastFile) : loadSample())}
                title="Reopen the last uploaded program, or the original My Blocks sample"
                >↻ <span>Reload</span></button
            ><button class="load-button" disabled={busy} on:click={() => fileInput.click()}
                >＋ Load program</button
            >
        </div>
        <input
            hidden
            type="file"
            accept=".llsp3,.spikelab"
            bind:this={fileInput}
            on:change={() => {
                if (fileInput.files?.[0]) loadFile(fileInput.files[0]);
                fileInput.value = '';
            }}
        />
    </header>
    <div class="transport">
        <div class="mode-tabs" role="tablist" aria-label="Workspace mode">
            <button role="tab" aria-selected={mode === 'build'} on:click={() => switchMode('build')}
                >Build</button
            >
            <button role="tab" aria-selected={mode === 'run'} on:click={() => switchMode('run')}
                >Run</button
            >
        </div>
        <div class="run-controls">
            <button
                class="run-button"
                on:click={toggle}
                disabled={loading || !mapReady || (mode === 'run' && !!info?.unsupported.length)}
                >{busy ? 'Ⅱ Pause' : '▶ Run'}</button
            ><button
                class="icon-button"
                aria-label="Step one simulation tick"
                title="Step one 5 ms simulation tick"
                disabled={mode === 'build' ||
                    busy ||
                    loading ||
                    !mapReady ||
                    !!info?.unsupported.length}
                on:click={step}>▸│</button
            ><button
                class="icon-button"
                aria-label="Reset run"
                title="Reset run"
                on:click={reset}
                disabled={loading}>↺</button
            >
            <div class="control-rule"></div>
            <label class="speed-label"
                >Speed <select bind:value={speed}
                    ><option value={0.25}>¼×</option><option value={0.5}>½×</option><option
                        value={1}>1×</option
                    ><option value={2}>2×</option><option value={4}>4×</option></select
                ></label
            >
        </div>
        <div class="run-status" aria-live="polite">
            <span class:running={busy} class="status-dot"></span>{loading
                ? 'Loading program…'
                : mode === 'build' && dirty
                  ? 'Edits ready to test'
                  : status}<span class="clock">{fmt(snapshot.time, 2)} s</span>
        </div>
        <button
            class="profile-button"
            class:selected={settings}
            on:click={() => (settings = !settings)}
            >⚙ <span>Advanced Driving Base</span><span class="chevron">⌄</span></button
        >
    </div>
    {#if error || snapshot.error}<div class="error-banner" role="alert">
            {error || snapshot.error}<button
                on:click={() => {
                    error = '';
                    reset();
                }}>Dismiss</button
            >
        </div>{/if}
    {#if info?.unsupported.length}<div class="error-banner" role="alert">
            This program uses blocks not supported yet: {info.unsupported.join(', ')}
        </div>{/if}
    {#if mission && mode === 'run'}
        <section class="mission-brief" aria-label="Coral Nursery training mission">
            <div>
                <strong>M01 · Coral Nursery</strong><small
                    >Approach 42.5 cm → lift C → reverse home · authored training route</small
                >
            </div>
            <div class="mission-checks">
                <span class:done={missionState.validLaunch}>① Launch</span><span
                    class:done={missionState.aligned}>② Align</span
                ><span class:done={missionState.activated}>③ Lift C</span><span
                    class:done={missionState.returned}>④ Home</span
                >
            </div>
            {#if missionState.returned}<strong role="status">Practice complete ✓</strong>{/if}
            <a href={coralMission.rulebook} target="_blank" rel="noreferrer">Official mission ↗</a>
            <small class="mission-caveat"
                >Approximate landmarks and tool-contact check. No official scoring or other mission
                collisions yet.</small
            >
        </section>
    {/if}
    <main class="workspace" class:build-mode={mode === 'build'} style={`--split:${split}%`}>
        <section
            class="code-panel"
            aria-label={mode === 'build' ? 'Block program editor' : 'Read-only program'}
        >
            <div class="panel-heading">
                <div>
                    <span class="panel-index">01</span>
                    <h1>{mode === 'build' ? 'Build your program' : 'Program flow'}</h1>
                </div>
                <span class="subtle-tag"
                    >{mode === 'build' ? 'DRAG · CONNECT · EXPERIMENT' : 'READ ONLY'}</span
                >
            </div>
            <div class="code-tools">
                <select
                    aria-label="Inspect a program or custom block"
                    bind:value={selectedRoot}
                    on:change={() => {
                        follow = false;
                        program.focus(selectedRoot);
                    }}
                    >{#each roots as root}<option value={root.id}>{root.label}</option
                        >{/each}</select
                >{#if mode === 'build'}
                    <div class="editor-actions">
                        <button class="quiet" on:click={() => program.undo()}>Undo</button><button
                            class="quiet"
                            on:click={() => program.undo(true)}>Redo</button
                        ><span
                            >{draftStatus ||
                                'Pick a category, then drag a block into your program'}</span
                        >
                    </div>
                {:else}<label class="check-label"
                        ><input type="checkbox" bind:checked={follow} /> Follow</label
                    >{/if}
            </div>
            <div class="block-surface">
                <ProgramView
                    bind:this={program}
                    {project}
                    building={mode === 'build'}
                    active={mode === 'run' ? snapshot.active : []}
                    {follow}
                    on:edit={edited}
                />
                <div class="zoom-tools">
                    <button aria-label="Zoom blocks out" on:click={() => program.zoom(-1)}>−</button
                    ><button on:click={() => program.fit()}>Fit</button><button
                        aria-label="Zoom blocks in"
                        on:click={() => program.zoom(1)}>＋</button
                    >
                </div>
                {#if loading}<div class="loading-cover">Opening your program…</div>{/if}
            </div>
            <div class="execution-inspector" class:mode-hidden={mode === 'build'}>
                <span class="eyebrow"
                    >{snapshot.calls.length ? 'INSIDE CUSTOM BLOCK' : 'EXECUTION'}</span
                ><strong
                    >{snapshot.calls.at(-1) ||
                        (busy
                            ? 'Following the main program'
                            : snapshot.state === 'finished'
                              ? 'All start scripts have finished'
                              : 'Press Run to follow the blocks')}</strong
                >
                <div class="arguments">
                    {#each Object.entries(snapshot.args) as [key, value]}<span
                            >{key} <b>{String(value)}</b></span
                        >{/each}
                </div>
            </div>
            <div class="code-footer">
                <span
                    >{#if mode === 'build' && draftStatus}{draftStatus}{:else}{info?.total || 0} blocks
                        <span class="tiny-divider">/</span>
                        {info?.procedures.size || 0} custom blocks{/if}</span
                ><span
                    >{mode === 'build'
                        ? 'Run → watch your robot • Save program → keep a copy'
                        : `${steps} execution events`}</span
                >
            </div>
        </section>
        <button
            class="splitter"
            class:mode-hidden={mode === 'build'}
            aria-label="Resize program and simulator panels"
            on:pointerdown={() => (resizeStart = true)}
            on:keydown={(e) => {
                if (e.key === 'ArrowLeft') split = Math.max(30, split - 5);
                if (e.key === 'ArrowRight') split = Math.min(70, split + 5);
            }}><span></span></button
        >
        <section
            class="simulation-panel"
            class:mode-hidden={mode === 'build'}
            aria-label="3D robot simulation"
        >
            <div class="panel-heading dark">
                <div>
                    <span class="panel-index">02</span>
                    <h2>Robot playground</h2>
                </div>
                <select
                    aria-label="Competition field"
                    bind:value={map}
                    disabled={busy}
                    on:change={selectMap}
                    ><option value="2024">SUBMERGED · 2024</option><option value="2023"
                        >MASTERPIECE · 2023</option
                    ><option value="practice">Calibration grid</option><option value="sensor-course"
                        >Color & line course</option
                    ></select
                >
            </div>
            <div class="world-surface">
                <WorldView
                    bind:this={world}
                    pose={snapshot}
                    {path}
                    {map}
                    {showTrail}
                    {showSensors}
                    {placing}
                    {appearance}
                    bind:followRobot
                    motors={snapshot.motors}
                    sensors={snapshot.sensors}
                    {profile}
                    {mission}
                    missionActivated={missionState.activated}
                    on:modelstatus={(e) => (modelStatus = e.detail)}
                    on:mapready={fieldReady}
                    on:place={placement}
                    on:error={(e) => (error = e.detail)}
                />
                <div class="world-top">
                    <span class="field-tag"
                        >{map === 'practice' || map === 'sensor-course'
                            ? 'PRACTICE FIELD'
                            : 'FLL CHALLENGE'}<small
                            >{map === 'sensor-course'
                                ? 'Color markers + curved line'
                                : map === 'practice'
                                  ? 'Grid and color targets'
                                  : 'Mat + boundary walls'}</small
                        ><small title={modelStatus}
                            >{appearance === 'advanced'
                                ? 'ADB-style model · approximate assembly'
                                : appearance === 'cylinder'
                                  ? 'Cylinder proxy'
                                  : modelStatus.startsWith('Animated')
                                    ? 'Reference build · not exact ADB'
                                    : 'ADB approximation · reference unavailable/loading'}</small
                        ></span
                    >
                    <div class="camera-tools">
                        <button title="Overhead camera" on:click={() => world.overhead()}
                            >Top</button
                        ><button title="Reset 3D camera" on:click={() => world.home()}>3D</button
                        ><button
                            title="Inspect robot and moving tools"
                            on:click={() => world.robotCloseup()}>Robot</button
                        ><button
                            class:active={followRobot}
                            title="Keep the camera with the moving robot"
                            on:click={() => (followRobot = !followRobot)}>Follow</button
                        >
                    </div>
                </div>
                <div class="world-bottom">
                    <button
                        class:active={placing}
                        disabled={busy}
                        on:click={() => (placing = !placing)}
                        >{placing ? 'Click the mat to place' : '⌖ Place robot'}</button
                    ><label
                        >Heading <input
                            aria-label="Starting heading in degrees"
                            type="number"
                            min="-360"
                            max="360"
                            step="5"
                            bind:value={start.heading}
                            disabled={busy}
                            on:change={reset}
                        />°</label
                    ><button class:active={showTrail} on:click={() => (showTrail = !showTrail)}
                        >Trail</button
                    ><button
                        class:active={showSensors}
                        on:click={() => (showSensors = !showSensors)}>Sensors</button
                    >
                </div>
                {#if snapshot.collision}<div class="collision-label">
                        Boundary contact · wheels may still turn
                    </div>{/if}
            </div>
            {#if showSensors}<div class="sensor-hud" aria-label="Live sensor readings">
                    {#each Object.entries(snapshot.sensors) as [port, s]}
                        <div>
                            <strong>{port} · {s.kind}</strong>
                            <span
                                >{s.kind === 'color'
                                    ? `${s.reflection}% · ${s.color === -1 ? 'no color' : 'color ' + s.color}`
                                    : s.kind === 'distance'
                                      ? s.distance === null
                                          ? 'No echo'
                                          : `${fmt(s.distance / 10)} cm`
                                      : s.kind === 'force'
                                        ? `${fmt(s.force)} N · ${s.pressed ? 'pressed' : 'released'}`
                                        : 'Not connected'}</span
                            >
                            <small>{s.quality}</small>
                        </div>
                    {/each}
                    <small
                        >100 Hz · {realism === 'ideal'
                            ? 'errors off'
                            : 'research baseline, not calibrated'}</small
                    >
                </div>{/if}
            <div class="telemetry">
                <div>
                    <span>SENSED YAW</span><strong>{fmt(snapshot.yaw, 0)}<small>°</small></strong>
                </div>
                <div>
                    <span>TRUE HEADING</span><strong
                        >{fmt(wrap(snapshot.heading), 1)}<small>°</small></strong
                    >
                </div>
                <div>
                    <span>TRAVELED</span><strong
                        >{fmt(snapshot.distance / 10, 1)}<small>cm</small></strong
                    >
                </div>
                <div>
                    <span>WHEEL SLIP</span><strong
                        >{fmt(snapshot.slip * 100, 1)}<small>%</small></strong
                    >
                </div>
            </div>
            {#if snapshot.variables[resultVariable]}<div class="sensor-outcome" role="status">
                    {snapshot.variables[resultVariable]}
                </div>{/if}
            <div class="world-footer">
                <span class="calibration-indicator"></span><span
                    >{realism === 'ideal' ? 'Ideal reference' : 'Illustrative physics'} · not calibrated
                    to hardware</span
                >
            </div>
        </section>
    </main>
    <footer class="bottom-bar">
        <span><span class="yellow-dash"></span>BUILD → LOAD → TEST → IMPROVE</span><span
            >Programs stay in this browser <span class="tiny-divider">·</span> Fixed 5 ms simulation
            clock</span
        ><a
            href="https://github.com/alexandrehardy/lego-spike-simulator"
            target="_blank"
            rel="noreferrer">Built on open source ↗</a
        >
    </footer>
</div>
{#if settings}
    <div class="drawer-backdrop" role="presentation" on:click={() => (settings = false)}></div>
    <aside class="settings-drawer" aria-label="Robot and simulation settings">
        <div class="drawer-title">
            <div>
                <span class="eyebrow">ROBOT PROFILE</span>
                <h2>Advanced Driving Base</h2>
            </div>
            <button
                class="icon-button"
                aria-label="Close settings"
                on:click={() => (settings = false)}>×</button
            >
        </div>
        <p class="profile-note">
            Two large drive motors, two attachment motors and two color sensors. Geometry and error
            settings are editable starting assumptions.
        </p>
        <fieldset disabled={busy}>
            <label class="field-label"
                >Robot appearance<select bind:value={appearance}
                    ><option value="advanced">Advanced Driving Base · approximation</option><option
                        value="reference">Imported reference build</option
                    ><option value="cylinder">Diagnostic cylinder</option></select
                ></label
            >
            <p class="small-note">
                ADB-style geometry follows the configured drive-wheel diameter, track and B/F sensor
                mounts. It is not a brick-for-brick reconstruction; C/D tools are illustrative. The
                optional imported build is a different assembly. Appearance never changes physics. {modelStatus}.
            </p>
            <label class="field-label"
                >Simulation profile<select bind:value={realism} on:change={setProfile}
                    ><option value="illustrative">Illustrative imperfections</option><option
                        value="ideal">Ideal reference</option
                    ></select
                ></label
            >
            <div class="settings-grid">
                <label
                    >Wheel diameter <span>mm</span><input
                        type="number"
                        min="20"
                        max="150"
                        bind:value={profile.wheel}
                        on:change={setProfile}
                    /></label
                ><label
                    >Axle track <span>mm · estimate</span><input
                        type="number"
                        min="50"
                        max="400"
                        bind:value={profile.track}
                        on:change={setProfile}
                    /></label
                >
            </div>
            <h3>Drive connections</h3>
            <div class="settings-grid">
                <label
                    >Left motor<select bind:value={profile.left} on:change={setProfile}
                        ><option>A</option><option>E</option></select
                    ></label
                ><label
                    >Right motor<select bind:value={profile.right} on:change={setProfile}
                        ><option>E</option><option>A</option></select
                    ></label
                ><label
                    >Left forward polarity<select
                        bind:value={profile.leftSign}
                        on:change={setProfile}
                        ><option value={-1}>Counterclockwise</option><option value={1}
                            >Clockwise</option
                        ></select
                    ></label
                ><label
                    >Right forward polarity<select
                        bind:value={profile.rightSign}
                        on:change={setProfile}
                        ><option value={1}>Clockwise</option><option value={-1}
                            >Counterclockwise</option
                        ></select
                    ></label
                >
            </div>
            <p class="small-note">
                The sample selects E+A. Port order affects direction. Check orientation against his
                physical build.
            </p>
            <h3>Sensors & mounting</h3>
            <p class="small-note">
                Stock B/F are downward color sensors at about 8 mm. Distance or force replaces a
                color sensor; A/C/D/E remain motors. Optional mounts point forward and sense table
                walls only.
            </p>
            {#each sensorPorts as port}
                <div class="settings-grid">
                    <label
                        >Port {port}<select
                            bind:value={profile.sensorConfig.ports[port].kind}
                            on:change={() => changeSensor(port)}
                        >
                            <option value="color">Color / reflection</option><option
                                value="distance">Ultrasonic distance</option
                            ><option value="force">Force / touch probe</option><option value="none"
                                >Disconnected</option
                            >
                        </select></label
                    >
                    <label
                        >Height <span>mm</span><input
                            type="number"
                            min="0"
                            max="150"
                            bind:value={profile.sensorConfig.ports[port].height}
                            on:change={setProfile}
                        /></label
                    >
                    <label
                        >Forward offset <span>mm</span><input
                            type="number"
                            min="-200"
                            max="200"
                            bind:value={profile.sensorConfig.ports[port].forward}
                            on:change={setProfile}
                        /></label
                    >
                    <label
                        >Right offset <span>mm</span><input
                            type="number"
                            min="-200"
                            max="200"
                            bind:value={profile.sensorConfig.ports[port].side}
                            on:change={setProfile}
                        /></label
                    >
                </div>
            {/each}
            <p class="small-note">
                Raise color sensors to 16 mm to compare black detection. Heights affect color
                sensing; optional sensors use a flat, full-height wall model. The force offset is
                its backplate; its probe extends another 8 mm.
            </p>
            <label class="range-label"
                >Reflection noise <strong>±{profile.sensorConfig.reflectionNoise}%</strong><input
                    type="range"
                    min="0"
                    max="10"
                    step=".5"
                    bind:value={profile.sensorConfig.reflectionNoise}
                    on:change={setProfile}
                /></label
            >
            <label class="range-label"
                >Distance error envelope <strong>±{profile.sensorConfig.distanceError} mm</strong
                ><input
                    type="range"
                    min="0"
                    max="50"
                    step="1"
                    bind:value={profile.sensorConfig.distanceError}
                    on:change={setProfile}
                /></label
            >
            <label class="range-label"
                >Missed echo assumption <strong
                    >{Math.round(profile.sensorConfig.distanceDropout * 100)}%</strong
                ><input
                    type="range"
                    min="0"
                    max=".25"
                    step=".01"
                    bind:value={profile.sensorConfig.distanceDropout}
                    on:change={setProfile}
                /></label
            >
            <p class="small-note">
                No echo reports −1; distance predicates are false. This is a provisional simulator
                convention, pending a Word Blocks hardware test. Sensor event-start blocks and full
                3D tilt/acceleration are not implemented.
            </p>
            <h3>Drive & gyro imperfections</h3>
            <label class="range-label"
                >Residual motor mismatch<strong>{profile.motorMismatch}%</strong><input
                    type="range"
                    min="0"
                    max="8"
                    step=".1"
                    bind:value={profile.motorMismatch}
                    on:change={setProfile}
                /></label
            >
            <label class="range-label"
                >Effective wheel mismatch<strong>{profile.mismatch}%</strong><input
                    type="range"
                    min="0"
                    max="8"
                    step=".1"
                    bind:value={profile.mismatch}
                    on:change={setProfile}
                /></label
            >
            <label class="range-label"
                >Surface slip<strong>{profile.slip}%</strong><input
                    type="range"
                    min="0"
                    max="15"
                    step=".5"
                    bind:value={profile.slip}
                    on:change={setProfile}
                /></label
            >
            <label class="range-label"
                >Gyro drift<strong>{profile.gyroBias}°/s</strong><input
                    type="range"
                    min="-1"
                    max="1"
                    step=".01"
                    bind:value={profile.gyroBias}
                    on:change={setProfile}
                /></label
            >
            <label class="range-label"
                >Gyro noise<strong>{profile.gyroNoise}°</strong><input
                    type="range"
                    min="0"
                    max="3"
                    step=".1"
                    bind:value={profile.gyroNoise}
                    on:change={setProfile}
                /></label
            >
            <label class="range-label"
                >Motor response time<strong>{profile.response}s</strong><input
                    type="range"
                    min=".01"
                    max=".3"
                    step=".01"
                    bind:value={profile.response}
                    on:change={setProfile}
                /></label
            >
            <label class="field-label"
                >Repeatable random seed<input
                    type="number"
                    min="1"
                    max="2147483647"
                    bind:value={profile.seed}
                    on:change={setProfile}
                /></label
            >
        </fieldset>
        <div class="scope-note">
            <strong>Preview boundaries</strong>
            <p>
                Real mat artwork with estimated registration. The Coral Nursery exercise uses a
                simplified tool-motion check, not contact physics or official scoring. C/D demo
                tools follow physical motor angles. Color/reflection, distance, force/touch, yaw and
                motor-angle readings have sampled models. Mat brightness is not measured
                reflectance; noise distributions and probe mechanics still need calibration. The hub
                uses an inertial gyro, not a compass.
            </p>
            {#if info?.unusedUnsupported.length}<p>
                    Unused unsupported blocks: {info.unusedUnsupported.join(', ')}.
                </p>{/if}
        </div>
        <div class="motor-readings">
            <h3>Reported motor positions · 100 Hz</h3>
            {#each Object.entries(snapshot.encoders) as [port, m]}<span
                    >{port}<b>{fmt(m.position, 0)}°</b></span
                >{/each}
        </div>
    </aside>
{/if}
{#if notice}<div class="toast" role="status">{notice}</div>{/if}
