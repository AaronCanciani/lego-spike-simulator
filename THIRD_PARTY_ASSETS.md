# Reuse and asset provenance

## Application foundation

Alexandre Hardy, [lego-spike-simulator](https://github.com/alexandrehardy/lego-spike-simulator), baseline `94b2cf8aa052642d7ce47662298e7d7bcce62fa4`. This fork retains its source and GPL-2.0 license in `COPYING.md`, including the Scratch converter and SPIKE Blockly UI. Three.js is MIT licensed; Blockly is Apache-2.0; dependency notices remain applicable.

## Competition mat images

`static/maps/FLL2023.jpg` and `FLL2024.jpg` were obtained from [QuirkyCort/gears](https://github.com/QuirkyCort/gears), commit `ea031032f1d24ffb77506523361c55c0e08edfa1`, paths `public/textures/maps/FLL/FLL2023.jpg` and `public/textures/maps/FLL/FLL2024.jpg`. They depict FIRST LEGO League MASTERPIECE (2023) and SUBMERGED (2024) field artwork.

Gears' GPL-3.0 repository license does not establish ownership of FIRST/LEGO artwork or grant trademark rights. No Gears source code was copied. These reference images are included for this educational prototype; reproduction and distribution permissions for a wider release still need verification. Replace or obtain permission where required before distributing a product. Official challenge reference: [FIRST past challenges](https://www.firstinspires.org/resources/library/fll/past-challenges). No affiliation or endorsement is implied.

## Robot model reference (not bundled)

Upstream README links [DrivingBase3.mpd](https://ahfiles.s3.amazonaws.com/robots/DrivingBase3.mpd). The optional `model:fetch` script downloads this packed LDraw reference for local visualization, pinned to SHA-256 `f9cf37808820863094a74fe92e3700ef20ae811440348f1e8e64ee891aa82a01`. The downloaded file is excluded from git. Model-level and individual LDraw part rights must be checked before redistribution, including distribution inside a built application. It is a different assembly, not a verified model of the user's Advanced Driving Base. The adapter reuses Three.js's LDraw loader and this fork's upstream LDraw color palette. Added C/D tools and the training coral proxy are original simplified geometry.

## New preview assets

`src/lab/advancedRig.ts` creates original simplified ADB-style geometry from code, inspired by the user's reference image; it contains no imported LEGO/LDraw mesh data and is not a verified reconstruction. Its parts, decorative hub matrix, C/D tools and sensor housings are illustrative. See [ROBOT_MODEL.md](ROBOT_MODEL.md). Existing upstream licenses and notices remain in place.

`static/lab-icon.svg` and the generated practice grid/cylinder are created for this fork. The bundled `static/samples/new-code-blocks.json` is extracted from the user's supplied exploratory LEGO project. It is not a demonstrated successful driving program. Google Fonts are requested by the stylesheet; program data is not included in those requests.
