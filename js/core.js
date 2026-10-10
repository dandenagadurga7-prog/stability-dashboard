/* Stability Analysis Management Dashboard — core utilities
 * Central date logic + automatic status engine + persistence/audit store.
 * No pharma data lives here; all domain data is in data.js and is clearly
 * labelled as DEMO until the approved Protocol / Report / Excel are supplied.
 */
(function (global) {
  "use strict";

  var MS_DAY = 86400000;

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function toISO(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }

  var dates = {
    todayISO: function () { return toISO(new Date()); },
    toISO: toISO,
    parse: function (iso) {
      if (!iso) return null;
      var p = String(iso).slice(0, 10).split("-");
      if (p.length !== 3) return null;
      var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
      return isNaN(d.getTime()) ? null : d;
    },
    addDays: function (iso, n) {
      var d = dates.parse(iso);
      if (!d) return null;
      d.setDate(d.getDate() + Number(n));
      return toISO(d);
    },
    diffDays: function (aISO, bISO) {
      var a = dates.parse(aISO), b = dates.parse(bISO);
      if (!a || !b) return null;
      return Math.round((b - a) / MS_DAY);
    },
    fmt: function (iso, style) {
      var d = dates.parse(iso);
      if (!d) return "—";
      var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      if (style === "short") return pad(d.getDate()) + " " + months[d.getMonth()];
      return pad(d.getDate()) + " " + months[d.getMonth()] + " " + d.getFullYear();
    },
    monthKey: function (iso) { return iso ? String(iso).slice(0, 7) : null; },
    monthLabel: function (key) {
      if (!key) return "—";
      var p = key.split("-");
      var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      return months[Number(p[1]) - 1] + " " + p[0];
    },
    addMonths: function (iso, n) {
      var d = dates.parse(iso);
      if (!d) return null;
      d.setMonth(d.getMonth() + Number(n));
      return toISO(d);
    },
    nowStamp: function () {
      var d = new Date();
      return toISO(d) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
    }
  };

  var STATUS = {
    UPCOMING: { code: "UPCOMING", label: "Upcoming", tone: "muted" },
    DUE_FOR_WITHDRAWAL: { code: "DUE_FOR_WITHDRAWAL", label: "Due for Withdrawal", tone: "info" },
    WITHDRAWAL_OVERDUE: { code: "WITHDRAWAL_OVERDUE", label: "Withdrawal Overdue", tone: "danger" },
    WITHDRAWN: { code: "WITHDRAWN", label: "Withdrawn", tone: "purple" },
    IN_ANALYSIS: { code: "IN_ANALYSIS", label: "In Analysis", tone: "info" },
    ANALYSIS_DUE_SOON: { code: "ANALYSIS_DUE_SOON", label: "Analysis Due Soon", tone: "warn" },
    ANALYSIS_OVERDUE: { code: "ANALYSIS_OVERDUE", label: "Analysis Overdue", tone: "danger" },
    UNDER_REVIEW: { code: "UNDER_REVIEW", label: "Under Review", tone: "purple" },
    REPORT_PENDING: { code: "REPORT_PENDING", label: "Report Pending", tone: "warn" },
    COMPLETED: { code: "COMPLETED", label: "Completed", tone: "success" },
    ON_HOLD: { code: "ON_HOLD", label: "On Hold", tone: "muted" }
  };

  /* Single source of truth for every derived date. */
  function computeDates(sample, settings) {
    var W = Number(settings.withdrawalWindowDays);
    var A = Number(settings.analysisDueDays);
    var R = Number(settings.reportDueDays);
    return {
      earliestWithdrawal: sample.plannedWithdrawal || null,
      latestWithdrawal: sample.plannedWithdrawal ? dates.addDays(sample.plannedWithdrawal, W) : null,
      analysisDue: sample.actualWithdrawal ? dates.addDays(sample.actualWithdrawal, A) : null,
      reportDue: sample.analysisCompleteDate ? dates.addDays(sample.analysisCompleteDate, R) : null
    };
  }

  /* Automatic status engine. Dates + workflow state -> one status. */
  function deriveStatus(sample, settings, todayISO) {
    var today = todayISO || dates.todayISO();
    var d = computeDates(sample, settings);

    if (sample.hold) return { def: STATUS.ON_HOLD, reason: "On hold: " + (sample.holdReason || "temporarily stopped") };
    if (sample.reportStatus === "approved") return { def: STATUS.COMPLETED, reason: "Report approved" };

    if (sample.analysisCompleteDate) {
      if (sample.reviewStatus !== "approved") {
        return { def: STATUS.UNDER_REVIEW, reason: "Results entered; awaiting review" };
      }
      return { def: STATUS.REPORT_PENDING, reason: "Reviewed; report not approved" };
    }

    if (sample.analysisStart) {
      var due = d.analysisDue;
      if (due) {
        var toDue = dates.diffDays(today, due);
        if (toDue < 0) return { def: STATUS.ANALYSIS_OVERDUE, reason: "Analysis due " + dates.fmt(due) + " (" + Math.abs(toDue) + "d overdue)" };
        if (toDue <= 3) return { def: STATUS.ANALYSIS_DUE_SOON, reason: "Analysis due " + dates.fmt(due) };
      }
      return { def: STATUS.IN_ANALYSIS, reason: "Analysis started " + dates.fmt(sample.analysisStart) };
    }

    if (sample.actualWithdrawal) {
      return { def: STATUS.WITHDRAWN, reason: "Withdrawn " + dates.fmt(sample.actualWithdrawal) + "; analysis not started" };
    }

    if (d.latestWithdrawal && dates.diffDays(today, d.latestWithdrawal) < 0) {
      return { def: STATUS.WITHDRAWAL_OVERDUE, reason: "Withdrawal window closed " + dates.fmt(d.latestWithdrawal) };
    }
    if (d.earliestWithdrawal && dates.diffDays(today, d.latestWithdrawal) >= 0 && dates.diffDays(today, d.earliestWithdrawal) <= 0) {
      return { def: STATUS.DUE_FOR_WITHDRAWAL, reason: "Planned " + dates.fmt(sample.plannedWithdrawal) };
    }
    return { def: STATUS.UPCOMING, reason: "Planned " + dates.fmt(sample.plannedWithdrawal) };
  }

  var STORE_KEY = "sd_stability_v1";

  var store = {
    state: null,
    load: function (seedFn) {
      var raw = null;
      try { raw = global.localStorage.getItem(STORE_KEY); } catch (e) { raw = null; }
      if (raw) {
        try { this.state = JSON.parse(raw); } catch (e) { this.state = null; }
      }
      if (!this.state || !this.state.samples) {
        this.state = seedFn();
        this.save();
      }
      return this.state;
    },
    save: function () {
      try { global.localStorage.setItem(STORE_KEY, JSON.stringify(this.state)); } catch (e) { /* private mode */ }
    },
    reset: function (seedFn) { this.state = seedFn(); this.save(); },
    getSample: function (id) {
      for (var i = 0; i < this.state.samples.length; i++) if (this.state.samples[i].id === id) return this.state.samples[i];
      return null;
    },
    audit: function (entry) {
      var e = {
        id: "aud_" + Math.random().toString(36).slice(2, 9),
        at: dates.nowStamp(),
        user: entry.user || "ar.dhamodar",
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        field: entry.field || null,
        oldValue: entry.oldValue === undefined ? null : entry.oldValue,
        newValue: entry.newValue === undefined ? null : entry.newValue,
        note: entry.note || null
      };
      this.state.audit.unshift(e);
      if (this.state.audit.length > 500) this.state.audit.pop();
      return e;
    },
    updateSample: function (id, patch, user) {
      var s = this.getSample(id);
      if (!s) return { ok: false, error: "Sample not found" };
      var changed = [];
      for (var k in patch) {
        if (!Object.prototype.hasOwnProperty.call(patch, k)) continue;
        if (s[k] !== patch[k]) {
          this.audit({
            user: user, action: "update", entity: "sample", entityId: id,
            field: k, oldValue: s[k], newValue: patch[k]
          });
          s[k] = patch[k];
          changed.push(k);
        }
      }
      this.save();
      return { ok: true, changed: changed };
    },
    /* Validation at the edge: rejects a record with missing required fields. */
    validateSample: function (fields) {
      var errors = [];
      if (!fields.product) errors.push("Product is required");
      if (!fields.batch) errors.push("Batch No is required");
      if (!fields.plannedWithdrawal) errors.push("Planned Withdrawal date is required");
      if (fields.actualWithdrawal && !/^\d{4}-\d{2}-\d{2}$/.test(fields.actualWithdrawal)) errors.push("Actual Withdrawal must be a valid date");
      if (fields.analysisCompleteDate && !fields.actualWithdrawal) errors.push("Cannot complete analysis without an Actual Withdrawal date");
      if (fields.reportStatus === "approved" && !fields.analysisCompleteDate) errors.push("Cannot approve a report before analysis is completed");
      return errors;
    }
  };

  /* ---------- digital lifecycle: Protocol -> ... -> Final Report ---------- */
  function padId(n, len) { var s = String(n); while (s.length < len) s = "0" + s; return s; }

  var ids = {
    next: function (state, kind) {
      state.counters = state.counters || {};
      state.counters[kind] = (state.counters[kind] || 0) + 1;
      var year = new Date().getFullYear();
      var prefix = {
        prot: "STB-PROT-" + year + "-", pk: "PK-" + year + "-", er: "ER-" + year + "-",
        load: "LOAD-" + year + "-", wd: "WD-" + year + "-", doc: "DOC-" + year + "-", rep: "REP-" + year + "-",
        ar: "AR-" + year + "-", ep: "EP-" + year + "-"
      }[kind] || (kind.toUpperCase() + "-");
      var len = { prot: 3, pk: 5, er: 6, load: 6, wd: 6, doc: 6, rep: 6, ar: 6, ep: 6 }[kind] || 5;
      return prefix + padId(state.counters[kind], len);
    }
  };

  var lifecycle = {
    ensure: function (state) {
      if (!state.chambers) state.chambers = [];
      if (!state.projects) state.projects = {};
      if (!state.counters) state.counters = {};
      if (!state.users) state.users = [];
      if (!state.deviations) state.deviations = [];
      if (!state.pulls) state.pulls = [];
      (state.protocols || []).forEach(function (p) {
        if (!state.projects[p.id]) {
          state.projects[p.id] = { protocolId: p.id, approvals: [], packing: null, er: null, loading: null, documents: [], finalReport: { status: "not_started" }, deviations: [] };
        }
      });
      /* migration: completed analyses get an AR number (Analysis Report) */
      (state.samples || []).forEach(function (s) {
        if (s.analysisCompleteDate && !s.arNumber) s.arNumber = ids.next(state, "ar");
      });
      return state;
    },
    project: function (state, protocolId) { this.ensure(state); return state.projects[protocolId]; },
    samplesFor: function (state, protocolId) {
      return (state.samples || []).filter(function (s) { return s.protocolId === protocolId; });
    },
    protocolStatus: function (state, protocolId) {
      var pr = this.project(state, protocolId);
      var ap = pr.approvals || [];
      var last = ap[ap.length - 1];
      if (last && (last.action === "rejected" || last.action === "changes_requested")) return "CHANGES_REQUESTED";
      /* only the current review cycle counts: approvals after the latest change request */
      var start = 0;
      for (var i = ap.length - 1; i >= 0; i--) {
        if (ap[i].action === "changes_requested" || ap[i].action === "rejected") { start = i + 1; break; }
      }
      var cycle = ap.slice(start);
      if (cycle.some(function (a) { return a.level === "Group Leader" && a.action === "approved"; })) return "APPROVED";
      if (cycle.some(function (a) { return a.level === "Reviewer" && a.action === "approved"; })) return "PENDING_GL";
      if (cycle.some(function (a) { return a.level === "Preparer"; })) return "UNDER_REVIEW";
      return "DRAFT";
    },
    checklist: function (state, protocolId) {
      var pr = this.project(state, protocolId);
      var samples = this.samplesFor(state, protocolId);
      var today = dates.todayISO();
      function withdrawn(s) { return !!s.actualWithdrawal; }
      function isInitial(s) { return s.timePointLabel === "Initial"; }
      function notYetDue(s) { return !s.plannedWithdrawal || dates.diffDays(today, s.plannedWithdrawal) > 0; }
      /* a withdrawal is "done" when every due sample is withdrawn and at least one real time point has been withdrawn */
      function withdrawalDone() {
        if (!samples.length) return false;
        if (!samples.some(function (s) { return withdrawn(s) && !isInitial(s); })) return false;
        return samples.every(function (s) { return withdrawn(s) || notYetDue(s); });
      }
      /* analysis is "done" when every withdrawn sample has been analysed */
      function analysisDone() {
        if (!samples.length) return false;
        if (!samples.some(function (s) { return withdrawn(s) && !isInitial(s); })) return false;
        return samples.every(function (s) { return !withdrawn(s) || !!s.analysisCompleteDate; });
      }
      var steps = [
        { key: "protocol", label: "Protocol approved", done: this.protocolStatus(state, protocolId) === "APPROVED", detail: this.protocolStatus(state, protocolId) },
        { key: "packing", label: "Sample packed", done: !!pr.packing, detail: pr.packing ? pr.packing.packingId : "Not packed" },
        { key: "er", label: "ER number generated", done: !!pr.er, detail: pr.er ? pr.er.erNumber : "Pending" },
        { key: "loading", label: "Loaded into chamber", done: !!pr.loading, detail: pr.loading ? pr.loading.loadingId + " · " + pr.loading.chamberName : "Pending" },
        { key: "schedule", label: "Time-point schedule created", done: samples.length > 0, detail: samples.length + " time point(s)" },
        { key: "withdrawal", label: "Samples withdrawn", done: withdrawalDone(), detail: samples.filter(function (s) { return s.actualWithdrawal; }).length + "/" + samples.length },
        { key: "analysis", label: "Analysis completed", done: analysisDone(), detail: samples.filter(function (s) { return s.analysisCompleteDate; }).length + "/" + samples.length },
        { key: "documents", label: "Documentation generated", done: (pr.documents || []).length > 0, detail: (pr.documents || []).length + " document(s)" },
        { key: "report", label: "Final report approved", done: !!(pr.finalReport && pr.finalReport.status === "approved"), detail: pr.finalReport ? pr.finalReport.status : "not_started" }
      ];
      return steps;
    },
    nextAction: function (state, protocolId) {
      var pr = this.project(state, protocolId);
      var ps = this.protocolStatus(state, protocolId);
      var today = dates.todayISO();
      if (ps === "DRAFT") return { label: "Submit protocol for review", act: "proto-submit", id: protocolId };
      if (ps === "UNDER_REVIEW") return { label: "Review protocol (Reviewer)", route: "#/protocoldoc/" + protocolId };
      if (ps === "PENDING_GL") return { label: "Group Leader sign-off", route: "#/protocoldoc/" + protocolId };
      if (ps === "CHANGES_REQUESTED") return { label: "Update protocol and resubmit", act: "proto-submit", id: protocolId };
      if (!pr.packing) return { label: "Pack samples", act: "pack-open", id: protocolId };
      if (!pr.er) return { label: "Generate ER number", act: "er-generate", id: protocolId };
      if (!pr.loading) return { label: "Load into chamber", act: "load-open", id: protocolId };
      var samples = this.samplesFor(state, protocolId);
      var due = samples.filter(function (s) { var c = computeDates(s, state.settings); return !s.actualWithdrawal && c.earliestWithdrawal && dates.diffDays(today, c.earliestWithdrawal) <= 0; });
      if (due.length) return { label: "Withdraw " + due.length + " due sample(s)", route: "#/withdrawals" };
      var openAn = samples.filter(function (s) { return s.actualWithdrawal && !s.analysisCompleteDate; });
      if (openAn.length) return { label: "Complete analysis (" + openAn.length + ")", route: "#/analysis" };
      var pending = samples.filter(function (s) { return s.analysisCompleteDate && s.reportStatus !== "approved"; });
      if (pending.length) return { label: "Review & approve report (" + pending.length + ")", route: "#/reports" };
      if (!(pr.documents || []).length) return { label: "Generate documentation", act: "doc-generate-all", id: protocolId };
      if (!pr.finalReport || pr.finalReport.status !== "approved") return { label: "Generate & approve final report", act: "final-open", id: protocolId };
      return { label: "Project completed", route: "#/project/" + protocolId };
    }
  };

  /* ---------- formula + specification engine (STP-driven, no invented data) ---------- */
  function evalFormula(expr, vars) {
    var s = String(expr || "").replace(/\s+/g, "");
    if (!s) return null;
    var i = 0;
    function peek() { return i < s.length ? s[i] : ""; }
    function parseExpr() {
      var v = parseTerm();
      while (peek() === "+" || peek() === "-") { var op = s[i++]; var r = parseTerm(); v = op === "+" ? v + r : v - r; }
      return v;
    }
    function parseTerm() {
      var v = parseFactor();
      while (peek() === "*" || peek() === "/") { var op = s[i++]; var r = parseFactor(); v = op === "*" ? v * r : v / r; }
      return v;
    }
    function parseFactor() {
      var c = peek();
      if (c === "(") { i++; var v = parseExpr(); if (peek() === ")") i++; return v; }
      if (c === "-") { i++; return -parseFactor(); }
      if (/[0-9.]/.test(c)) { var st = i; while (/[0-9.]/.test(peek())) i++; return parseFloat(s.slice(st, i)); }
      if (/[A-Za-z_]/.test(c)) { var stn = i; while (/[A-Za-z0-9_]/.test(peek())) i++; var name = s.slice(stn, i); return Number(vars[name]); }
      throw new Error("Bad formula at " + i);
    }
    var val = parseExpr();
    if (i !== s.length) throw new Error("Unexpected trailing input");
    return isNaN(val) ? null : val;
  }

  function parseSpec(spec) {
    var s = String(spec || "").toLowerCase();
    var range = s.match(/not less than\s*([0-9.]+)\s*and not more than\s*([0-9.]+)/);
    if (range) return { type: "range", min: parseFloat(range[1]), max: parseFloat(range[2]) };
    var max = s.match(/not more than\s*([0-9.]+)/);
    if (max) return { type: "max", max: parseFloat(max[1]) };
    var min = s.match(/not less than\s*([0-9.]+)/);
    if (min) return { type: "min", min: parseFloat(min[1]) };
    return { type: "manual" };
  }

  function checkSpec(value, spec) {
    var p = parseSpec(spec);
    var n = parseFloat(value);
    if (p.type === "manual" || isNaN(n)) return "MANUAL";
    if (p.type === "range") return (n >= p.min && n <= p.max) ? "PASS" : "FAIL";
    if (p.type === "max") return n <= p.max ? "PASS" : "FAIL";
    if (p.type === "min") return n >= p.min ? "PASS" : "FAIL";
    return "MANUAL";
  }

  global.SD = { dates: dates, STATUS: STATUS, computeDates: computeDates, deriveStatus: deriveStatus, store: store, ids: ids, lifecycle: lifecycle, evalFormula: evalFormula, parseSpec: parseSpec, checkSpec: checkSpec };
})(window);
