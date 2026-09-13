# Advanced Driving Base attachments

The user identified LEGO's **rear dozer blade** and **front lift arm**, not a bucket scoop. The default pair is C = rear dozer, D = front lift; both are physical hinged bodies in the same world as the robot and mission objects. This replaces the yellow/pink display-only pair in the normal app. The older linear Cargo Harbor prototype remains a separate mode.

## Configuration

My Robot offers independent C/D choices: dozer, lift arm, simple paddle or no attachment, plus a button restoring the stock pair. Swapping ports preserves the preset mounting end. Advanced > Attachment geometry & mechanics exposes mounting position, facing, outline dimensions, gear ratio, shaft direction, starting angle, travel limits, mass and torque. Changes reset the run. Backups, drafts and reliability replays retain these settings. Older backups without attachment settings use the new default pair; explicitly saved configurations are preserved.

The front attachment has two bent rails and a short lifting finger. The rear attachment has segmented curved supports, a wide blue blade and purple bottom edge. Rendering and collision use the **same part definitions**, including orientation. These are original simplified geometry, not imported LEGO CAD or an exact brick assembly.

## Mechanics and limits

-   Hinge motors have finite output torque (shaft limit × gear ratio × assumed 0.8 efficiency), gravity loads and capped integral position control. Shafts report actual geared joint movement. Impossible angle targets remain pending/stalled, not falsely completed.
-   Default **3:1 gearing is an unverified starting estimate**, not a researched LEGO specification. Lengths, pivot heights, mass, torque, initial pose, mechanical limits and controller tuning are likewise uncalibrated. Measure shaft rotation against attachment angle before comparing with hardware.
-   A plate only lifts when supported by actual contact; there is no magnetic pickup or attachment binding. Raised/misaligned tools can miss objects. Objects can slide off.
-   Angular travel stops use position projection after a solver step, not compliant end-stop material. Chassis pitch/roll and vertical travel remain locked, so this does not model tipping or suspension. Tools collide with world objects but not the chassis or one another; robot self-collision, gearing backlash, flex, thermal behavior and battery sag remain unimplemented.
-   Sensors currently exclude robot/tool bodies from their rays; attachment-induced sensor occlusion is not modeled. The simulator freezes the world when a program ends, so post-program settling is still a fidelity limitation.

## Evidence and validation

The LEGO lesson and PDFs identify the outlines and mounting ends; the lesson's Python materials identify C as dozer and D as lift. They do not establish the numerical simulation calibration above.

-   [LEGO: Time for an Upgrade](https://education.lego.com/en-us/lessons/prime-competition-ready/time-for-an-upgrade/)
-   [Official dozer instructions](https://assets.education.lego.com/v3/assets/blt293eea581807678a/blt87d3e0928886e2f9/5ec8e994daab7c7c2a55503f/dozer-bi-pdf-book1of1.pdf)
-   [Official lift instructions](https://assets.education.lego.com/v3/assets/blt293eea581807678a/blt93af2e55087807c6/5ec8e99a6b4f987c36ce7603/lift-arm-bi-pdf-book1of1.pdf)

`attachments.test.mjs` checks front/rear placement, matching rendered/collision parts, independent motor targets, gearing and reverse polarity, finite travel stops, native Scratch C/D commands, unloaded motors, blade contact versus raised misses, and supported lifting versus missed pickup. It also checks shared-season worlds, sensor rays and interaction with a non-selected mission. These establish implementation behavior, not real-hardware equivalence.
