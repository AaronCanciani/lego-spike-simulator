<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { Profile } from './engine';
    import { adbAttachments, toolPreset, type Attachments, type ToolKind } from './attachments';
    export let attachments: Attachments = structuredClone(adbAttachments);
    export let profile: Profile;
    export let liftEnabled = false;
    export let busy = false;
    const dispatch = createEventDispatcher();
    const ports = ['B', 'F'] as const;
    const toolPorts = ['C', 'D'] as const;
    function toolChanged(port: 'C' | 'D', event: Event) {
        attachments = {
            ...attachments,
            [port]: toolPreset((event.currentTarget as HTMLSelectElement).value as ToolKind)
        };
        dispatch('toolchange');
    }
    const descriptions = {
        color: 'Looks down at colors and lines on the mat.',
        distance: 'Looks ahead to measure distance to walls and cargo.',
        force: 'Feels a touch when its forward-facing button is pressed.',
        none: 'Nothing plugged into this port.'
    };
    function driveChanged(event: Event) {
        const left = (event.target as HTMLSelectElement).value;
        profile = { ...profile, left, right: left === 'A' ? 'E' : 'A' };
        dispatch('change');
    }
</script>

<div class="student-robot">
    <p class="student-intro">
        Choose what is plugged into your robot. Use the same port letters in your blocks.
    </p>
    {#if busy}<p class="student-warning" role="status">Pause the run to change your robot.</p>{/if}
    <fieldset disabled={busy}>
        <legend class="sr-only">Student robot configuration</legend>
        <div class="sensor-cards">
            {#each ports as port}
                <section class="sensor-card" aria-label={`Port ${port} setup`}>
                    <h3><span class="port-letter">{port}</span> Port {port}</h3>
                    <label
                        >Sensor
                        <select
                            aria-label={`Port ${port} sensor`}
                            bind:value={profile.sensorConfig.ports[port].kind}
                            on:change={() => dispatch('sensorchange', port)}
                        >
                            <option value="color">Color & lines</option>
                            <option value="distance">Distance</option>
                            <option value="force">Touch / force</option>
                            <option value="none">Not connected</option>
                        </select>
                    </label>
                    <p>{descriptions[profile.sensorConfig.ports[port].kind]}</p>
                </section>
            {/each}
        </div>
        <details class="mounting-details">
            <summary>Where are my sensors mounted?</summary>
            <p class="student-help">
                Measurements are in millimeters. “Forward” starts at the wheel axle; negative side
                positions are left of center. Color sensors face down; distance and touch sensors
                face forward.
            </p>
            <div class="sensor-cards">
                {#each ports as port}
                    <section aria-label={`Port ${port} mounting`}>
                        <h3>Port {port} position</h3>
                        <label
                            >Height above mat<input
                                aria-label={`Port ${port} height`}
                                type="number"
                                min="0"
                                max="150"
                                bind:value={profile.sensorConfig.ports[port].height}
                                on:change={() => dispatch('change')}
                            /></label
                        >
                        <label
                            >Forward from axle<input
                                aria-label={`Port ${port} forward position`}
                                type="number"
                                min="-200"
                                max="200"
                                bind:value={profile.sensorConfig.ports[port].forward}
                                on:change={() => dispatch('change')}
                            /></label
                        >
                        <label
                            >Side position (+ right)<input
                                aria-label={`Port ${port} side position`}
                                type="number"
                                min="-200"
                                max="200"
                                bind:value={profile.sensorConfig.ports[port].side}
                                on:change={() => dispatch('change')}
                            /></label
                        >
                    </section>
                {/each}
            </div>
        </details>
        <h3>Wheels & motors</h3>
        <label
            >Drive connections
            <select
                aria-label="Drive motor connections"
                value={profile.left}
                on:change={driveChanged}
            >
                <option value="A">A = left wheel · E = right wheel</option>
                <option value="E">E = left wheel · A = right wheel</option>
            </select>
        </label>
        <p class="student-help">
            Match the movement-motor pair in your program to your wiring. A and E are wheel motors;
            C and D are attachment motors.
        </p>
        <h3>My attachments</h3>
        <div class="sensor-cards">
            {#each toolPorts as port}
                <section class="sensor-card">
                    <h3><span class="port-letter">{port}</span> Port {port}</h3>
                    <label
                        >Tool
                        <select
                            aria-label={`Port ${port} attachment`}
                            value={attachments[port].kind}
                            on:change={(event) => toolChanged(port, event)}
                        >
                            <option value="dozer">Rear dozer blade</option>
                            <option value="lift">Front lift arm</option>
                            <option value="paddle">Simple lift paddle</option>
                            <option value="none">No attachment</option>
                        </select>
                    </label>
                    <p>
                        {attachments[port].kind === 'none'
                            ? 'No tool on this motor.'
                            : `Mounted on the ${attachments[port].facing}. Moves with motor ${port}.`}
                    </p>
                </section>
            {/each}
        </div>
        <p class="student-help">
            Advanced Driving Base: dozer at the back, lift at the front. Choose the port that
            matches your wiring.
        </p>
        <button
            type="button"
            on:click={() => {
                attachments = structuredClone(adbAttachments);
                dispatch('toolchange');
            }}>Use Advanced Driving Base attachments</button
        >
        <details class="mounting-details">
            <summary>Separate cargo-lift prototype</summary>
            <label
                >Attachment
                <select
                    aria-label="Robot attachment"
                    bind:value={liftEnabled}
                    on:change={() => dispatch('attachmentchange')}
                >
                    <option value={false}>No cargo lift</option>
                    <option value={true}>C = cargo lift (prototype)</option>
                </select>
            </label>
            <p class="student-help">
                The prototype lift also adds a cargo cube and delivery zone. It is not an exact
                model of your own attachment.
            </p>
        </details>
    </fieldset>
    <div class="student-tip">
        Your blocks are kept; changing equipment resets the run. Open <strong>Sensors</strong> in the
        playground to see live readings.
    </div>
</div>
