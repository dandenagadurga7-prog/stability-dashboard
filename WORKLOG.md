# WORKLOG â€” Stability Analysis Management Dashboard

One line per slice: what I did -> the command I ran -> what it actually printed.

- Inspect workspace for reference files -> `Glob **/*.{xlsx,xls,csv,pdf,docx,doc}` -> `No files found`; pharma-name search -> no output. Protocol / Report format / Excel are NOT present.
- Confirm target folder is an unrelated live app -> `git log --oneline -8` -> `Initial Sweet Ginger Studio app`, `Follow-up board for open enquiries...`; decided to build in a new isolated `stability-dashboard/` folder.
- Scaffold -> `New-Item ... stability-dashboard/js` -> `True`.
- Write core (dates + status engine + store), demo data, app, styles, index.
- Syntax-check JS -> `node --check js/core.js; js/data.js; js/app.js; serve.js` -> first: app.js SyntaxError (mismatched quote) and missing `/`. Fixed both.
- Re-check -> `node --check ...` -> `core OK`, `data OK`, `app OK`, `serve OK`.
- Headless status engine -> `node checks/engine-check.js` -> `today = 2026-10-03`, `samples = 34 protocols = 8`, all 10 statuses present; withdrawal window Â±7d verified; `actual 2026-08-26 + 15 days => analysisDue 2026-09-10`; `ALL EXPECTED STATUSES PRESENT: ok`, exit 0.
- Start server -> `node serve.js` -> `stability dashboard listening on http://localhost:4173`.
- Fetch assets -> `Invoke-WebRequest` on `/`, `/styles.css`, `/js/*.js` -> `200 styles.css (14910 bytes)`, `200 core.js (8894)`, `200 data.js (12423)`, `200 app.js (64345)`.
- Headless render of every route + core workflow -> `node checks/render-check.js` -> first run FAILED: `#/sample/s1` fell back to dashboard (real router bug: `sample` missing from the valid-route list). Fixed `parseHash`. Also harness selector bug fixed.
- Re-run -> all 13 routes render; `#/sample/s1 -> 4335 chars (found 'Tests &amp; Results')`; `actual withdrawal = 2026-10-07 -> analysis due = 2026-10-22 (expected 2026-10-22)`; `validation rejected empty record: 3 error(s)`; `ALL ROUTES + WORKFLOW: ok`, exit 0.

## 2026-10-03 — real Stability Report supplied (photo)

- Read supplied Hetero (R&D) Kazipally Stability Report -> extracted product Trofinetide, STP No HK-TP/IH-STP/TFD-05, Batch HK-TFD/034, -20°C N2 Pack, Humidity NA, Format F-02-01/ARD015, Effective 26/11/2022, study date 06/06/2025, packing conditions text, 14 tests with exact specs, time points Initial/1M/2M/3M/6M/9M/12M, analysis scheduled dates.
- Loaded it into `js/data.js` as protocol `p0` (real) and rewrote `reportHTML` to the Hetero layout (field rows, S.No/Test/Spec matrix over time points, packing conditions, scheduled/compiled/reviewed rows, format footer).
- Syntax -> `node --check js/data.js; js/app.js` -> `data OK`, `app OK`.
- Engine -> `node checks/engine-check.js` -> `samples = 41 protocols = 9`, all statuses present, exit 0.
- Render -> `node checks/render-check.js` -> all routes render; `#/reports/t1` found `Analysis scheduled date`, `Packing conditions`, `Not less than 98.0 and not more than 102.0`; `#/reports/s1 -> 2373 chars (found 'STABILITY REPORT')`; workflow `actual withdrawal = 2026-06-05 -> analysis due = 2026-06-20 (expected 2026-06-20)`; `ALL ROUTES + WORKFLOW: ok`, exit 0.

## 2026-10-04 — connected lifecycle (front half) added

- Added lifecycle engine to core.js (auto IDs PK/ER/LOAD/WD/DOC/REP/STB-PROT, protocol status DRAFT->UNDER_REVIEW->PENDING_GL->APPROVED, checklist + next-action) and lifecycle seed to data.js (chambers, users, per-protocol project records).
- Added modules: Sample Packing, ER Management, Chamber Management, Chamber Loading, Withdrawal/Pulling queue, Documentation, Final Reports, STP Master, Users & Roles, Project 360.
- Syntax -> `node --check js/core.js; js/data.js; js/app.js` -> first: app.js SyntaxError (double-quoted string closed with a single quote in finalReportHTML). Fixed.
- Engine -> `node checks/engine-check.js` -> `samples = 41 protocols = 9`, all statuses, exit 0.
- Render -> `node checks/render-check.js` -> all 28 route renders pass; real bug found and fixed (`SD.testLibrary` undefined -> `S.testLibrary`); real bug found and fixed (`protocolById` only knew seed protocols, so runtime-created protocols broke lookups).
- Lifecycle proof -> `node checks/render-check.js` printed:
  `protocol STB-PROT-2026-009 -> APPROVED`, `packing = PK-2026-00006, ER = ER-2026-000005`, `loading = LOAD-2026-000005, schedule = 4 time points`, `ALL ROUTES + WORKFLOW: ok`, exit 0.

## 2026-10-04 — AR No (Analysis Report) stage added to the chain

- core.js: new id kind `ar` -> AR-YYYY-000001; lifecycle.ensure migrates completed analyses to carry an AR number.
- data.js: seeded AR numbers for completed time points; counters.ar set.
- app.js: AR number generated automatically when an analysis is completed; shown in Sample detail, Project 360 time-point table, Reports table, Documentation (per project) and CSV export.
- Syntax -> `node --check core/data/app` -> `syntax OK`.
- Engine -> `node checks/engine-check.js` -> `samples = 41 protocols = 9`, all statuses.
- Render + chain -> `node checks/render-check.js` ->
  `analysis complete on TFD-0005 -> AR No AR-2026-000013`, `AR numbers on record: 13`, `ALL ROUTES + WORKFLOW: ok`.
- Server -> `Invoke-WebRequest /js/app.js` -> `HTTP 200 ... AR=True`.

## 2026-10-04 — report document generated from the supplied format

- Built `reports/TROFINETIDE-stability-report.html` from the supplied Hetero Stability Report photo: real header fields, all 14 tests with printed specifications, Initial column values, packing conditions, analysis scheduled dates, format footer.
- Served -> `Invoke-WebRequest /reports/TROFINETIDE-stability-report.html` -> `HTTP 200 (7597 bytes) trofinetide=True format=True`.

## 2026-10-04 — STP-driven analysis worksheet (theory auto, user enters data, PASS/FAIL)

- core.js: added a safe recursive-descent formula evaluator, specification parser and checkSpec (PASS/FAIL/MANUAL). No invented chemistry; formulas come from the STP record.
- data.js: added `stps` (STP master) per protocol with per-test theory + optional variables/formula. Assay seeded with a clearly-labelled DEMO formula sampleArea/stdArea*100.
- app.js: STP Master + Analysis now open a worksheet: select STP -> select tests -> method/theory prints read-only -> analyst enters only values -> Calculate -> PASS/FAIL -> Print/PDF.
- Syntax -> `node --check core/data/app` -> `syntax OK`.
- Render + chain -> `node checks/render-check.js` ->
  `assay 100000/100200*100 -> 99.8; PASS shown = true; FAIL shown = true`, `ALL ROUTES + WORKFLOW: ok`.
- Server -> `Invoke-WebRequest /js/app.js` -> `HTTP 200 ... worksheet=True`.

## 2026-10-05 — real Anastrozole protocol + STP + cumulative data sheet

- Loaded Anastrozole from the supplied documents: Protocol (F-01-01/ARD015) fields and STP AL-009-04 tests/specs/theory (Description, Solubility, IR, HPLC ID, XRD with 2theta values, Water NMT 0.30%, LOD NMT 0.50%, Sulphated ash NMT 0.10%, unspecified impurity NMT 0.10%, total impurities NMT 0.20%, Assay 98.0-102.0%, Residual solvents by GC).
- data.js: protocol `panz` (batch HL-ANA/01615, 25C/60%RH, nitrogen-purged packing) + ANZ time-point samples (1M/2M/3M entered, 6M in analysis, 9M/12M pending) + project lifecycle record.
- app.js: STP worksheet now has a time-point selector, chromatogram upload per test, instrument-Excel upload, and "Save to time point"; new cumulative Stability Data Sheet (#/datasheet/:id) fills 1st/2nd/3rd Month columns as results are entered.
- Syntax -> `node --check data/app` -> ok.
- Engine -> `node checks/engine-check.js` -> `samples = 48 protocols = 10`, all statuses.
- Render + chain -> `node checks/render-check.js` -> `6M assay saved = 99.502 (within_spec)`, `ALL ROUTES + WORKFLOW: ok`.
- Server restarted; `Invoke-WebRequest /js/app.js` -> `HTTP 200 ... datasheet=True anastrozole=True`.

## 2026-10-05 — Excel round-trip (same columns in -> same columns out)

- Import now keeps the exact uploaded file (name, size, data URL) and the parsed column headings + rows.
- Export: "Download uploaded file (exact)" returns the identical file; "Download Excel (same columns)" exports with the imported headings; "Download Excel (.xls)" exports full data as a spreadsheet.
- Syntax -> `node --check app` -> ok.
- Render + round-trip -> `node checks/render-check.js` -> `stored columns = Product | Batch | Planned Withdrawal | Shelf Life`, `export actions completed without error`, `ALL ROUTES + WORKFLOW: ok`.
- Harness fix: DOM stub lacked Element.click(), which made downloads throw headlessly (browser is fine).
- Server -> `HTTP 200 app.js ... exportSame=True dataUrl=True`.

## 2026-10-05 — auto-read .xlsx (dependency-free)

- Added `js/xlsx.js`: reads the ZIP central directory, inflates parts with DecompressionStream, extracts the first worksheet into a 2-D array (shared strings + inline strings). No library, no network.
- index.html loads xlsx.js; Import page auto-reads a chosen .xlsx into the preview (`.xls` binary still not auto-read); normalizeDate converts Excel serial dates.
- Syntax -> `node --check xlsx/app` -> ok.
- Render + xlsx -> `node checks/render-check.js` -> `headers = Product | Batch | Planned Withdrawal | Shelf Life; data rows = 2`, `ALL ROUTES + WORKFLOW: ok`.
- Server -> `index has xlsx.js = True`, `xlsx.js HTTP 200 (5148 bytes)`.

## 2026-10-05 — Supabase connection

- Probed the project: `products HTTP 200` (reachable), `samples/protocols HTTP 404` (stability tables absent) — so the dashboard had been on localStorage.
- Added `js/db.js` (PostgREST sync, publishable key only), `supabase/stability-schema.sql` (stability_state table + RLS), serve.js route `/sd-config.js` (reads .env.local, exposes only the publishable key), and boot sync + sidebar badge in app.js.
- Syntax -> `node --check db/app/serve` -> `syntax OK`; render -> `ALL ROUTES + WORKFLOW: ok`.
- Connectivity proof -> `db.enabled = true`, `pull reached Supabase, error = stability_state table missing — run supabase/stability-schema.sql`.
- Server restarted; `sd-config.js HTTP 200 (125 bytes) hasUrl=True hasKeyField=True`; `index sd-config=True db.js=True`.

## 2026-10-07 — R&D Early Pull / Advance Sample Withdrawal (add-on)

- core.js: id kind `ep` (EP-YYYY-000001); lifecycle.ensure creates `state.pulls`.
- data.js: seeded 3 requests (approved, submitted, rejected) for Anastrozole + Trofinetide; counters.ep.
- app.js: new module `R&D Early Pull` (nav #/earlypull), form (+ R&D Early Pull Request), auto requested date = official - advance (1/3/5/7/10/15/20/custom), workflow Draft->Submitted->Reviewer->Group Leader->Approved->Withdrawn->Completed / Rejected, withdraw capture, audit history; early-pull column + button in Withdrawal queue; R&D Early Pull column in Project 360 time points; early-pull alerts on the Alerts page.
- Official date is a stored snapshot; sample.plannedWithdrawal is never written by this feature.
- Syntax -> `node --check core/data/app` -> `syntax OK`.
- Tests -> `node checks/render-check.js`:
  10-day: official 2026-01-04 -> early 2025-12-25 (10d);
  20-day: early 2025-12-15 (20d);
  approved -> withdrawn: actual 2025-12-25;
  rejected: EP-2026-000004 -> REJECTED;
  `official date unchanged = true (2026-01-04)`; `ALL ROUTES + WORKFLOW: ok`.
- Server -> `HTTP 200 app.js ... earlypull=True nav=True`.
