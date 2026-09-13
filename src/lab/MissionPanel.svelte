<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { missionCatalog, wallMission, findMission } from './missionCatalog';
    import type { CompetitionSnapshot } from './competitionWorld';
    import type { TrialResult } from './reliability';
    export let selected = '';
    export let busy = false;
    export let testing = false;
    export let running = false;
    export let state: CompetitionSnapshot | null = null;
    export let results: TrialResult[] = [];
    export let trialCount = 10;
    export let practice = false;
    let starter = '';
    let toolsOpen = false;
    $: if (running) toolsOpen = false;
    const dispatch = createEventDispatcher();
    $: mission = findMission(selected);
    $: successes = results.filter((r) => r.success).length;
</script>

<section class="mission-library" aria-label="Mission library">
    <div class="mission-picker">
        <label for="mission-select">Mission library</label>
        <select
            id="mission-select"
            bind:value={selected}
            disabled={busy}
            on:change={() => dispatch('choose')}
        >
            <option value="">Explore mat · no mission models</option>
            {#each missionCatalog as m}<option value={m.id}>{m.map} · {m.number} {m.name}</option
                >{/each}
            <option value={wallMission.id}>Training · {wallMission.name}</option>
        </select>
    </div>
    {#if mission}
        <div class="mission-progress">
            <span>{practice ? 'APPROACH PRACTICE' : 'LAUNCH RUN'} · {mission.number}</span><strong
                class:passed={state?.complete}
                >{state?.complete
                    ? '✓ Complete'
                    : state?.failed
                      ? 'Try again'
                      : `${Math.round((state?.progress ?? 0) * 100)}%`}</strong
            >
        </div>
        <p class="mission-objective">{mission.goal}</p>
        <small
            >Solid walls + {state?.missions.length ?? 1} modeled mission{(state?.missions.length ??
                1) === 1
                ? ''
                : 's'} from this season. Unmodeled objects in the photo remain flat.</small
        >
        <details bind:open={toolsOpen} class="mission-tools">
            <summary
                >Mission tools · starts, code & reliability{#if results.length}
                    · {successes}/{results.length} passed{/if}</summary
            >
            <details>
                <summary>Board models & limits</summary>
                {#if state?.missions.length}
                    <ul>
                        {#each state.missions as model}<li>
                                {model.name}{model.complete
                                    ? ' · complete'
                                    : model.failed
                                      ? ' · failed'
                                      : ''}
                            </li>{/each}
                    </ul>
                {/if}
                <p>
                    Archived field photos; original simplified physical models. Locations are
                    approximate. This tests the objective above, not every official scoring option.
                    Pictured models baked into the photo are NOT extra obstacles; the color sensor
                    reads the photo itself. Configure physical tools on C and D in My Robot.
                </p>
                <p>
                    Cyan ring = suggested launch. Gold ring = short practice approach. Outlined
                    targets are assessment overlays, not extra color-sensor markings.
                </p>
                <a href={mission.source} target="_blank" rel="noreferrer">Mission source ↗</a>
            </details>
            <div class="mission-actions">
                <button disabled={busy} on:click={() => dispatch('position', false)}
                    >Launch start</button
                >
                <button disabled={busy} on:click={() => dispatch('position', true)}
                    >Practice approach</button
                >
                <select
                    aria-label="Load mission starter code"
                    bind:value={starter}
                    disabled={busy}
                    on:change={() => {
                        dispatch('starter', starter);
                        starter = '';
                    }}
                >
                    <option value="">Load starter code…</option>
                    <option value="line">Follow line · B color / F distance</option>
                    <option value="distance">Approach · F distance</option>
                    <option value="contact">Push & retreat · F force</option>
                    <option value="wall">Square up · wall drill</option>
                </select>
            </div>
            <details class="reliability-panel" open={testing || results.length > 0}>
                <summary
                    >Reliability lab {#if results.length}· {successes}/{results.length} passed{/if}</summary
                >
                <p>
                    Test this program from the current start. Each seeded trial varies placement ±10
                    mm / ±3°, wheel mismatch ±1.5 percentage points, motor mismatch ±0.8, slip ±0.5
                    and contact friction ±20%. These are illustrative ranges, not measured hardware
                    statistics.
                </p>
                <div class="mission-actions">
                    <select
                        aria-label="Reliability trial count"
                        bind:value={trialCount}
                        disabled={busy}
                        ><option value={10}>10 runs</option><option value={20}>20 runs</option
                        ><option value={30}>30 runs</option></select
                    >
                    {#if testing}<button on:click={() => dispatch('cancel')}>Cancel trials</button
                        >{:else}<button disabled={busy} on:click={() => dispatch('test')}
                            >Test reliability</button
                        >{/if}
                </div>
                {#if results.length}
                    <p role="status">
                        <strong>{Math.round((successes / results.length) * 100)}% success</strong> · {results.length}/{trialCount}
                        trials {testing ? '— testing…' : 'finished'}
                    </p>
                    <div class="trial-results">
                        {#each results as result}<div class="trial-result">
                                <span
                                    >{result.success ? '✓' : '✕'} Run {result.index} · {result.seconds.toFixed(
                                        1
                                    )} s</span
                                ><small>{result.reason}</small><button
                                    disabled={busy}
                                    on:click={() => dispatch('replay', result)}
                                    >Replay seed {result.seed}</button
                                >
                            </div>{/each}
                    </div>
                {/if}
            </details>
        </details>
    {:else}
        <small>Select a historical mission above to add its working 3D parts.</small>
    {/if}
</section>
