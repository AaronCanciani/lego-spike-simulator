# SPIKE Lab — working preview

This branch adds a student-facing block editor, program runner and 3D field to Alexandre Hardy's simulator. It is an early compatibility and teaching prototype, not a calibrated digital twin or complete LEGO runtime.

## Try it

Use Node 24, run `npm ci`, then `npm run dev -- --host 127.0.0.1`. Open the printed local URL. `npm run check`, `npm run build`, and `node --test src/lab/engine.test.mjs` verify the preview.

Optional detailed reference robot: run `npm run model:fetch` before starting the app. `npm test` runs the complete runtime, mission, joint and sensor suite. See [the Coral Nursery exercise](CORAL_MISSION.md) for the mission route and its limitations, and [sensor research and assumptions](SENSOR_MODELS.md) for the new sampled sensor models.

The default is now an animated ADB-style approximation that needs no model download. See [ROBOT_MODEL.md](ROBOT_MODEL.md) for geometry limits, the following camera and **Robot · wheels & tools** experiment. The imported reference and diagnostic cylinder remain selectable.

Load a LEGO Word Blocks `.llsp3` file. Programs are unpacked in the browser; Python projects are rejected. Run, pause, reset, playback speed, 5 ms single-tick stepping, execution highlighting, custom-block arguments and a resizable split view are available. Uploaded programs are not sent to a server. The bundled sample is the user's exploratory My Blocks project, not a successful navigation benchmark.

**Build** now gives the editor the full workspace, with a supported-block palette, variables and My Blocks creation. **Run** hides the palette and restores the read-only program/3D robot split. Switching to Build pauses an active run; testing edits starts a fresh simulation. Undo survives tab switches. Programs autosave locally and can be downloaded/reopened as `.spikelab` files (not LEGO-compatible exports). See [BUILD_MODE.md](BUILD_MODE.md) for persistence, coverage and limitations.

The **Experiments** menu loads two purpose-built Scratch graphs: an open-loop two-second drive and a two-second proportional gyro controller (`steering = 3 × (0 − sensed yaw)`). Both use the regular interpreter, physical model and block viewer. Try identical settings, then raise effective wheel mismatch. Automated tests compare drift across four seeds and verify that feedback fails to correct drift when the sensed yaw is stuck at zero. This demonstrates the model's internal control-loop behavior, not hardware fidelity.

## What is implemented

**My Robot** opens student setup first: side-by-side B/F sensor cards, optional mounting details, one safe A/E wiring selector, and a cargo-attachment choice. **Advanced — Teacher / developer** holds simulation profiles, geometry calibration, slip, gyro drift/noise, motor mismatch, sensor error assumptions and diagnostics. Changing tabs does not change configuration; reopening the drawer defaults to the student tab. Advanced is an organizational separation, not a password or access-control boundary. Configuration is disabled during a running program.

**Cargo lab · lift & deliver** adds the first physical payload and powered attachment: pushing, gravity, supported carrying, release, friction, overload stalls and a contact-based delivery zone. It has 16 dedicated tests. The attachment is an illustrative linear fork lift; lateral attachment loads do not yet feed back into the chassis. See [CARGO_LAB.md](CARGO_LAB.md) for exact scope and limits.

New color/line experiments and their positive/negative coverage are described in [SENSOR_TESTS.md](SENSOR_TESTS.md). Red and blue marker stops now exercise the real pixel classifier; a continuous reflected-light controller follows a curved training line to a red finish. These use ordinary Scratch blocks and distinguish detected targets from timeouts.

-   Reuses upstream Scratch-to-Blockly conversion, block definitions and renderer. New bounded generator interpreter in `src/lab/engine.ts`; unsupported reachable blocks fail explicitly.
-   Fixed 5 ms simulation time, seeded experiments, separate encoder/true-pose/sensed-yaw values, motor response and residual gain mismatch, effective wheel mismatch, illustrative surface slip, gyro drift/noise/quantization/delay.
-   Three.js ADB-style approximation, imported LDraw reference or cylinder; motor-animated wheels and demonstration C/D tools; orbit/overhead/robot/follow cameras, trail, sensor bodies and markers, clickable placement, telemetry and editable robot profile.
-   Eight archived field photos (2018–2025), ten selectable simplified historical mission objectives, and a physical wall-alignment drill. Mission mode adds dynamic payloads, finite-force chassis contact, a powered C paddle and physical sensor occlusion. See [mission scope and testing](MISSION_PACK.md).
-   The supplied 202-block file executes its reachable custom procedures. Distance reporters are now supported; calling its unused distance routine requires replacing the requested port's color sensor in settings.
-   Color/reflection, ultrasonic distance, force/touch and motor encoders sample at 100 Hz. Per-sensor seeded errors, finite color footprint, stock ADB low-height black-classification stress, distance range/echo limits, and a spring-probe contact approximation are implemented. A live overlay shows readings, search cones and probes. Three native Scratch sensor-stop experiments exercise them end to end.

## Important limitations

The interpreter currently runs on the main thread, with bounded ticks and a 180-second simulated limit. This is not full Scratch scheduling or LEGO firmware timing. Gyro readings are modeled, not an ideal compass. True heading is inspector-only; programs read the simulated sensor.

Free exploration retains the planar differential-drive approximation and 100 mm boundary footprint. The ten new missions use a rectangular rigid-body chassis, finite traction force, physical wall contact, payload dynamics and a torque-limited C paddle; Cargo Harbor retains its separate linear lift. Chassis pitch/roll, battery effects and hardware-calibrated parameters are still absent. Coral Nursery remains an alignment-and-tool-motion rubric, not official scoring. Color sensing approximates reflectance from photographic image brightness; mission distance/force sensors detect actual 3D objects and walls, not printed objects elsewhere in the photo. No-echo Word Blocks behavior is a documented provisional convention. Sensor event hats, ambient/raw color, full 3D IMU and hub buttons remain unsupported. D remains a demonstration tool.

Advanced Driving Base defaults use physical drive ports A/E and an approximately 87.95 mm wheel diameter. Track width 160 mm, motor polarity and horizontal sensor locations are starting assumptions; default 8 mm color height follows published ADB observations. Sensor ranges/resolutions/accuracy envelopes now follow LEGO specifications, but error distributions and gyro parameters remain unmeasured assumptions. The sample selects E+A; that order is preserved and may reverse motion. Verify wiring and direction on the real build before interpreting results.

The field is 2362 × 1143 mm. The 2024 artwork is approximately registered between 171 mm side home strips; its crop and landmark coordinates are digitized estimates, not surveyed measurements. The 2023 image retains the initial whole-image fit. Do not use this preview for millimeter-accurate mission practice.

## Reusable animated models

Upstream loads hierarchical LDraw `.ldr`/`.mpd`, not just flattened meshes. Its linked `DrivingBase3.mpd` contains individual parts, `!SPIKE_PORT` and `!SPIKE_GEARING` annotations. Inspection on 2026-09-13 found drive wheels associated with C/D, unlike this robot's A/E profile. This example is not the Advanced Driving Base Assembly. The upstream `VM.turnMotor` computes wheel travel; it does not itself rotate the rendered wheel parts.

Reuse this hierarchy through a Three.js LDraw adapter or a prepared glTF asset. Preserve separate named wheel and attachment groups, axle/pivot positions, rotation axes, motor port, polarity, gear ratio and rest transform. Animate from encoder angle, never from distance traveled, so wheels can spin during slip or wall contact. Arms require grouping all rigidly attached bricks around their joint; identifying the motor alone is insufficient. Gear trains/linkages and contact bodies need explicit configuration. Visual detail must remain independent of the collision model.

The Three.js adapter now loads that packed LDraw model, preserving paired tire/rim pivots and mapping them to the current physical left/right drive roles. C/D demonstration tools are separate joints; all animation follows encoder angles, including at boundary contact. The exact Advanced Driving Base hierarchy and real attachment linkage geometry remain future work. The reference has different dimensions and is labeled accordingly in the UI; it never changes the physical profile.

Before bundling a robot model, verify the exact assembly and asset redistribution notices. The SHA-256-pinned upstream example can be fetched locally with `npm run model:fetch`, but is ignored by git and must not be included in a distributed build before its rights are checked. The original ADB-style approximation is the default and fallback when the optional asset is unavailable; the cylinder remains selectable.

## Next stages

1. Expand opcode, procedure and scheduler conformance tests against LEGO exports and hardware.
2. Worker-isolated runtime, independent randomness streams, run recording and block-level stepping.
3. Verified field registration and rigid-body/contact experiments, animated robot adapter.
4. Hardware calibration: straight runs, turns, encoder-versus-distance, stationary gyro and repeated surface trials. Fit distributions, not one lucky run.
5. Expand and calibrate the new ten-objective mission pack and worker-based 10/20/30 seeded reliability trials. Verify full routes on hardware; existing starter programs are control snippets, not guaranteed competition solutions.

See `THIRD_PARTY_ASSETS.md` for sources and rights caveats. Preserve upstream `COPYING.md` and notices.
