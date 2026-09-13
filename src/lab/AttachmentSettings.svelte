<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { Attachments } from './attachments';
    export let attachments: Attachments;
    export let busy = false;
    const dispatch = createEventDispatcher();
    const ports = ['C', 'D'] as const;
    const geometry = [
        ['forward', 'Pivot forward from axle (mm)', -200, 200],
        ['side', 'Pivot right of center (mm)', -150, 150],
        ['height', 'Pivot height above mat (mm)', 10, 250],
        ['length', 'Reach from pivot (mm)', 30, 400],
        ['width', 'Width (mm)', 8, 300],
        ['drop', 'Drop below pivot at 0° (mm)', 0, 250],
        ['ratio', 'Motor turns per attachment turn', 0.25, 20],
        ['initial', 'Starting joint angle (°)', -90, 170],
        ['min', 'Lower travel stop (°)', -90, 169],
        ['max', 'Upper travel stop (°)', -89, 170],
        ['mass', 'Attachment mass (kg)', 0.01, 1],
        ['torque', 'Motor torque limit (N·m)', 0.01, 1]
    ] as const;
</script>

<details class="mounting-details">
    <summary>Attachment geometry & mechanics</summary>
    <p class="student-help">
        Outline approximations based on LEGO's dozer and lift instructions. Dimensions, gearing,
        torque and travel limits are starting estimates—not measured calibration. The same geometry
        is used for contact and drawing. Motor encoders measure the shaft, not the geared arm angle.
    </p>
    <fieldset disabled={busy}>
        <div class="sensor-cards">
            {#each ports as port}
                <section>
                    <h3>Port {port}: {attachments[port].kind}</h3>
                    <label
                        >Facing
                        <select
                            bind:value={attachments[port].facing}
                            on:change={() => dispatch('change')}
                        >
                            <option value="front">Front</option><option value="rear">Rear</option>
                        </select>
                    </label>
                    <label
                        >Positive motor direction
                        <select
                            bind:value={attachments[port].polarity}
                            on:change={() => dispatch('change')}
                        >
                            <option value={1}>Raises tool</option><option value={-1}
                                >Lowers tool</option
                            >
                        </select>
                    </label>
                    {#each geometry as [key, label, min, max]}
                        <label
                            >{label}<input
                                aria-label={`Port ${port} ${label}`}
                                type="number"
                                {min}
                                {max}
                                step="any"
                                bind:value={attachments[port][key]}
                                on:change={() => dispatch('change')}
                            /></label
                        >
                    {/each}
                </section>
            {/each}
        </div>
    </fieldset>
</details>
