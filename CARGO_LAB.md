# Cargo lab: physical attachment milestone

Choose **Experiments → Cargo lab · lift & deliver**, then Run. Build edits the same ordinary Word Blocks program. The default example approaches a pallet-footed orange cube, lifts with motor C, drives to the green zone, lowers, backs away, and waits for settling. It succeeds at the default illustrative settings. It is a timed baseline, **not a closed-loop cargo controller or a claim of hardware reliability**.

## Implemented

- Opt-in cannon-es 0.20.0 rigid-body world, using meters internally and the existing fixed 5 ms simulation clock. No renderer-driven physics and no additional server.
- Solid planar chassis, solid table boundaries, a freely translating/rotating payload with gravity, and two forks whose contact geometry is also used for rendering. Cargo is never attached, snapped or parented to the robot.
- Motor C drives a **prototype linear carriage**, 0–140 mm of travel. Default gearing is 0.35 mm/motor-degree; fork length is 110 mm. This is original illustrative geometry, not the son's actual LEGO mechanism or a verified Advanced Driving Base attachment.
- Finite planar drive force (8 N per horizontal axis) and yaw torque (0.15 Nm). Wheel encoders can turn while the chassis is blocked. The vertical carriage has a 4 N force cap and velocity-servo integral compensation; C's reported position follows actual carriage travel. Heavy loads and unreachable targets can stall, leaving a blocking motor command waiting until the ordinary 180-second program safety timeout.
- Adjustable fork length, payload mass (80 g default), surface friction (0.45 default), lift force and gearing. Parameters are hypotheses for teaching, not measurements.
- Distance/touch rays see the actual rotated payload shapes at the configured mounting height, alongside the existing table walls. Default B/F remain color sensors; replace a sensor in settings to experiment with forward distance or touch. Downward color sampling remains mat-only.
- Green success requires the complete payload footprint inside the zone, actual floor contact, no fork contact, and at least 0.5 seconds at low linear/angular speed. Success is recomputed, not permanently latched. Inspector status is not a new robot sensor.
- Pause freezes the entire world; reset recreates it. As with other exercises, physics freezes when the program ends, so include a final wait for settling. Cargo setup is included in local program drafts and new `.spikelab` backups. Older backups remain readable; `.llsp3` files keep the currently selected robot/scene settings.

## Deliberate limitations

The chassis cannot tip. Fork horizontal/yaw motion follows a prescribed guide; **lateral attachment reactions do not feed back into chassis motion**. Vertical lift dynamics are force-limited, but this is not a complete transmission, torque-speed curve, current, battery, backlash or motor heating model. Decorative mast rails are not additional collision shapes. Body collision geometry approximates the visual assembly. The payload center of mass is an illustrative assignment.

Friction uses an estimated resting weight, not the solved instantaneous normal load; tangent budgets approximate a Coulomb friction cone. In cannon-es 0.20.0, the solver clamps accumulated impulses directly to equation force limits. Our small solver adapter supplies friction budgets in impulse units (`mu * mass * g * dt`) and shares them across contact points, avoiding timestep/contact-count-dependent sticking. Regression tests check approximate `mu*g` deceleration at 5 ms and 2.5 ms. Review this adapter before upgrading the pinned dependency. Source: [GSSolver](https://github.com/pmndrs/cannon-es/blob/v0.20.0/src/solver/GSSolver.ts), [Narrowphase](https://github.com/pmndrs/cannon-es/blob/v0.20.0/src/world/Narrowphase.ts).

This is one authored teaching fixture, not a general attachment builder, arbitrary-object importer, gripper, or official FLL mechanism/scoring engine. Archived printed mats do not acquire physical mission models automatically. The older Coral Nursery exercise remains a separate pose/motor teaching rubric.

## Verification

`npm test` includes 16 cargo tests: full delivery, repeatability, missed approach, early lift, chassis pushing, overload stall, hard travel stop, unsupported fall, height-aware distance ray, friction/timestep behavior, aggressive-turn spill, whole-footprint/rest/contact scoring, shared rendered/physical geometry, distance+touch readings, pause/reset, and configuration validation. These validate this simulator, not agreement with hardware.

Next: match a photographed/measured real attachment; add lateral load transfer and a constrained joint; implement an ordinary-block sensor-guided pickup/delivery program and stress it across seeds; then add one real mission mechanism (hinge or slider) and calibrate against physical trials.
