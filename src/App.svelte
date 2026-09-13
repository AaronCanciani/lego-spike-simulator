<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import JSZip from 'jszip';
    import ProgramView from './lab/ProgramView.svelte';
    import WorldView from './lab/WorldView.svelte';
    import { drivingExample } from './lab/examples';
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
    let profile: Profile = { ...defaultProfile },
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
    let appearance = 'reference',
        modelStatus = 'Loading reference model…';
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
                  response: 0.005
              }
            : profile;
    }
    function sampleColor(x: number, y: number) {
        if (!mapPixels || !mapCanvas) return { color: 10, reflection: 90 };
        const px = Math.round((x / WIDTH + 0.5) * (mapCanvas.width - 1)),
            py = Math.round((0.5 - y / HEIGHT) * (mapCanvas.height - 1));
        if (px < 0 || py < 0 || px >= mapCanvas.width || py >= mapCanvas.height)
            return { color: 0, reflection: 0 };
        let r = 0,
            g = 0,
            b = 0,
            count = 0;
        for (let dx = -1; dx <= 1; dx++)
            for (let dy = -1; dy <= 1; dy++) {
                const ix = Math.max(0, Math.min(mapCanvas.width - 1, px + dx)),
                    iy = Math.max(0, Math.min(mapCanvas.height - 1, py + dy)),
                    i = (iy * mapCanvas.width + ix) * 4;
                r += mapPixels.data[i];
                g += mapPixels.data[i + 1];
                b += mapPixels.data[i + 2];
                count++;
            }
        r /= count;
        g /= count;
        b /= count;
        const high = Math.max(r, g, b),
            low = Math.min(r, g, b);
        let color = 10;
        if (high < 65) color = 0;
        else if (high - low < 35) color = high < 170 ? 1 : 10;
        else if (b > r * 1.15 && b > g * 1.05) color = 3;
        else if (r > g * 1.35 && r > b * 1.25) color = 9;
        else if (r > 150 && g > 125 && b < g * 0.7) color = 7;
        else if (g > r * 1.1 && g > b * 1.05) color = 6;
        else if (b > r && g > r) color = 4;
        return {
            color,
            reflection: Math.round(((r * 0.2126 + g * 0.7152 + b * 0.0722) / 255) * 100)
        };
    }
    function reset() {
        if (!project) return;
        try {
            engine = new Engine(project, activeProfile(), start);
            monitor = mission ? new MissionMonitor(start) : null;
            missionState = new MissionMonitor(start).snapshot();
            engine.colorAt = sampleColor;
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
    function accept(p: Project, title: string) {
        if (!Array.isArray(p.targets) || !p.targets.length)
            throw new Error('This file does not contain a Scratch block program.');
        const report = inspect(p);
        if (report.total > 12000)
            throw new Error('This project exceeds the preview’s 12,000-block limit.');
        project = p;
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
                        : report.blocks[b.inputs.custom_block[1]]?.mutation?.proccode
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
    }
    async function loadSample() {
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
        loading = true;
        try {
            if (file.size > 15 * 1024 * 1024)
                throw new Error('Choose a project smaller than 15 MB.');
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
        mission = example.startsWith('coral');
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
        if (!engine || !mapReady) return;
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
    function resize(event: PointerEvent) {
        if (resizeStart)
            split = Math.max(30, Math.min(70, (event.clientX / window.innerWidth) * 100));
    }
    function onKey(event: KeyboardEvent) {
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
        loadSample();
        last = performance.now();
        frame = requestAnimationFrame(tick);
    });
    onDestroy(() => {
        cancelAnimationFrame(frame);
        clearTimeout(noticeTimer);
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
        <span class="preview-badge">EARLY PREVIEW</span>
        <div class="top-actions">
            <select
                aria-label="Load a driving experiment"
                bind:value={example}
                disabled={busy || loading}
                on:change={loadExample}
                ><option value="">Experiments</option><option value="open">Open-loop drive</option
                ><option value="gyro">Gyro feedback</option><option value="coral"
                    >Coral Nursery · gyro route</option
                ><option value="coral-open">Coral Nursery · open loop</option></select
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
            accept=".llsp3"
            bind:this={fileInput}
            on:change={() => {
                if (fileInput.files?.[0]) loadFile(fileInput.files[0]);
                fileInput.value = '';
            }}
        />
    </header>
    <div class="transport">
        <div class="run-controls">
            <button
                class="run-button"
                on:click={toggle}
                disabled={loading || !mapReady || !!info?.unsupported.length}
                >{busy ? 'Ⅱ Pause' : '▶ Run'}</button
            ><button
                class="icon-button"
                aria-label="Step one simulation tick"
                title="Step one 5 ms simulation tick"
                disabled={busy || loading || !mapReady}
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
    {#if mission}
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
    <main class="workspace" style={`--split:${split}%`}>
        <section class="code-panel" aria-label="Read-only program">
            <div class="panel-heading">
                <div>
                    <span class="panel-index">01</span>
                    <h1>Program flow</h1>
                </div>
                <span class="subtle-tag">READ ONLY</span>
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
                ><label class="check-label"
                    ><input type="checkbox" bind:checked={follow} /> Follow</label
                >
            </div>
            <div class="block-surface">
                <ProgramView bind:this={program} {project} active={snapshot.active} {follow} />
                <div class="zoom-tools">
                    <button aria-label="Zoom blocks out" on:click={() => program.zoom(-1)}>−</button
                    ><button on:click={() => program.fit()}>Fit</button><button
                        aria-label="Zoom blocks in"
                        on:click={() => program.zoom(1)}>＋</button
                    >
                </div>
                {#if loading}<div class="loading-cover">Opening your program…</div>{/if}
            </div>
            <div class="execution-inspector">
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
                    >{info?.total || 0} blocks <span class="tiny-divider">/</span>
                    {info?.procedures.size || 0} custom blocks</span
                ><span>{steps} execution events</span>
            </div>
        </section>
        <button
            class="splitter"
            aria-label="Resize program and simulator panels"
            on:pointerdown={() => (resizeStart = true)}
            on:keydown={(e) => {
                if (e.key === 'ArrowLeft') split = Math.max(30, split - 5);
                if (e.key === 'ArrowRight') split = Math.min(70, split + 5);
            }}><span></span></button
        >
        <section class="simulation-panel" aria-label="3D robot simulation">
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
                    ><option value="practice">Calibration grid</option></select
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
                    motors={snapshot.motors}
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
                        >{map === 'practice' ? 'PRACTICE FIELD' : 'FLL CHALLENGE'}<small
                            >{map === 'practice'
                                ? 'Grid and color targets'
                                : 'Mat + boundary walls'}</small
                        ><small title={modelStatus}
                            >{appearance === 'cylinder'
                                ? 'Cylinder proxy'
                                : modelStatus.startsWith('Animated')
                                  ? 'Reference build · not exact ADB'
                                  : 'Cylinder · reference loading/unavailable'}</small
                        ></span
                    >
                    <div class="camera-tools">
                        <button title="Overhead camera" on:click={() => world.overhead()}
                            >Top</button
                        ><button title="Reset 3D camera" on:click={() => world.home()}>3D</button
                        ><button
                            title="Inspect robot and moving tools"
                            on:click={() => world.robotCloseup()}>Robot</button
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
                    ><option value="reference">Imported reference build</option><option
                        value="cylinder">Diagnostic cylinder</option
                    ></select
                ></label
            >
            <p class="small-note">
                {modelStatus}. Reference body and wheel spacing differ from the Advanced Driving
                Base; appearance does not change physics. C/D tools are illustrative.
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
            <h3>Explore imperfections</h3>
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
                tools follow encoders. Color sensors B/F sample the mat; distance sensing is not
                supported yet.
            </p>
            {#if info?.unusedUnsupported.length}<p>
                    This file has an unused distance-sensor routine. Running a program that calls it
                    will show an unsupported-block error.
                </p>{/if}
        </div>
        <div class="motor-readings">
            <h3>Motor positions</h3>
            {#each Object.entries(snapshot.motors) as [port, m]}<span
                    >{port}<b>{fmt(m.position, 0)}°</b></span
                >{/each}
        </div>
    </aside>
{/if}
{#if notice}<div class="toast" role="status">{notice}</div>{/if}
