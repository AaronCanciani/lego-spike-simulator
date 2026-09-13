# LEGO project transfer — experimental

**Export to LEGO** produces an `.llsp3`: a manifest and nested `scratch.sb3`, following the fork's existing LEGO exporter format. **Save program** remains the complete `.spikelab` simulator backup. These are different artifacts: LEGO files contain program data, not robot geometry, mission selection or simulation calibration.

Imported original assets, metadata, My Blocks, variable IDs and target ownership are retained locally and restored on export. Export assigns a new project ID to avoid overwriting the imported LEGO project. Simulator-only root metadata is removed. A missing costume or sound is an explicit error; reopen the original `.llsp3` rather than exporting an incomplete old JSON sample. Original downloaded files are never modified. No uploads or new service dependencies are involved.

## Verified here

-   Nested ZIP structure and manifest shape.
-   Independent `scratch-parser` validation of generated SB3.
-   Valid default SVG assets with matching MD5 IDs.
-   Import/export preservation of original asset bytes and custom metadata.
-   Parameterized My Blocks and variable IDs survive archive round trips with identical simulator execution.
-   Existing editor tests cover conversion of My Blocks and edited programs. These are compatibility tests, **not proof of official firmware semantics**.

## Not yet verified

The official LEGO web app was opened and initialized, but its Open Project file picker was not exposed through the available browser automation. No successful official-app import or real-hub execution is claimed. UI labels therefore identify export as experimental.

To complete verification, export a disposable short program, open it in the official SPIKE app, check blocks/values/functions/ports, re-save from LEGO, and reopen that file in the simulator. Then run a short low-speed program on a supported hub, with the wheels safely clear or sufficient unobstructed space and attachment travel checked. Compare motor directions, shaft degrees, sensor units, function arguments and stop behavior. Keep the original file separately.

`node scripts/make-transfer-check.mjs` generates a nonpersonal disposable transfer fixture in the system temporary folder. The simulator supports only its documented block subset and is not a firmware emulator; successful file transfer alone does not verify physical behavior.
