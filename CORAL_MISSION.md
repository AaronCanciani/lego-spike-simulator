# SUBMERGED: representative Coral Nursery exercise

## What comes from the real season

FIRST's 2024–25 SUBMERGED Robot Game Rulebook identifies **Mission 01 — Coral Nursery** on the left side of the field (page 9). Its coral-buds task is to flip the buds up, worth 20 points under the official end-of-match rules (page 10). There are other scoring conditions for the coral tree which this exercise does not implement.

The official launch areas are the two marked quarter-circle areas in the bottom corners. The robot and anything it will move must fit completely inside the selected launch area when launching (pages 16–17). Teams select their own start pose and route; FIRST does not prescribe the route below.

Source: [official SUBMERGED Robot Game Rulebook](https://firstinspires.blob.core.windows.net/fll/challenge/2024-25/fll-challenge-submerged-rgr-eng.pdf). The relevant diagram and rule pages were inspected visually. [Official field setup guide](https://firstinspires.blob.core.windows.net/fll/challenge/2024-25/fll-challenge-submerged-field-setup-guide.pdf) remains the reference for physical model assembly/placement; our proxy is not a reconstruction of that mechanism.

## Our authored teaching route

Select **Experiments → Coral Nursery · gyro route**. The app loads ordinary Scratch Word Blocks and the 2024 mat. The green ring is the nominal starting footprint, cyan dashed line is the intended path, and cyan target ring is the approach checkpoint. Yellow is the robot's actual trail.

| Stage | Nominal plan | What controls it |
| --- | --- | --- |
| Launch | Left launch, center x = −840 mm, y = −390 mm, facing north | Fixed starting placement |
| Approach | Drive 425 mm north toward x = −840, y = +35 | E encoder; yaw correction while driving |
| Operate | Stop, settle 0.3 s, rotate C clockwise 75°, hold 0.5 s | C motor's position target |
| Return | Reverse until E approaches its initial encoder position | E encoder and reverse-sign yaw correction |

Origin is the field center; x increases right, y increases toward the far wall. Heading 0° points north. Encoder distance is based on the nominal 87.95 mm wheel. Changing wheel geometry therefore changes the route's distance, as it would for a student's hard-coded conversion.

The landmark around (−900, +180) mm and the approach pose are estimates from the archived artwork/overview, not official surveyed coordinates. The 2024 image's approximate source mat rectangle (208, 0, 1946, 1143 pixels) is registered between nominal 171 mm side home strips; the original image stays unchanged. Real mat tolerances, margins, model pivots and attachment reach still need physical measurement.

## What the training checks mean

The four indicators assess a nominal 100 mm radius launch footprint, approach within 45 mm and 8°, at least 60° of positive C motion while remaining aligned, then return inside the estimated launch area. A pre-raised arm arriving at the target does not count. The pink buds are an animated proxy driven by this training check, not by a contact solver.

**“Practice complete” is not an official mission score.** Other mission models are not collision obstacles yet. The proxy does not model force, leverage, latch behavior, coral-tree scoring or whether the real tool could reach the actual buds. This is a representative approach/tool/return control exercise on a real map, not a validated FLL solution.

Try the open-loop variant with the same seed and profile. With effective wheel mismatch 6% and residual motor mismatch 2%, tests at seeds 1, 42, 79 and 120 find that gyro feedback completes the training exercise while open loop misses the approach criteria. Default illustrative settings also pass with feedback. None of these tests establish hardware fidelity.

## Animated model

The detailed shell and wheel/rim geometry come from the upstream DrivingBase3 LDraw file. Its native wheel spacing is approximately 112.8 mm; it is visibly and explicitly a **reference build, not the exact Advanced Driving Base**. Wheel animation maps to the selected physical A/E drive roles without changing the physical profile. C/D mounts and tools are new demonstration geometry. Every joint uses encoder angle, so a stationary chassis can still have spinning wheels. The **Robot** camera button makes the motion easier to inspect.

Run `npm run model:fetch` to fetch the SHA-256-pinned asset locally. The downloaded model is ignored by git because redistribution rights are not established; the adapter, attribution, tests and fetch script are committed. With the asset absent the app safely falls back to the cylinder. Do not distribute a build containing this optional model until its rights are checked.

Next validation work: fit the actual Advanced Driving Base geometry and tool pivots, measure the launch/landmark coordinates on a physical mat, and replace the teaching rubric with mechanism contacts and end-state scoring.
