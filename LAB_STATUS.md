# SPIKE Lab — working preview

This branch adds a student-facing, read-only program runner and 3D field to Alexandre Hardy's simulator. It is an early compatibility and teaching prototype, not a calibrated digital twin or complete LEGO runtime.

## Try it

Use Node 24, run `npm ci`, then `npm run dev -- --host 127.0.0.1`. Open the printed local URL. `npm run check`, `npm run build`, and `node --test src/lab/engine.test.mjs` verify the preview.

Optional detailed reference robot: run `npm run model:fetch` before starting the app. `npm test` runs the complete runtime, mission, joint and sensor suite. See [the Coral Nursery exercise](CORAL_MISSION.md) for the mission route and its limitations, and [sensor research and assumptions](SENSOR_MODELS.md) for the new sampled sensor models.

Load a LEGO Word Blocks `.llsp3` file. Programs are unpacked in the browser; Python projects are rejected. Run, pause, reset, playback speed, 5 ms single-tick stepping, execution highlighting, custom-block arguments and a resizable split view are available. Uploaded programs are not sent to a server. The bundled sample is the user's exploratory My Blocks project, not a successful navigation benchmark.

The **Experiments** menu loads two purpose-built Scratch graphs: an open-loop two-second drive and a two-second proportional gyro controller (`steering = 3 × (0 − sensed yaw)`). Both use the regular interpreter, physical model and block viewer. Try identical settings, then raise effective wheel mismatch. Automated tests compare drift across four seeds and verify that feedback fails to correct drift when the sensed yaw is stuck at zero. This demonstrates the model's internal control-loop behavior, not hardware fidelity.

## What is implemented

New color/line experiments and their positive/negative coverage are described in [SENSOR_TESTS.md](SENSOR_TESTS.md). Red and blue marker stops now exercise the real pixel classifier; a continuous reflected-light controller follows a curved training line to a red finish. These use ordinary Scratch blocks and distinguish detected targets from timeouts.

- Reuses upstream Scratch-to-Blockly conversion, block definitions and renderer. New bounded generator interpreter in `src/lab/engine.ts`; unsupported reachable blocks fail explicitly.
- Fixed 5 ms simulation time, seeded experiments, separate encoder/true-pose/sensed-yaw values, motor response and residual gain mismatch, effective wheel mismatch, illustrative surface slip, gyro drift/noise/quantization/delay.
- Three.js cylinder or imported LDraw reference build, encoder-animated wheels and demonstration C/D tools, orbit/overhead/robot cameras, trail, sensor markers, clickable placement, telemetry and editable robot profile.
- Two archived field images and a generated practice field; only boundary walls affect motion.
- The supplied 202-block file executes its reachable custom procedures. Distance reporters are now supported; calling its unused distance routine requires replacing the requested port's color sensor in settings.
- Color/reflection, ultrasonic distance, force/touch and motor encoders sample at 100 Hz. Per-sensor seeded errors, finite color footprint, stock ADB low-height black-classification stress, distance range/echo limits, and a spring-probe contact approximation are implemented. A live overlay shows readings, search cones and probes. Three native Scratch sensor-stop experiments exercise them end to end.

## Important limitations

The interpreter currently runs on the main thread, with bounded ticks and a 180-second simulated limit. This is not full Scratch scheduling or LEGO firmware timing. Gyro readings are modeled, not an ideal compass. True heading is inspector-only; programs read the simulated sensor.

The drivetrain is a planar differential-drive approximation, not a traction/contact solver. Collisions clamp a 100 mm radius footprint to field boundaries. The Coral Nursery training exercise uses an alignment-and-tool-motion rubric and an animated proxy, not physical arm contacts or official scoring. There are no payload dynamics, lateral traction, battery effects or hardware-calibrated parameters yet. Color sensing approximates reflectance from image brightness; optional distance/force sensors detect only table boundaries, not printed mission objects. No-echo Word Blocks behavior is a documented provisional convention. Sensor event hats, ambient/raw color, full 3D IMU and hub buttons remain unsupported. Attachments C/D have encoder-driven demonstration tools.

Advanced Driving Base defaults use physical drive ports A/E and an approximately 87.95 mm wheel diameter. Track width 160 mm, motor polarity and horizontal sensor locations are starting assumptions; default 8 mm color height follows published ADB observations. Sensor ranges/resolutions/accuracy envelopes now follow LEGO specifications, but error distributions and gyro parameters remain unmeasured assumptions. The sample selects E+A; that order is preserved and may reverse motion. Verify wiring and direction on the real build before interpreting results.

The field is 2362 × 1143 mm. The 2024 artwork is approximately registered between 171 mm side home strips; its crop and landmark coordinates are digitized estimates, not surveyed measurements. The 2023 image retains the initial whole-image fit. Do not use this preview for millimeter-accurate mission practice.

## Reusable animated models

Upstream loads hierarchical LDraw `.ldr`/`.mpd`, not just flattened meshes. Its linked `DrivingBase3.mpd` contains individual parts, `!SPIKE_PORT` and `!SPIKE_GEARING` annotations. Inspection on 2026-09-13 found drive wheels associated with C/D, unlike this robot's A/E profile. This example is not the Advanced Driving Base Assembly. The upstream `VM.turnMotor` computes wheel travel; it does not itself rotate the rendered wheel parts.

Reuse this hierarchy through a Three.js LDraw adapter or a prepared glTF asset. Preserve separate named wheel and attachment groups, axle/pivot positions, rotation axes, motor port, polarity, gear ratio and rest transform. Animate from encoder angle, never from distance traveled, so wheels can spin during slip or wall contact. Arms require grouping all rigidly attached bricks around their joint; identifying the motor alone is insufficient. Gear trains/linkages and contact bodies need explicit configuration. Visual detail must remain independent of the collision model.

The Three.js adapter now loads that packed LDraw model, preserving paired tire/rim pivots and mapping them to the current physical left/right drive roles. C/D demonstration tools are separate joints; all animation follows encoder angles, including at boundary contact. The exact Advanced Driving Base hierarchy and real attachment linkage geometry remain future work. The reference has different dimensions and is labeled accordingly in the UI; it never changes the physical profile.

Before bundling a robot model, verify the exact assembly and asset redistribution notices. The SHA-256-pinned upstream example can be fetched locally with `npm run model:fetch`, but is ignored by git and must not be included in a distributed build before its rights are checked. The cylinder remains the fallback when the optional asset is unavailable.

## Next stages

1. Expand opcode, procedure and scheduler conformance tests against LEGO exports and hardware.
2. Worker-isolated runtime, independent randomness streams, run recording and block-level stepping.
3. Verified field registration and rigid-body/contact experiments, animated robot adapter.
4. Hardware calibration: straight runs, turns, encoder-versus-distance, stationary gyro and repeated surface trials. Fit distributions, not one lucky run.
5. Multiple seeded trials, reliability comparisons and mission mechanisms.

See `THIRD_PARTY_ASSETS.md` for sources and rights caveats. Preserve upstream `COPYING.md` and notices.
