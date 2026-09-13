# Representative sensor tests

Run `npm test`. As of 2026-09-13, 42 tests pass with the optional reference model installed. These are software-model tests, not evidence of real-robot accuracy. The existing `.llsp3` sample and Coral Nursery regressions remain part of the suite.

## Newly available browser experiments

Choose from **Experiments**:

- **Color · stop at red**: drive past the blue stripe, stop on red.
- **Color · stop at blue**: stop at the earlier blue stripe.
- **Line · follow curve to red**: continuously steer from B's reflected light and stop at the red finish. The robot follows the right edge of the black line, not its center. Its chassis trail is offset from the sensor's path because B is mounted ahead and left of the axle.

All three use ordinary Scratch graphs, a synthetic training mat, stock horizontal B/F offsets, and a disclosed raised color-sensor height of 16 mm. They retain the selected drivetrain settings. A named Scratch variable remembers a detected target; a 12-second timeout produces **Timed out — target not detected**, never a success. The visible result is the program's report, not independent mission scoring.

The line controller is `steering = -0.9 × (B reflection - 50)` at 20% movement speed. It has no access to robot coordinates, the course curve or true heading. This is a teaching controller with a pre-positioned start, not a general line-search/reacquisition algorithm. The synthetic mat has white/black contrast chosen for this example; threshold and gain need calibration on a real mat.

## Coverage

| Input | Representative program | Failure/accuracy checks |
| --- | --- | --- |
| Color category | Stop at red or blue using real raster pixels and `isColor` | Eight canonical colors; ignore wrong-colored marker; move target/change speed; missing target; lose color during braking |
| Reflected light | Stop at a dark line; continuously follow a curved edge to red | Footprint mixing, sample-and-hold, noise, four seeded mismatch trials; open-loop and frozen-reflection controls miss the course |
| Ultrasonic distance | Drive toward a table wall and stop before it | Range, resolution, bounded error, no echo, cone/occlusion, wrong port, units |
| Force/touch | Stop when a front-mounted probe touches the wall | Touch separate from measured force, hard press reporter, force accuracy/saturation, no activation from rear contact |
| Gyro yaw | Correct a drifting drive; complete the representative Coral route | Multiple seeds, yaw reset, frozen-yaw control cannot correct drift |
| Motor encoders | Distance-controlled travel and C/D tool operation | One-degree sampling, bounded error, encoder motion during ground slip/wall contact |

### New automated scenarios

`colorExamples.test.mjs` adds nine tests:

1. All eight canonical color swatches pass the same RGB/pixel classifier used in the browser. This caught and fixed a light-blue swatch being classified as blue.
2. Generated Scratch graphs use supported native blocks, with valid parent/input references and no route/pose API.
3. Red and blue stops succeed across four seeds and both 8/16 mm sensor heights (16 runs). Red must pass the earlier blue stripe.
4. Moving the red stripe by 120 mm changes the stopping position accordingly, even with different movement speeds.
5. Continuous line-following completes across four seeds with 6% wheel mismatch and 2% motor mismatch, sensor noise and surface slip. Before the finish stripe, mean sensor-to-edge error must be under 4 mm and peak error under 10 mm. These are internal model regression bounds, not physical accuracy claims.
6. Removing steering feedback or freezing reflection at its target value causes a timeout and substantially larger edge error, rather than magically completing the route.
7. Erasing the red pixels causes a timeout; the earlier blue marker cannot count as success.
8. Identical seeds reproduce the complete path, readings, execution trace and result.
9. Once detected, the result remains latched even if the color reading becomes unavailable during braking.

The 1600×800 course raster is generated once in `sensorCourse.ts`. Both headless tests and the browser consume it through `colorSampling.ts`; tests do not bypass image classification by feeding predetermined color IDs. Sensor sampling then passes through the normal sensor model and interpreter. True sensor position is used only by the test grader to measure tracking error.

## Still outside coverage

- Physical mission-model sensing/contact: only table boundaries currently have distance/contact geometry. Printed artwork is not a solid obstacle.
- Full 3D IMU, ambient/raw RGB, hub buttons, sensor event hats, force tap/peak mode and other unsupported blocks.
- Hardware fidelity, real optical spectra/lighting, acoustics, calibrated backlash/force response and exact Word Blocks no-echo semantics.
- General-purpose line acquisition, intersections, tight corners and arbitrary start positions.

See [SENSOR_MODELS.md](SENSOR_MODELS.md) for research sources, assumptions and the proposed physical calibration trials.
