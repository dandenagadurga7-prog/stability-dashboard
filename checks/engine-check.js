/* Headless check: loads core.js + data.js with a stubbed browser, seeds the
 * demo data, and prints the status the engine assigns to every sample.
 * Fails (exit 1) if any expected status is missing from the seed. */
var path = require("path");
global.window = global;
var mem = {};
global.localStorage = { getItem: function (k) { return mem[k] || null; }, setItem: function (k, v) { mem[k] = v; } };
require(path.join(__dirname, "..", "js", "core.js"));
require(path.join(__dirname, "..", "js", "data.js"));

var SD = global.SD;
var state = SD.seed();
var counts = {};
var today = SD.dates.todayISO();

state.samples.forEach(function (s) {
  var st = SD.deriveStatus(s, state.settings, today).def.code;
  counts[st] = (counts[st] || 0) + 1;
});

console.log("today =", today);
console.log("samples =", state.samples.length, "protocols =", state.protocols.length);
Object.keys(counts).sort().forEach(function (k) { console.log("  " + k + " = " + counts[k]); });

/* Date-rule assertions */
var sample = state.samples[0];
var d = SD.computeDates(sample, state.settings);
console.log("rule check: withdrawal window days =", state.settings.withdrawalWindowDays,
  "| earliest", d.earliestWithdrawal, "latest", d.latestWithdrawal);
var an = state.samples.filter(function (s) { return s.actualWithdrawal; })[0];
var ad = SD.computeDates(an, state.settings);
console.log("rule check: actual", an.actualWithdrawal, "+", state.settings.analysisDueDays, "days => analysisDue", ad.analysisDue);

var expected = ["UPCOMING", "DUE_FOR_WITHDRAWAL", "WITHDRAWAL_OVERDUE", "IN_ANALYSIS", "ANALYSIS_DUE_SOON", "ANALYSIS_OVERDUE", "UNDER_REVIEW", "REPORT_PENDING", "COMPLETED", "ON_HOLD"];
var missing = expected.filter(function (e) { return !counts[e]; });
if (missing.length) { console.error("MISSING STATUSES:", missing.join(", ")); process.exit(1); }
console.log("ALL EXPECTED STATUSES PRESENT: ok");
