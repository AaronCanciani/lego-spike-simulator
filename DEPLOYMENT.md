# Public GitHub Pages site

URL: https://aaroncanciani.github.io/lego-spike-simulator/

GitHub Pages uses the Actions publishing source. `.github/workflows/pages.yml` builds on pushes to **spike-lab**, not the upstream `master` branch. No repository default-branch change is required. The workflow runs the tests, type checks, public build and artifact safety checks before deployment. The optional local robot-asset test is skipped on GitHub because that asset is deliberately not checked in.

The repository is public, so this uses free GitHub Pages hosting. No desktop server, paid domain, application server, database or deployment secret is required. The deployment job has only Pages-write and OIDC permissions; build jobs have repository read access. The site uses HTTPS and remains available when the desktop is off.

## Public build and asset boundaries

`npm run build:pages` builds under `/lego-spike-simulator/`. The public build deliberately uses ordinary JS/CSS assets instead of the single-file plugin, which overrides Vite's base path. `npm run build` and local development retain their existing behavior.

The public build starts with the authored gyro example and generated calibration field. It offers Build/Run, student file imports, the generated color/line course, sensor experiments, and original ADB-style geometry. Programs and drafts run/stay in the visitor's browser; there is no shared cloud program storage.

Only `blockly/`, `icons/`, `colours/`, the eight specifically named `maps/FLL2018.jpg` through `FLL2025.jpg` files, the app icon, robots/404 files, and license/provenance notices are emitted from local static assets. `scripts/check-pages-build.mjs` rejects unexpected output and requires essential assets. Reliability testing uses a bundled module worker, also served from the repository base path.

The public website **does not bundle** the son's exploratory sample or optional imported LDraw robot. Archived competition mats are now explicitly included at the project owner's request; see the provenance notice. Eight maps, ten selected physical teaching missions and a separate wall-alignment drill are available. CARGO CONNECT and UNEARTHED currently offer map exploration, not additional scored missions. These exclusions concern the deployed website, not files already present in the public Git repository/history.

## Updating or troubleshooting

Push a verified change to `spike-lab`; inspect the **Publish SPIKE Lab** run in the repository's Actions tab. A failed build does not replace the last successful deployment. Do not publish the ordinary local `dist` folder manually: it can contain reference/private-use assets. Always use `build:pages` and the artifact check.

For a local public-build check, run `npm run build:pages`, then `npm run preview -- --host 127.0.0.1 --port 4173 --base /lego-spike-simulator/` and open `/lego-spike-simulator/` at that address.

To stop public hosting, use repository Settings → Pages → Unpublish site. To pause automatic updates without unpublishing the last version, disable the Publish SPIKE Lab workflow.
