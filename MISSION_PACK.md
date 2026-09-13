# Archived missions and reliability lab

## Shared-season update

Normal app runs now load **all implemented missions from the selected season into one physics world**, with one robot, shared contact/sensor geometry and independent mechanism state. For example RePLAY includes Boccia, Step Counter and Tire Flip together. Selecting an objective no longer makes those other implemented models disappear. The mission brief lists which models are present. This is **not a complete official field**: unimplemented models pictured in photographic mats remain flat, and the photographic color-sampling limitation remains.

Both C and D now accept [configurable physical attachments](ATTACHMENTS.md). Default: rear dozer C, front lift D. The old C-only paddle descriptions below document the legacy regression fixture, not the normal app. Reliability workers capture the selected attachments and recreate the same shared-season world on replay. Generic starter snippets do not automatically reposition tools or guarantee success with every rig.

## Student workflow

Open **Mission tools** for starts, starter code, the full brief and reliability tests. It folds away while a visible run is active to leave room for the 3D playground.

Run tab -> Mission library -> choose a mission. Selecting a mission changes the map, suggested launch and physical models but preserves the program. Choose **Practice approach** for a shorter isolated exercise; gold and cyan rings show practice and suggested launch locations. These positions are digitized estimates, not certified legal full-equipment launch placements.

Starter programs are editable native Scratch graphs: line following (B reflection, F distance), distance approach, contact/push/retreat (F force), and wall square-up. Loading one explicitly replaces the program after the normal unsaved-work confirmation and applies the displayed sensor wiring. They are reusable control snippets, NOT ten guaranteed complete competition solutions. The full-route descriptions are proposals; their end-to-end navigation has not been validated on physical robots. The contact probe uses a forward 220 mm mount just ahead of the paddle; other distance examples use 100 mm. The line starter sets B height to 16 mm.

Program backups and browser drafts now preserve normal robot setup, map, mission, practice position and replay friction as well as the older cargo format. Old backups continue to load.

## Included objectives (teaching scoring, not official scores)

| Season            | Mission                  | Implemented objective / mechanism                                                                                                                                             |
| ----------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2019 CITY SHAPER  | M02 Crane                | Physical blue slider releases a suspended unit; complete after the unit rests on the mat. Crane rotation/stacking bonuses omitted.                                            |
| 2019 CITY SHAPER  | M12 Design & Build       | One red dynamic unit completely inside the target circle, resting and released. Multi-color stacks omitted.                                                                   |
| 2020 RePLAY       | M08 Boccia Share         | Two independently pressed sliders launch cubes with a stored-energy impulse; exactly one must cross the north wall. Pressing both fails permanently. No opposing robot/bonus. |
| 2020 RePLAY       | M02 Step Counter         | Horizontal carriage moved >=150 mm through contact. Original linear rail, not the LEGO ratchet assembly.                                                                      |
| 2020 RePLAY       | M09 Tire Flip            | Dynamic heavy cylinder white-side up and wholly inside the target; crossing the visible red limit fails permanently. Light tire omitted.                                      |
| 2022 SUPERPOWERED | M04 Solar Farm           | Three dynamic energy units displaced entirely beyond their starting circles.                                                                                                  |
| 2022 SUPERPOWERED | M07 Wind Turbine         | Three distinct physical press/release cycles drop three units; holding the plate counts once.                                                                                 |
| 2023 MASTERPIECE  | M03 Immersive Experience | Physical slider triggers the three screen states; robot must withdraw. Screen motion is a latched kinematic mechanism, not simulated LEGO linkages.                           |
| 2024 SUBMERGED    | M15 Research Vessel      | Dynamic vessel pushed between solid dock guides and against the latch, then left resting. Sample loading omitted.                                                             |
| 2018 INTO ORBIT   | M01 Space Travel         | Physical slider releases one preloaded rolling cart proxy down a slope past a finish threshold. Additional cart loading omitted.                                              |

The separate **Wall alignment** drill requires actual south-wall contact, heading within 3 degrees, and a subsequent >=100 mm departure with small lateral deviation. Wall contact rotates the rectangular chassis through rigid-body forces. There is no heading or pose snap.

## Physics scope

Mission mode uses cannon-es at 5 ms, 190 x 180 mm rectangular chassis, finite horizontal traction forces (8 N/axis) and yaw torque (0.12 Nm), and a 78 mm physical table wall. Chassis pitch/roll are constrained; this is not a full tire suspension model. Existing motor/wheel mismatch, slip, gyro and sensor errors still feed the physical motion. Wheel encoders may spin against an obstacle.

The C paddle is an original 80 x 120 mm hinged arm with a 0.35 Nm motor torque limit. Hinge reaction loads transfer to the chassis. Encoder readings come from actual joint movement, not the requested target. D is still a visual demonstration attachment. Do not interpret this arm as the exact Advanced Driving Base attachment. Cargo Harbor's existing linear lift remains a separate mode.

Push plates use one-axis sliders, finite spring return and travel stops. Launchers and screen/rack releases use event-driven simplified mechanisms after real slider movement/contact. Object dimensions/masses, spring constants and traction values are illustrative, not calibrated hardware measurements. The cart has rolling cylinder-wheel collision geometry, simplified visual geometry and no independent wheel axles. Target circle containment conservatively checks all projected AABB corners. Solar clearance uses a conservative center-distance test. Completion requires 0.3 s sustained qualifying state; release/rest objectives exclude robot/arm contact.

Distance and force rays intersect actual physical geometry at sensor height; beams above the table walls do not hit infinite-height walls. Color/reflection samples the exact rendered photographic map, including any pictured model baked into that image. Photographed objects elsewhere on the field have no colliders. Only the selected mission's solid 3D objects and table walls affect motion. Assessment/start outlines are 3D overlays, never extra markings in the sensor image. The 2024 registration retains its approximate crop; other archived images fit the full field. None is survey-accurate.

## Reliability

10/20/30 background-worker trials copy the current program, active profile, start and map pixels. Separate reproducible seeds vary start x/y +/-10 mm, heading +/-3 degrees, wheel mismatch +/-1.5 percentage points, motor mismatch +/-0.8 points, slip +/-0.5 points (clamped nonnegative), and mission contact friction +/-20% around 0.45. These ranges are a teaching stress test, not a hardware-derived confidence interval. Ideal mode removes sensor noise but the deliberate trial perturbations still apply.

Success is checked at program end, not at the first transient scoring pose. Errors, unsupported instructions, missing sensors and the 180 s runtime limit are failures. Results show the reason and can replay exactly the captured seed/profile/start/friction on the visible playground. Cancellation terminates the worker; program/settings changes invalidate results. Partial/cancelled batches show their actual completed count. A high percentage is not a guarantee of real-world success. A single successful open-loop run is not proof of robust control.

## Verification and sources

`competition.test.mjs` tests all ten objectives and idle non-success, actual Scratch contact programs, wall rotation/departure, sensor height/occlusion, joint feedback, deterministic trials and missing-sensor failures. Delivery and tire orientation tests arrange physical payload fixtures before settling them; these are scoring tests, not complete autonomous solutions. Other mechanisms use physical drive/arm inputs. Existing interpreter, color-image, sensor, editor, rig and cargo suites remain applicable.

-   [Official past challenge archive](https://www.firstinspires.org/resources/library/fll/past-challenges)
-   [LEGO Crane lesson](https://education.lego.com/en-us/lessons/first-lego-league-archived-missions/the-crane-mission/)
-   [LEGO Boccia lesson](https://education.lego.com/en-us/lessons/first-lego-league-archived-missions/the-boccia-shared-mission/)
-   [SUPERPOWERED rules](https://firstinspires.blob.core.windows.net/fll/challenge/2022-23/fll-challenge-superpowered-robot-game-rulebook.pdf)
-   [SUBMERGED rules](https://firstinspires.blob.core.windows.net/fll/challenge/2024-25/fll-challenge-submerged-rgr-eng.pdf)
-   [Source/provenance and map publication authorization](THIRD_PARTY_ASSETS.md)
