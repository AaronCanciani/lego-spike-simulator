# Animated robot models

**Current attachment update:** normal runs now use physical rear C dozer/front D lift geometry, configurable through My Robot. See [attachment mechanics and limits](ATTACHMENTS.md). The earlier display-only tools described below remain legacy renderer fixtures, not the normal app's attachments. Normal runs now use the rectangular physical chassis; the planar-only engine remains for regression fixtures.

The default view is now an original, code-generated **Advanced Driving Base-style approximation**, inspired by the user's build reference. It is not an exact LEGO assembly, scanned model, building instruction or verified CAD reconstruction.

## What students can see

- Yellow/white hub, perforated magenta/cyan frames, drive motors, treaded wheels with spokes and visible rotation markers, a rear support and B/F sensor bodies.
- Independent left/right wheel rotation following physical motor shaft angles. The model does not derive wheel rotation from ground travel, so slipping wheels still turn.
- Independent C/D demonstration tools: yellow C and pink D. Positive motor rotation raises them; reverse rotation lowers them. These tools are illustrative, not a reconstruction of the child's actual attachment mechanisms.
- B/F bodies change appearance for color, ultrasonic distance or force, and disappear when disconnected. Their positions follow the sensor configuration. Force probe travel reflects the simulated compression.
- The hub matrix is decorative, not emulated hub light output.

**Robot** opens a close view from the front and enables **Follow**. Follow keeps the camera's current offset as the robot moves; students can orbit/zoom while following. **Top** and **3D** return to field views and disable following. The camera never changes robot state.

## Try the moving parts

Choose **Experiments → Robot · wheels & tools**. The regular Scratch interpreter drives forward/back, raises C and D, then lowers each tool. This is not a scripted visual animation outside the simulator. The experiment selects the new ADB-style view and following camera but retains the current physical profile.

## Geometry vs physics

Drive-wheel center spacing and nominal diameter follow the configured track and wheel settings. Frame width follows track as a visual approximation. Other proportions, supports, tool pivots, gearing (1:1) and structural details are illustrative. The sensor mounts are independent of that frame scaling.

No collision shape, mass, inertia, traction, sensor error or mission scoring was changed. The physics still uses its existing 100 mm circular chassis footprint. Visible frame/tool parts can extend beyond it and do not collide with mission objects. Exact model geometry must eventually be matched to measured dimensions and collision bodies before using this as an accurate physical digital twin.

## Existing imported model

Robot settings still offer **Imported reference build**, preserving the upstream packed LDraw model, wheel joints and C/D demonstration tools. That source is a different driving base; the UI continues to identify it as such. It is now loaded only when selected, avoiding its several-second parsing cost during normal startup. If it is unavailable, the new approximation remains visible.

The optional `npm run model:fetch` workflow and redistribution caveats in [THIRD_PARTY_ASSETS.md](THIRD_PARTY_ASSETS.md) remain unchanged. The downloaded model is not committed. The new default geometry needs no download or external model asset and reuses the existing motor-to-joint animation adapter. **Diagnostic cylinder** is retained in settings.

## Verification

The four new `advancedRig.test.mjs` tests verify configurable wheel geometry, independent joint rotations/reset, sensor placement/probe travel, and a native-block showcase that leaves engine state identical with or without rendering. The full suite has 46 passing tests when the optional reference asset is installed. Browser checks cover the new model, showcase, following camera and model switching. These verify implementation, not exact physical reconstruction.

Next model-fidelity work needs a verified ADB `.io`/`.ldr`/`.mpd`/glTF assembly or measured reconstruction, plus the actual attachment geometry and pivot/gear definitions. Preserve separate wheel/tool groups when importing; a flattened mesh cannot provide these joints by itself.
