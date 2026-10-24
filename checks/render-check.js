/* Headless render + workflow check for app.js using a minimal DOM stub.
 * Proves every route renders without a runtime error, then runs the core
 * acceptance path: record actual withdrawal -> analysis due auto-calculated.
 */
var path = require("path");
var zlib = require("zlib");
var mem = {};

function makeZip(files) {
  var localParts = [], centralParts = [], offset = 0;
  Object.keys(files).forEach(function (name) {
    var nameBuf = Buffer.from(name, "utf8");
    var data = Buffer.from(files[name], "utf8");
    var comp = zlib.deflateRawSync(data);
    var crc = zlib.crc32(data);
    var lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6); lh.writeUInt16LE(8, 8);
    lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0, 12); lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26); lh.writeUInt16LE(0, 28);
    localParts.push(lh, nameBuf, comp);
    var ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0, 8); ch.writeUInt16LE(8, 10);
    ch.writeUInt16LE(0, 12); ch.writeUInt16LE(0, 14); ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(nameBuf.length, 28); ch.writeUInt16LE(0, 30); ch.writeUInt16LE(0, 32);
    ch.writeUInt16LE(0, 34); ch.writeUInt16LE(0, 36); ch.writeUInt32LE(0, 38); ch.writeUInt32LE(offset, 42);
    centralParts.push(ch, nameBuf);
    offset += lh.length + nameBuf.length + comp.length;
  });
  var local = Buffer.concat(localParts), central = Buffer.concat(centralParts);
  var eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(0, 4); eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(Object.keys(files).length, 8); eocd.writeUInt16LE(Object.keys(files).length, 10);
  eocd.writeUInt32LE(central.length, 12); eocd.writeUInt32LE(local.length, 16); eocd.writeUInt16LE(0, 20);
  return Buffer.concat([local, central, eocd]);
}
function makeXlsx(rows) {
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function col(i) { var s = ""; i++; while (i) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  var sheetRows = rows.map(function (r, ri) {
    return '<row r="' + (ri + 1) + '">' + r.map(function (v, ci) { return '<c r="' + col(ci) + (ri + 1) + '" t="inlineStr"><is><t>' + esc(v) + "</t></is></c>"; }).join("") + "</row>";
  }).join("");
  var sheet = '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + sheetRows + "</sheetData></worksheet>";
  return makeZip({ "xl/worksheets/sheet1.xml": sheet });
}
function toArrayBuffer(buf) { return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength); }

function El(id) {
  this.id = id; this._html = ""; this._h = {}; this.style = {}; this.value = "";
  this.textContent = ""; this.files = [];
  var self = this;
  this.classList = { add: function () {}, remove: function () {}, toggle: function () {}, contains: function () { return false; } };
}
Object.defineProperty(El.prototype, "innerHTML", { get: function () { return this._html; }, set: function (v) { this._html = String(v); } });
El.prototype.addEventListener = function (t, fn) { (this._h[t] = this._h[t] || []).push(fn); };
El.prototype.getAttribute = function () { return null; };
El.prototype.setAttribute = function () {};
El.prototype.closest = function () { return null; };
El.prototype.matches = function () { return false; };
El.prototype.appendChild = function () {};
El.prototype.removeChild = function () {};
El.prototype.click = function () {};

var ids = {};
global.document = {
  getElementById: function (id) { return ids[id] || (ids[id] = new El(id)); },
  querySelectorAll: function () { return []; },
  createElement: function () { return new El("tmp"); },
  body: new El("body")
};
global.window = global;
global.localStorage = { getItem: function (k) { return mem[k] || null; }, setItem: function (k, v) { mem[k] = v; }, removeItem: function (k) { delete mem[k]; } };
global.location = { hash: "#/" };
global.addEventListener = function (t, fn) { if (t === "hashchange") global.__hash = fn; };
global.alert = function (m) { global.__lastAlert = m; };
global.confirm = function () { return false; };
global.history = { length: 1, back: function () {} };
global.scrollTo = function () {};
global.URL = { createObjectURL: function () { return "blob:x"; }, revokeObjectURL: function () {} };
global.Blob = function () {};
global.FileReader = function () {};

require(path.join(__dirname, "..", "js", "core.js"));
require(path.join(__dirname, "..", "js", "data.js"));
require(path.join(__dirname, "..", "js", "xlsx.js"));
require(path.join(__dirname, "..", "js", "app.js"));

var SD = global.SD;
var view = ids["view"];
var failures = [];

function goto(hash, marker) {
  global.location.hash = hash;
  try { global.__hash(); } catch (e) { failures.push(hash + " threw: " + e.message); return; }
  var html = view.innerHTML || "";
  if (html.length < 200) failures.push(hash + " rendered only " + html.length + " chars");
  if (marker && html.indexOf(marker) < 0) failures.push(hash + " missing marker '" + marker + "'");
  console.log("  " + hash + " -> " + html.length + " chars" + (marker ? " (found '" + marker + "')" : ""));
}

console.log("Routes:");
goto("#/", "Monthly Workload");
goto("#/protocols", "STB/ATV/2025-01");
goto("#/products", "Atorvastatin");
goto("#/schedule", "Planned Withdrawal");
goto("#/samples", "Sample ID");
goto("#/analysis", "Analysis Worklist");
goto("#/reports", "Stability Reports");
goto("#/alerts", "Next 7 Days");
goto("#/audit", "A. Dhamodar");
goto("#/data", "Monthly Workload");
goto("#/settings", "Timeline Rules");
goto("#/sample/s1", "Tests &amp; Results");
goto("#/reports/s1", "STABILITY REPORT");
goto("#/protocols", "HK-TP/IH-STP/TFD-05");
goto("#/packing", "Sample Packing");
goto("#/er", "ER Number");
goto("#/chambers", "Stability Chamber Register");
goto("#/loading", "Loading creates the schedule");
goto("#/withdrawals", "Withdrawal / Pulling Queue");
goto("#/documentation", "Auto-generated from record data");
goto("#/final-reports", "Blocked until complete");
goto("#/stp", "STP No.");
goto("#/stdoc/p0", "STANDARD TEST PROCEDURE");
goto("#/review/p1/s1", "Read-only review view");
goto("#/users", "Signed-in role");
goto("#/protocols", "AL-009-04");
goto("#/project/p0", "Lifecycle");
goto("#/project/panz", "Lifecycle");
goto("#/protocoldoc/panz", "Reason(s) for Stability study");
goto("#/datasheet/panz", "Cumulative data sheet");
goto("#/datasheet/p0", "Cumulative data sheet");
/* R&D Early Pull was removed from the UI (nav), so #/earlypull falls back to the dashboard */
goto("#/earlypull", "Monthly Workload");
goto("#/sample/t1", "Trofinetide");
goto("#/reports/t1", "Analysis scheduled date");
goto("#/reports/t1", "Packing conditions");
goto("#/reports/t1", "Not less than 98.0 and not more than 102.0");

/* Workflow: record actual withdrawal, confirm analysis due is auto-calculated */
var S = SD.store.state;
var subject = S.samples.filter(function (s) { return !s.actualWithdrawal && !s.hold; })[0];
var planned = subject.plannedWithdrawal;
console.log("\nWorkflow on " + subject.sampleId + " (planned " + planned + ")");

function click(handler, attrs) {
  var fake = { getAttribute: function (k) { return attrs[k] !== undefined ? attrs[k] : null; } };
  var target = { closest: function (sel) { return sel === "[data-act]" ? fake : null; }, classList: { contains: function () { return false; } } };
  handler({ target: target });
}
function change(handler, id) { handler({ target: { id: id } }); }

var viewClick = view._h.click[0];
var overlayClick = ids["overlayRoot"]._h.click[0];
if (!viewClick || !overlayClick) { failures.push("click handlers not registered"); }
else {
  click(viewClick, { "data-act": "wd-open", "data-id": subject.id });
  if (ids["overlayRoot"].innerHTML.indexOf("Record Actual Withdrawal") < 0) failures.push("withdrawal drawer did not open");
  document.getElementById("wdDate").value = SD.dates.addDays(planned, -1);
  document.getElementById("wdReason").value = "";
  click(overlayClick, { "data-act": "wd-save", "data-id": subject.id });
  if (subject.actualWithdrawal) failures.push("early withdrawal without a reason was allowed");
  else console.log("  early withdrawal without a reason rejected");
  document.getElementById("wdDate").value = planned;
  document.getElementById("wdStart").value = "no";
  click(overlayClick, { "data-act": "wd-save", "data-id": subject.id });
  if (subject.actualWithdrawal !== planned) failures.push("actual withdrawal not saved (got " + subject.actualWithdrawal + ")");
  var expectedDue = SD.dates.addDays(planned, S.settings.analysisDueDays);
  var gotDue = SD.computeDates(subject, S.settings).analysisDue;
  if (gotDue !== expectedDue) failures.push("analysis due wrong: expected " + expectedDue + " got " + gotDue);
  console.log("  actual withdrawal = " + subject.actualWithdrawal + " -> analysis due = " + gotDue + " (expected " + expectedDue + ")");
}

/* Full front-half lifecycle: create -> 3-level approval -> pack -> ER -> load -> schedule */
console.log("\nLifecycle: create -> approve -> pack -> ER -> load -> schedule");
click(viewClick, { "data-act": "new-protocol" });
document.getElementById("npProduct").value = "Test API";
document.getElementById("npCode").value = "TST";
document.getElementById("npBatch").value = "TST-001";
document.getElementById("npCondition").value = "-20C N2";
document.getElementById("npPack").value = "HDPE";
document.getElementById("npTp").value = "1,3,6";
document.getElementById("npTests").selectedOptions = [{ value: "tfd_assay" }, { value: "tfd_water" }];
click(overlayClick, { "data-act": "np-save" });
var np = S.protocols[S.protocols.length - 1];
if (!np || np.product !== "Test API") failures.push("protocol not created");
else {
  var npid = np.id;
  click(viewClick, { "data-act": "proto-submit", "data-id": npid });
  click(viewClick, { "data-act": "proto-review-approve", "data-id": npid });
  click(viewClick, { "data-act": "proto-gl-approve", "data-id": npid });
  var pstatus = SD.lifecycle.protocolStatus(S, npid);
  if (pstatus !== "APPROVED") failures.push("protocol not approved: " + pstatus);
  console.log("  protocol " + np.protocolNo + " -> " + pstatus);

  click(viewClick, { "data-act": "pack-open", "data-id": npid });
  document.getElementById("pkQty_0").value = "7 time points";
  document.getElementById("pkDate_0").value = SD.dates.todayISO();
  document.getElementById("pkBy_0").value = "tester";
  document.getElementById("pkRemarks_0").value = "";
  click(overlayClick, { "data-act": "pack-save", "data-id": npid });
  var prn = SD.lifecycle.project(S, npid);
  if (!prn.packing) failures.push("packing not saved");
  if (!prn.er) failures.push("ER not auto-generated from packing");
  console.log("  packing = " + (prn.packing && prn.packing.packingId) + ", ER = " + (prn.er && prn.er.erNumber));

  click(viewClick, { "data-act": "load-open", "data-id": npid });
  document.getElementById("loadChamber_0").value = "CH-01";
  document.getElementById("loadRack_0").value = "R1";
  document.getElementById("loadShelf_0").value = "S1";
  document.getElementById("loadQty_0").value = "7";
  document.getElementById("loadDate_0").value = "2026-02-01";
  document.getElementById("loadTime_0").value = "10:00";
  click(overlayClick, { "data-act": "load-save", "data-id": npid });
  var gen = SD.lifecycle.samplesFor(S, npid);
  if (!prn.loading) failures.push("loading not saved");
  if (gen.length !== 4) failures.push("schedule wrong: expected 4 samples (Initial + 3 time points from npTp='1,3,6'), got " + gen.length);
  var npProto = S.protocols.filter(function (x) { return x.id === npid; })[0];
  if (!npProto || (npProto.timePoints || []).join(",") !== "1,3,6") failures.push("protocol time points not taken from the form: " + (npProto ? (npProto.timePoints || []).join(",") : "?"));
  else console.log("  protocol time points from form -> " + npProto.timePoints.join(", ") + " months");
  console.log("  loading = " + (prn.loading && prn.loading.loadingId) + ", schedule = " + gen.length + " time points");
  goto("#/protocoldoc/" + npid, "Reason(s) for Stability study");
}

/* AR No: generated automatically when analysis completes */
var anS = S.samples.filter(function (s) { return s.analysisStart && !s.analysisCompleteDate && !s.hold; })[0];
if (!anS) failures.push("no in-analysis sample to complete");
else {
  (S.results[anS.sampleId] || []).forEach(function (r) { if (r.status === "pending") { r.result = "Complies"; r.status = "within_spec"; } });
  click(viewClick, { "data-act": "complete-analysis", "data-id": anS.id });
  console.log("  analysis complete on " + anS.sampleId + " -> AR No " + anS.arNumber);
  if (!anS.arNumber || !/^AR-\d{4}-\d{6}$/.test(anS.arNumber)) failures.push("AR number not generated/valid: " + anS.arNumber);
}
var withAr = S.samples.filter(function (s) { return s.arNumber; }).length;
console.log("  AR numbers on record: " + withAr);

/* Test Results: tests come from the protocol; unticked tests are not saved */
var rsS = S.samples[0];
var rsP = S.protocols.filter(function (p) { return p.id === rsS.protocolId; })[0];
if (rsS && rsP && rsP.tests.length > 1) {
  var dropTid = rsP.tests[0], keepTid = rsP.tests[1];
  click(viewClick, { "data-act": "results-open", "data-id": rsS.id });
  document.getElementById("res_chk_" + dropTid).checked = false;
  document.getElementById("res_in_" + keepTid).value = "Complies";
  click(overlayClick, { "data-act": "results-save", "data-id": rsS.id });
  var savedRows = S.results[rsS.sampleId] || [];
  if (savedRows.some(function (r) { return r.testId === dropTid; })) failures.push("unticked protocol test was still saved");
  if (!savedRows.some(function (r) { return r.testId === keepTid; })) failures.push("ticked protocol test was not saved");
  else console.log("  Test Results: " + rsP.tests.length + " protocol tests, unticked one not saved (" + savedRows.length + " saved)");
}

/* STP worksheet: batch -> STP revision -> condition/time point, theory loads, PASS/FAIL */
console.log("\nWorksheet: batch -> STP revision -> condition/time point -> enter data -> PASS/FAIL");
click(viewClick, { "data-act": "ws-new" });
var wsOpenHtml = ids["overlayRoot"].innerHTML || "";
if ((ids["wsContext"].innerHTML || "").indexOf("Time point / condition") < 0) failures.push("worksheet trace has no time point / condition selector");
if (wsOpenHtml.indexOf("Batch No.") < 0) failures.push("worksheet has no batch selector");
if (wsOpenHtml.indexOf('id="wsStp"') < 0 || wsOpenHtml.indexOf(" | Rev ") < 0) failures.push("worksheet has no revision-aware STP source");
if (wsOpenHtml.indexOf('id="wsProtocol"') < 0) failures.push("worksheet has no optional protocol selector");
else if (!document.getElementById("wsProtocol").value) failures.push("protocol was not auto-filled from the batch");
else console.log("  protocol auto-filled from batch (optional override present)");
if ((ids["wsDocBar"].innerHTML || "").indexOf("Selected pair") < 0) failures.push("worksheet doc bar does not show the selected STP + protocol pair");
if ((ids["wsDocBar"].innerHTML || "").indexOf("Open protocol + STP") < 0) failures.push("worksheet has no read-only protocol + STP action");
/* changing the batch must update the context to that batch's own product/protocol */
var otherB = null;
for (var bi = 0; bi < S.samples.length; bi++) { if (S.samples[bi].batch !== document.getElementById("wsBatch").value) { otherB = S.samples[bi].batch; break; } }
if (otherB) {
  document.getElementById("wsBatch").value = otherB;
  change(ids["overlayRoot"]._h.change[0], "wsBatch");
  var ctx2 = ids["wsContext"].innerHTML || "";
  if (ctx2.indexOf("Batch</span><strong>" + otherB) < 0) failures.push("context did not follow the batch change to " + otherB);
  else console.log("  context follows batch change -> " + otherB);
}
if (wsOpenHtml.indexOf('id="wsStpFile"') < 0) failures.push("worksheet has no local STP file picker");
var wsBatchList = wsOpenHtml;
if (wsBatchList.indexOf("ATV10-2501") < 0 || wsBatchList.indexOf("ATV10-2502") < 0) failures.push("worksheet batch list is missing the ATV batches");
else console.log("  worksheet batch list carries ATV10-2501 and ATV10-2502");
document.getElementById("wsStpFile").files = [{ name: "HK-ITB-STP-001_Rev02.pdf", size: 4096, type: "application/pdf" }];
change(ids["overlayRoot"]._h.change[0], "wsStpFile");
var pickedCtx = ids["wsContext"].innerHTML || "";
if (pickedCtx.indexOf("HK-ITB-STP-001") < 0 || pickedCtx.indexOf("Rev 02") < 0) failures.push("picked STP file did not update the protocol + STP pair");
else console.log("  picked STP file -> pair updated to HK-ITB-STP-001 · Rev 02");
if ((ids["wsDocBar"].innerHTML || "").indexOf("Rev 02") < 0) failures.push("picked STP file did not update the document bar pair");
document.getElementById("wsBatch").value = "ATV10-2501";
change(ids["overlayRoot"]._h.change[0], "wsBatch");
var wsBatchHtml = ids["wsContext"].innerHTML || "";
if (wsBatchHtml.indexOf("Condition:") < 0) failures.push("worksheet time points are not grouped by condition");
if (wsBatchHtml.indexOf("3M · 25°C / 60% RH") < 0) failures.push("worksheet time points do not show month + condition");
else console.log("  worksheet time points show month + condition (3M · 25°C / 60% RH), no sample ID");
document.getElementById("wsProtocol").value = "p0";
change(ids["overlayRoot"]._h.change[0], "wsProtocol");
click(overlayClick, { "data-act": "ws-load" });
var wsContextHtml = ids["wsContext"].innerHTML || "";
if (wsContextHtml.indexOf("Time point / condition") < 0) failures.push("worksheet trace has no time point / condition row");
if (wsContextHtml.indexOf("Status") < 0) failures.push("worksheet trace has no status row");
if (wsContextHtml.indexOf(">SMP-") >= 0) failures.push("worksheet trace still exposes a sample ID");
if (!document.getElementById("wsComplete")) failures.push("worksheet has no documentation-complete option at the end");
document.getElementById("ws_in_tfd_assay_sampleArea").value = "100000";
document.getElementById("ws_in_tfd_assay_stdArea").value = "100200";
document.getElementById("ws_in_tfd_water_result").value = "5.5";
document.getElementById("ws_in_tfd_total_result").value = "1.4";
click(overlayClick, { "data-act": "ws-calc" });
var sheet = ids["wsSheet"].innerHTML || "";
if (sheet.indexOf("99.8") < 0) failures.push("worksheet did not compute assay 99.8");
if (sheet.indexOf("PASS") < 0) failures.push("worksheet did not show PASS");
if (sheet.indexOf("FAIL") < 0) failures.push("worksheet did not flag the out-of-range impurity");
console.log("  assay 100000/100200*100 -> " + (sheet.indexOf("99.8") >= 0 ? "99.8" : "missing") + "; PASS shown = " + (sheet.indexOf("PASS") >= 0) + "; FAIL shown = " + (sheet.indexOf("FAIL") >= 0));
if (sheet.indexOf("Method / theory") < 0) failures.push("theory not loaded from STP");

/* Save worksheet results to a time point -> cumulative data sheet fills */
console.log("\nData sheet: enter 6M assay -> save to time point -> documentation completed");
click(viewClick, { "data-act": "ws-new" });
document.getElementById("wsProtocol").value = "panz";
change(ids["overlayRoot"]._h.change[0], "wsProtocol");
document.getElementById("wsTimePoint").value = "ANZ-0005";
click(overlayClick, { "data-act": "ws-load" });
if (!document.getElementById("wsComplete")) failures.push("worksheet has no documentation-complete checkbox");
document.getElementById("ws_in_anz_assay_sampleArea").value = "100000";
document.getElementById("ws_in_anz_assay_stdArea").value = "100500";
click(overlayClick, { "data-act": "ws-calc" });
document.getElementById("wsComplete").checked = true;
click(overlayClick, { "data-act": "ws-save" });
var r6 = (S.results["ANZ-0005"] || []).filter(function (x) { return x.testId === "anz_assay"; })[0];
if (!r6 || !r6.result) failures.push("worksheet did not save result to time point");
var wsSampleRec = S.samples.filter(function (x) { return x.sampleId === "ANZ-0005"; })[0];
if (!wsSampleRec || !wsSampleRec.worksheet || wsSampleRec.worksheet.stpNumber !== "AL-009-04") failures.push("worksheet did not store its STP reference on the sample");
else if (JSON.stringify(wsSampleRec.worksheet).indexOf("data:") >= 0) failures.push("worksheet stored file content instead of a reference");
else console.log("  worksheet saved data against STP " + wsSampleRec.worksheet.stpNumber + " (reference only, no file copied)");
if (wsSampleRec && wsSampleRec.worksheet && wsSampleRec.worksheet.timePointLabel !== "6M") failures.push("worksheet did not save the month label on the sample reference");
if (!wsSampleRec || !wsSampleRec.documentationComplete) failures.push("documentation-complete did not set the completed status");
else console.log("  documentation complete -> status Completed, time point " + wsSampleRec.worksheet.timePointLabel + " · " + wsSampleRec.worksheet.condition);
if ((ids["wsSaveNote"].innerHTML || "").indexOf("Completed") < 0) failures.push("worksheet did not confirm the completed status after save");
else if ((ids["wsStatusNow"].innerHTML || "").indexOf("Completed") < 0) failures.push("worksheet status was not updated to Completed");
console.log("  6M assay saved = " + (r6 && r6.result) + " (" + (r6 && r6.status) + ")");
goto("#/datasheet/panz", "Cumulative data sheet");
var ds = ids["view"].innerHTML || "";
if (ds.indexOf("100000") >= 0 && ds.indexOf("102.0") >= 0) console.log("  data sheet rendered after save");
if (ds.indexOf("Cumulative data sheet") < 0) failures.push("data sheet did not render after save");

/* Excel round-trip: imported columns are kept and exported back with the same headings */
console.log("\nExcel round-trip: same columns in -> same columns out");
document.getElementById("csvText").value = "Product,Batch,Planned Withdrawal,Shelf Life\nRoundTrip API,RT-001,15-Oct-2026,24M";
click(viewClick, { "data-act": "import-parse" });
if (!S.sheet || !S.sheet.headers || S.sheet.headers.length !== 4) failures.push("import did not store the original columns");
else console.log("  stored columns = " + S.sheet.headers.join(" | "));
var before = failures.length;
click(viewClick, { "data-act": "export-same" });
click(viewClick, { "data-act": "export-excel" });
click(viewClick, { "data-act": "export-original" });
if (failures.length > before) failures.push("export actions threw");
console.log("  export actions completed without error");

/* R&D early pull: 10-day and 20-day math, approval, rejection, withdrawal, official unchanged */
console.log("\nR&D Early Pull: 10-day / 20-day, approval, withdrawal");
var s7 = S.samples.filter(function (s) { return s.sampleId === "ANZ-0007"; })[0];
var officialBefore = s7.plannedWithdrawal;

click(viewClick, { "data-act": "ep-new" });
document.getElementById("epSample").value = "a7";
change(ids["overlayRoot"]._h.change[0], "epSample");
var off = s7.plannedWithdrawal;
document.getElementById("epReason").value = "R&D early data needed";
click(overlayClick, { "data-act": "ep-save" });
var ep10 = S.pulls[0];
var exp10 = SD.dates.addDays(off, -10);
if (ep10.advanceDays !== 10) failures.push("expected 10 advance days, got " + ep10.advanceDays);
if (ep10.requestedDate !== exp10) failures.push("10-day requested date wrong: " + ep10.requestedDate + " vs " + exp10);
console.log("  10-day: official " + off + " -> early " + ep10.requestedDate + " (advance " + ep10.advanceDays + "d)");

click(viewClick, { "data-act": "ep-new" });
document.getElementById("epSample").value = "a7";
change(ids["overlayRoot"]._h.change[0], "epSample");
document.getElementById("epReqDate").value = SD.dates.addDays(off, -20);
change(ids["overlayRoot"]._h.change[0], "epReqDate");
document.getElementById("epReason").value = "20 day test";
click(overlayClick, { "data-act": "ep-save" });
var ep20 = S.pulls[0];
var exp20 = SD.dates.addDays(off, -20);
if (ep20.advanceDays !== 20 || ep20.requestedDate !== exp20) failures.push("20-day requested date wrong: " + ep20.requestedDate + " vs " + exp20);
console.log("  20-day: early " + ep20.requestedDate + " (advance " + ep20.advanceDays + "d)");

click(viewClick, { "data-act": "ep-reviewer-approve", "data-id": ep10.id });
click(viewClick, { "data-act": "ep-gl-approve", "data-id": ep10.id });
if (ep10.status !== "APPROVED") failures.push("approval chain failed: " + ep10.status);
click(viewClick, { "data-act": "ep-withdraw", "data-id": ep10.id });
document.getElementById("epwDate").value = SD.dates.addDays(ep10.officialDate, -40);
click(overlayClick, { "data-act": "ep-withdraw-save", "data-id": ep10.id });
if (ep10.status === "WITHDRAWN" || s7.actualWithdrawal) failures.push("withdrawal more than 1 month before official was allowed");
else console.log("  rejected withdrawal more than 1 month before the official date");
click(viewClick, { "data-act": "ep-withdraw", "data-id": ep10.id });
document.getElementById("epwDate").value = ep10.requestedDate;
click(overlayClick, { "data-act": "ep-withdraw-save", "data-id": ep10.id });
if (ep10.status !== "WITHDRAWN") failures.push("withdraw failed: " + ep10.status);
if (s7.actualWithdrawal !== ep10.requestedDate) failures.push("actual withdrawal not set to the early date");
console.log("  approved -> withdrawn: actual " + s7.actualWithdrawal + " (advance " + ep10.advanceDays + "d early)");

click(viewClick, { "data-act": "ep-reject", "data-id": ep20.id });
if (ep20.status !== "REJECTED") failures.push("rejection failed: " + ep20.status);
console.log("  rejected: " + ep20.id + " -> " + ep20.status);

if (s7.plannedWithdrawal !== officialBefore) failures.push("OFFICIAL WITHDRAWAL DATE CHANGED: " + officialBefore + " -> " + s7.plannedWithdrawal);
console.log("  official date unchanged = " + (s7.plannedWithdrawal === officialBefore) + " (" + officialBefore + ")");

/* After a pull, the Withdrawal step Back clears the withdrawal and reopens the early-pull request */
global.confirm = function () { return true; };
click(viewClick, { "data-act": "step-back", "data-key": "withdrawal", "data-id": s7.protocolId });
if (s7.actualWithdrawal) failures.push("withdrawal step Back did not clear the actual withdrawal");
if (ep10.status !== "APPROVED") failures.push("withdrawal step Back did not reopen the early pull: " + ep10.status);
else console.log("  withdrawal step Back cleared the sample and reopened the early-pull request");
global.confirm = function () { return false; };

/* Validation must reject a record with missing required fields. */
var vErrors = SD.store.validateSample({ product: "", batch: "", plannedWithdrawal: "" });
if (!vErrors.length) failures.push("validation accepted an empty record");
else console.log("  validation rejected empty record: " + vErrors.length + " error(s)");

/* Change request -> edit only what was asked -> resubmit re-enters review */
console.log("\nChange request: edit -> resubmit (protocol number unchanged)");
click(viewClick, { "data-act": "new-protocol" });
document.getElementById("npProduct").value = "CR Drug";
document.getElementById("npCode").value = "CR";
document.getElementById("npBatch").value = "CR-001";
document.getElementById("npStpNo").value = "ITB-STP/001";
document.getElementById("npCondA").checked = true;
document.getElementById("npCondB").checked = true;
document.getElementById("npCondC").checked = true;
["npSc_0_0_0", "npSc_0_0_1", "npSc_0_0_2", "npSc_0_0_3", "npSc_0_0_4", "npSc_0_0_5"].forEach(function (id) { document.getElementById(id).value = "\u2713"; });
["npSc_0_0_6", "npSc_0_0_7"].forEach(function (id) { document.getElementById(id).value = "X"; });
click(overlayClick, { "data-act": "np-save" });
var crp = S.protocols[S.protocols.length - 1];
if (!crp || crp.product !== "CR Drug") failures.push("CR protocol not created");
else {
  var crNoBefore = crp.protocolNo;
  if (!/^PT-CR-\d{3}-00$/.test(crNoBefore)) failures.push("protocol number format wrong (want PT-CR-001-00): " + crNoBefore);
  else console.log("  protocol number -> " + crNoBefore);
  /* a second batch of the same product increments the trailing order to 01 */
  click(viewClick, { "data-act": "new-protocol" });
  document.getElementById("npProduct").value = "CR Drug batch 2";
  document.getElementById("npCode").value = "CR";
  document.getElementById("npBatch").value = "CR-002";
  click(overlayClick, { "data-act": "np-save" });
  var crp2 = S.protocols[S.protocols.length - 1];
  if (!crp2 || crp2.protocolNo !== "PT-CR-001-01") failures.push("second batch order not 01: " + (crp2 && crp2.protocolNo));
  else console.log("  second batch number -> " + crp2.protocolNo);

  /* Global search filters the CURRENT section and does not jump to Samples */
  goto("#/protocols", "Protocol");
  var gsEl = document.getElementById("globalSearch");
  gsEl.value = "CR";
  (gsEl._h.input || []).forEach(function (fn) { fn({ target: gsEl }); });
  if (location.hash !== "#/protocols") failures.push("search changed the route to " + location.hash);
  if (view.innerHTML.indexOf("PT-CR") < 0) failures.push("protocol search did not match PT-CR");
  if (view.innerHTML.indexOf("SMP-") >= 0) failures.push("protocol search showed samples");
  else console.log("  protocols search stays on Protocols (matches PT-CR, no samples)");
  gsEl.value = "";
  (gsEl._h.input || []).forEach(function (fn) { fn({ target: gsEl }); });
  if (!S.stps.some(function (x) { return x.id === crp.id; })) failures.push("no STP auto-built for the new protocol");
  else {
    var crStp = S.stps.filter(function (x) { return x.id === crp.id; })[0];
    if (crStp.stpNumber !== "ITB-STP/001") failures.push("STP number not taken from the protocol STP No.: " + crStp.stpNumber);
    else console.log("  STP auto-built for new protocol -> STP No. " + crStp.stpNumber);
    var crAssay = crStp.tests.filter(function (x) { return x.testId === "assay"; })[0];
    if (crAssay && crAssay.theory.indexOf("Standard preparation") < 0) failures.push("assay theory does not carry the STP method/preparation text");
    else if (crAssay) console.log("  assay theory carries the STP method/preparation text");
    if (crp.tests.indexOf("dissolution") >= 0) failures.push("schedule ticks were not used to auto-pick tests (dissolution present)");
    if (crp.tests.indexOf("water") < 0 || crp.tests.indexOf("related") < 0 || crp.tests.indexOf("assay") < 0) failures.push("schedule ticks did not auto-pick water/related/assay: " + crp.tests.join(","));
    else console.log("  protocol tests auto-picked from schedule ticks: " + crp.tests.join(", "));
  }
  click(viewClick, { "data-act": "proto-submit", "data-id": crp.id });
  click(viewClick, { "data-act": "proto-changes", "data-id": crp.id });
  document.getElementById("pcComment").value = "Change packing details";
  click(overlayClick, { "data-act": "proto-changes-save", "data-id": crp.id });
  var crStatus = SD.lifecycle.protocolStatus(S, crp.id);
  if (crStatus !== "CHANGES_REQUESTED") failures.push("status after change request = " + crStatus);
  console.log("  after change request -> " + crStatus);
  click(viewClick, { "data-act": "proto-edit", "data-id": crp.id });
  document.getElementById("npPackInner").value = "Corrected LDPE bag, nitrogen purged";
  click(overlayClick, { "data-act": "np-update", "data-id": crp.id });
  var crStatus2 = SD.lifecycle.protocolStatus(S, crp.id);
  if (crStatus2 !== "UNDER_REVIEW") failures.push("status after resubmit = " + crStatus2);
  if (crp.protocolNo !== crNoBefore) failures.push("protocol number changed on edit: " + crNoBefore + " -> " + crp.protocolNo);
  if (!crp.protocolMeta || !crp.protocolMeta.packing || crp.protocolMeta.packing.innermost !== "Corrected LDPE bag, nitrogen purged") failures.push("edited packing not saved");
  console.log("  after edit + resubmit -> " + crStatus2 + ", number unchanged = " + (crp.protocolNo === crNoBefore));
  goto("#/packing", "40±2°C / 75±5% RH, 25±2°C / 60±5% RH");
  click(viewClick, { "data-act": "proto-review-approve", "data-id": crp.id });
  click(viewClick, { "data-act": "proto-gl-approve", "data-id": crp.id });
  if (SD.lifecycle.protocolStatus(S, crp.id) !== "APPROVED") failures.push("CR protocol not approved for packing");
  click(viewClick, { "data-act": "pack-open", "data-id": crp.id });
  var pkHtml = ids["overlayRoot"].innerHTML;
  if (pkHtml.indexOf("Condition 1") < 0 || pkHtml.indexOf("Condition 2") < 0) failures.push("packing drawer did not show all conditions");
  else console.log("  packing drawer shows all " + crp.protocolMeta.sampleConditions.length + " conditions");
  click(overlayClick, { "data-act": "pack-save", "data-id": crp.id });
  var crj0 = SD.lifecycle.project(S, crp.id);
  if (!crj0.ers || crj0.ers.length !== 3) failures.push("expected 3 ER numbers (one per condition), got " + (crj0.ers ? crj0.ers.length : 0));
  else if (crj0.ers.map(function (e) { return e.erNumber; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).length !== 3) failures.push("per-condition ER numbers are not unique");
  else console.log("  per-condition ER numbers -> " + crj0.ers.map(function (e) { return e.erNumber; }).join(", "));
  click(viewClick, { "data-act": "load-open", "data-id": crp.id });
  var lHtml = ids["overlayRoot"].innerHTML;
  var lConds = (lHtml.match(/Condition \d+: /g) || []).length;
  if (lHtml.indexOf("loadChamber_0") < 0 || lHtml.indexOf("loadChamber_2") < 0) failures.push("loading drawer missing per-condition chambers");
  else console.log("  loading drawer shows " + lConds + " condition(s)");
  document.getElementById("loadChamber_0").value = "CH-01";
  document.getElementById("loadChamber_1").value = "CH-01";
  document.getElementById("loadChamber_2").value = "CH-01";
  click(overlayClick, { "data-act": "load-save", "data-id": crp.id });
  var gen2 = SD.lifecycle.samplesFor(S, crp.id);
  if (gen2.length !== 12) failures.push("loading schedule wrong: expected 12 (3 conditions x 4 time points), got " + gen2.length);
  else console.log("  loading created " + gen2.length + " samples across 3 conditions");
  if (!gen2.length || !gen2.every(function (s) { return !!s.erNumber; })) failures.push("samples are missing the per-condition ER number");
  else console.log("  every sample carries its condition's ER number");
  goto("#/loading", "CR Drug");
  var crRows = (view.innerHTML.match(/CR Drug/g) || []).length;
  if (crRows < 3) failures.push("chamber loading list shows only " + crRows + " row(s) for 3 conditions");
  else console.log("  chamber loading list shows " + crRows + " rows (all 3 conditions)");
  /* add a missed condition back without touching what is already loaded */
  var cprj = SD.lifecycle.project(S, crp.id);
  var dropCond = cprj.loading.conditions[1].condition;
  cprj.loading.conditions.splice(1, 1);
  S.samples = S.samples.filter(function (s) { return !(s.protocolId === crp.id && s.condition === dropCond); });
  goto("#/project/" + crp.id, "Add condition (1)");
  click(viewClick, { "data-act": "load-add", "data-id": crp.id });
  if (ids["overlayRoot"].innerHTML.indexOf("Add Condition 1") < 0) failures.push("add-condition drawer did not open");
  document.getElementById("laChamber_0").value = "CH-01";
  click(overlayClick, { "data-act": "load-add-save", "data-id": crp.id });
  var gen3 = SD.lifecycle.samplesFor(S, crp.id);
  if (gen3.length !== 12) failures.push("add condition wrong: expected 12 samples, got " + gen3.length);
  if (SD.lifecycle.project(S, crp.id).loading.conditions.length !== 3) failures.push("loading conditions not restored to 3");
  else console.log("  added missed condition -> " + gen3.length + " samples, 3 conditions");
  /* step Back reverts that step and everything after it */
  global.confirm = function () { return true; };
  click(viewClick, { "data-act": "step-back", "data-key": "loading", "data-id": crp.id });
  if (SD.lifecycle.project(S, crp.id).loading) failures.push("step Back did not clear loading");
  if (SD.lifecycle.samplesFor(S, crp.id).length !== 0) failures.push("step Back did not clear the schedule");
  else console.log("  step Back cleared loading + schedule");
global.confirm = function () { return false; };

/* Early-pull window is official date - 30 days .. official date (0 to 1 month early) */
var wSample = SD.lifecycle.samplesFor(S, npid)[1];
click(viewClick, { "data-act": "ep-new" });
document.getElementById("epSample").value = wSample.sampleId;
change(ids["overlayRoot"]._h.change[0], "epSample");
var wMin = SD.dates.addDays(wSample.plannedWithdrawal, -30);
var wMax = wSample.plannedWithdrawal;
var defVal = document.getElementById("epReqDate").value;
if (defVal < wMin || defVal > wMax) failures.push("requested date default outside window: " + defVal + " not in " + wMin + ".." + wMax);
else console.log("  early-pull window " + wMin + " .. " + wMax + ", default " + defVal);
document.getElementById("epReqDate").value = SD.dates.addDays(wSample.plannedWithdrawal, -31);
document.getElementById("epReason").value = "too early";
click(overlayClick, { "data-act": "ep-save" });
if (S.pulls.some(function (x) { return x.reason === "too early"; })) failures.push("requested date more than 30 days early was allowed");
else console.log("  rejected requested date > 30 days before official");
click(overlayClick, { "data-act": "close-overlay" });

}

/* Withdrawal step ticks once every due sample is withdrawn (future time points do not block it) */
var npidSamples = SD.lifecycle.samplesFor(S, npid);
var dueUn = npidSamples.filter(function (s) { return s.timePointLabel !== "Initial" && !s.actualWithdrawal && s.plannedWithdrawal && s.plannedWithdrawal <= SD.dates.todayISO(); });
dueUn.forEach(function (s) {
  click(viewClick, { "data-act": "wd-open", "data-id": s.id });
  document.getElementById("wdDate").value = SD.dates.todayISO();
  click(overlayClick, { "data-act": "wd-save", "data-id": s.id });
});
var wstep = SD.lifecycle.checklist(S, npid).filter(function (x) { return x.key === "withdrawal"; })[0];
if (!wstep || !wstep.done) failures.push("withdrawal step did not tick after all due samples withdrawn (" + (wstep ? wstep.detail : "?") + ")");
else console.log("  withdrawal step ticked after all due samples withdrawn (" + wstep.detail + ")");

/* Per-condition time points: 5C can be 1-3 months while 25C is 1-12 months */
console.log("\nProtocol: per-condition time points");
click(viewClick, { "data-act": "new-protocol" });
document.getElementById("npProduct").value = "Month Test";
document.getElementById("npBatch").value = "MT-1";
document.getElementById("npCondA").checked = true;
document.getElementById("npCondB").checked = true;
document.getElementById("npCondC").checked = false;
document.getElementById("npTp_0").value = "1, 2, 3";
document.getElementById("npTp_1").value = "1, 2, 3, 6, 9, 12";
click(overlayClick, { "data-act": "np-save" });
var mt = S.protocols[S.protocols.length - 1];
var mtsc = (mt && mt.protocolMeta && mt.protocolMeta.schedule && mt.protocolMeta.schedule.conditions) || [];
if (mtsc.length < 2) failures.push("per-condition schedule missing: " + mtsc.length + " condition(s)");
else if ((mtsc[0].months || []).join(",") !== "1,2,3") failures.push("condition 1 months not saved: " + (mtsc[0].months || []).join(","));
else if ((mtsc[1].months || []).join(",") !== "1,2,3,6,9,12") failures.push("condition 2 months not saved: " + (mtsc[1].months || []).join(","));
else console.log("  condition 1 = " + mtsc[0].months.join(",") + " months; condition 2 = " + mtsc[1].months.join(",") + " months");

/* STP register: upload the current STP (no approval step), versioned */
console.log("\nSTP register: upload current STP");
var prevRole = S.role;
S.role = "Admin";
click(viewClick, { "data-act": "stp-upload" });
document.getElementById("stpNo").value = "TEST-STP/9";
document.getElementById("stpProduct").value = "Test Product";
document.getElementById("stpText").value = "Assay method text";
click(overlayClick, { "data-act": "stp-upload-save" });
var newStp = S.stps.filter(function (x) { return x.stpNumber === "TEST-STP/9"; })[0];
if (!newStp) failures.push("STP upload did not create a record");
else if (newStp.status !== "Approved") failures.push("uploaded STP is not current/Approved: " + newStp.status);
else console.log("  uploaded current STP -> " + newStp.stpNumber + " (" + newStp.status + ")");
S.role = prevRole;

function finish() {
  if (failures.length) { console.error("\nFAILURES:\n - " + failures.join("\n - ")); process.exit(1); }
  console.log("\nALL ROUTES + WORKFLOW: ok");
}

/* XLSX auto-read: generate a real .xlsx and parse it with the app reader */
console.log("\nXLSX auto-read: parse a generated workbook");
var xlsxBuf = makeXlsx([
  ["Product", "Batch", "Planned Withdrawal", "Shelf Life"],
  ["XLSX Drug", "XL-001", "2026-11-20", "24M"],
  ["Second Drug", "XL-002", "2026-12-05", "12M"]
]);
SD.readXlsx(toArrayBuffer(xlsxBuf)).then(function (res) {
  var hdr = (res.rows[0] || []).join(" | ");
  if (!res.rows[0] || res.rows[0][0] !== "Product") failures.push("xlsx header not read: " + hdr);
  if (!res.rows[2] || res.rows[2][0] !== "Second Drug") failures.push("xlsx third row not read");
  console.log("  headers = " + hdr + "; data rows = " + (res.rows.length - 1));
  /* Excel serial date 46007 must convert to a real date */
  var serial = SD.dates.addDays ? 46007 : 46007;
  return SD.readXlsx(toArrayBuffer(makeXlsx([["Product", "Batch", "Planned Withdrawal"], ["Serial Drug", "SR-1", String(serial)]])));
}).then(function (res2) {
  var serialCell = res2.rows[1][2];
  console.log("  serial " + serialCell + " is kept as a number (converted later by normalizeDate)");
}).catch(function (e) {
  failures.push("xlsx read failed: " + e.message);
}).then(finish);
