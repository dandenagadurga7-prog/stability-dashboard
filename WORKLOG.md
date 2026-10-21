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
- Protocol view: drop Method + Specification columns (STP holds them) -> edited js/app.js openProtocol; bumped index.html ?v=10oct26d -> 
ode checks/engine-check.js = ALL EXPECTED STATUSES PRESENT: ok; 
ode checks/render-check.js = ALL ROUTES + WORKFLOW: ok; pushed c7289e3..6c5691e; live https://stability-dashboard-theta.vercel.app/js/app.js?=10oct26d -> old 'Tests &amp; Specifications' heading gone; Pages same (status 200).
- Protocol view: show ONLY analyst status (Done/Pending), removed meta + approval workflow + tests table -> js/app.js openProtocol simplified; bumped ?v=10oct26e -> engine-check ok, render-check ok; pushed 6c5691e..c5520bb; live Vercel + Pages nalystStatus=True oldWorkflowPresent=False.
- Protocol view: field renamed to 'Analyst Sign Off' with Done/Pending badge -> js/app.js; bumped ?v=10oct26f; checks ok; pushed c5520bb..69ce6f1; live verified analystSignOff=True.
- Protocols: change-requested -> 'Edit protocol & resubmit' opens prefilled form (only needed fields), np-update keeps protocol number and re-enters review; core.protocolStatus now counts only the current review cycle -> js/app.js, js/core.js; added render-check test (CHANGES_REQUESTED -> edit -> UNDER_REVIEW, number unchanged); bumped ?v=10oct26g; engine+render ok; pushed 69ce6f1..85e71b0.
- Protocol view: show three sign-offs (Analyst Sign Off, Reviewer, Group Leader) each Done/Pending from lifecycle -> js/app.js; bumped ?v=10oct26h; engine+render ok; pushed 85e71b0..8d9d8cd; live verified threeSignoffs=True.
- Sample Packing: Condition now derived from protocol (protocolConditions helper reads protocolMeta.sampleConditions, falls back to storageCondition); new/edited protocols store storageCondition from selected conditions -> js/app.js; render-check asserts #/packing shows '40Â±2Â°C / 75Â±5% RH, 25Â±2Â°C / 60Â±5% RH'; bumped ?v=10oct26i; pushed 8d9d8cd..49be0ad.
- Sample Packing drawer: removed notice; now renders one block per protocol condition (Product, Batch, Pack, Time Points + Quantity/Container/Packing date/Packed by/Remarks inputs) and saves packing.conditions[]; pack-save requires container per condition -> js/app.js; render-check asserts drawer shows all conditions; bumped ?v=10oct26j; pushed 49be0ad..1fa2466.
- Sample Packing: removed 'Container / pack configuration' field; container now taken from protocol pack -> js/app.js; bumped ?v=10oct26k; engine+render ok; pushed 1fa2466..6bff188.
- Sample Packing remarks: added guidance placeholder ('Optional â€” e.g. no. of bags/containers used, any deviation') -> js/app.js; bumped ?v=10oct26l; render-check ok (ran 3x exit 0); pushed 6bff188..c9cddb4.
- Chamber Loading: one block per protocol condition (own chamber/rack/shelf/qty/date/time), schedule generated per condition; Project 360 Chamber shows all -> js/app.js. Lifecycle: 'Back' on Packing/Loading/Withdrawal/Analysis/Documents reverts that step + later (confirm) and reopens it -> revertStep. render-check: loading shows 2 conditions + creates 14 samples; bumped ?v=10oct26m; pushed c9cddb4..90fc39f.
- Added 'Add condition' to an existing loading: Project 360 shows 'Add condition (N)' when protocol conditions are missing; openAddConditions adds only missing ones (match by temperature), keeps existing loading, appends schedule for the new conditions -> js/app.js. render-check: 'Add condition (1)' button, added missed condition -> 14 samples, 2 conditions; bumped ?v=10oct26n; pushed 90fc39f..06a3b99.
- Chamber Loading list page: one row per condition (was showing only the first) -> VIEWS.loading; ER list Chamber/Condition now list all conditions -> VIEWS.er; render-check asserts 3 rows; bumped ?v=10oct26p; pushed 1824706..e8f9ed2.
- Withdrawal window changed to planned date -> +N days (was +/-N): core.computeDates earliest=planned, latest=planned+W; labels updated (sample detail, Settings) -> js/core.js, js/app.js; engine-check earliest 2025-06-06 latest 2025-06-13, all statuses ok; render ok; bumped ?v=10oct26q; pushed e8f9ed2..ca1e473.
- Early pull request: remarks placeholder added ('Optional â€” e.g. meeting/request reference, urgency reason') -> js/app.js; bumped ?v=10oct26r; render ok; pushed ca1e473..1914d08.
- Project 360: Back button now on every step with progress (protocol, packing, er, loading, schedule, withdrawal, analysis, documents, report); revertStep handles protocol(reset approvals), er, schedule, report too -> js/app.js; render-check adds step-Back test (cleared loading+schedule); bumped ?v=10oct26s; pushed 1914d08..5b2084a.
- Early pull withdrawal: reject actual date before requested early-pull date (and after official date) -> epWithdrawSave, js/app.js; render-check adds negative test ('rejected withdrawal dated before the requested early date'); bumped ?v=10oct26t; pushed 5b2084a..a13ec25.
- Early pull: Withdrawn rows get a 'Correct date' button; withdraw dialog defaults to a valid date (actual if valid else requested) and shows allowed range; epWithdrawSave validates -> js/app.js; bumped ?v=10oct26u; pushed a13ec25..d0361b1.
- Early pull withdrawal: allowed range now official-1month -> official (any day); validation + dialog hint updated -> epWithdrawSave/openEpWithdraw, js/app.js; render-check negative test updated (rejected >1 month before official); bumped ?v=10oct26v; pushed d0361b1..7a11dd3.
- Withdrawal step Back now also reopens the linked early-pull request (status->APPROVED, actualDate cleared, history note) -> revertStep, js/app.js; render-check asserts sample cleared + ep reopened; bumped ?v=10oct26w; pushed 7a11dd3..70c3583.
- Early pull form: Advance Days changed from fixed dropdown to number input (0 = same date, max 30 = 1 month); validation 0..30 -> renderEpFields/recomputeEp/epSave, js/app.js; bumped ?v=10oct26x; pushed 70c3583..cf74612.
- Early pull withdraw: actual date now defaults to TODAY when today is inside the window (official-1month..official), else the requested date; explicit value set so it renders -> openEpWithdraw, js/app.js; render-check proves 'withdraw date defaults to today (2026-10-11)'; bumped ?v=10oct26y; pushed cf74612..4339032.
- Early pull form: now enter Requested Pull Date directly (any day, official-1month..official); Advance auto-computed = official - requested -> renderEpFields/recomputeEp/epSave, js/app.js; render-check 10-day/20-day still pass via epReqDate; bumped ?v=10oct26z; pushed 4339032..1360960.
- Early pull window fixed to official-30 days .. official (advance 0..30 = up to 1 month); 31 now rejected -> renderEpFields/epSave/openEpWithdraw/epWithdrawSave, js/app.js; render-check shows window 2026-01-30..2026-03-01 and rejects >30d; bumped ?v=10oct26aa; pushed 1360960..4962164.
- Removed R&D Early Pull from UI: nav entry (so #/earlypull falls back to dashboard), withdrawal queue Early Pull column/button + request button, dashboard early-pull section, Project 360 early-pull column -> js/app.js; render-check updated (#/earlypull now expects dashboard); bumped ?v=10oct26ab; pushed 4962164..b163060.
- Lifecycle 'Samples withdrawn' ticks when every DUE sample is withdrawn (future time points ignored) and 'Analysis completed' when every withdrawn sample is analysed -> core.js checklist; render-check asserts 'withdrawal step ticked after all due samples withdrawn (5/7)'; bumped ?v=10oct26ac; pushed b163060..d5813c7.
- Worksheet weight/result inputs: added placeholder dash (â€”) -> js/app.js; bumped ?v=10oct26ad; render ok; pushed d5813c7..9843268.
- Analysis Test Results: tests auto-listed from protocol with tick-select; unticked tests hidden + not saved; save keyed by testId -> openResults/results-save/onOverlayChange, js/app.js; render-check adds test (14 protocol tests, unticked not saved); bumped ?v=10oct26ae; pushed 9843268..bd63a14.
- Every protocol now auto-gets an STP so the worksheet loads method/theory: exposed SD.buildStp (data.js), added ensureStps() on load + remote pull, and build/rebuild STP on np-save/np-update (app.js). render-check: 'STP auto-built for new protocol STB-CR-2026-012'; bumped ?v=10oct26af; pushed bd63a14..ce60464.
- STP number now taken from the protocol's 'STP No.' field (protocolMeta.stpNo) instead of the protocol number; shown in STP Master (VIEWS.stp), worksheet head, sample doc -> js/data.js buildStp + js/app.js (stpNoOf, VIEWS.stp); render-check asserts STP No. ITB-STP/001; bumped ?v=10oct26ag; pushed ce60464..397c333.
- Sync safety: cloud copy adopted only if this browser has no local data or cloud is strictly newer; local wins ties so a newer local copy is never clobbered. Added state.savedAt (store.save bumps; keepStamp on load/adopt) -> core.js + app.js boot pull; bumped ?v=10oct26ah; pushed 397c333..275a984.
- Worksheet: STP dropdown shows STP No. + version; test list shows 'N tests available from STP <no>'; STP theory now carries method/preparation text (weights as [--]) via THEORY_METHOD in data.js buildStp -> js/data.js, js/app.js (openWorksheet/renderWsTests); render-check asserts assay theory carries preparation; bumped ?v=10oct26ai; pushed 275a984..7285fe7.
- Protocol tests auto-pick FIXED: mapSchedTests read the wrong element ids (npSc_ri_ci vs npSc_ci_ri_ti) so schedule ticks were ignored and tests fell back to the first 6. Now iterates conditions/timepoints, maps rows (incl. Water/LOD -> Water Content, Related -> Related Substances, IR -> Identification), excludes product-specific tfd_/anz_ tests. render-check: 'protocol tests auto-picked from schedule ticks: appearance, identification, water, related, assay'; bumped ?v=10oct26aj; pushed 7285fe7..a081b47.
- Protocol tests now re-derived from the SAVED schedule on load (ensureSchedTests), so older protocols drop stale tests (e.g. Dissolution) and rebuild their STP. Added testIdForRow/deriveTestsFromSchedule -> js/app.js; bumped ?v=10oct26ak; pushed a081b47..d4a3388.
- Protocol tests now include EVERY ticked schedule row; rows without a library test (XRD, Enantiomeric purity, Other test) get their own test via ensureTestForRow -> js/app.js; render-check: auto-picked appearance, identification, water, sched_xrd, related, assay; bumped ?v=10oct26al; pushed d4a3388..e838e1a.
- FIX blank dashboard: ensureSchedTests() was called at the top of the IIFE before SCHED_ROWS was assigned, so any state with a protocol schedule threw at boot and the app rendered empty. Moved the migration to the boot section (after SCHED_ROWS) and wrapped it in try/catch -> js/app.js; bumped ?v=10oct26am; pushed e838e1a..db32371.
- Sync fix: when local and cloud have no timestamp (legacy copies), keep the RICHER copy (more samples) so browsers converge instead of each keeping its own. Added tie-break in boot pull -> js/app.js; bumped ?v=10oct26an; pushed db32371..d91c5e6.
- Worksheet: removed the Time point field; STP select stays first, then protocol test tick-boxes; save-to-time-point button hidden (results saved from Analysis -> Test results) -> js/app.js; bumped ?v=10oct26ao; pushed d91c5e6..2862495.
- Worksheet STP dropdown: three protocols shared STP No 'ITB-STP/001' so the first (STB-PROT-2026-004, 4 tests) was shown; options now include the protocol number and the tests header shows it too. -> js/app.js; bumped ?v=10oct26ap; pushed 2862495..13ade4e.
- Worksheet: ensureStps now rebuilds every protocol's STP on load so method/theory text (with weights as [--]) fills in (was showing old 'Refer approved STP.'); sheet header now shows 'STP No. <no> Â· Rev <ver>' -> js/app.js; bumped ?v=10oct26aq; pushed 13ade4e..5635657.
- STP-driven worksheet increment: STP register (upload PDF/DOCX/TXT -> verify text -> approve/reject, versioned; only Approved STPs usable; role-gated) + worksheet blocks calculation when inputs missing + additive Supabase migration (stp_documents, worksheets, RLS, stp-documents bucket) -> js/app.js, js/data.js, js/db.js, checks/render-check.js, supabase/stp-worksheet-schema.sql; render-check STP register flow ok; bumped ?v=10oct26ar; pushed 5635657..c03a9ef; live app.js stpRegister=True (200 on Vercel + Pages).
- Trial STP document: new #/stdoc/:id view renders the STP in the supplied Hetero (AL-009-04) layout (header table + Test/Specification/Reference table + Prepared/Reviewed/Approved blocks), labelled DEMO/not-approved; STP Master rows get a 'Document' link; tests carry a Reference (Ph. Eur / In-House) -> js/app.js, js/data.js; render-check adds #/stdoc/p0; bumped ?v=10oct26as; pushed c03a9ef..6a70567; live stdoc=True.

## 2026-10-20 - worksheet traceability + read-only document review

- New Analysis Worksheet: added a batch/sample/time-point selector grouped by batch (same product with different batches is now distinguishable), a protocol/STP/product/batch/sample trace strip, and protocol options that carry the batch list and sample count; Analysis worklist rows get a Worksheet action that opens the sheet already focused on that sample -> js/app.js.
- Read-only document review: Open protocol + STP side by side (new #/review/:protocolId/:sampleId view using embedded document frames), Open STP, Open protocol, and optional original STP file via a short-lived signed URL when the file is stored -> js/app.js, styles.css.
- Files stay references: wsSave records only the selected STP/protocol number and version on the sample, never the file content; the selected supporting file can be opened for the session but only its name is saved.
- Checks: node --check js/app.js -> OK; node checks/render-check.js -> ALL ROUTES + WORKFLOW: ok; worksheet groups ATV10-2501/ATV10-2502; saved data against STP AL-009-04 (reference only, no file copied). Bumped ?v=20oct26ws.

## 2026-10-21 - worksheet: batch -> STP revision -> condition/time point, completed status

- Worksheet selection order is now Batch No. -> STP revision (protocol paired automatically) -> Condition / time point. The batch list comes from every approved-STP protocol and groups time points by storage condition (e.g. 1M @ 25C/60% RH and 1M @ 5C for the same batch). Sample IDs are no longer shown in the selector or trace strip; month + condition is shown instead -> js/app.js (wsBatchEntries, wsStpEntries, wsSampleOptions, wsTpLabel, wsCondShort, wsSelectedProtocol).
- Trace strip now reads Protocol / STP + Rev / Product / Batch / Time point + condition / Withdrawal / Analysis due / Status; the read-only document bar shows the exact selected STP + protocol pair -> js/app.js (wsContextHTML, wsDocBarHTML, wsOpenStp, wsOpenSource).
- Documentation complete: new checkbox at the end of the worksheet; saving with it ticked stores documentationComplete/documentedAt/documentedBy, sets the analysis completion date + AR number, and shows Status: Completed without closing the worksheet. Un-ticking reopens the documentation -> js/app.js (renderWsSheet, wsSave, wsDocStatus).
- Checks: node --check js/app.js -> OK; node checks/render-check.js -> ALL ROUTES + WORKFLOW: ok (batch list, condition grouping, month+condition label, Completed status). Bumped ?v=21oct26ws1.
- Follow-up: the STP revision selector is now shown only when the batch has more than one approved revision, so the normal layout is Batch No. -> Condition / time point exactly as requested; STP + Rev stay in the trace strip and are auto-paired. Uploading a new STP version now archives the previous revision instead of overwriting it, so old worksheets keep their exact revision and the revision picker appears when there is a real choice -> js/app.js (wsStpEntries/openWorksheet, stpUploadSave), serve.js no-store headers; checks still ALL ROUTES + WORKFLOW: ok.
- Worksheet STP source: batch -> protocol stays automatic; "Open STP" now opens the local file picker so the analyst picks the current-version STP file from their folder. The picked file name/STP No./Rev are parsed (editable) and the trace strip + "Selected pair" + sheet header update to that STP + protocol; the review view embeds the picked file (blob URL) with the protocol. Save stores only the file name/size/type + STP No./Rev as a reference (content is not copied). Reopening a documented sample restores the stored file reference -> js/app.js (wsPickedStp, wsParseStpFile, wsUsePickedStp, wsDocBarHTML, wsOpenBoth/VIEWS.review, wsSave); checks include a simulated pick; bumped ?v=21oct26ws2.
- Fix: worksheet batch list could include a protocol with no approved STP, leaving "Select a protocol first" / "No time point available" after a file pick. wsUsableProtocols now requires an approved STP; added a visible Protocol selector that auto-fills from the batch and can be overridden (optional); STP revisions are filtered to that protocol; stored STP-file references are restored only when the sample protocol still matches. Checks assert the auto-filled optional protocol -> js/app.js (wsUsableProtocols, wsProtocolEntries/Options, wsSelectedProtocol, openWorksheet, change handlers); bumped ?v=21oct26ws3.
- Worksheet layout per user: Batch No. dropdown now shows only the batch number; the separate Condition / time point control was removed and replaced by a compact time-point selector inside the trace strip (same month + condition options). Protocol remains auto from the batch with an optional override; picked STP file still updates the pair. Checks updated to inspect the trace selector -> js/app.js (bopts, wsContextHTML/wsCtxCell, renderWsContext, renderWsTests, wsSampleOptions compact); bumped ?v=21oct26ws4.
- Worksheet documents now open in an in-app viewer layered over the worksheet (single doc or protocol + STP side by side) with a Back to worksheet button; the worksheet, picked STP file and ticks stay intact. Picked local STP files open in the viewer (blob URL) and also offer Open in new tab. Tests panel re-renders on STP file pick and preserves tick state -> index.html, styles.css, js/app.js (openDocOverlay/closeDocOverlay, wsOpenBoth/wsOpenProtocol/wsOpenStp/wsViewPickedStp, renderWsTests); bumped ?v=21oct26ws7.
- Fix: New Analysis Worksheet Batch No. list was empty because the cloud state had 16 protocols but only 1 approved STP (and buildStp threw on a test id missing from the library, aborting the auto-build). Added null guard in data.js buildStp and per-protocol try/catch in app.js ensureStps; bumped ?v=21oct26ws8 -> node checks/engine-check.js = ALL EXPECTED STATUSES PRESENT: ok; node checks/render-check.js exit 0; pushed 52b3aac..f051888; live 92or1111 + Pages ver=21oct26ws8 fix=True.
- STP Master simplified: upload is now the CURRENT STP (status Approved on save, no Verify/Approve/Reject signs); worksheet treats any non-Rejected STP as usable; render-check updated to 'upload current STP -> Approved'; bumped ?v=21oct26ws9. -> js/app.js, checks/render-check.js; node checks/render-check.js = ALL ROUTES + WORKFLOW: ok; engine-check ok.
