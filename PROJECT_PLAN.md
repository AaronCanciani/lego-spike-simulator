# SPIKE Prime student simulator — project plan

Planning baseline: September 13, 2026. Implementation has started in the `spike-simulator` folder and the `spike-lab` branch of https://github.com/AaronCanciani/lego-spike-simulator. See that repository's `LAB_STATUS.md` for the current preview and explicit limitations; later stages below remain planned work.

## Product

A browser application for testing programs exported from LEGO SPIKE. Students load an .llsp3 file, select a field and robot profile, place the robot, and press Run. A resizable vertical divider starts at 50/50: a read-only block execution view on the left and a 3D field on the right. Coding remains in LEGO's app.

The first robot is an attractive cylinder with a clear front marker, soft shadows, sensor markers and a visible path trail. Its appearance is independent of its physical footprint, wheel geometry and sensors. A cylindrical display must not prevent configuring a flat collision face when we eventually teach wall squaring.

Primary learning outcome: students can see why a program succeeds or fails, change it in LEGO's app, reload it, and demonstrate improved reliability over repeated trials.

## Reuse decisions and inspected evidence

- Primary fork candidate: [alexandrehardy/lego-spike-simulator](https://github.com/alexandrehardy/lego-spike-simulator), inspected at commit `94b2cf8aa052642d7ce47662298e7d7bcce62fa4`. Reuse its Svelte/TypeScript application foundation, Scratch import, Blockly definitions, custom procedure support and execution machinery. Its generator has entries for all 30 distinct block types in the supplied 202-block project. This is a source coverage check, not proof that every block executes correctly.
- The [existing VM](https://github.com/alexandrehardy/lego-spike-simulator/blob/94b2cf8aa052642d7ce47662298e7d7bcce62fa4/src/lib/spike/vm.ts) includes execution highlighting, wall-clock timers and yaw updated directly from simulated rotation. These are concrete integration points: retain highlighting through execution events, replace wall-clock timing, and separate sensor estimates from physical state.
- Secondary reference: [QuirkyCort/gears](https://github.com/QuirkyCort/gears), inspected at `ea031032f1d24ffb77506523361c55c0e08edfa1`. Its tree contains FLL mat images and mission world definitions for 2018 through 2025. Evaluate reusable field data and geometry individually; do not merge two complete applications or physics engines.
- Preferred new rendering layer: [Three.js](https://threejs.org/docs/). Preferred contact/rigid-body candidate: Rapier, evaluated with a small drivetrain/contact benchmark before commitment. A general physics engine still needs a specific wheel traction and sensor model. [Rapier documents requirements for repeatable JavaScript simulations](https://rapier.rs/docs/user_guides/javascript/determinism/).
- Repository license labels differ: Hardy GPL-2.0, Gears GPL-3.0. During the reuse audit, read actual file notices and asset provenance before copying across them; preserve attribution and avoid assuming the repository license covers third-party mat artwork. Remote forks and pinned local checkouts are part of Stage 1.
- Use [FIRST's archived challenges](https://www.firstinspires.org/resources/library/fll/past-challenges) to verify season setup and dimensions. Availability of a mat image does not establish its scale or reproduction permissions.

## Stage 1 — Establish compatibility and the reusable foundation

Create the working fork and pinned reference checkout. Build the upstream application and import the supplied project. Produce a supported-block matrix and a trace of its main stack and custom procedures. Preserve original block IDs through import so each runtime event points back to a visible block.

Test procedure arguments, nested loops, concurrent scripts, steering signs, motor direction, port pair order, units, blocking motor operations, continuing motor operations, timer behavior and yaw wrap/reset semantics. Disconnected blocks remain inspectable but do not run without an event or explicit supported trigger. Unsupported reachable blocks produce a clear preflight error rather than disappearing.

Add a robot profile for wheel diameter, axle track, gear ratio, motor types/polarity and sensor locations. The sample uses drive pair E+A and additional motors C/D. Both color and distance routines reference port F, so we must report configuration conflicts and identify which routines are reachable. A program file does not fully specify the physical robot.

Exit: the project imports with an auditable execution trace and an explicit compatibility report. Do not claim all 202 blocks are physically validated merely because they render.

## Stage 2 — Deliver the first engaging browser experience

Build the 50/50 resizable layout. Left: familiar colored blocks, active-block highlighting, gentle follow mode, zoom, procedure navigation and live argument values. Keep disconnected scripts accessible without allowing them to crowd out the running stack. No toolbox or code editing controls.

Right: a 3D cylinder on a practice mat, soft lighting/shadows, heading marker, path trail, orbit/zoom, overhead view and reset-camera button. Allow drag-to-place and heading adjustment before a run.

Shared controls: Load program, Reload, field selection, robot profile, Run/Pause, Reset, speed and elapsed simulation time. A small telemetry strip shows sensed yaw, wheel movement and relevant sensor values. Keep advanced calibration settings in a drawer.

Exit: a student can load the real file and see its executing blocks synchronized with movement. Visual identity, typography, spacing, responsive resizing and empty/error states are included in this milestone.

## Stage 3 — Make execution and simulation repeatable

Decouple the interpreter and physical model from drawing, using a worker and a fixed simulation clock. Start with a candidate 5 ms physics step; validate convergence with smaller steps. Sensor sampling and program scheduling have explicit rates and latency, eventually measured on hardware. All waits and timers use simulation time.

Define an ordered cycle: apply scheduled commands, advance physical state, update due sensors, resume eligible program tasks, record events. Preserve asynchronous event/loop semantics. Seed program randomness and physical uncertainty through separate reproducible streams. Pin engine versions and record seed, profile, field, program and timing settings with every run.

Pause freezes the complete simulation. Slow motion changes playback speed without stretching control delays. Step-into/over advances simulation until the requested program boundary; a long-running movement continues to advance physics while waiting. Recorded replay supports scrubbing without pretending to execute backward.

Exit: the same run reproduces within declared numerical tolerances at different rendering rates and playback speeds. A runaway loop cannot freeze the interface.

## Stage 4 — Add configurable physical and sensor imperfections

Maintain separate true robot state, motor/encoder state and measurements available to the student's code. Only the inspector may expose ground truth. Resetting sensed yaw changes its reference, never the robot's actual heading.

Implement in increasing complexity:

1. Effective wheel radius/axle geometry mismatch, motor response lag, acceleration and braking.
2. Wheel traction limits, longitudinal/lateral slip, surface patches, load and collision response. A wheel may rotate while the robot hardly travels.
3. Gyro rate bias, integrated drift, scale error, sample noise, quantization, latency and calibration/reset behavior.
4. Color sensing from an unlit field/sensor map with a physical sampling footprint, plus classification uncertainty and delay. Distance sensing uses geometry, sensor placement, range limits and plausible missing returns.

LEGO motor speed and position commands already involve lower-level feedback. Reproduce that behavior instead of treating every command as raw power and exaggerating mismatch. Distinguish persistent robot characteristics, per-run setup variation and disturbances during a run. Use gradual, correlated disturbances where appropriate rather than adding arbitrary independent position jitter.

Provide an ideal reference profile, an explicitly uncalibrated illustrative profile, and later measured profiles. Ground-truth versus sensed-heading arrows and slip overlays are optional learning aids.

Exit: seeded straight-drive, turn and feedback benchmarks show explainable differences. Heading feedback reduces correctable heading error but cannot magically remove sensor bias or make distance accurate through severe slip.

## Stage 5 — Load actual past-season fields

Start with SUBMERGED 2024 and MASTERPIECE 2023, plus a simple calibration field. Substitute another available season if it better matches the family's physical mat. Evaluate the Gears images/worlds, verify dimensions and orientation against field documentation, and package each season as data.

A field pack contains its image, physical dimensions, table bounds, mat offset, start areas, fixed obstacle shapes, sensor appearance and surface properties. Support a locally imported mat image with a scale-setting workflow. Verify image cropping and pixel-to-distance conversion rather than trusting filename or image width.

Ship a scaled mat with walls and simplified fixed obstacles first. Mark movable mission mechanisms as unsupported until implemented. Attachments C/D can show motor motion in telemetry, but their mission interactions require separate mechanism models. Field art alone cannot certify mission success.

Exit: a measured drive covers the right distance on the mat; color readings follow the correct printed region; fixed obstacles affect motion and distance measurements. Season switching needs no simulator code changes.

## Stage 6 — Calibrate against real SPIKE robots

Create guided experiments and a measurement import format: stationary gyro recordings; repeated straight runs at several speeds; forward/reverse movements; left/right turns; acceleration/braking; and tests on known surfaces. Record wheel geometry, motor types, battery condition, payload and launch placement.

Use independent physical measurements or calibrated overhead video for actual heading and displacement. Gyro telemetry alone cannot reveal its own heading error. Separate measurement uncertainty from robot variation. Collect multiple repetitions and fit persistent bias separately from run-to-run spread.

Fit a small identifiable model first. Compare path shape, endpoint error, heading error, stopping distance, timing and observed distributions. Validate on trajectories and speeds withheld from fitting. Save versioned profiles with their evidence and supported operating conditions; determine quantitative acceptance bounds from measurement quality.

Exit: the model predicts held-out runs and useful differences between control strategies within agreed tolerances. Until this passes, label profiles illustrative rather than calibrated.

## Stage 7 — Student trial comparison and release

Add Run 20 trials with path overlays, endpoint scatter, heading spread and user-defined target-zone/orientation criteria. Allow comparison of two loaded exports using matched seeds and starting conditions. Show success rate with trial count, not a bare percentage.

Students can inspect a failed run, replay it with synchronized blocks, and see whether it timed out waiting for a sensor, missed a target or hit an obstacle. Ground-truth debug overlays stay outside the program API. Program reload preserves field and robot settings when compatible.

Finish keyboard controls, reduced-motion support, readable contrast, clear focus indicators, loading/error recovery and browser performance tests on representative student laptops. Target smooth rendering with a lower-quality option without changing simulation results. Store session setup locally and offer a portable experiment file; accounts and a backend are unnecessary for the first release.

Exit: students can independently load, run, diagnose, edit externally, reload and compare reliability. Run end-to-end checks with the supplied file plus programs exercising loops, events and unsupported-block reporting.

## Delivery boundaries

- First usable preview: Stages 1–3, a cylinder, highlighted real code and basic practice field. It demonstrates the workflow, not calibrated realism.
- First learning beta: Stages 4–5, imperfect motion/sensors and two real field packs, with uncertainty honestly labeled.
- Calibrated student release: Stages 6–7, measured profiles and repeat-trial comparison.
- Later: detailed robot meshes, configurable attachments and mission mechanisms, ramps/uneven terrain, additional seasons and scoring. Decorative mesh upgrades should not alter physical behavior.

Stage 1 determines implementation effort more reliably than an estimate based on README claims. The main schedule risks are faithful LEGO block timing, physical-model calibration, field-asset quality and scope of mission interaction. Hardware experiments are the only planned dependency on access to the actual robots; the earlier stages can proceed with explicit uncalibrated profiles.
