# Build and Run workspaces

## Student workflow

1. Choose **New**, load a LEGO Word Blocks `.llsp3`, or open an experiment.
2. Select **Build**. The field is hidden; the palette and editable program fill the workspace.
3. Drag blocks out of a category, connect them, edit values, and create variables or My Blocks. Function inputs can be number/text or true/false reporters.
4. Select **Run** to inspect the program beside the robot, or press the yellow **Run** button to switch and start immediately. The palette is hidden and blocks cannot be edited in Run.
5. Select Build again to pause and revise. Edits reset simulation state before the next run; switching without edits preserves the paused run. Undo/Redo and block positions survive tab changes.

The palette contains implemented driving, motor, sensor, control, operator and variable blocks, not every block supported by LEGO. Imported unsupported blocks are still displayed where the upstream renderer supports them; reachable unsupported instructions are rejected by the runner. Sensor ports and realistic behavior still depend on the robot settings.

## Persistence

-   A single current program draft is saved in this browser's local storage after edits. Reload restores it in Build mode, including unfinished functions that need fixing before they can run.
-   **Save program** downloads a `.spikelab` JSON backup; **Load program** reopens it. **Export to LEGO** now downloads an experimental `.llsp3`; see [transfer verification and outstanding checks](PROGRAM_TRANSFER.md). Original downloaded LEGO files are never modified.
-   Loading a different program replaces the local draft. After edits, the app asks before replacing it and warns before closing the page; save separate copies for multiple programs.
-   Drafts/backups retain program data, block positions, field selection, robot/attachment configuration and calibration settings. They do not retain live motor state or execution history. Undo history is session-only.
-   Local storage can be unavailable or full; the footer reports this and advises saving a file. Backups are advisable before clearing browser data.

## Implementation and verification

The editor reuses upstream Blockly blocks, renderer, Scratch conversion and function flyout. One live workspace is used in both tabs to preserve Undo. The 3D view stays mounted but hidden during Build. No remote editing service is involved.

The reverse conversion retains original project metadata/assets, target ownership and initial variable values. Variable reporters, primitive literals, obscured shadows and function signatures are covered by regression tests. SPIKE's stale function input sockets (removed arguments still present in exports) are normalized so they do not prevent loading.

`npm test` includes eight editor regression tests, alongside the existing robot/mission/sensor suite (54 tests total with the optional local reference model). Tests cover identical execution before/after conversion of the seven-function sample and authored experiments, edits that change runtime, deletion, variable names/values, loose reporters, shadow restoration and reopening incomplete programs while still rejecting execution.

Browser checks cover full-width Build / split Run, drag-and-connect creation, numeric field editing and changed run duration, Undo/Redo across tabs, new parameterized My Blocks, and local draft restoration. The editor is an early compatibility implementation, not a full replacement for every LEGO authoring feature.

The `.spikelab` fixture in `src/lab/fixtures/editor-backup.spikelab` was also opened through the browser's file picker. The embedded browser did not report a completed file download in the automation check; download delivery still needs verification in a standard browser. The UI reports a download request, not confirmed file creation. Local autosave was verified separately.
