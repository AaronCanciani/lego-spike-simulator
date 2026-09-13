# Solid mission boards

Choosing an archived map now automatically loads its available physical scene, even with no selected objective. The previous UI required a second mission selection and otherwise displayed only a mat plus the table border. Leaving Cargo Harbor also disables that separate prototype so it cannot hide a newly selected board's models.

All eight archived maps have at least one interior physical structure. The six seasons already covered by the mission catalog load their working mechanisms together. CARGO CONNECT has four new static structure envelopes, SUBMERGED six, and UNEARTHED four (14 total). Choosing a mission changes the objective, not the scene's physical geometry. The calibration and color-course maps do not gain arbitrary internal barriers.

The static envelopes are **fixed, conservative boxes**, not exact LEGO models, articulated mechanisms or official scoring implementations. Heights and extents are estimates, not measured dimensions. They can block passages that a real open LEGO framework would permit. The UI lists these limitations and the represented structures. No printed route line or painted landscape is converted into a wall.

## References and registration

-   SUBMERGED: [official Field Setup Guide](https://firstinspires.blob.core.windows.net/fll/challenge/2024-25/fll-challenge-submerged-field-setup-guide.pdf), mission-position overview on page 2 and model views on pages 3–5, 12 and 14. Six envelopes represent M01, M02, M03, M10, M11 and M12. Approximate centers are mapped into the existing cropped 2024 texture coordinate system.
-   UNEARTHED: [official Field Setup Reference Guide](https://firstinspires.blob.core.windows.net/fll/challenge/2025-26/fll-challenge-unearthed-field-setup-reference-guide.pdf), mission-position overview on page 2 and model views on pages 3–5. Four envelopes represent M01, M03, M05 and M08. Existing side margins in the mat image are retained in placement estimates.
-   CARGO CONNECT: positions of the ship, crane base, east rail and southeast sorting structure are digitized from the existing `static/maps/FLL2021.jpg` overhead photograph, with its existing full-image registration. Static envelopes do not implement these missions' moving mechanisms.

The existing Research Vessel functional proxy retains its earlier approximate practice placement, which is not the official M15 launch-area placement shown in the setup guide. Correcting that mechanism's orientation, placement and scoring is still outstanding. Other unmodeled structures are also still absent; this is not a fully reconstructed official field.

## Rendering and behavior

`boardGeometry.ts` supplies the same four perimeter wall dimensions to Cannon and Three: 78 mm high, 26 mm thick, bounding a 2362 × 1143 mm playable area. The rendered mat is at physical floor level (0 mm); the old view was 10 mm below it. Contrasting top faces and edge lines make the walls visible. Walls and obstacle boxes cast and receive shadows; boxes have visible edge outlines.

Static obstacle boxes render directly from physics snapshots. They block the chassis and attachments, and distance/force rays use their true height. There are no invisible unlimited-height extensions. Overview cameras now frame the table for the current panel aspect ratio, and the oversized field-status overlay is compact in normal runs.

`boardGeometry.test.mjs` verifies automatic loading for every archived map, perimeter/render/collision agreement, physical blocking with an unobstructed control run, height-aware rays, identical geometry across objective selection and camera framing at four aspect ratios. All existing mission and reliability regressions remain applicable; worker and visible-engine mission runs derive the same obstacle set from the mission's map.
