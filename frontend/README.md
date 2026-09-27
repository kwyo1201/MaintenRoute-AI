# MaintenRoute Frontend — End-to-End Scenario

This folder is ready to overwrite the existing `frontend` folder.

## New in this version

The sensor scenario is now connected to the full planning pipeline.

```text
Asset sensor scenario
        ↓
FastAPI /predict
        ↓
Predicted failure risk
        ↓
Apply to planning
        ↓
FastAPI /planning
        ↓
Priority score
        ↓
Candidate selection
        ↓
Risk-aware inspection sequence
        ↓
Point-to-point A*
        ↓
Updated route + planning metrics
```

## Assets page workflow

1. Select an asset. M05 is selected by default when available.
2. Change its sensor values.
3. `Preview prediction` runs only `/predict`.
4. `Apply to planning` validates the prediction and then sends the scenario into `/planning`.
5. Overview and Planning update automatically.
6. `Reset applied scenario` returns to the baseline asset observation.

Failure-risk values below 1% preserve two decimal places.

## Backend

Replace the project root `api.py` with:

```text
api_end_to_end.py
```

and rename it:

```text
api.py
```

This backend exposes:

- `GET /health`
- `GET /model-info`
- `POST /predict`
- `GET /assets`
- `POST /planning`

The planning response also includes the asset's baseline failure risk, so the frontend can show the scenario delta.

## Run

FastAPI:

```powershell
cd C:\Users\kwyo1\OneDrive\Desktop\ABB\MaintenRouteAI

& "C:\Users\kwyo1\miniconda3\envs\6550_env\python.exe" `
  -m uvicorn api:app --reload --host 127.0.0.1 --port 8000
```

Next.js:

```powershell
cd C:\Users\kwyo1\OneDrive\Desktop\ABB\MaintenRouteAI\frontend

npm.cmd install
npm.cmd run dev
```

Open:

```text
http://localhost:3000
```

## Suggested test

Go to `Assets`, select `M05`, modify the sensor values, and click:

```text
Apply to planning
```

Then inspect `Overview` and `Planning` to verify that risk, priority, queue, and route update together.

## Sidebar cleanup

The sidebar now shows only controls that actively affect the live backend pipeline:

- Number of Assets
- Minimum Failure Risk
- Maximum Assets to Inspect
- Distance Weight

`Auto Generate` was removed because it was not connected to the current production path.
`Sensor Scenario` was removed from the sidebar because the full sensor workflow now lives in the Assets page.


## Functional Auto Generate

The sidebar now includes a real `Layout Mode`:

- `Default Layout`
- `Auto Generate`

When `Auto Generate` is active, you can control:

- Factory Width
- Factory Height
- Obstacle Density

`Generate New Layout` increments the layout seed and asks the Python backend to regenerate:

- representative asset positions
- technician starting position
- reachable obstacles

The generated layout is then used by the same risk-aware sequencing and A* route planning pipeline.

`Sensor Scenario` stays out of the sidebar because its full end-to-end workflow is already on the Assets page.


## Typography cleanup

The UI now uses one local sans-serif system stack across headings, controls, tables, charts, and navigation.

Monospace is reserved only for compact technical metadata such as thresholds, route metadata, and backend state.

No external font download is required.


## Sensor scenario UX simplification

The Assets page now uses one end-to-end action:

`Apply Scenario`

The separate `Preview prediction` button was removed. Applying a scenario now:
1. runs `/predict`,
2. updates the prediction readout,
3. applies the scenario to `/planning`,
4. refreshes risk, priority, queue, and route.


## Editorial Registry UI

This version is a full visual redesign inspired by editorial/registry web design rather than a conventional dashboard.

Key changes:
- oversized editorial page titles
- numbered record sections
- thin rule-based layout instead of cards
- readouts presented as evidence/records
- compact technical metadata
- flatter control ledger sidebar
- large route case-file view
- ledger-style inspection and asset tables
- no WebGPU, particles, gradients, or decorative effects

The backend, Auto Generate, sensor scenario, planning pipeline, and Docker/API integration remain unchanged.


## Editorial Registry UI v2

- Unified typography scale across hero, section headings, tables, sidebar, metadata, and map labels.
- Fixed the Assets hero newline rendering.
- Restored an Interactive Editor layout mode.
- In Planning, choose **interactive editor**, select move asset / move technician / toggle obstacle, then click the map grid.
- Every manual edit is sent to FastAPI `/planning`, which recomputes priority-aware sequencing and A* routing on the edited facility.


## V3 refinements

- Simple page titles: Overview, Asset Analysis, Route Planning, Model Operations.
- Larger MaintenRoute AI brand in the header.
- Consistent sans typography, monospace only for metadata.
- Interactive Editor automatically opens Planning and initializes safely.
- Map editing uses direct SVG click-to-grid mapping for reliable interaction.


## V4 editor fixes

- Asset selector options now use a dark background with high-contrast text.
- `reload current layout` was replaced by `Restore Layout`.
- The editor now captures a baseline snapshot when Interactive Editor is opened.
- `Restore Layout` restores that saved snapshot instead of copying the already-edited planning response.
- Auto Generate, sensor scenario, prioritization, route planning, and API behavior are unchanged.


## Industrial Command Center UI

This version is a full layout redesign.

Major changes:
- no persistent left sidebar
- floating `Controls` launcher with a right-side control drawer
- stronger MaintenRoute AI product header
- command-center KPI cards
- operational panels instead of editorial registry sections
- Planning uses a large map-first layout
- Interactive Editor is a floating toolbar over the facility map
- Assets uses a machine-inspector split layout
- tables and status surfaces use compact enterprise styling

Core functionality is unchanged:
- XGBoost inference
- sensor scenarios
- Default / Interactive / Auto layout modes
- manual asset / technician / obstacle editing
- Restore Layout
- risk-aware prioritization
- A* routing
- FastAPI / Next.js / Docker integration


## Command Center v2 — always-editable facility

Layout creation and layout editing are now separate concepts.

### Controls drawer
Only two layout sources remain:
- `Default`
- `Auto`

`Manual` was removed from the drawer.

### Planning map
The map editor is always visible:
- Move Asset
- Technician
- Toggle Obstacle
- Restore Source

A Default or Auto layout becomes immediately editable after it loads.
The Python backend still uses its existing `manual` validation internally
after the source layout is captured, but users no longer need to enter a
separate Manual mode.

`Restore Source` restores the last loaded Default layout or last generated
Auto layout.


## Command Center v2.1 — map toolbar placement

The always-on map editor toolbar now sits in normal layout flow above the
facility SVG instead of floating over it. This prevents M07/M08/M09/M10 and
other top-of-map labels from being hidden by the editor controls.
