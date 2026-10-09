# REPORT â€” Stability Analysis Management Dashboard

Built: 2026-10-03. Location: `C:\Users\dande\Downloads\fwai-starter\stability-dashboard\`.
Isolated from the existing Sweet Ginger Studio app; nothing outside this folder was modified.

## Status per part

Reference-file analysis: BLOCKED (files were never supplied)
  evidence: `Glob **/*.{xlsx,xls,csv,pdf,docx,doc}` -> `No files found`; recursive pharma-name
  search -> no output. Per the brief's own rule ("FIRST analyze those files"), no approved test
  names, limits, time points or report layout could be taken from source. All such values in this
  build are marked DEMO.

Dashboard application: DONE (runs locally, all routes render, core workflow proven)
  evidence: `node serve.js` -> `stability dashboard listening on http://localhost:4173`;
  `Invoke-WebRequest` -> `200` for `/`, `/styles.css`, `/js/core.js`, `/js/data.js`, `/js/app.js`.

Status engine: DONE
  evidence: `node checks/engine-check.js` -> `today = 2026-10-03`, `samples = 34 protocols = 8`,
  counts for all 10 statuses; `ALL EXPECTED STATUSES PRESENT: ok` (exit 0).

Route rendering + workflow: DONE
  evidence: `node checks/render-check.js` -> 13/13 routes render; with the core path
  `actual withdrawal = 2026-10-07 -> analysis due = 2026-10-22 (expected 2026-10-22)`;
  empty record rejected with 3 errors; `ALL ROUTES + WORKFLOW: ok` (exit 0).

Deployment: NOT DONE (not requested; no hosting credentials were available)
  UNVERIFIED: no public URL exists for this build.

## What broke and how I fixed it

1. `app.js` failed `node --check` twice: a single-quoted string closed with `"` in the schedule
   view, and a stray `/` before `:` in the reports view. Fixed both; re-checked -> `app OK`.
2. Real routing bug found by the harness: `#/sample/<id>` fell back to the Dashboard because
   `sample` was not in the router's valid-route list. Fixed `parseHash`; `#/sample/s1` then rendered
   4335 chars containing `Tests & Results`.
3. Harness bugs (not app bugs): `closest()` returned a fake for every selector, so the withdrawal
   drawer's save was swallowed by the close branch; and a stub element was read before it existed.
   Made `closest` selector-aware and created stub inputs first.

## Claims ledger

- "34 demo samples, 8 protocols" â€” `node checks/engine-check.js` printed it.
- "All 10 statuses appear" â€” same command printed `ALL EXPECTED STATUSES PRESENT: ok`.
- "Withdrawal window = Â±7 days; analysis due = actual withdrawal + 15 days" â€” engine check printed
  `rule check: ... earliest 2026-08-17 latest 2026-08-31` and
  `actual 2026-08-26 + 15 days => analysisDue 2026-09-10`.
- "Every route renders" â€” render-check printed each `#/... -> N chars` line and `ok`.
- "Recording a withdrawal auto-calculates the analysis due date" â€” render-check printed
  `actual withdrawal = 2026-10-07 -> analysis due = 2026-10-22 (expected 2026-10-22)`.
- "A record with missing required fields is rejected and saved nowhere" â€” engine/render checks
  printed `validation rejected empty record: 3 error(s)`.
- "Assets are served over HTTP" â€” `Invoke-WebRequest` printed `200 ... (bytes)` for each.
- UNVERIFIED: visual layout at 1440 px and 375 px. No headless browser (jsdom/playwright/puppeteer)
  was available, so the responsive CSS was written but not looked at in a real viewport. This is the
  one section-3c step that remains for a human.

## What I would tell the next person

- The three source documents are the whole point. Supply the Protocol Report, the approved Stability
  Report format and the Monthly Schedule Excel, then replace the DEMO seed: `js/data.js` holds the
  protocols/tests; `Settings` changes the date rules; `Import / Export` ingests the schedule.
- Do not ship the DEMO specifications as approved data. They are generic ICH-style placeholders and
  the UI says so on every relevant screen.
- The browser localStorage store is a demo convenience. The TECH-STACK path is a Supabase Postgres
  schema mirroring these columns; the one data layer to change is `SD.store` in `js/core.js`.
- Verified-by-command: `node checks/engine-check.js` and `node checks/render-check.js`.
  Serve locally with `node serve.js` (port 4173).

## Update 2026-10-03 — Stability Report received

The supplied Stability Report (photo) is now the source of truth for the report format and for
Trofinetide. Protocol `p0` carries the real STP No, batch, storage condition, packing conditions,
14 tests with the printed specifications, the Initial/1M/2M/3M/6M/9M/12M time points and the
analysis scheduled dates. `reportHTML` now renders the Hetero layout (field rows, S.No/Test/Spec
matrix across time points, packing conditions, scheduled/compiled/reviewed rows, format footer).

Evidence: `node checks/engine-check.js` -> `samples = 41 protocols = 9`, all statuses, exit 0;
`node checks/render-check.js` -> `#/reports/t1` found `Analysis scheduled date`, `Packing conditions`
and `Not less than 98.0 and not more than 102.0`, `ALL ROUTES + WORKFLOW: ok`, exit 0;
`Invoke-WebRequest /js/app.js` -> `HTTP 200 ... has-real-format=True`.

Still MISSING: the Protocol Report and the Monthly Schedule Excel. The non-initial-time-point
results and the other products remain labelled demo.

## Update 2026-10-04 — connected lifecycle (front half)

Added, without removing existing features: protocol 3-level approval, Sample Packing, ER Management,
Chamber Management, Chamber Loading (auto-creates the time-point schedule), Withdrawal/Pulling queue,
Documentation, Final Reports, STP Master, Users & Roles, and Project 360 (checklist + Next Action).

Evidence: `node checks/engine-check.js` -> `samples = 41 protocols = 9`, all statuses, exit 0.
`node checks/render-check.js` -> 28/28 route renders; lifecycle path printed
`protocol STB-PROT-2026-009 -> APPROVED`, `packing = PK-2026-00006, ER = ER-2026-000005`,
`loading = LOAD-2026-000005, schedule = 4 time points`, `ALL ROUTES + WORKFLOW: ok`, exit 0.
Server: `Invoke-WebRequest http://localhost:4173/js/app.js` -> `HTTP 200 ... lifecycle=True nextaction=True`.

Real bugs found by the checks and fixed: (1) `SD.testLibrary` was undefined — it lives on state;
(2) protocol lookup only knew seed protocols, so any runtime-created protocol broke — now searches live state.

NOT DONE / NOT CLAIMED: the data layer is still browser localStorage, not Supabase; there is no real
authentication, no multi-user concurrency control, no instrument integration, no PDF export of
documents, and no GxP/21 CFR Part 11 compliance. The STP method text is not yet stored (only test
names/specs). Non-initial-time-point report values remain labelled demo. The Protocol Report and
Monthly Schedule Excel are still missing.

## Update 2026-10-04 — AR No stage

Added the Analysis Report number to the chain Protocol -> Chamber Load -> Withdraw -> Analysis ->
AR No -> Document. The AR number is generated automatically on analysis completion and reuses the
same record everywhere (no re-typing).

Evidence: `node checks/render-check.js` printed `analysis complete on TFD-0005 -> AR No
AR-2026-000013` and `AR numbers on record: 13`, ending `ALL ROUTES + WORKFLOW: ok` (exit 0);
`Invoke-WebRequest /js/app.js` -> `HTTP 200 ... AR=True`.

## Update 2026-10-04 — STP-driven analysis worksheet

Enter-once principle applied to analysis: the analyst selects the STP and tests; the method/theory is
printed read-only from the STP; the analyst enters only actual values/weights; the system computes the
result from the STP formula and prints PASS/FAIL against the specification. Where no formula or a
non-numeric specification exists it shows MANUAL rather than inventing a verdict.

Evidence: `node checks/render-check.js` printed
`assay 100000/100200*100 -> 99.8; PASS shown = true; FAIL shown = true`, ending `ALL ROUTES + WORKFLOW: ok`.
`Invoke-WebRequest /js/app.js` -> `HTTP 200 ... worksheet=True`.

The Assay formula is an explicit DEMO; the theory text is the report specification where the report
gave a method statement, otherwise a labelled placeholder. Real STP method text and formulas replace
these once the approved STPs are supplied.

## Update 2026-10-05 — real Anastrozole protocol/STP + cumulative data sheet

Loaded the supplied Anastrozole Stability Protocol and STP AL-009-04. Added a cumulative Stability
Data Sheet per project: results entered at a time point fill that column, so entering 1M then 2M shows
both. The STP worksheet now selects STP + time point, auto-prints the method/theory, lets the analyst
enter only values, attaches chromatogram and instrument-Excel files, and saves into the time point.

Evidence: `node checks/engine-check.js` -> `samples = 48 protocols = 10`, all statuses;
`node checks/render-check.js` -> `6M assay saved = 99.502 (within_spec)`, `ALL ROUTES + WORKFLOW: ok`.

Real bugs found by the checks and fixed: the worksheet time-point dropdown passed the display sample
ID where the store expects the internal ID, so the save wrote nothing; now resolved by a by-ref lookup.

Still not done / not claimed: formulas are DEMO (real STP formulas pending), no PDF binary export,
no real multi-user auth, data still in browser storage.

## Update 2026-10-05 — Excel round-trip

The Import/Export page now keeps the uploaded file exactly and lets the user download it back unchanged,
plus export a spreadsheet that keeps the imported column headings (filled from dashboard data), plus a
generic .xls download.

Evidence: `node checks/render-check.js` printed `stored columns = Product | Batch | Planned Withdrawal |
Shelf Life` and `export actions completed without error`, ending `ALL ROUTES + WORKFLOW: ok`.
`Invoke-WebRequest /js/app.js` -> `HTTP 200 ... exportSame=True dataUrl=True`.

## Update 2026-10-05 — .xlsx auto-read

Choosing an .xlsx file now reads its rows automatically (ZIP + DecompressionStream, no library) and runs
the import preview; Excel serial dates are converted. Evidence: `node checks/render-check.js` printed
`headers = Product | Batch | Planned Withdrawal | Shelf Life; data rows = 2`, ending `ALL ROUTES + WORKFLOW: ok`.
`index has xlsx.js = True`, `xlsx.js HTTP 200 (5148 bytes)`.

## Update 2026-10-05 — Supabase connection

The dashboard now syncs its workspace to Supabase (publishable key only, via PostgREST) with
localStorage fallback, and shows the active store in the sidebar. A schema file is provided; the
stability_state table must be created by the member.

Evidence: `db.enabled = true`; `pull reached Supabase, error = stability_state table missing — run
supabase/stability-schema.sql`; `sd-config.js HTTP 200 ... hasUrl=True hasKeyField=True`; render
`ALL ROUTES + WORKFLOW: ok`.

Until the SQL is run, the app stays on localStorage and says so. The secret/service key is never read
or sent; only `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is used.

## Update 2026-10-07 — R&D Early Pull / Advance Sample Withdrawal

Added as an add-on to the existing withdrawal flow. The official schedule is never overwritten: the
official date is kept as a snapshot on each request, and `sample.plannedWithdrawal` is not written by
this feature (verified). Three dates are kept separate everywhere: Official Withdrawal + R&D Early Pull
+ Actual Withdrawal. Approval chain: Draft -> Submitted -> Reviewer -> Group Leader -> Approved ->
Withdrawn -> Completed, or Rejected with a reason.

Evidence: `node checks/render-check.js` -> `official 2026-01-04 -> early 2025-12-25 (10d)`,
`20-day: early 2025-12-15`, `approved -> withdrawn: actual 2025-12-25`, `rejected: EP-2026-000004`,
`official date unchanged = true (2026-01-04)`, `ALL ROUTES + WORKFLOW: ok`.
Server: `HTTP 200 app.js (146387 bytes) earlypull=True nav=True`.
