# Stability Analysis Management Dashboard

A working AR&D stability-tracking dashboard: protocol → product/batch → monthly schedule →
planned/actual withdrawal → analysis (with auto deadlines) → test results → review → report.

> **DEMO DATA.** The Protocol Report, approved Stability Report format and Monthly Schedule Excel
> were not supplied with the project, so the app ships clearly-labelled placeholder pharma data
> (generic ICH-style tests and limits). Replace it via **Import / Export** or **Settings** once the
> approved files exist. No placeholder limit is presented as approved.

## Run

```
node serve.js
```

Open http://localhost:4173/ in a browser.

## What is inside

| File | Purpose |
|---|---|
| `index.html` | Shell, sidebar nav, top bar |
| `styles.css` | Single design direction; responsive to 375 px |
| `js/core.js` | Central date logic, automatic status engine, localStorage + audit store |
| `js/data.js` | Labelled DEMO protocols, samples, tests and results |
| `js/app.js` | Router and all views/actions |
| `checks/engine-check.js` | Headless proof: status spread + date rules |
| `checks/render-check.js` | Headless proof: every route renders + core workflow |

## Modules

Dashboard (KPIs, monthly workload, today/overdue/upcoming, activity) · Protocols · Products ·
Monthly Schedule · Samples · Analysis worklist · Reports (generate/preview/approve) · Alerts ·
Audit Trail · Import/Export (CSV) · Settings (configurable date rules).

## Date rules (configurable in Settings)

- Withdrawal window: **± 7 days** from the planned withdrawal date.
- Analysis due: **actual withdrawal + 15 days** (calculated automatically).
- Report due: analysis completion + 7 days.
- Status engine derives one of 11 statuses from dates and workflow state.

## Verify

```
node checks/engine-check.js
node checks/render-check.js
```
