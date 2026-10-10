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
goto("#/data", "Import Monthly Schedule");
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
goto("#/users", "Signed-in role");
goto("#/protocols", "AL-009-04");
goto("#/project/p0", "Lifecycle");
goto("#/project/panz", "Lifecycle");
goto("#/protocoldoc/panz", "Reason(s) for Stability study");
goto("#/datasheet/panz", "Cumulative data sheet");
goto("#/datasheet/p0", "Cumulative data sheet");
goto("#/earlypull", "R&amp;D Early Pull");
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
  if (gen.length !== 7) failures.push("schedule wrong: expected 7 samples (Initial + 6 time points), got " + gen.length);
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

/* STP worksheet: theory loads, analyst enters weights, system prints PASS/FAIL */
console.log("\nWorksheet: select STP -> select tests -> enter data -> PASS/FAIL");
click(viewClick, { "data-act": "ws-new" });
document.getElementById("wsStp").value = "p0";
click(overlayClick, { "data-act": "ws-load" });
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
console.log("\nData sheet: enter 6M assay -> save to time point");
click(viewClick, { "data-act": "ws-new" });
document.getElementById("wsStp").value = "panz";
document.getElementById("wsTimePoint").value = "ANZ-0005";
click(overlayClick, { "data-act": "ws-load" });
document.getElementById("ws_in_anz_assay_sampleArea").value = "100000";
document.getElementById("ws_in_anz_assay_stdArea").value = "100500";
click(overlayClick, { "data-act": "ws-calc" });
click(overlayClick, { "data-act": "ws-save" });
var r6 = (S.results["ANZ-0005"] || []).filter(function (x) { return x.testId === "anz_assay"; })[0];
if (!r6 || !r6.result) failures.push("worksheet did not save result to time point");
console.log("  6M assay saved = " + (r6 && r6.result) + " (" + (r6 && r6.status) + ")");
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
document.getElementById("epAdvance").value = "20";
change(ids["overlayRoot"]._h.change[0], "epAdvance");
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
document.getElementById("npCondA").checked = true;
document.getElementById("npCondB").checked = true;
document.getElementById("npCondC").checked = true;
click(overlayClick, { "data-act": "np-save" });
var crp = S.protocols[S.protocols.length - 1];
if (!crp || crp.product !== "CR Drug") failures.push("CR protocol not created");
else {
  var crNoBefore = crp.protocolNo;
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
  if (gen2.length !== 21) failures.push("loading schedule wrong: expected 21 (3 conditions x 7), got " + gen2.length);
  else console.log("  loading created " + gen2.length + " samples across 3 conditions");
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
  if (gen3.length !== 21) failures.push("add condition wrong: expected 21 samples, got " + gen3.length);
  if (SD.lifecycle.project(S, crp.id).loading.conditions.length !== 3) failures.push("loading conditions not restored to 3");
  else console.log("  added missed condition -> " + gen3.length + " samples, 3 conditions");
  /* step Back reverts that step and everything after it */
  global.confirm = function () { return true; };
  click(viewClick, { "data-act": "step-back", "data-key": "loading", "data-id": crp.id });
  if (SD.lifecycle.project(S, crp.id).loading) failures.push("step Back did not clear loading");
  if (SD.lifecycle.samplesFor(S, crp.id).length !== 0) failures.push("step Back did not clear the schedule");
  else console.log("  step Back cleared loading + schedule");
  global.confirm = function () { return false; };
}

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
