# Sensor models: research baseline, not a calibrated digital twin

Implemented 2026-09-13 in `src/lab/sensors.ts`, integrated with the Word Blocks interpreter. Sources below were checked on that date. Hardware specifications constrain this first model; they do **not** establish error distributions, firmware latency or this individual robot's behavior. No measurements of the user's robot have been collected.

## Build and connections

The Advanced Driving Base uses drive motors A/E, attachment motors C/D and downward color sensors B/F. Distance and force are optional replacements, not extra invisible hardware. This preview permits replacing B/F; reassigning C/D to sensors is not yet implemented. Optional presets use a forward-facing mount with a 100 mm offset and 35 mm height (both estimates).

Prime Lessons' own [Advanced Driving Base observations, pages 5–6](https://primelessons.org/en/ProgrammingLessons/BuildingARobot.pdf) describe the stock color sensors approximately 8 mm above the ground and unreliable black classification on tape/FLL mats at that height. They recommend raising them to 16 mm. The default height follows this observation; forward/lateral offsets of 100/±45 mm remain estimates. This is evidence for a failure mode, not a measured failure probability.

## Published constraints and their implementation

| Sensor | Source constraint | First implementation |
| --- | --- | --- |
| Color/reflection | 100 Hz; optimal distance 16 mm; reflection 0–100% | 10 ms sample-and-hold; nine-point footprint over registered mat; integer reflection and LEGO color IDs |
| Ultrasonic distance | Normal range 50–2000 mm, ±20 mm; 1 mm resolution; 100 Hz; entrance angle ±35° varies with distance | 10 ms sampling; range rejection, quantization, bounded error; nine-ray planar cone against table walls |
| Force/touch | 100 Hz; touch threshold 1 ±0.5 mm in the 0–2 mm zone; force zone 2–8 mm, 2.5–10 N; resolution 0.1 N; accuracy ±0.65 N | Independent touch switch and force reading; compressed forward probe; travel-based force curve and bounded measurement error |
| Angular encoder | Large and medium motors: 360 counts/revolution, accuracy ≤±3° including gearbox slack, update 100 Hz | Sampled 1° readings with bounded repeatable angular error; true shaft angle remains separate for physics/animation |
| Hub IMU | Three-axis gyro plus three-axis accelerometer; not a magnetic compass | Existing yaw model retained: drift, noise, integer output, 20 ms sampling and one-sample lag. No published accuracy/timing bound found in the hub sheet; these values remain assumptions |

Primary LEGO sources: [color datasheet](https://assets.education.lego.com/v3/assets/blt293eea581807678a/blt62a78c227edef070/5f8801b9a302dc0d859a732b/techspecs_techniccolorsensor.pdf), [distance datasheet](https://assets.education.lego.com/v3/assets/blt293eea581807678a/blt64c2b9534cf10f68/5f8801b8bc43790f5c4389ea/techspecs_technicdistancesensor.pdf), [force datasheet](https://assets.education.lego.com/v3/assets/blt293eea581807678a/blt23df304b05e587b2/5f8801ba721f8178f2e5e626/techspecs_technicforcesensor.pdf), [large motor datasheet](https://assets.education.lego.com/v3/assets/blt293eea581807678a/bltb9abb42596a7f1b3/5f8801b5f4c5ce0e93db1587/le_spike-prime_tech-fact-sheet_45602_1hy19.pdf), [hub datasheet](https://assets.education.lego.com/v3/assets/blt293eea581807678a/bltf512a371e82f6420/5f8801baf4f4cf0fa39d2feb/techspecs_techniclargehub.pdf).

The current [distance product page](https://education.lego.com/en-gb/products/lego-technic-distance-sensor/45604/) instead advertises 1–200 cm and ±1 cm. This conflicts with the more detailed technical sheet. We deliberately use the conservative 50 mm minimum/±20 mm envelope until a hardware/firmware-specific test resolves it. The fast 50–300 mm mode is not exposed. The [medium motor datasheet](https://assets.education.lego.com/v3/assets/blt293eea581807678a/blt692436dd1e8fa71c/5f8801d5c8a27c1d9614c27e/techspecs_technicmediumangularmotor.pdf) independently confirms the same encoder resolution, accuracy and update rate for the C/D attachments.

## Unmeasured modeling choices (editable, not claimed LEGO statistics)

- Color: sampled image brightness is a **proxy**, not physical reflectance or spectral response. Nine-point radius `2 + 0.18 × height` mm is an estimated footprint. Per-device reflection offset is bounded by ±2 percentage points and sample noise by ±1. Low mounting linearly increases a black-to-no-color stress probability up to 50% at 8 mm; that probability is invented for experimentation, not fitted data. It does not change reflected-light readings, allowing reflection-threshold line detection to be explored separately. At 16 mm this particular stress is disabled. Ambient-light contamination, glossy surfaces, saturation and optical height response still need models/data.
- Distance: the stated entrance angle is represented by a fixed ±35° cone; this is not a measured acoustic beam pattern. Reject incidence cosine below 0.25; assume 2% independent lost samples. Those choices require angular/material trials. Error is a seeded fixed bias plus bounded uniform sample noise (60/40 allocation), leaving half a millimeter for rounding. A datasheet tolerance is not a Gaussian standard deviation. No cross-talk, multipath, height occlusion or full acoustic propagation yet.
- Force: a probe extends 8 mm from the configurable backplate, measuring compression against forward walls. Force is zero below 2 mm, then a linear 2.5–10 N approximation over 2–8 mm. The real low-travel force response is not measured. The touch switch uses 1 mm with a seeded ±0.5 mm device threshold and an assumed 0.15 mm release hysteresis. Measurement error is bias/noise (65/35), reserving 0.05 N for rounding. No drivetrain torque/contact-force solver; the probe does not change the 100 mm chassis collision footprint. Reaching a rear wall does not press a front probe.
- Encoder: sinusoidal angular error plus rounding stays within the default ±3° envelope. This approximates angle-dependent tolerance, not a measured backlash/reversal model. Reported speed is rounded from shaft speed; no empirical speed-error model yet. Physical motors still close their internal target loop on true angle. Wheels rotate from true shaft angle, never noisy reported angle or ground travel.
- Gyro: default 0.12°/s drift, ±0.2° uniform noise and 20 ms pipeline are pre-existing illustrative settings, not specifications. Reset clears the reference and pending heading sample without rotating the robot. Temperature, warm-up, scale factor and fusion/transient behavior require recordings.

The Ideal reference disables stochastic/accuracy perturbations, but retains finite sensing footprint, sampling, quantization, sensing range and mounting geometry. Each external sensor has its own seeded stream, independent of reads, rendering, other sensor types and drivetrain randomness. Repeated runs with the same seed reproduce exactly. Existing gyro/slip/program-random stream separation remains future work.

## Block compatibility and deliberate limits

Supported reporters/predicates: color, isColor, reflectivity, isReflectivity, distance, isDistance, force, isPressed, yaw, timer, motor position/absolutePosition/speed. `pressed` uses the touch channel independently from force; `hard-pressed` uses >5 N (matching the upstream VM). Sensor event hats, tap/peak mode, ambient/raw RGB, hub buttons, gestures, pitch/roll and accelerometer blocks are **not** implemented and remain explicit unsupported blocks. The plane-only vehicle cannot honestly produce free-fall/tilt data yet.

Distance units match the upstream VM: mm/10 for cm, mm/25.4 for inches, mm/20 for percent. Force percent is N×10. Missing/wrong sensor types throw a clear port error instead of returning zero. Invalid distance is internally `null`, visibly “No echo”. **Provisional Word Blocks convention:** distance reporter returns -1 in every unit; distance predicates all return false without a valid echo. LEGO's [Python API](https://spike.legoeducation.com/prime/modal/help/lls-help-python) documents -1 for invalid distance, but that does NOT verify Word Blocks behavior. Record an actual export/runtime test before asserting compatibility. Equality compares the converted sampled reading, with a tiny floating-point tolerance; it does not mean “within the sensor accuracy envelope”.

Only modeled table boundaries produce echoes/contact. Printed mission artwork and the Coral proxy are not colliders. The distance overlay depicts a search cone capped at the reported range, not a reconstructed exact echo location. The force overlay retracts and changes color on touch. A collision indicator alone is not a force-sensor reading.

## Student experiments and validation

Experiments menu: Reflection — stop at line; Distance — stop before wall; Force — stop on contact. Each is an ordinary Scratch graph following the same interpreter and visualizer as uploaded `.llsp3` programs. The preset replaces B, keeps F color, sets a forward-facing start on the calibration grid and enables the live sensor overlay. Settings expose B/F type and mounting geometry plus reflection noise, distance error and dropout.

Run `npm test`, `npm run check`, `npm run build`. Tests cover sample-and-hold, finite footprint, stock-height failure stress, range/occlusion, accuracy envelopes, seeded independence, independent touch vs force, rear contact, encoder error, native block names, unit conversions, no echo, incorrect ports and end-to-end sensor-controlled stops. These validate the model's implementation, not its real-world predictive accuracy.

## Next physical measurements

1. Record the build, port layout, sensor-face positions/heights and hub firmware/app version.
2. Record stationary yaw for 2 minutes cold/warm, plus repeated 90°/360° turns against an external angle reference.
3. At 8/12/16/20 mm, record black/white/colored patches and line crossings; compare color ID and reflection distributions under room lighting changes.
4. Record distance to a flat wall at 50/100/200/500/1000/2000 mm, then angled/small/soft targets. Count invalid readings and capture Word Blocks no-echo behavior in each unit.
5. Record touch/release travel and known loads across the force range, including gentle and hard presses. Never infer contact force only from commanded motor power.
6. Compare reported shaft angle with external angle marks in both directions. Then fit profiles using multiple repetitions and reserve held-out runs for validation.
