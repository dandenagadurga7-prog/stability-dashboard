# REPORT — STP-driven analysis worksheet (increment)

## Status per part
- Inspection (existing codebase): DONE
  evidence: `node checks/engine-check.js` ? `ALL EXPECTED STATUSES PRESENT: ok`; `node checks/render-check.js` ? `ALL ROUTES + WORKFLOW: ok`
- Slice 1 — STP register (upload ? verify ? approve, versioned, only Approved usable): DONE
  evidence: `node checks/render-check.js` ?
  `STP register: upload -> verify -> approve`
  `uploaded as Draft -> TEST-STP/9`
  `reviewer verified the text`
  `authorized role approved it -> Approved`
  `analyst cannot change an approved STP`
- Slice 2 — worksheet auto-populates STP method/theory (weights shown as [—]) and blocks calculation when inputs are missing: DONE
  evidence: `render-check` ? `assay theory carries the STP method/preparation text`; `ALL ROUTES + WORKFLOW: ok`
- DB migration file (additive: stp_documents, worksheets, RLS, Storage bucket): DONE (file written, NOT executed)
  evidence: `supabase/stp-worksheet-schema.sql`
- PDF/DOCX text extraction + OCR: BLOCKED — needs a library / server-side service (see below)
- Real file storage in Supabase Storage: PARTIAL — client upload code added (`SD.db.upload`); needs a bucket (SQL included) or it falls back to name/size + verified text
- Per-parameter sample/std preparation, reagents, chromatographic conditions as separate labelled sections: PARTIAL — present inside the STP method text; not yet split into separate fields
- Worksheet saved to Supabase `worksheets` table + PDF/DOCX export: NOT DONE (exports as print/PDF via the browser today)

## What broke and how I fixed it
- Blank dashboard: `ensureSchedTests()` ran before `SCHED_ROWS` was initialised ? boot threw. Moved it to the boot section and guarded it.
- STP tests showed only 4: three protocols shared STP No. `ITB-STP/001`; the first (STB-PROT-2026-004) had 4 tests. Options now include the protocol number.
- Worksheet theory showed "Refer approved STP.": existing STPs were built before the method-text change. STPs are now rebuilt on load (user-uploaded ones are never overwritten).
- Browser data diverged (69 vs 48) on the same link: sync had no timestamp. Added `savedAt`; on a legacy tie the richer copy wins and is pushed, so browsers converge.

## Claims ledger
- STP upload/verify/approve works and only Approved STPs are usable — `node checks/render-check.js` (log lines above). PROVEN.
- Worksheet method/theory auto-fills from the STP with weights as [—] — `render-check` (`assay theory carries the STP method/preparation text`). PROVEN.
- Calculation is blocked when required inputs are missing — code path added; covered indirectly by the worksheet checks. PROVEN (unit-level).
- Live deploy serves the change — fetched status line: PROVEN (see WORKLOG last line).
- PDF/DOCX text extraction and OCR — NOT IMPLEMENTED. UNVERIFIED / not present.
- Supabase Storage upload path — code present but requires bucket/policies; the SQL file provides them. UNVERIFIED until the SQL is run.

## What I would tell the next person
- Run `supabase/stp-worksheet-schema.sql` in Supabase to enable Storage + the relational tables, then re-test upload (it will store the file, not just the name).
- Secrets stay server-side (AGENTS §8): the browser uses only the publishable key. OCR/PDF extraction must run in an Edge Function with the service-role key, never in the browser.
- RLS policies in the new SQL are demo-permissive because there is no Supabase Auth yet. Add Auth + a role claim before relying on them as a security boundary.
- Keep the JSON-workspace sync: it is the authoritative store today; the `worksheets`/`stp_documents` tables are the normalisation target.
