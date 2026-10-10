/* Stability Analysis Management Dashboard — application layer */
(function () {
  "use strict";
  var dates = SD.dates;
  var store = SD.store;
  var S = store.load(SD.seed);
  SD.lifecycle.ensure(S);
  store.save();

  var filters = { search: "", product: "", batch: "", status: "", storage: "", analyst: "", timePoint: "" };
  var protoFilter = "";
  var scheduleMonth = dates.monthKey(dates.todayISO());
  var route = { name: "dashboard", param: null };

  function h(s) {
    if (s === null || s === undefined) return "";
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function today() { return dates.todayISO(); }
  function statusOf(s) { return SD.deriveStatus(s, S.settings, today()); }
  function fmt(d) { return dates.fmt(d); }
  function statusBadge(def) { return '<span class="badge tone-' + def.tone + '"><span class="dot"></span>' + h(def.label) + "</span>"; }
  function uniq(arr) { var o = {}, out = []; arr.forEach(function (x) { if (x && !o[x]) { o[x] = 1; out.push(x); } }); return out; }

  function computeDatesFor(s) { return SD.computeDates(s, S.settings); }
  function projectOf(id) { return SD.lifecycle.project(S, id); }
  function protocolOf(id) {
    for (var i = 0; i < S.protocols.length; i++) if (S.protocols[i].id === id) return S.protocols[i];
    return null;
  }
  function stpFor(id) {
    var list = S.stps || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  /* ---------- R&D early pull (add-on; official date never changed) ---------- */
  function pullsForRef(ref) {
    return (S.pulls || []).filter(function (p) { return p.sampleRef === ref; })
      .sort(function (a, b) { return (b.createdAt || "").localeCompare(a.createdAt || ""); });
  }
  function latestPull(ref) { return pullsForRef(ref)[0] || null; }
  var EP_STATES = {
    SUBMITTED: { t: "warn", l: "Pending Approval" },
    REVIEWER_APPROVED: { t: "warn", l: "Awaiting Group Leader" },
    APPROVED: { t: "success", l: "Approved" },
    REJECTED: { t: "danger", l: "Rejected" },
    WITHDRAWN: { t: "purple", l: "Withdrawn" }
  };
  function epEffective(ep) {
    if (ep.status === "WITHDRAWN") { var s = sampleByRef(ep.sampleRef); if (s && s.analysisCompleteDate) return "COMPLETED"; }
    return ep.status;
  }
  function epBadge(ep) {
    var st = epEffective(ep);
    if (st === "COMPLETED") return '<span class="badge tone-success"><span class="dot"></span>Completed</span>';
    var m = EP_STATES[st] || { t: "muted", l: st };
    return '<span class="badge tone-' + m.t + '"><span class="dot"></span>' + h(m.l) + "</span>";
  }
  function PROTO_TONE(ps) {
    return ps === "APPROVED" ? "success" : ps === "PENDING_GL" ? "warn" : ps === "CHANGES_REQUESTED" ? "danger" : ps === "UNDER_REVIEW" ? "info" : "muted";
  }
  function protoBadge(ps) {
    var lbl = { DRAFT: "Draft", UNDER_REVIEW: "Under review", PENDING_GL: "Pending Group Leader", APPROVED: "Approved", CHANGES_REQUESTED: "Changes requested" }[ps] || ps;
    return '<span class="badge tone-' + PROTO_TONE(ps) + '"><span class="dot"></span>' + h(lbl) + "</span>";
  }
  /* Conditions come from the approved protocol's "Stability Study Required At" list, so packing stays in step with the protocol. */
  function protocolConditionList(p) {
    var m = p.protocolMeta || {};
    var conds = m.sampleConditions;
    if (conds && conds.length) return conds.map(function (c) { return String(c).replace(/^[A-F]\.\s*/, ""); });
    return [p.storageCondition || "—"];
  }
  function protocolConditions(p) { return protocolConditionList(p).join(", "); }
  /* temperature number used to match a protocol condition with what is already loaded */
  function condNum(s) { var m = String(s).match(/(-?\d{1,3})/); return m ? m[1] : String(s); }
  function loadingChamberText(l) {
    if (l.conditions && l.conditions.length) return l.conditions.map(function (c) { return c.chamberName + " · " + c.chamberCondition; }).join("; ");
    return l.chamberName + " · " + l.condition;
  }
  function nextActionHtml(id) {
    var na = SD.lifecycle.nextAction(S, id);
    var control = na.act
      ? '<button class="btn primary" data-act="' + na.act + '" data-id="' + h(id) + '">Go</button>'
      : '<a class="btn primary" href="' + h(na.route) + '">Go</a>';
    return '<div class="next-action"><div><div class="eyebrow">Next action</div><div class="na-label">' + h(na.label) + "</div></div>" + control + "</div>";
  }

  function counts() {
    var t = today(), c = {
      total: S.samples.length, products: uniq(S.samples.map(function (s) { return s.productCode; })).length,
      dueToday: 0, thisWeek: 0, thisMonth: 0, pendingWd: 0, inAnalysis: 0, dueSoon: 0,
      analysisOverdue: 0, withdrawalOverdue: 0, reportsPending: 0, completed: 0, onHold: 0, underReview: 0, withdrawn: 0
    };
    var curMonth = dates.monthKey(t);
    S.samples.forEach(function (s) {
      var st = statusOf(s).def.code;
      var d = computeDatesFor(s);
      if (s.plannedWithdrawal === t && !s.actualWithdrawal) c.dueToday++;
      if (d.analysisDue === t && !s.analysisCompleteDate) c.dueToday++;
      if (s.plannedWithdrawal && !s.actualWithdrawal) {
        var toW = dates.diffDays(t, s.plannedWithdrawal);
        if (toW >= 0 && toW <= 7) c.thisWeek++;
        if (dates.monthKey(s.plannedWithdrawal) === curMonth) c.thisMonth++;
      }
      if (st === "DUE_FOR_WITHDRAWAL" || st === "WITHDRAWAL_OVERDUE") c.pendingWd++;
      if (st === "IN_ANALYSIS" || st === "ANALYSIS_DUE_SOON") c.inAnalysis++;
      if (st === "ANALYSIS_DUE_SOON") c.dueSoon++;
      if (st === "ANALYSIS_OVERDUE") c.analysisOverdue++;
      if (st === "WITHDRAWAL_OVERDUE") c.withdrawalOverdue++;
      if (st === "REPORT_PENDING") c.reportsPending++;
      if (st === "UNDER_REVIEW") c.underReview++;
      if (st === "WITHDRAWN") c.withdrawn++;
      if (st === "COMPLETED") c.completed++;
      if (st === "ON_HOLD") c.onHold++;
    });
    return c;
  }

  function lifecycleCounts() {
    var pa = 0, pp = 0, ic = 0, cs = 0;
    S.protocols.forEach(function (p) {
      var ps = SD.lifecycle.protocolStatus(S, p.id), pr = projectOf(p.id);
      if (ps !== "APPROVED") pa++;
      if (ps === "APPROVED" && !pr.packing) pp++;
      if (pr.loading) ic++;
      if (pr.finalReport && pr.finalReport.status === "approved") cs++;
    });
    return { pendingApproval: pa, pendingPacking: pp, inChambers: ic, completed: cs };
  }

  function monthsInData() {
    var set = {};
    S.samples.forEach(function (s) { if (s.plannedWithdrawal) set[dates.monthKey(s.plannedWithdrawal)] = 1; });
    set[dates.monthKey(today())] = 1;
    return Object.keys(set).sort();
  }

  function monthlyWorkload() {
    var map = {};
    S.samples.forEach(function (s) {
      if (!s.plannedWithdrawal) return;
      var k = dates.monthKey(s.plannedWithdrawal);
      if (!map[k]) map[k] = { key: k, total: 0, done: 0, overdue: 0, pending: 0 };
      map[k].total++;
      var st = statusOf(s).def.code;
      if (s.analysisCompleteDate) map[k].done++;
      else if (st === "ANALYSIS_OVERDUE" || st === "WITHDRAWAL_OVERDUE") map[k].overdue++;
      else map[k].pending++;
    });
    return Object.keys(map).sort().map(function (k) { return map[k]; });
  }

  /* ---------- nav / router ---------- */
  var NAV = [
    ["dashboard", "\u25A6", "Dashboard", "#/"],
    ["protocols", "\u2697", "Protocols", "#/protocols"],
    ["packing", "\u25A3", "Sample Packing", "#/packing"],
    ["er", "\u2317", "ER Management", "#/er"],
    ["chambers", "\u25A6", "Chamber Management", "#/chambers"],
    ["loading", "\u21E3", "Chamber Loading", "#/loading"],
    ["withdrawals", "\u21E1", "Withdrawal / Pulling", "#/withdrawals"],
    ["analysis", "\u2315", "Analysis", "#/analysis"],
    ["documentation", "\u2630", "Documentation", "#/documentation"],
    ["final-reports", "\u2637", "Final Reports", "#/final-reports"],
    ["stp", "\u2699", "STP Master", "#/stp"],
    ["products", "\u25A4", "Products", "#/products"],
    ["schedule", "\u2261", "Monthly Schedule", "#/schedule"],
    ["samples", "\u29C9", "Samples", "#/samples"],
    ["users", "\u263A", "Users & Roles", "#/users"],
    ["alerts", "\u2691", "Alerts", "#/alerts"],
    ["audit", "\u21BB", "Audit Trail", "#/audit"],
    ["reports", "\u2637", "Reports", "#/reports"],
    ["data", "\u21C5", "Excel / Import-Export", "#/data"],
    ["settings", "\u2699", "Settings", "#/settings"]
  ];

  function renderNav() {
    document.getElementById("nav").innerHTML = NAV.map(function (n) {
      return '<a href="' + n[3] + '" data-nav="' + n[0] + '"><span class="ico">' + n[1] + '</span><span class="label">' + n[2] + "</span></a>";
    }).join("");
  }

  function parseHash() {
    var hash = (location.hash || "#/").replace(/^#\/?/, "");
    var parts = hash.split("/").filter(Boolean);
    if (!parts.length) return { name: "dashboard", param: null };
    var name = parts[0];
    var param = parts[1] || null;
    if (name === "reports" && param) return { name: "report", param: param };
    if (name === "sample" && param) return { name: "sample", param: param };
    if (name === "project" && param) return { name: "project", param: param };
    if (name === "datasheet" && param) return { name: "datasheet", param: param };
    if (name === "protocoldoc" && param) return { name: "protocoldoc", param: param };
    var valid = NAV.map(function (n) { return n[0]; });
    if (valid.indexOf(name) < 0) return { name: "dashboard", param: null };
    return { name: name, param: param };
  }

  var TITLES = {
    dashboard: ["Dashboard", "Management overview"],
    protocols: ["Protocols", "Create, review and approve stability protocols"],
    packing: ["Sample Packing", "Pack approved samples and generate ER"],
    er: ["ER Management", "Traceability reference for the whole lifecycle"],
    chambers: ["Chamber Management", "Stability chamber register"],
    loading: ["Chamber Loading", "Load samples and create the withdrawal schedule"],
    withdrawals: ["Withdrawal / Pulling", "Withdrawal queue by window"],
    earlypull: ["R&D Early Pull", "Advance sample withdrawal requests (add-on to the official schedule)"],
    products: ["Products", "Products and batches under stability"],
    schedule: ["Monthly Schedule", "Planned sample withdrawals by month"],
    samples: ["Samples", "All stability samples"],
    analysis: ["Analysis", "Analysis worklist, STP and results"],
    documentation: ["Documentation", "Auto-generated controlled documents"],
    "final-reports": ["Final Reports", "Assemble and approve the final stability report"],
    stp: ["STP Master", "Standard Test Procedures and versions"],
    users: ["Users & Roles", "Team, roles and access"],
    reports: ["Reports", "Per-time-point stability report generation"],
    report: ["Stability Report", "Preview and approval"],
    alerts: ["Alerts", "Today, upcoming and overdue"],
    audit: ["Audit Trail", "Change history"],
    data: ["Import / Export", "Monthly schedule data"],
    settings: ["Settings", "Rules, users and roles"],
    sample: ["Sample Detail", "Full sample record"],
    project: ["Project 360°", "One project, one lifecycle"],
    datasheet: ["Stability Data Sheet", "Cumulative time-point results"],
    protocoldoc: ["Stability Protocol", "Company format"]
  };

  function render() {
    route = parseHash();
    var target = route.name === "sample" ? "samples" : ((route.name === "project" || route.name === "datasheet" || route.name === "protocoldoc") ? "protocols" : route.name);
    var title = TITLES[route.name] || ["Dashboard", ""];
    document.getElementById("pageTitle").textContent = title[0];
    document.getElementById("pageSub").textContent = title[1];
    Array.prototype.forEach.call(document.querySelectorAll("[data-nav]"), function (a) {
      a.classList.toggle("active", a.getAttribute("data-nav") === target || (route.name === "report" && a.getAttribute("data-nav") === "reports"));
    });
    var html = (VIEWS[route.name] || VIEWS.dashboard)(route.param);
    document.getElementById("view").innerHTML = html;
    window.scrollTo(0, 0);
  }

  /* ---------- shared fragments ---------- */
  function demoNotice() {
    return '<div class="notice info"><strong>Source status (not an error).</strong> Supplied by you and loaded: the Stability Report format (Hetero R&D Kazipally, F-02-01/ARD015), the Trofinetide study, and the Anastrozole Protocol + STP AL-009-04 (tests, specifications, theory). Not yet supplied: the Monthly Stability Excel file — load your own sheet via Import. Only values you enter or import are shown as results; any unsourced value is labelled, and no unproven value is presented as approved.</div>';
  }
  function kpi(label, val, note, cls) {
    return '<div class="card kpi ' + (cls || "") + '"><div class="lbl">' + h(label) + '</div><div class="val num">' + val + '</div><div class="note">' + h(note || "") + "</div></div>";
  }
  function productOptions() {
    var codes = uniq(S.samples.map(function (s) { return s.productCode; })).sort();
    return '<option value="">All products</option>' + codes.map(function (c) {
      var p = S.samples.filter(function (s) { return s.productCode === c; })[0];
      return '<option value="' + h(c) + '"' + (filters.product === c ? " selected" : "") + ">" + h(c + " — " + p.product) + "</option>";
    }).join("");
  }
  function statusOptions() {
    var seen = {};
    return Object.keys(SD.STATUS).map(function (k) {
      var d = SD.STATUS[k]; if (seen[d.code]) return ""; seen[d.code] = 1;
      return '<option value="' + d.code + '"' + (filters.status === d.code ? " selected" : "") + ">" + h(d.label) + "</option>";
    }).join("");
  }
  function analystOptions() {
    var list = uniq(S.samples.map(function (s) { return s.analyst; })).sort();
    return '<option value="">All analysts</option>' + list.map(function (a) {
      return '<option value="' + h(a) + '"' + (filters.analyst === a ? " selected" : "") + ">" + h(a) + "</option>";
    }).join("");
  }
  function filteredSamples() {
    var s = filters.search.toLowerCase();
    return S.samples.filter(function (x) {
      var st = statusOf(x).def.code;
      if (s) {
        var hay = [x.product, x.productCode, x.batch, x.protocolNo, x.sampleId, x.timePointLabel].join(" ").toLowerCase();
        if (hay.indexOf(s) < 0) return false;
      }
      if (filters.product && x.productCode !== filters.product) return false;
      if (filters.batch && x.batch !== filters.batch) return false;
      if (filters.status && st !== filters.status) return false;
      if (filters.storage && x.storageCondition !== filters.storage) return false;
      if (filters.analyst && x.analyst !== filters.analyst) return false;
      if (filters.timePoint && x.timePointLabel !== filters.timePoint) return false;
      return true;
    }).sort(function (a, b) { return (a.plannedWithdrawal || "").localeCompare(b.plannedWithdrawal || ""); });
  }

  /* ---------- views ---------- */
  var VIEWS = {};

  VIEWS.dashboard = function () {
    var c = counts();
    var wl = monthlyWorkload();
    var maxTotal = Math.max.apply(null, wl.map(function (m) { return m.total; }).concat([1]));
    var bars = wl.map(function (m) {
      var scale = 150 / maxTotal;
      return '<div class="bcol" data-act="set-month" data-month="' + m.key + '" title="' + dates.monthLabel(m.key) + ': ' + m.total + ' planned" style="cursor:pointer">' +
        '<div class="mtotal num">' + m.total + "</div>" +
        '<div class="stack">' +
        '<div class="seg overdue" style="height:' + Math.round(m.overdue * scale) + 'px" title="' + m.overdue + ' overdue"></div>' +
        '<div class="seg pending" style="height:' + Math.round(m.pending * scale) + 'px" title="' + m.pending + ' pending"></div>' +
        '<div class="seg done" style="height:' + Math.round(m.done * scale) + 'px" title="' + m.done + ' completed"></div>' +
        "</div>" +
        '<div class="mlabel">' + dates.monthLabel(m.key).slice(0, 3) + "<br>" + m.key.slice(2, 4) + "</div></div>";
    }).join("");

    var overdue = S.samples.filter(function (s) {
      var st = statusOf(s).def.code; return st === "ANALYSIS_OVERDUE" || st === "WITHDRAWAL_OVERDUE";
    });

    var dueTodayWd = S.samples.filter(function (s) { return s.plannedWithdrawal === today() && !s.actualWithdrawal; });
    var dueTodayAn = S.samples.filter(function (s) { var d = computeDatesFor(s); return d.analysisDue === today() && !s.analysisCompleteDate; });
    var reportsPending = S.samples.filter(function (s) { return s.analysisCompleteDate && s.reportStatus !== "approved"; });

    var upcoming = [];
    S.samples.forEach(function (s) {
      var d = computeDatesFor(s);
      if (s.plannedWithdrawal && !s.actualWithdrawal) {
        var n = dates.diffDays(today(), s.plannedWithdrawal);
        if (n > 0 && n <= 7) upcoming.push({ when: s.plannedWithdrawal, kind: "Withdrawal", s: s });
      }
      if (d.analysisDue && !s.analysisCompleteDate) {
        var m = dates.diffDays(today(), d.analysisDue);
        if (m > 0 && m <= 7) upcoming.push({ when: d.analysisDue, kind: "Analysis due", s: s });
      }
    });
    upcoming.sort(function (a, b) { return a.when.localeCompare(b.when); });

    function alertRow(s, whenLabel) {
      return '<div class="alert-item"><div class="timeline-dot"></div><div class="grow"><div class="t">' + h(s.productCode + " · " + s.batch + " · " + s.timePointLabel) + '</div><div class="m">' + h(s.sampleId + " — " + whenLabel) + "</div></div>" +
        '<button class="btn small" data-act="open-sample" data-id="' + s.id + '">Open</button></div>';
    }

    return demoNotice() +
      '<div class="toolbar"><a class="btn primary" href="#/data">Excel Import / Export</a>' +
      '<a class="btn" href="#/schedule">Monthly Schedule</a>' +
      '<a class="btn" href="#/datasheet/panz">Anastrozole Data Sheet</a>' +
      '<div class="grow"></div></div>' +
      '<div class="kpis">' +
      kpi("Total Samples", c.total, c.products + " products", "accent") +
      kpi("Due Today", c.dueToday, "withdrawal or analysis", "warn") +
      kpi("In Analysis", c.inAnalysis, c.dueSoon + " due soon", "info") +
      kpi("Overdue", c.analysisOverdue + c.withdrawalOverdue, c.analysisOverdue + " analysis · " + c.withdrawalOverdue + " withdrawal", "danger") +
      "</div>" +
      '<div class="kpis" style="margin-top:14px">' +
      kpi("This Week", c.thisWeek, "withdrawals next 7 days") +
      kpi("This Month", c.thisMonth, "planned withdrawals") +
      kpi("Pending Withdrawal", c.pendingWd, "not yet withdrawn") +
      kpi("Reports Pending", c.reportsPending, c.underReview + " under review", "warn") +
      "</div>" +
      '<div class="kpis" style="margin-top:14px">' +
      kpi("Completed", c.completed, "report approved", "success") +
      kpi("On Hold", c.onHold, "temporarily stopped") +
      kpi("Awaiting Review", c.underReview, "results entered") +
      kpi("Withdrawn", c.withdrawn, "analysis not started") +
      "</div>" +

      '<div class="kpis" style="margin-top:14px">' +
      kpi("Pending Approval", lifecycleCounts().pendingApproval, "protocols not approved", "warn") +
      kpi("Pending Packing", lifecycleCounts().pendingPacking, "approved, not packed") +
      kpi("In Chambers", lifecycleCounts().inChambers, "loaded studies") +
      kpi("Completed Studies", lifecycleCounts().completed, "final report approved", "success") +
      "</div>" +

      '<h3 class="section-title">Next Actions <span class="hint">what each project needs now</span></h3>' +
      '<div class="card"><div class="card-b list">' +
      S.protocols.map(function (p) {
        var na = SD.lifecycle.nextAction(S, p.id);
        var control = na.act
          ? '<button class="btn small primary" data-act="' + na.act + '" data-id="' + p.id + '">' + h(na.label) + "</button>"
          : '<a class="btn small" href="' + h(na.route) + '">' + h(na.label) + "</a>";
        return '<div class="row"><div class="grow"><a href="#/project/' + p.id + '"><strong>' + h(p.product) + "</strong></a> <span class=\"muted\">" + h(p.protocolNo) + "</span></div>" + control + "</div>";
      }).join("") +
      "</div></div>" +

      '<h3 class="section-title">Monthly Workload <span class="hint">click a month to drill down</span></h3>' +
      '<div class="card"><div class="card-b"><div class="bars">' + bars + "</div>" +
      '<div class="legend"><span class="k"><span class="sw" style="background:var(--success)"></span>Completed</span>' +
      '<span class="k"><span class="sw" style="background:var(--info)"></span>Pending</span>' +
      '<span class="k"><span class="sw" style="background:var(--danger)"></span>Overdue</span></div></div></div>' +

      '<div class="grid-3" style="margin-top:22px">' +
      '<div class="card"><div class="card-h"><h3>Today\'s Actions</h3></div><div class="card-b">' +
      (dueTodayWd.length || dueTodayAn.length || reportsPending.length
        ? dueTodayWd.map(function (s) { return alertRow(s, "Withdrawal due today"); }).join("") +
          dueTodayAn.map(function (s) { return alertRow(s, "Analysis due today"); }).join("") +
          reportsPending.slice(0, 3).map(function (s) { return alertRow(s, "Report pending"); }).join("")
        : '<div class="muted">Nothing due today.</div>') +
      "</div></div>" +
      '<div class="card"><div class="card-h"><h3>Overdue Items</h3><span class="hint">' + overdue.length + "</span></div><div class=\"card-b\">" +
      (overdue.length ? overdue.map(function (s) { var d = statusOf(s); return alertRow(s, d.def.label); }).join("") : '<div class="muted">No overdue items.</div>') +
      "</div></div>" +
      '<div class="card"><div class="card-h"><h3>Upcoming 7 Days</h3><span class="hint">' + upcoming.length + "</span></div><div class=\"card-b\">" +
      (upcoming.length ? upcoming.slice(0, 8).map(function (u) { return alertRow(u.s, u.kind + " · " + fmt(u.when)); }).join("") : '<div class="muted">Nothing in the next 7 days.</div>') +
      "</div></div>" +
      "</div>" +

      '<h3 class="section-title">Recent Activity <span class="hint">audit trail</span></h3>' +
      '<div class="card"><div class="card-b audit">' + S.audit.slice(0, 6).map(auditRow).join("") + "</div></div>";
  };

  VIEWS.protocols = function () {
    var list = S.protocols.filter(function (p) { return !protoFilter || SD.lifecycle.protocolStatus(S, p.id) === protoFilter; });
    var rows = list.map(function (p) {
      var ps = SD.lifecycle.protocolStatus(S, p.id), pr = projectOf(p.id);
      return "<tr>" +
        '<td><a href="#/project/' + p.id + '"><strong>' + h(p.protocolNo) + '</strong></a><div style="margin-top:4px">' + protoBadge(ps) + "</div></td>" +
        '<td class="wrap">' + h(p.product) + "</td>" +
        "<td>" + h(p.productCode) + "</td>" +
        "<td>" + h(p.batches.join(", ")) + "</td>" +
        "<td>" + h(p.timePoints.join(", ") + " M") + "</td>" +
        "<td>" + (pr.er ? h(pr.er.erNumber) : "—") + "</td>" +
        '<td style="white-space:nowrap"><button class="btn small" data-act="protocol-open" data-id="' + p.id + '">View</button> <a class="btn small" href="#/project/' + p.id + '">360°</a></td>' +
        "</tr>";
    }).join("");
    var opts = [["", "All statuses"], ["DRAFT", "Draft"], ["UNDER_REVIEW", "Under review"], ["PENDING_GL", "Pending Group Leader"], ["CHANGES_REQUESTED", "Changes requested"], ["APPROVED", "Approved"]];
    var sel = opts.map(function (o) { return '<option value="' + o[0] + '"' + (protoFilter === o[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join("");
    return '<div class="toolbar"><div><label class="fld">Status</label><select class="select" data-act="proto-filter" style="min-width:190px">' + sel + "</select></div>" +
      '<div class="grow"></div><button class="btn primary" data-act="new-protocol">+ New Protocol</button></div>' +
      '<div class="card"><div class="table-wrap"><table class="data"><thead><tr>' +
      "<th>Protocol No / Status</th><th>Product</th><th>Code</th><th>Batch(es)</th><th>Time Points</th><th>ER</th><th></th>" +
      "</tr></thead><tbody>" + (rows || '<tr><td colspan="7"><div class="empty">No protocols for this status.</div></td></tr>') + "</tbody></table></div></div>";
  };

  VIEWS.products = function () {
    var map = {};
    S.samples.forEach(function (s) {
      if (!map[s.productCode]) map[s.productCode] = { product: s.product, code: s.productCode, batches: {}, storage: {}, samples: 0, protocol: s.protocolNo };
      map[s.productCode].batches[s.batch] = 1;
      map[s.productCode].storage[s.storageCondition] = 1;
      map[s.productCode].samples++;
    });
    var rows = Object.keys(map).sort().map(function (k) {
      var p = map[k];
      return "<tr><td><strong>" + h(p.product) + "</strong></td><td>" + h(p.code) + "</td><td>" + h(Object.keys(p.batches).join(", ")) + "</td>" +
        '<td class="wrap">' + h(Object.keys(p.storage).join(" | ")) + "</td><td>" + h(p.protocol) + '</td><td class="num">' + p.samples + "</td>" +
        '<td><button class="btn small" data-act="filter-product" data-code="' + h(p.code) + '">View samples</button></td></tr>';
    }).join("");
    return '<div class="card"><div class="table-wrap"><table class="data"><thead><tr><th>Product</th><th>Code</th><th>Batch(es)</th><th>Storage Condition</th><th>Protocol</th><th>Samples</th><th></th></tr></thead><tbody>' + rows + "</tbody></table></div></div>";
  };

  VIEWS.schedule = function () {
    var months = monthsInData();
    if (months.indexOf(scheduleMonth) < 0) scheduleMonth = months[months.length - 1];
    var opts = months.map(function (m) { return '<option value="' + m + '"' + (m === scheduleMonth ? " selected" : "") + ">" + dates.monthLabel(m) + "</option>"; }).join("");
    var rows = S.samples.filter(function (s) { return dates.monthKey(s.plannedWithdrawal) === scheduleMonth; })
      .sort(function (a, b) { return (a.plannedWithdrawal || "").localeCompare(b.plannedWithdrawal || ""); });
    var body = rows.length ? rows.map(function (s) {
      var d = computeDatesFor(s), st = statusOf(s);
      return "<tr>" +
        '<td class="wrap"><a href="#/sample/' + s.id + '">' + h(s.product) + "</a></td>" +
        "<td>" + h(s.productCode) + "</td><td>" + h(s.batch) + "</td><td>" + h(s.timePointLabel) + "</td>" +
        "<td>" + fmt(s.plannedWithdrawal) + "</td>" +
        '<td>' + (s.actualWithdrawal ? fmt(s.actualWithdrawal) : "—") + "</td>" +
        '<td>' + (d.analysisDue ? fmt(d.analysisDue) : "—") + "</td>" +
        "<td>" + statusBadge(st.def) + "</td>" +
        '<td style="white-space:nowrap">' +
        (!s.actualWithdrawal ? '<button class="btn small primary" data-act="wd-open" data-id="' + s.id + '">Withdraw</button> ' : "") +
        '<button class="btn small" data-act="open-sample" data-id="' + s.id + '">Open</button></td></tr>';
    }).join("") : '<tr><td colspan="9"><div class="empty"><div class="big">No samples planned in this month</div>Choose another month.</div></td></tr>';
    return '<div class="toolbar"><div><label class="fld">Month</label><select class="select" data-act="month-select" style="min-width:200px">' + opts + "</select></div>" +
      '<div class="grow"></div><button class="btn" data-act="export-month">Export month CSV</button></div>' +
      '<div class="card"><div class="table-wrap"><table class="data"><thead><tr><th>Product</th><th>Code</th><th>Batch</th><th>Time Point</th><th>Planned Withdrawal</th><th>Actual Withdrawal</th><th>Analysis Due</th><th>Status</th><th>Actions</th></tr></thead><tbody>' + body + "</tbody></table></div></div>";
  };

  VIEWS.samples = function () {
    var list = filteredSamples();
    var body = list.length ? list.map(function (s) {
      var st = statusOf(s), d = computeDatesFor(s);
      return "<tr>" +
        '<td><a href="#/sample/' + s.id + '">' + h(s.sampleId) + "</a></td>" +
        '<td class="wrap">' + h(s.product) + "</td><td>" + h(s.productCode) + "</td><td>" + h(s.batch) + "</td>" +
        "<td>" + h(s.protocolNo) + "</td><td>" + h(s.timePointLabel) + "</td>" +
        "<td>" + fmt(s.plannedWithdrawal) + "</td>" +
        "<td>" + (s.actualWithdrawal ? fmt(s.actualWithdrawal) : "—") + "</td>" +
        "<td>" + (d.analysisDue ? fmt(d.analysisDue) : "—") + "</td>" +
        "<td>" + h(s.analyst) + "</td>" +
        "<td>" + statusBadge(st.def) + "</td>" +
        '<td><button class="btn small" data-act="open-sample" data-id="' + s.id + '">Open</button></td></tr>';
    }).join("") : '<tr><td colspan="12"><div class="empty"><div class="big">No samples match</div>Clear one or more filters.</div></td></tr>';
    return '<div class="toolbar">' +
      '<div><label class="fld">Search</label><input class="input" data-filter="search" value="' + h(filters.search) + '" placeholder="sample, product, batch…" /></div>' +
      '<div><label class="fld">Product</label><select class="select" data-filter="product">' + productOptions() + "</select></div>" +
      '<div><label class="fld">Status</label><select class="select" data-filter="status"><option value="">All statuses</option>' + statusOptions() + "</select></div>" +
      '<div><label class="fld">Analyst</label><select class="select" data-filter="analyst">' + analystOptions() + "</select></div>" +
      '<div class="grow"></div><button class="btn" data-act="export-samples">Export CSV</button>' +
      '<button class="btn ghost" data-act="clear-filters">Clear</button></div>' +
      '<div class="card"><div class="table-wrap"><table class="data"><thead><tr>' +
      "<th>Sample ID</th><th>Product</th><th>Code</th><th>Batch</th><th>Protocol</th><th>Time Point</th><th>Planned</th><th>Actual</th><th>Analysis Due</th><th>Analyst</th><th>Status</th><th></th>" +
      "</tr></thead><tbody>" + body + "</tbody></table></div></div>";
  };

  VIEWS.analysis = function () {
    var work = S.samples.filter(function (s) {
      var st = statusOf(s).def.code;
      return st === "IN_ANALYSIS" || st === "ANALYSIS_DUE_SOON" || st === "ANALYSIS_OVERDUE" || st === "WITHDRAWN";
    }).sort(function (a, b) { var da = computeDatesFor(a).analysisDue || "9999"; var db = computeDatesFor(b).analysisDue || "9999"; return da.localeCompare(db); });
    var rows = work.map(function (s) {
      var st = statusOf(s), d = computeDatesFor(s);
      return "<tr>" +
        '<td><a href="#/sample/' + s.id + '">' + h(s.sampleId) + "</a></td>" +
        '<td class="wrap">' + h(s.product) + "</td><td>" + h(s.batch) + "</td><td>" + h(s.timePointLabel) + "</td>" +
        "<td>" + (s.actualWithdrawal ? fmt(s.actualWithdrawal) : "—") + "</td>" +
        "<td>" + (d.analysisDue ? fmt(d.analysisDue) : "—") + "</td>" +
        "<td>" + h(s.analyst) + "</td>" +
        "<td>" + statusBadge(st.def) + "</td>" +
        '<td>' + (s.analysisStart ? '<button class="btn small" data-act="results-open" data-id="' + s.id + '">Enter results</button>' : '<button class="btn small primary" data-act="start-analysis" data-id="' + s.id + '">Start</button>') + "</td></tr>";
    }).join("");
    return '<div class="toolbar"><div class="grow"></div><button class="btn primary" data-act="ws-new">+ New analysis worksheet (STP)</button></div>' +
      '<div class="card"><div class="card-h"><h3>Analysis Worklist</h3><span class="hint">withdrawn, in analysis, due soon or overdue</span></div><div class="table-wrap"><table class="data"><thead><tr>' +
      "<th>Sample ID</th><th>Product</th><th>Batch</th><th>Time Point</th><th>Withdrawn</th><th>Analysis Due</th><th>Analyst</th><th>Status</th><th>Action</th>" +
      "</tr></thead><tbody>" + (rows || '<tr><td colspan="9"><div class="empty"><div class="big">No samples in the analysis queue</div></div></td></tr>') + "</tbody></table></div></div>";
  };

  VIEWS.reports = function () {
    var list = S.samples.filter(function (s) { return !!s.analysisCompleteDate; })
      .sort(function (a, b) { return (a.analysisCompleteDate || "").localeCompare(b.analysisCompleteDate || ""); });
    var rows = list.map(function (s) {
      var label = s.reportStatus === "approved" ? '<span class="badge tone-success"><span class="dot"></span>Approved</span>'
        : s.reportStatus === "generated" ? '<span class="badge tone-warn"><span class="dot"></span>Generated</span>'
        : '<span class="badge tone-muted"><span class="dot"></span>Not started</span>';
      return "<tr>" +
        '<td><a href="#/sample/' + s.id + '">' + h(s.sampleId) + "</a></td>" +
        '<td class="wrap">' + h(s.product) + "</td><td>" + h(s.batch) + "</td><td>" + h(s.timePointLabel) + "</td>" +
        "<td>" + fmt(s.analysisCompleteDate) + "</td><td>" + (s.arNumber ? h(s.arNumber) : "—") + "</td><td>" + label + "</td>" +
        '<td style="white-space:nowrap">' +
        (s.reportStatus === "not_started" ? '<button class="btn small primary" data-act="report-generate" data-id="' + s.id + '">Generate</button> ' : "") +
        '<button class="btn small" data-act="report-preview" data-id="' + s.id + '">Preview</button> ' +
        (s.reportStatus === "generated" ? '<button class="btn small" data-act="report-approve" data-id="' + s.id + '">Approve</button>' : "") +
        "</td></tr>";
    }).join("");
    return demoNotice() +
      '<div class="card"><div class="card-h"><h3>Stability Reports</h3><span class="hint">from the approved report format</span></div><div class="table-wrap"><table class="data"><thead><tr>' +
      "<th>Sample ID</th><th>Product</th><th>Batch</th><th>Time Point</th><th>Analysis Completed</th><th>AR No</th><th>Report Status</th><th>Actions</th>" +
      "</tr></thead><tbody>" + (rows || '<tr><td colspan="7"><div class="empty"><div class="big">No completed analyses yet</div>Complete an analysis to generate a report.</div></td></tr>') + "</tbody></table></div></div>";
  };

  VIEWS.report = function (id) {
    var s = store.getSample(id);
    if (!s) return notFound();
    return '<div class="toolbar"><button class="btn" data-act="back">← Back</button><div class="grow"></div>' +
      '<button class="btn" onclick="window.print()">Print / Save PDF</button>' +
      (s.reportStatus === "generated" ? '<button class="btn primary" data-act="report-approve" data-id="' + s.id + '">Approve report</button>' : "") +
      (s.reportStatus === "not_started" ? '<button class="btn primary" data-act="report-generate" data-id="' + s.id + '">Generate report</button>' : "") +
      "</div>" + reportHTML(s);
  };

  VIEWS.sample = function (id) {
    var s = store.getSample(id);
    if (!s) return notFound();
    var p = protocolOf(s.protocolId);
    var st = statusOf(s), d = computeDatesFor(s);
    var results = S.results[s.sampleId] || [];
    var role = S.role;
    var canRecord = role !== "Reviewer";
    var canApprove = role === "Reviewer" || role === "Manager" || role === "Admin";

    var testsRows = results.map(function (r) {
      var def = SD.testById(r.testId) || {};
      var tone = r.status === "within_spec" ? "success" : r.status === "out_of_spec" ? "danger" : r.status === "na" ? "muted" : "muted";
      var lbl = r.status === "within_spec" ? "Within specification" : r.status === "out_of_spec" ? "Out of specification" : r.status === "na" ? "Not applicable" : "Pending";
      return "<tr><td>" + (def.section ? '<span class="pill">' + h(def.section) + "</span> " : "") + h(r.test) + '</td><td class="wrap">' + h(r.method) + '</td><td class="wrap">' + h(r.specification) + "</td>" +
        '<td class="num">' + h(r.result || "—") + "</td><td>" + h(r.unit) + "</td>" +
        '<td><span class="badge tone-' + tone + '"><span class="dot"></span>' + lbl + "</span></td>" +
        "<td>" + h(r.analyst || "—") + "</td></tr>";
    }).join("");

    var actions = [];
    if (!s.actualWithdrawal && canRecord) actions.push('<button class="btn primary" data-act="wd-open" data-id="' + s.id + '">Record actual withdrawal</button>');
    if (s.actualWithdrawal && !s.analysisStart && canRecord) actions.push('<button class="btn primary" data-act="start-analysis" data-id="' + s.id + '">Start analysis</button>');
    if (s.analysisStart && canRecord) actions.push('<button class="btn" data-act="results-open" data-id="' + s.id + '">Enter / edit results</button>');
    if (s.analysisStart && !s.analysisCompleteDate && allResultsEntered(s) && canRecord) actions.push('<button class="btn primary" data-act="complete-analysis" data-id="' + s.id + '">Mark analysis complete</button>');
    if (s.analysisCompleteDate && s.reviewStatus !== "approved" && canApprove) actions.push('<button class="btn primary" data-act="review-approve" data-id="' + s.id + '">Approve review</button>');
    if (s.reviewStatus === "approved" && s.reportStatus === "not_started" && canRecord) actions.push('<button class="btn primary" data-act="report-generate" data-id="' + s.id + '">Generate report</button>');
    if (s.reportStatus !== "not_started") actions.push('<button class="btn" data-act="report-preview" data-id="' + s.id + '">Preview report</button>');

    return '<div class="toolbar"><button class="btn" data-act="back">← Back</button>' +
      '<div class="grow"></div><span class="eyebrow" style="align-self:center">' + statusBadge(st.def) + "</span>" +
      actions.join(" ") + "</div>" +
      (s.hold ? '<div class="notice"><strong>On hold.</strong> ' + h(s.holdReason || "") + "</div>" : "") +

      '<div class="grid-2">' +
      '<div class="card"><div class="card-h"><h3>Product Information</h3></div><div class="card-b"><dl class="meta">' +
      "<dt>Sample ID</dt><dd>" + h(s.sampleId) + "</dd>" +
      "<dt>Product</dt><dd>" + h(s.product) + "</dd>" +
      "<dt>Product Code</dt><dd>" + h(s.productCode) + "</dd>" +
      "<dt>Batch No</dt><dd>" + h(s.batch) + "</dd>" +
      "<dt>Protocol No</dt><dd>" + h(s.protocolNo) + " (" + h(p.version) + ")</dd>" +
      "<dt>Manufacturing Date</dt><dd>" + fmt(s.manufacturingDate) + "</dd>" +
      "<dt>Expiry Date</dt><dd>" + fmt(s.expiryDate) + "</dd>" +
      "</dl></div></div>" +
      '<div class="card"><div class="card-h"><h3>Stability Information</h3></div><div class="card-b"><dl class="meta">' +
      "<dt>Storage Condition</dt><dd>" + h(s.storageCondition) + "</dd>" +
      "<dt>Pack</dt><dd>" + h(s.pack) + "</dd>" +
      "<dt>Time Point</dt><dd>" + h(s.timePointLabel) + "</dd>" +
      "<dt>Withdrawal Window</dt><dd>planned date to + " + S.settings.withdrawalWindowDays + " days</dd>" +
      "<dt>Analysis Timeline</dt><dd>" + S.settings.analysisDueDays + " days from actual withdrawal</dd>" +
      "</dl></div></div>" +
      "</div>" +

      '<div class="grid-2" style="margin-top:14px">' +
      '<div class="card"><div class="card-h"><h3>Withdrawal</h3></div><div class="card-b"><dl class="meta">' +
      "<dt>Planned</dt><dd>" + fmt(s.plannedWithdrawal) + "</dd>" +
      "<dt>Earliest Permissible</dt><dd>" + fmt(d.earliestWithdrawal) + "</dd>" +
      "<dt>Latest Permissible</dt><dd>" + fmt(d.latestWithdrawal) + "</dd>" +
      "<dt>Actual Withdrawal</dt><dd>" + (s.actualWithdrawal ? fmt(s.actualWithdrawal) : '<span class="badge tone-muted"><span class="dot"></span>Not withdrawn</span>') + "</dd>" +
      "</dl></div></div>" +
      '<div class="card"><div class="card-h"><h3>Analysis</h3></div><div class="card-b"><dl class="meta">' +
      "<dt>Start Date</dt><dd>" + (s.analysisStart ? fmt(s.analysisStart) : "—") + "</dd>" +
      "<dt>Analysis Due</dt><dd>" + (d.analysisDue ? fmt(d.analysisDue) : "—") + "</dd>" +
      "<dt>Completion Date</dt><dd>" + (s.analysisCompleteDate ? fmt(s.analysisCompleteDate) : "—") + "</dd>" +
      "<dt>AR No (Analysis Report)</dt><dd>" + (s.arNumber ? h(s.arNumber) : "—") + "</dd>" +
      "<dt>Analyst</dt><dd>" + h(s.analyst) + "</dd>" +
      "<dt>Reviewer</dt><dd>" + h(s.reviewer) + "</dd>" +
      "<dt>Review Status</dt><dd>" + h(s.reviewStatus) + "</dd>" +
      "</dl></div></div>" +
      "</div>" +

      '<h3 class="section-title">Tests &amp; Results <span class="hint">' + results.length + " tests from protocol " + h(s.protocolNo) + "</span></h3>" +
      '<div class="card"><div class="table-wrap"><table class="data"><thead><tr><th>Test</th><th>Method</th><th>Specification</th><th>Result</th><th>Unit</th><th>Status</th><th>Analyst</th></tr></thead><tbody>' +
      (testsRows || '<tr><td colspan="7"><div class="empty">No tests defined for this protocol.</div></td></tr>') + "</tbody></table></div></div>" +

      '<h3 class="section-title">Audit History <span class="hint">this sample</span></h3>' +
      '<div class="card"><div class="card-b audit">' +
      (S.audit.filter(function (a) { return a.entityId === s.id || a.entityId === s.sampleId; }).slice(0, 10).map(auditRow).join("") || '<div class="muted">No changes recorded.</div>') +
      "</div></div>";
  };

  VIEWS.alerts = function () {
    var t = today();
    var dueToday = [], upcoming = [], overdue = [];
    S.samples.forEach(function (s) {
      var st = statusOf(s).def.code, d = computeDatesFor(s);
      if (s.plannedWithdrawal === t && !s.actualWithdrawal) dueToday.push({ s: s, label: "Withdrawal due today" });
      if (d.analysisDue === t && !s.analysisCompleteDate) dueToday.push({ s: s, label: "Analysis due today" });
      if (s.analysisCompleteDate && s.reportStatus !== "approved") dueToday.push({ s: s, label: "Report pending" });
      if (st === "ANALYSIS_OVERDUE" || st === "WITHDRAWAL_OVERDUE") overdue.push({ s: s, label: statusOf(s).def.label });
      if (s.plannedWithdrawal && !s.actualWithdrawal) { var n = dates.diffDays(t, s.plannedWithdrawal); if (n > 0 && n <= 7) upcoming.push({ s: s, label: "Withdrawal " + fmt(s.plannedWithdrawal) }); }
      if (d.analysisDue && !s.analysisCompleteDate) { var m = dates.diffDays(t, d.analysisDue); if (m > 0 && m <= 7) upcoming.push({ s: s, label: "Analysis due " + fmt(d.analysisDue) }); }
    });
    function col(title, arr, tone) {
      return '<div class="card"><div class="card-h"><h3>' + title + '</h3><span class="hint">' + arr.length + '</span></div><div class="card-b alert-col">' +
        (arr.length ? arr.map(function (x) {
          return '<div class="alert-item"><span class="badge tone-' + tone + '"><span class="dot"></span>' + h(x.label) + '</span><div class="grow"><div class="t">' + h(x.s.productCode + " · " + x.s.batch) + '</div><div class="m">' + h(x.s.sampleId + " · " + x.s.timePointLabel) + "</div></div>" +
            '<button class="btn small" data-act="open-sample" data-id="' + x.s.id + '">Open</button></div>';
        }).join("") : '<div class="muted">None.</div>') + "</div></div>";
    }
    function epItems(list, label) {
      return list.map(function (ep) { var s = sampleByRef(ep.sampleRef); return s ? { s: s, label: label + " · " + ep.id + " (" + fmt(ep.requestedDate) + ")" } : null; }).filter(Boolean);
    }
    var epReviewer = epItems((S.pulls || []).filter(function (ep) { return ep.status === "SUBMITTED"; }), "Awaiting Reviewer");
    var epGL = epItems((S.pulls || []).filter(function (ep) { return ep.status === "REVIEWER_APPROVED"; }), "Awaiting Group Leader");
    var epApprovedItems = (S.pulls || []).filter(function (ep) { return ep.status === "APPROVED"; })
      .map(function (ep) { var n = dates.diffDays(t, ep.requestedDate); return n <= 7 ? { ep: ep, n: n } : null; }).filter(Boolean)
      .map(function (x) { var s = sampleByRef(x.ep.sampleRef); return s ? { s: s, label: (x.n < 0 ? "Overdue · " : "Due in " + x.n + "d · ") + x.ep.id } : null; }).filter(Boolean);
    return '<div class="grid-3">' + col("Today", dueToday, "warn") + col("Next 7 Days", upcoming, "info") + col("Overdue", overdue, "danger") + "</div>";
  };

  function auditRow(a) {
    var delta = "";
    if (a.field) {
      delta = " <span class=\"delta\">" + h(a.field) + ": <code>" + h(a.oldValue === null || a.oldValue === "" ? "—" : a.oldValue) + "</code> → <code>" + h(a.newValue === null || a.newValue === "" ? "—" : a.newValue) + "</code></span>";
    }
    return '<div class="row"><div class="who">' + h(a.user) + '</div><div class="when">' + h(a.at) + '</div><div class="what">' +
      h(a.action.toUpperCase()) + " · " + h(a.entity) + " " + h(a.entityId) + delta + (a.note ? " — " + h(a.note) : "") + "</div></div>";
  }

  VIEWS.audit = function () {
    var rows = S.audit.slice(0, 200).map(auditRow).join("");
    return '<div class="toolbar"><div class="grow"></div><span class="eyebrow" style="align-self:center">' + S.audit.length + " entries</span></div>" +
      '<div class="card"><div class="card-b audit">' + (rows || '<div class="muted">No changes recorded.</div>') + "</div></div>";
  };

  VIEWS.data = function () {
    var sampleCount = S.samples.length;
    return demoNotice() +
      '<div class="grid-2">' +
      '<div class="card"><div class="card-h"><h3>Export</h3><span class="hint">same sheet back / Excel / CSV</span></div><div class="card-b">' +
      '<p class="muted">Uploaded file: <strong id="sheetName">' + h(S.sheet && S.sheet.name ? S.sheet.name : "none") + "</strong>" + (S.sheet && S.sheet.size ? " (" + Math.round(S.sheet.size / 1024) + " KB)" : "") + " · " + sampleCount + " samples in total.</p>" +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button class="btn primary" data-act="export-original">Download uploaded file (exact)</button>' +
      '<button class="btn primary" data-act="export-same">Download Excel (same columns)</button>' +
      '<button class="btn" data-act="export-excel">Download Excel (.xls)</button>' +
      '<button class="btn" data-act="export-samples">Full data CSV</button>' +
      '<button class="btn" data-act="export-month">Monthly schedule CSV</button>' +
      '<button class="btn" data-act="export-pending">Pending withdrawals</button>' +
      '<button class="btn" data-act="export-overdue">Overdue</button>' +
      '<button class="btn" data-act="export-completed">Completed</button>' +
      "</div>" +
      '<p class="muted" style="margin-top:10px">"Download uploaded file" gives back the exact file you imported. "Download Excel (same columns)" gives a spreadsheet with the same column headings you imported, filled from the dashboard.</p>' +
      "</div></div>" +
      '<div class="card"><div class="card-h"><h3>Import Monthly Schedule</h3><span class="hint">Excel / CSV / pasted rows</span></div><div class="card-b">' +
      '<p class="muted">Choose your Excel/CSV file (it is kept exactly and can be downloaded back), or paste rows. Required columns: <span class="kbd">Product</span>, <span class="kbd">Batch</span>, <span class="kbd">Planned Withdrawal</span>. Optional: Product Code, Protocol No, Storage Condition, Time Point.</p>' +
      '<input type="file" id="csvFile" accept=".csv,.txt,.xlsx,.xls" class="input" />' +
      '<p class="muted" style="margin-top:6px">If a column cannot be mapped the preview flags it ("Column mapping required") and lets you correct the paste; invalid rows are shown and never silently dropped.</p>' +
      '<textarea id="csvText" class="input csv-area" style="margin-top:8px" placeholder="Product,Batch,Planned Withdrawal&#10;Product A,B001,15-Oct-2026"></textarea>' +
      '<div style="display:flex;gap:8px;margin-top:10px"><button class="btn primary" data-act="import-parse">Validate &amp; preview</button>' +
      '<button class="btn ghost" data-act="import-clear">Clear</button></div>' +
      '<div id="importResult" style="margin-top:14px"></div>' +
      "</div></div></div>" +
      '<div class="card" style="margin-top:14px"><div class="card-h"><h3>Data Model</h3><span class="hint">what this dashboard stores</span></div><div class="card-b">' +
      '<p class="muted">Protocol → Product → Batch → Storage Condition → Time Point → Scheduled Withdrawal → Actual Withdrawal → Analysis → Test Results → Review → Stability Report. Records persist in the browser (localStorage) for this demo; the TECH-STACK path is a Supabase Postgres schema that mirrors these columns.</p>' +
      "</div></div>";
  };

  VIEWS.settings = function () {
    return demoNotice() +
      '<div class="grid-2">' +
      '<div class="card"><div class="card-h"><h3>Timeline Rules</h3><span class="hint">source of truth for date logic</span></div><div class="card-b">' +
      '<label class="fld">Withdrawal window (days after planned date)</label><input class="input" id="setWindow" type="number" min="0" value="' + S.settings.withdrawalWindowDays + '" />' +
      '<label class="fld" style="margin-top:10px">Analysis completion timeline (days after actual withdrawal)</label><input class="input" id="setAnalysis" type="number" min="0" value="' + S.settings.analysisDueDays + '" />' +
      '<label class="fld" style="margin-top:10px">Report timeline (days after analysis completion)</label><input class="input" id="setReport" type="number" min="0" value="' + S.settings.reportDueDays + '" />' +
      '<div style="margin-top:14px"><button class="btn primary" data-act="settings-save">Save rules</button></div>' +
      '<p class="muted" style="margin-top:12px">If the approved protocol/SOP specifies different values, change them here; the status engine recalculates immediately.</p>' +
      "</div></div>" +
      '<div class="card"><div class="card-h"><h3>Data</h3></div><div class="card-b">' +
      "<p class=\"muted\">" + S.samples.length + " samples · " + S.protocols.length + " protocols · " + S.audit.length + " audit entries.</p>" +
      '<button class="btn danger" data-act="reset-demo">Reset demo data</button>' +
      '<p class="muted" style="margin-top:12px">Reset restores the labelled demo seed and clears local changes.</p>' +
      "</div></div>" +
      "</div>";
  };

  /* ================= LIFECYCLE MODULES ================= */

  var DOC_TYPES = ["Protocol", "Sample Packing Record", "Chamber Loading Record", "Withdrawal Record", "Analysis Summary", "Stability Data Sheet", "Stability Summary", "Final Stability Report"];

  VIEWS.packing = function () {
    var rows = S.protocols.map(function (p) {
      var pr = projectOf(p.id), ps = SD.lifecycle.protocolStatus(S, p.id);
      var action = pr.packing
        ? '<span class="pill">' + h(pr.packing.packingId) + " · " + h(fmt(pr.packing.date)) + "</span>"
        : (ps === "APPROVED" ? '<button class="btn small primary" data-act="pack-open" data-id="' + p.id + '">Pack samples</button>' : '<span class="badge tone-muted"><span class="dot"></span>Awaiting protocol approval</span>');
      return "<tr><td><a href=\"#/project/" + p.id + '">' + h(p.protocolNo) + '</a></td><td class="wrap">' + h(p.product) + "</td><td>" + h(p.batches.join(", ")) + '</td><td class="wrap">' + h(protocolConditions(p)) + "</td><td>" + h(p.timePoints.join(", ") + " M") + "</td><td>" + protoBadge(ps) + "</td><td>" + action + "</td></tr>";
    }).join("");
    return '<div class="card"><div class="card-h"><h3>Sample Packing</h3><span class="hint">approved protocols move here automatically</span></div><div class="table-wrap"><table class="data"><thead><tr><th>Protocol</th><th>Product</th><th>Batch</th><th>Condition</th><th>Time Points</th><th>Protocol Status</th><th>Packing</th></tr></thead><tbody>' + rows + "</tbody></table></div></div>";
  };

  VIEWS.er = function () {
    var rows = S.protocols.map(function (p) {
      var pr = projectOf(p.id);
      var er = pr.er ? '<strong>' + h(pr.er.erNumber) + "</strong>" : '<span class="muted">Not generated</span>';
      var action = pr.er ? '<a class="btn small" href="#/project/' + p.id + '">Trace</a>' : (pr.packing ? '<button class="btn small primary" data-act="er-generate" data-id="' + p.id + '">Generate ER</button>' : '<span class="muted">Pack first</span>');
      return "<tr><td>" + er + "</td><td>" + h(p.protocolNo) + '</td><td class="wrap">' + h(p.product) + "</td><td>" + h(p.batches.join(", ")) + "</td><td>" + (pr.loading ? h((pr.loading.conditions || [pr.loading]).map(function (c) { return c.chamberName; }).join(", ")) : "—") + "</td><td>" + (pr.loading ? h(protocolConditions(p)) : "—") + "</td><td>" + action + "</td></tr>";
    }).join("");
    return '<div class="notice"><strong>ER = traceability reference.</strong> The ER number links protocol → product → batch → packing → chamber → time point → withdrawal → analysis → final report. Generate it once; every later stage reuses it.</div>' +
      '<div class="card"><div class="table-wrap"><table class="data"><thead><tr><th>ER Number</th><th>Protocol</th><th>Product</th><th>Batch</th><th>Chamber</th><th>Condition</th><th></th></tr></thead><tbody>' + rows + "</tbody></table></div></div>";
  };

  VIEWS.chambers = function () {
    var rows = S.chambers.map(function (c) {
      return "<tr><td><strong>" + h(c.id) + "</strong></td><td>" + h(c.name) + "</td><td>" + h(c.temperature) + "</td><td>" + h(c.humidity) + "</td><td>" + h(c.location) + '</td><td class="num">' + h(c.capacity) + "</td><td>" + h(c.status) + "</td><td>" + h(c.qualification) + "</td></tr>";
    }).join("");
    return '<div class="toolbar"><div class="grow"></div><button class="btn primary" data-act="chamber-new">+ Add chamber / condition</button></div>' +
      '<div class="card"><div class="card-h"><h3>Stability Chamber Register</h3><span class="hint">conditions are configurable, not hard-coded</span></div><div class="table-wrap"><table class="data"><thead><tr><th>ID</th><th>Name</th><th>Temperature</th><th>Humidity</th><th>Location</th><th>Capacity</th><th>Status</th><th>Qualification</th></tr></thead><tbody>' + rows + "</tbody></table></div></div>";
  };

  VIEWS.loading = function () {
    var rows = S.protocols.map(function (p) {
      var pr = projectOf(p.id);
      var er = pr.er ? h(pr.er.erNumber) : "—";
      if (pr.loading) {
        var lconds = (pr.loading.conditions && pr.loading.conditions.length) ? pr.loading.conditions : [pr.loading];
        var pill = '<span class="pill">' + h(pr.loading.loadingId) + " · " + h(fmt(pr.loading.date)) + "</span>";
        return lconds.map(function (c) {
          return "<tr><td>" + er + '</td><td class="wrap">' + h(p.product) + "</td><td>" + h(c.chamberName || "—") + "</td><td>" + h(c.condition || c.chamberCondition || "—") + '</td><td class="wrap">' + h(c.rack + " / " + c.shelf) + "</td><td>" + pill + "</td></tr>";
        }).join("");
      }
      var action = pr.er ? '<button class="btn small primary" data-act="load-open" data-id="' + p.id + '">Load into chamber</button>' : '<span class="muted">Generate ER first</span>';
      return "<tr><td>" + er + '</td><td class="wrap">' + h(p.product) + '</td><td>—</td><td>—</td><td>—</td><td>' + action + "</td></tr>";
    }).join("");
    return '<div class="notice"><strong>Loading creates the schedule.</strong> Once a sample is loaded, the system generates one time-point record per protocol time point (Initial, 1M, 2M …) with its scheduled withdrawal date. Each protocol condition is loaded (and shown) separately.</div>' +
      '<div class="card"><div class="table-wrap"><table class="data"><thead><tr><th>ER Number</th><th>Product</th><th>Chamber</th><th>Condition</th><th>Rack / Shelf</th><th>Loading</th></tr></thead><tbody>' + rows + "</tbody></table></div></div>";
  };

  VIEWS.withdrawals = function () {
    var open = S.samples.filter(function (s) { return !s.actualWithdrawal; }).sort(function (a, b) { return (a.plannedWithdrawal || "").localeCompare(b.plannedWithdrawal || ""); });
    var rows = open.length ? open.map(function (s) {
      var d = computeDatesFor(s), st = statusOf(s), pr = projectOf(s.protocolId);
      return "<tr><td>" + (pr.er ? h(pr.er.erNumber) : "—") + '</td><td class="wrap">' + h(s.product) + "</td><td>" + h(s.batch) + "</td><td>" + h(s.storageCondition) + "</td><td>" + h(s.timePointLabel) + "</td>" +
        "<td>" + fmt(s.plannedWithdrawal) + "</td>" +
        "<td>" + fmt(d.earliestWithdrawal) + " → " + fmt(d.latestWithdrawal) + "</td>" +
        "<td>" + statusBadge(st.def) + "</td>" +
        '<td style="white-space:nowrap"><button class="btn small primary" data-act="wd-open" data-id="' + s.id + '">Withdraw</button></td></tr>';
    }).join("") : '<tr><td colspan="8"><div class="empty"><div class="big">Nothing pending</div>All scheduled samples have been withdrawn.</div></td></tr>';
    return '<div class="card"><div class="card-h"><h3>Withdrawal / Pulling Queue</h3><span class="hint">official schedule stays unchanged</span></div><div class="table-wrap"><table class="data"><thead><tr><th>ER</th><th>Product</th><th>Batch</th><th>Condition</th><th>Time Point</th><th>Official Withdrawal</th><th>Window</th><th>Status</th><th></th></tr></thead><tbody>' + rows + "</tbody></table></div></div>";
  };

  VIEWS.documentation = function () {
    var cards = S.protocols.map(function (p) {
      var pr = projectOf(p.id);
      var list = (pr.documents || []).map(function (d) { return '<div class="row"><div class="grow">' + h(d.type) + ' <span class="pill">' + h(d.id) + "</span></div><div class=\"muted\">" + h(d.by + " · " + d.at) + "</div></div>"; }).join("");
      var samples = SD.lifecycle.samplesFor(S, p.id);
      var ready = samples.length > 0 && samples.every(function (s) { return s.analysisCompleteDate; });
      var ars = samples.filter(function (s) { return s.arNumber; }).map(function (s) { return '<span class="pill">' + h(s.sampleId + ": " + s.arNumber) + "</span>"; }).join(" ");
      return '<div class="card" style="margin-bottom:14px"><div class="card-h"><h3>' + h(p.product) + " · " + h(p.protocolNo) + '</h3><span class="hint">' + (pr.er ? h(pr.er.erNumber) : "no ER") + '</span></div><div class="card-b"><div class="list">' + (list || '<div class="muted">No documents generated yet.</div>') + "</div>" +
        '<div style="margin-top:10px"><span class="eyebrow">Analysis Reports (AR No)</span><div style="margin-top:6px">' + (ars || '<span class="muted">No completed analyses yet.</span>') + "</div></div>" +
        '<div style="margin-top:12px">' + (ready ? '<button class="btn primary" data-act="doc-generate-all" data-id="' + p.id + '">Generate documents (' + DOC_TYPES.length + ")</button>" : '<span class="muted">Available after all analyses for this project are completed.</span>') + "</div></div></div>";
    }).join("");
    return '<div class="notice"><strong>Auto-generated from record data.</strong> Product, batch, ER, chamber, condition, time point, STP, analyst, results, reviewer and dates are already in the system and are not re-typed.</div>' + cards;
  };

  VIEWS["final-reports"] = function () {
    var rows = S.protocols.map(function (p) {
      var pr = projectOf(p.id), samples = SD.lifecycle.samplesFor(S, p.id);
      var done = samples.filter(function (s) { return s.analysisCompleteDate; }).length;
      var allDone = samples.length > 0 && done === samples.length;
      var fr = pr.finalReport || { status: "not_started" };
      var status = fr.status === "approved" ? '<span class="badge tone-success"><span class="dot"></span>Approved</span>' : fr.status === "under_review" ? '<span class="badge tone-warn"><span class="dot"></span>Under review</span>' : '<span class="badge tone-muted"><span class="dot"></span>Not started</span>';
      var action = fr.status === "approved" ? '<a class="btn small" href="#/project/' + p.id + '">View</a>'
        : allDone ? '<button class="btn small primary" data-act="final-open" data-id="' + p.id + '">' + (fr.status === "under_review" ? "Review / approve" : "Assemble report") + "</button>"
        : '<span class="muted">' + done + "/" + samples.length + " analyses complete</span>";
      return "<tr><td>" + h(p.protocolNo) + '</td><td class="wrap">' + h(p.product) + "</td><td>" + (pr.er ? h(pr.er.erNumber) : "—") + "</td><td>" + done + "/" + samples.length + "</td><td>" + status + "</td><td>" + action + "</td></tr>";
    }).join("");
    return '<div class="notice"><strong>Blocked until complete.</strong> A final report cannot be approved while mandatory analyses are open. The system refuses rather than silently completing.</div>' +
      '<div class="card"><div class="table-wrap"><table class="data"><thead><tr><th>Protocol</th><th>Product</th><th>ER</th><th>Analyses</th><th>Final Report</th><th></th></tr></thead><tbody>' + rows + "</tbody></table></div></div>";
  };

  VIEWS.stp = function () {
    var rows = S.protocols.map(function (p) {
      var tests = p.tests.map(function (t) { var d = SD.testById(t); return d ? d.name : t; });
      return '<tr><td><strong>' + h(p.protocolNo) + "</strong></td><td>" + h(p.version) + "</td><td>" + h(fmt(p.effectiveDate)) + '</td><td class="wrap">' + h(p.product) + '</td><td class="num">' + p.tests.length + '</td><td><span class="badge tone-success"><span class="dot"></span>Approved</span></td><td><button class="btn small" data-act="protocol-open" data-id="' + p.id + '">View methods</button> <button class="btn small primary" data-act="ws-new-stp" data-id="' + p.id + '">Worksheet</button></td></tr>';
    }).join("");
    return '<div class="toolbar"><div class="grow"></div><button class="btn primary" data-act="ws-new">+ New analysis worksheet (STP)</button></div>' +
      '<div class="notice"><strong>Read-only source control.</strong> In analysis the applicable STP loads automatically; the analyst cannot edit method text, only enter actual lab data. Historical records keep the exact STP version used.</div>' +
      '<div class="card"><div class="table-wrap"><table class="data"><thead><tr><th>STP No.</th><th>Version</th><th>Effective</th><th>Product</th><th>Tests</th><th>Status</th><th></th></tr></thead><tbody>' + rows + "</tbody></table></div></div>";
  };

  VIEWS.users = function () {
    var rows = S.users.map(function (u) {
      return "<tr><td>" + h(u.name) + "</td><td>" + h(u.role) + "</td><td>" + h(u.email) + '</td><td><span class="badge tone-success"><span class="dot"></span>' + h(u.status) + "</span></td></tr>";
    }).join("");
    var byRole = {};
    S.users.forEach(function (u) { byRole[u.role] = (byRole[u.role] || 0) + 1; });
    var roles = Object.keys(byRole).map(function (r) { return '<span class="pill">' + h(r) + ": " + byRole[r] + "</span>"; }).join(" ");
    return '<div class="notice"><strong>Signed-in role:</strong> ' + h(S.role) + " (change in the top bar). Users and roles are structure only in this build; authentication is not implemented and no regulatory compliance is claimed.</div>" +
      '<div class="toolbar"><div class="grow">' + roles + '</div><button class="btn" data-act="new-user">+ Add user</button></div>' +
      '<div class="card"><div class="table-wrap"><table class="data"><thead><tr><th>Name</th><th>Role</th><th>Email</th><th>Status</th></tr></thead><tbody>' + rows + "</tbody></table></div></div>";
  };

  VIEWS.project = function (id) {
    var p = protocolOf(id);
    if (!p) return notFound();
    var pr = projectOf(id);
    var steps = SD.lifecycle.checklist(S, id);
    var samples = SD.lifecycle.samplesFor(S, id);
    var doneCount = steps.filter(function (s) { return s.done; }).length;
    var pct = Math.round((doneCount / steps.length) * 100);
    var ps = SD.lifecycle.protocolStatus(S, id);
    var backable = {
      protocol: ps === "APPROVED", packing: !!pr.packing, er: !!pr.er, loading: !!pr.loading,
      schedule: samples.length > 0,
      withdrawal: samples.some(function (s) { return s.actualWithdrawal; }),
      analysis: samples.some(function (s) { return s.analysisCompleteDate; }),
      documents: (pr.documents || []).length > 0, report: !!pr.finalReport
    };
    var checkHtml = steps.map(function (s) {
      var back = backable[s.key] ? ' <button class="btn small" data-act="step-back" data-key="' + s.key + '" data-id="' + id + '">Back</button>' : "";
      return '<div class="check ' + (s.done ? "done" : "todo") + '"><span class="tick">' + (s.done ? "\u2713" : "\u25CB") + '</span><div><div class="c-label">' + h(s.label) + back + '</div><div class="muted">' + h(s.detail) + "</div></div></div>";
    }).join("");
    var ap = (pr.approvals || []).map(function (a) {
      return '<div class="row"><div class="grow"><strong>' + h(a.level) + '</strong> · ' + h(a.action) + (a.comment ? ' — <span class="muted">' + h(a.comment) + "</span>" : "") + '</div><div class="muted">' + h(a.user + " · " + a.at) + "</div></div>";
    }).join("");
    var sampleRows = samples.map(function (s) {
      var st = statusOf(s);
      return "<tr><td>" + h(s.sampleId) + "</td><td>" + h(s.timePointLabel) + "</td><td>" + fmt(s.plannedWithdrawal) + "</td><td>" + (s.actualWithdrawal ? fmt(s.actualWithdrawal) : "—") + "</td><td>" + (s.arNumber ? h(s.arNumber) : "—") + "</td><td>" + statusBadge(st.def) + "</td></tr>";
    }).join("");
    var missConds = pr.loading ? missingConditions(p, pr.loading) : [];
    return '<div class="toolbar"><a class="btn" href="#/protocols">← Protocols</a><a class="btn" href="#/protocoldoc/' + id + '">Protocol document</a><div class="grow"></div>' +
      (missConds.length ? '<button class="btn primary" data-act="load-add" data-id="' + id + '">Add condition (' + missConds.length + ')</button> ' : "") +
      nextActionHtml(id) + "</div>" +
      '<div class="grid-2">' +
      '<div class="card"><div class="card-h"><h3>' + h(p.product) + '</h3><span class="hint">' + h(p.protocolNo) + '</span></div><div class="card-b"><dl class="meta">' +
      "<dt>Protocol ID</dt><dd>" + h(id) + "</dd>" +
      "<dt>Product Code</dt><dd>" + h(p.productCode) + "</dd>" +
      "<dt>Batch(es)</dt><dd>" + h(p.batches.join(", ")) + "</dd>" +
      "<dt>Protocol Status</dt><dd>" + protoBadge(ps) + "</dd>" +
      "<dt>ER Number</dt><dd>" + (pr.er ? h(pr.er.erNumber) : "—") + "</dd>" +
      "<dt>Chamber</dt><dd>" + (pr.loading ? h(loadingChamberText(pr.loading)) : "—") + "</dd>" +
      "</dl></div></div>" +
      '<div class="card"><div class="card-h"><h3>Lifecycle</h3><span class="hint">' + doneCount + "/" + steps.length + " steps</span></div><div class=\"card-b\">" +
      '<div class="progress"><span style="width:' + pct + '%"></span></div>' + checkHtml + "</div></div>" +
      "</div>" +
      '<h3 class="section-title">Protocol Approval</h3><div class="card"><div class="card-b list">' + (ap || '<div class="muted">No approvals recorded.</div>') + "</div></div>" +
      '<h3 class="section-title">Time Points <span class="hint">official schedule unchanged</span></h3><div class="card"><div class="table-wrap"><table class="data"><thead><tr><th>Sample ID</th><th>Time Point</th><th>Official Withdrawal</th><th>Actual Withdrawal</th><th>AR No</th><th>Status</th></tr></thead><tbody>' + (sampleRows || '<tr><td colspan="5"><div class="empty">Schedule not created yet.</div></td></tr>') + "</tbody></table></div></div>";
  };

  VIEWS.datasheet = function (id) {
    var p = protocolOf(id);
    if (!p) return notFound();
    var pr = projectOf(id);
    var samples = SD.lifecycle.samplesFor(S, id);
    var meta = p.reportMeta || {};
    var cols = meta.timePointColumns || [{ label: "Initial", months: 0 }].concat(p.timePoints.map(function (m) { return { label: m + "M", months: m }; }));
    var byMonths = {};
    samples.forEach(function (s) { byMonths[s.timePointMonths] = s; });
    var head = "<th>Test</th><th>Specification</th>" + cols.map(function (c) { return '<th class="num">' + h(c.label) + "</th>"; }).join("");
    var rows = p.tests.map(function (tid) {
      var t = SD.testById(tid);
      var cells = cols.map(function (c) {
        var s = byMonths[c.months];
        if (!s) return '<td class="num muted">—</td>';
        var rr = (S.results[s.sampleId] || []).filter(function (x) { return x.testId === tid; })[0];
        var val = rr && rr.result !== "" && rr.result !== undefined ? rr.result : "";
        if (!val) return '<td class="num muted">—</td>';
        var verdict = SD.checkSpec(parseFloat(val), t.specification);
        return '<td class="num">' + (verdict === "FAIL" ? '<span class="ws-verdict fail" style="padding:1px 6px">' + h(val) + "</span>" : h(val)) + "</td>";
      }).join("");
      return '<tr><td class="test">' + (t.section ? '<span class="pill">' + h(t.section) + "</span> " : "") + h(t.name) + "</td><td>" + h(t.specification) + "</td>" + cells + "</tr>";
    }).join("");
    var fill = samples.filter(function (s) { return s.analysisCompleteDate; }).length;
    return '<div class="toolbar"><a class="btn" href="#/project/' + id + '">← Project 360</a><div class="grow"></div>' +
      '<span class="eyebrow" style="align-self:center">' + h(pr.er ? pr.er.erNumber : "") + " · " + fill + "/" + samples.length + " time points entered</span>" +
      '<button class="btn primary" data-act="ws-new-stp" data-id="' + id + '">+ Enter results at a time point</button></div>' +
      '<div class="notice"><strong>Cumulative data sheet.</strong> Enter results for 1M and the 1st Month column fills; enter 2M and both 1st and 2nd Month columns appear — no re-typing. Values outside specification are flagged in red.</div>' +
      '<div class="card"><div class="card-h"><h3>' + h(p.product) + " · " + h(p.protocolNo) + '</h3><span class="hint">' + h(p.storageCondition) + " · Batch " + h(p.batches.join(", ")) + '</span></div><div class="table-wrap"><table class="data"><thead><tr>' + head + "</tr></thead><tbody>" + rows + "</tbody></table></div></div>";
  };

  VIEWS.earlypull = function () {
    var list = (S.pulls || []).slice().sort(function (a, b) { return (b.createdAt || "").localeCompare(a.createdAt || ""); });
    var c = { pend: 0, gl: 0, appr: 0, rej: 0 };
    list.forEach(function (ep) {
      if (ep.status === "SUBMITTED") c.pend++;
      else if (ep.status === "REVIEWER_APPROVED") c.gl++;
      else if (ep.status === "APPROVED") c.appr++;
      else if (ep.status === "REJECTED") c.rej++;
    });
    var rows = list.map(function (ep) {
      var s = sampleByRef(ep.sampleRef);
      var actions = "";
      if (ep.status === "SUBMITTED") actions = '<button class="btn small primary" data-act="ep-reviewer-approve" data-id="' + ep.id + '">Reviewer approve</button> <button class="btn small danger" data-act="ep-reject" data-id="' + ep.id + '">Reject</button>';
      else if (ep.status === "REVIEWER_APPROVED") actions = '<button class="btn small primary" data-act="ep-gl-approve" data-id="' + ep.id + '">Group Leader approve</button> <button class="btn small danger" data-act="ep-reject" data-id="' + ep.id + '">Reject</button>';
      else if (ep.status === "APPROVED") actions = '<button class="btn small primary" data-act="ep-withdraw" data-id="' + ep.id + '">Withdraw sample</button>';
      else if (ep.status === "REJECTED") actions = '<span class="muted" title="' + h(ep.rejectReason || "") + '">' + h((ep.rejectReason || "Rejected").slice(0, 46)) + "</span>";
      else actions = (ep.actualDate ? '<span class="muted">Actual ' + fmt(ep.actualDate) + "</span> " : "") + '<button class="btn small" data-act="ep-withdraw" data-id="' + ep.id + '">Correct date</button>';
      return "<tr><td><strong>" + h(ep.id) + '</strong><div class="muted" style="font-size:11px">' + h(ep.requestedBy + " · " + (ep.createdAt || "").slice(0, 16)) + "</div></td>" +
        '<td class="wrap">' + h(ep.product) + "</td><td>" + h(ep.batch) + '</td><td class="wrap">' + h(ep.condition) + "</td><td>" + h(ep.timePointLabel) + "</td>" +
        "<td>" + fmt(ep.officialDate) + "</td>" +
        "<td>" + fmt(ep.requestedDate) + "</td>" +
        '<td class="num">' + ep.advanceDays + " d</td>" +
        "<td>" + epBadge(ep) + "</td>" +
        '<td style="white-space:nowrap">' + actions + "</td></tr>";
    }).join("");
    return '<div class="toolbar"><div class="grow"><span class="pill">Pending approval: ' + c.pend + '</span> <span class="pill">Awaiting GL: ' + c.gl + '</span> <span class="pill">Approved: ' + c.appr + '</span> <span class="pill">Rejected: ' + c.rej + "</span></div>" +
      '<button class="btn primary" data-act="ep-new">+ R&amp;D Early Pull Request</button></div>' +
      '<div class="notice info"><strong>Add-on, not a change.</strong> The official withdrawal date is never overwritten. An early pull is a separate request with its own approval and its own requested date (Official − Advance Days).</div>' +
      '<div class="card"><div class="table-wrap"><table class="data"><thead><tr><th>Request</th><th>Product</th><th>Batch</th><th>Condition</th><th>Time Point</th><th>Official Withdrawal</th><th>R&amp;D Early Pull</th><th>Advance</th><th>Status</th><th>Action</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="10"><div class="empty"><div class="big">No early-pull requests</div>Create one with the button above.</div></td></tr>') + "</tbody></table></div></div>";
  };

  VIEWS.protocoldoc = function (id) {
    var p = protocolOf(id);
    if (!p) return notFound();
    var pr = projectOf(id), m = p.protocolMeta || {};
    var ps = SD.lifecycle.protocolStatus(S, id);
    var reasonList = ["1. New product", "2. New process / polymorph", "3. Others (specify)"];
    var condList = ["A. 40±2°C / 75±5% RH", "B. 25±2°C / 60±5% RH", "C. 5±3°C", "D. -20°C±5°C", "E. Extra samples loaded", "F. Any other (specify)"];
    var encList = ["A. Initial Certificate of Analysis", "B. Requested tests related documents", "C. Any other (specify)"];
    function has(arr, x) { return (arr || []).indexOf(x) >= 0 ? "\u2713" : ""; }
    function li(list, item) { return '<li><span class="mark">' + has(list, item) + "</span> " + h(item) + "</li>"; }
    var sampleTypes = ["1  Lab sample", "2  Lab validation sample", "3  Others (specify)"];
    var reasonItems = reasonList.map(function (r) { return li(m.reason, r); }).join("");
    var condItems = condList.map(function (c) { return li(m.sampleConditions, c); }).join("");
    var encItems = encList.map(function (e) { return li(m.enclosures, e); }).join("");
    var atItems = ["A", "B", "C", "D", "E", "F"].map(function (l) { return '<li><span class="mark">' + has(m.studyAt, l) + "</span> " + l + ".</li>"; }).join("");
    var stItems = sampleTypes.map(function (s) { return '<li><span class="mark">' + ((m.sampleType || "1  Lab sample") === s ? "\u2713" : "") + "</span> " + h(s) + "</li>"; }).join("");
    var testNames = (p.tests || []).map(function (t) { var d = SD.testById(t); return d ? d.name : t; }).join(", ");
    var conds = (m.sampleConditions && m.sampleConditions.length) ? m.sampleConditions.slice() : [p.storageCondition];
    function condTemp(s) { var mm = String(s).match(/(-?\d{1,3})/); return mm ? parseInt(mm[1], 10) : 9999; }
    function condText(s) { return String(s).replace(/^[A-F]\.\s*/, ""); }
    function nthOrd(n) { return n + (n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"); }
    conds.sort(function (a, b) { return condTemp(a) - condTemp(b); });
    var condRowsHtml = "<tr><th>Storage condition</th><td>" + conds.map(function (c, i) { return h(nthOrd(i + 1) + ": " + condText(c)); }).join("<br>") + "</td></tr>";
    var pk = (m.packing && typeof m.packing === "object") ? m.packing : {};
    var packingHtml = "<strong>Innermost:</strong> " + h(pk.innermost || "The material should be packed in LDPE bag purged with nitrogen, twisted and tied with tag,") +
      "<br><strong>Middle:</strong> " + h(pk.middle || "then that bag should be inserted in ALUM bag heat sealed under nitrogen purge.") +
      "<br><strong>Outermost:</strong> " + h(pk.outermost || "Finally kept in HDPE container along with silica gel.");
    function docHeadCells(cond) {
      cond = cond || {};
      return docCols.map(function (l) {
        if (l.indexOf("Water content") === 0) return '<th class="num">Water content /<br>' + h(cond.waterText || (m.schedule && m.schedule.waterText) || "LOD / TGA") + "</th>";
        if (l.indexOf("Related compounds") === 0) return '<th class="num">Related compounds by<br>' + h(cond.relatedText || (m.schedule && m.schedule.relatedText) || "—") + "</th>";
        if (l === "Other test") return '<th class="num">Other test /<br>' + h(cond.otherText || (m.schedule && m.schedule.otherTest) || "") + "</th>";
        return '<th class="num">' + hHead(l) + "</th>";
      }).join("");
    }
    var docCols = SCHED_ROWS, docSchedRows, docSchedTables;
    if (m.schedule && m.schedule.rows && m.schedule.rows.length && m.schedule.rows[0].label !== undefined) {
      docCols = (m.schedule.cols && m.schedule.cols.length) ? m.schedule.cols : SCHED_ROWS;
      docSchedRows = m.schedule.rows.map(function (r) {
        return "<tr><td>" + h(r.label) + "</td>" + (r.marks || []).map(function (mk) {
          return '<td class="num">' + h(mk === true ? "\u2713" : mk === false ? "X" : (mk == null ? "" : mk)) + "</td>";
        }).join("") + "</tr>";
      }).join("");
    } else {
      docSchedRows = SCHED_COLS.map(function (tp, ri) {
        return "<tr><td>" + h(tp) + "</td>" + SCHED_ROWS.map(function (n, ci) { return '<td class="num">' + (ci < SCHED_DEFAULT_TICK ? "\u2713" : "X") + "</td>"; }).join("") + "</tr>";
      }).join("");
    }
    if (m.schedule && m.schedule.conditions && m.schedule.conditions.length) {
      docSchedTables = m.schedule.conditions.map(function (cond) {
        var rows = (cond.rows || []).map(function (r) {
          return "<tr><td>" + h(r.label) + "</td>" + (r.marks || []).map(function (mk) {
            return '<td class="num">' + h(mk === true ? "\u2713" : mk === false ? "X" : (mk == null ? "" : mk)) + "</td>";
          }).join("") + "</tr>";
        }).join("");
        var head = (cond.label ? '<tr><th class="num" colspan="' + (docCols.length + 1) + '" style="text-align:center">' + h(cond.label) + "</th></tr>" : "") +
          "<tr><th>Schedule</th>" + docHeadCells(cond) + "</tr>";
        return '<table class="sched" style="margin-top:12px"><thead>' + head + "</thead><tbody>" + rows + "</tbody></table>";
      }).join("");
    } else {
      docSchedTables = '<table class="sched"><thead>' +
        '<tr><th class="num" colspan="' + (docCols.length + 1) + '" style="text-align:center">' + h(condText(conds[0])) + "</th></tr>" +
        "<tr><th>Schedule</th>" + docHeadCells() + "</tr></thead><tbody>" + docSchedRows + "</tbody></table>";
    }
    var ap = (pr.approvals || []).map(function (a) { return h(a.level + " · " + a.action + (a.comment ? " — " + a.comment : "") + " · " + a.user + " · " + a.at); }).join("<br>");
    function apUser(level, action) {
      var list = (pr.approvals || []).filter(function (x) { return x.level === level && (!action || x.action === action); });
      var a = list[list.length - 1];
      return a ? (a.user + (a.at ? " · " + a.at : "")) : "";
    }
    var sigPrepared = apUser("Preparer") || (m.preparedBy || "—");
    var sigReviewed = apUser("Reviewer", "approved") || "—";
    var sigApprovedCrd = apUser("Group Leader", "approved") || "—";
    var sigApprovedArd = "—";
    var reviewBtns = "";
    if (ps === "UNDER_REVIEW") reviewBtns = '<button class="btn primary" data-act="proto-review-approve" data-id="' + id + '">Reviewer: approve</button> <button class="btn danger" data-act="proto-changes" data-id="' + id + '">Request changes</button> ';
    else if (ps === "PENDING_GL") reviewBtns = '<button class="btn primary" data-act="proto-gl-approve" data-id="' + id + '">Group Leader: approve</button> <button class="btn danger" data-act="proto-changes" data-id="' + id + '">Request changes</button> ';
    else if (ps === "CHANGES_REQUESTED") reviewBtns = '<button class="btn primary" data-act="proto-edit" data-id="' + id + '">Edit protocol &amp; resubmit</button> ';
    return '<div class="toolbar"><a class="btn" href="#/project/' + id + '">← Project 360</a><div class="grow"></div><span class="eyebrow" style="align-self:center">' + protoBadge(ps) + '</span> ' + reviewBtns + '<button class="btn" onclick="window.print()">Print / PDF</button></div>' +
      '<div class="report-preview">' +
      '<div class="rp-head"><div><h2 style="text-align:left">HETERO (R&amp;D)<br><small style="font-weight:400;font-size:11px;color:var(--muted)">KAZIPALLY</small></h2><div style="color:var(--muted);font-size:11px">STABILITY PROTOCOL</div></div>' +
      '<div style="text-align:right"><strong style="border:1px solid var(--line-strong);padding:4px 8px;border-radius:4px;font-family:var(--serif)">HETERO</strong></div></div>' +
      "<table><tbody>" +
      "<tr><th>Effective Date</th><td>" + h(m.effectiveDate ? fmt(m.effectiveDate) : "—") + "</td><th>Department</th><td>" + h(m.department || "Analytical Research & Development") + "</td></tr>" +
      "<tr><th>Drug substance</th><td>" + h(p.product) + "</td><th>Project Code</th><td>" + h(p.productCode) + "</td></tr>" +
      "<tr><th>Batch No.</th><td>" + h(p.batches.join(", ")) + "</td><th>Mfg Date</th><td>" + h(m.dateIn ? fmt(m.dateIn) : "—") + "</td></tr>" +
      "<tr><th>Manufacturing location</th><td>" + h(m.manufacturingLocation || "—") + "</td><th>STP No.</th><td>" + h(m.stpNo || p.protocolNo) + "</td></tr>" +
      "</tbody></table>" +
      '<div class="proto-grid" style="grid-template-columns:1fr 1fr;margin:10px 0">' +
      '<div class="proto-col"><div class="eyebrow">Reason(s) for Stability study [1 to 3]</div><ul class="proto-list">' + reasonItems + "</ul>" + (m.reasonOther ? '<div class="muted" style="font-size:11px">Others: ' + h(m.reasonOther) + "</div>" : "") +
      '<div class="eyebrow" style="margin-top:10px">Enclosures</div><ul class="proto-list">' + encItems + "</ul></div>" +
      '<div class="proto-col"><div class="eyebrow">Stability Study Required At</div><ul class="proto-list">' + condItems + "</ul>" + (m.sampleConditionOther ? '<div class="muted" style="font-size:11px">Any other: ' + h(m.sampleConditionOther) + "</div>" : "") +
      '<div class="eyebrow" style="margin-top:10px">Sample Details</div><ul class="proto-list">' + stItems + "</ul></div>" +
      "</div>" +
      '<table style="margin-top:10px"><tbody>' +
      "<tr><th>Packing</th><td>" + packingHtml + "</td></tr>" +
      "</tbody></table>" +
      docSchedTables +
      '<p class="muted" style="font-size:11px">\u2713 = Tests to be analysed &nbsp;&nbsp; X = Tests not to be analysed &nbsp;&nbsp; @ = Tests to be analyzed on demand</p>' +
      '<div class="sign-grid" style="grid-template-columns:repeat(4,1fr)"><div class="s">Prepared By (Analyst)<br>' + h(sigPrepared) + '</div><div class="s">Reviewed By (ARD)<br>' + h(sigReviewed) + '</div><div class="s">Approved By (CRD)<br>' + h(sigApprovedCrd) + '</div><div class="s">Approved By (ARD)<br>' + h(sigApprovedArd) + "</div></div>" +
      (ap ? '<p class="muted" style="margin-top:10px">Approval history:<br>' + ap + "</p>" : "") +
      '<div class="rp-foot"><span>Status: ' + h(ps) + "</span><span>Page 1 of 1</span></div>" +
      "</div>";
  };

  function notFound() { return '<div class="card"><div class="empty"><div class="big">Record not found</div></div></div>'; }

  function allResultsEntered(s) {
    var rows = S.results[s.sampleId] || [];
    if (!rows.length) return false;
    return rows.every(function (r) { return r.status !== "pending"; });
  }

  /* ---------- overlays ---------- */
  var overlay = document.getElementById("overlayRoot");
  function openOverlay(html, center) {
    overlay.innerHTML = '<div class="overlay' + (center ? " center" : "") + '"><div class="' + (center ? "modal" : "drawer") + '">' + html + "</div></div>";
    overlay.style.display = "block";
  }
  function closeOverlay() { overlay.innerHTML = ""; overlay.style.display = "none"; }

  function drawerHead(title, sub) {
    return '<div class="drawer-h"><div><h2>' + h(title) + '</h2><div class="muted" style="font-size:12px">' + h(sub || "") + '</div></div><div class="spacer"></div><button class="x" data-act="close-overlay">&times;</button></div>';
  }

  function openProtocol(id) {
    var p = protocolOf(id);
    if (!p) return;
    var ps = SD.lifecycle.protocolStatus(S, id);
    var analystDone = ps === "UNDER_REVIEW" || ps === "PENDING_GL" || ps === "APPROVED";
    var reviewerDone = ps === "PENDING_GL" || ps === "APPROVED";
    var glDone = ps === "APPROVED";
    function signBadge(done) {
      return done
        ? '<span class="badge tone-success"><span class="dot"></span>Done</span>'
        : '<span class="badge tone-warn"><span class="dot"></span>Pending</span>';
    }
    openOverlay(drawerHead(p.protocolNo, p.product) + '<div class="drawer-b">' +
      '<dl class="meta">' +
      "<dt>Analyst Sign Off</dt><dd>" + signBadge(analystDone) + "</dd>" +
      "<dt>Reviewer</dt><dd>" + signBadge(reviewerDone) + "</dd>" +
      "<dt>Group Leader</dt><dd>" + signBadge(glDone) + "</dd>" +
      "</dl>" +
      "</div>");
  }

  function openWithdraw(id) {
    var s = store.getSample(id); if (!s) return;
    var d = computeDatesFor(s);
    openOverlay(drawerHead("Record Actual Withdrawal", s.sampleId + " · " + s.product) + '<div class="drawer-b">' +
      '<dl class="meta"><dt>Planned</dt><dd>' + fmt(s.plannedWithdrawal) + "</dd><dt>Window</dt><dd>" + fmt(d.earliestWithdrawal) + " → " + fmt(d.latestWithdrawal) + "</dd></dl>" +
      '<label class="fld" style="margin-top:12px">Actual withdrawal date</label><input class="input" type="date" id="wdDate" value="' + today() + '" />' +
      '<label class="fld" style="margin-top:12px">Also start analysis now?</label><select class="select" id="wdStart"><option value="no">No, just record withdrawal</option><option value="yes">Yes, set analysis start to this date</option></select>' +
      '<div style="margin-top:16px"><button class="btn primary" data-act="wd-save" data-id="' + s.id + '">Save withdrawal</button> <button class="btn ghost" data-act="close-overlay">Cancel</button></div>' +
      '<p class="muted" style="margin-top:12px">Analysis due date is calculated automatically as withdrawal + ' + S.settings.analysisDueDays + " days.</p>" +
      "</div>");
  }

  function openResults(id) {
    var s = store.getSample(id); if (!s) return;
    var rows = S.results[s.sampleId] || [];
    if (!rows.length) {
      var p = protocolOf(s.protocolId);
      rows = p.tests.map(function (tid) { var t = SD.testById(tid); return { testId: tid, test: t.name, method: t.method, specification: t.specification, unit: t.unit, result: "", status: "pending", analyst: "", date: "" }; });
    }
    var body = rows.map(function (r, i) {
      return "<tr><td>" + h(r.test) + '</td><td class="wrap">' + h(r.specification) + '</td><td class="num">' + h(r.unit) + "</td>" +
        '<td><input class="input" style="width:110px" data-result="' + i + '" value="' + h(r.result) + '" placeholder="value" /></td>' +
        '<td><select class="select" style="width:130px" data-result-status="' + i + '">' +
        '<option value="pending"' + (r.status === "pending" ? " selected" : "") + ">Pending</option>" +
        '<option value="within_spec"' + (r.status === "within_spec" ? " selected" : "") + ">Within spec</option>" +
        '<option value="out_of_spec"' + (r.status === "out_of_spec" ? " selected" : "") + ">Out of spec</option>" +
        '<option value="na"' + (r.status === "na" ? " selected" : "") + ">N/A</option></select></td></tr>";
    }).join("");
    openOverlay(drawerHead("Test Results", s.sampleId + " · " + s.product) + '<div class="drawer-b">' +
      '<div class="card"><div class="table-wrap"><table class="data"><thead><tr><th>Test</th><th>Specification</th><th>Unit</th><th>Result</th><th>Status</th></tr></thead><tbody>' + body + "</tbody></table></div></div>" +
      '<div style="margin-top:16px"><button class="btn primary" data-act="results-save" data-id="' + s.id + '">Save results</button> <button class="btn ghost" data-act="close-overlay">Cancel</button></div>' +
      '<p class="muted" style="margin-top:12px">Entering a result does not complete the analysis; use "Mark analysis complete" when all tests are entered.</p>' +
      "</div>");
  }

  function openImportPreview() {
    var text = (document.getElementById("csvText") || {}).value || "";
    var errEl = document.getElementById("importResult");
    var parsed = parseCSV(text);
    if (parsed.error) { errEl.innerHTML = '<div class="validation-list">' + h(parsed.error) + "</div>"; return; }
    /* keep the exact columns + rows so the same sheet can be exported back */
    S.sheet = S.sheet || {};
    S.sheet.headers = parsed.header;
    S.sheet.rows = parsed.rows;
    store.save();
    var fields = ["product", "productCode", "protocolNo", "batch", "storageCondition", "timePoint", "plannedWithdrawal"];
    var map = {};
    fields.forEach(function (f) {
      var idx = parsed.header.findIndex(function (hd) { return normalize(hd) === normalize(FIELD_LABELS[f]); });
      if (idx < 0) idx = parsed.header.findIndex(function (hd) { return FIELD_ALIASES[f].indexOf(normalize(hd)) >= 0; });
      map[f] = idx;
    });
    var rows = parsed.rows.map(function (cols, n) {
      var rec = { _line: n + 2 };
      fields.forEach(function (f) { rec[f] = map[f] >= 0 ? (cols[map[f]] || "").trim() : ""; });
      rec.plannedWithdrawal = normalizeDate(rec.plannedWithdrawal);
      rec._errors = [];
      if (!rec.product) rec._errors.push("Product is required");
      if (!rec.batch) rec._errors.push("Batch is required");
      if (!rec.plannedWithdrawal || !/^\d{4}-\d{2}-\d{2}$/.test(rec.plannedWithdrawal)) rec._errors.push("Planned Withdrawal is required and must be a date");
      return rec;
    });
    var valid = rows.filter(function (r) { return !r._errors.length; });
    var invalid = rows.filter(function (r) { return r._errors.length; });
    PENDING_IMPORT = valid;
    var preview = rows.map(function (r) {
      return "<tr" + (r._errors.length ? ' style="background:var(--danger-soft)"' : "") + "><td>" + r._line + "</td><td>" + h(r.product) + "</td><td>" + h(r.productCode) + "</td><td>" + h(r.batch) + "</td><td>" + h(r.timePoint) + "</td><td>" + h(r.plannedWithdrawal) + "</td><td>" + (r._errors.length ? h(r._errors.join("; ")) : '<span class="badge tone-success"><span class="dot"></span>Valid</span>') + "</td></tr>";
    }).join("");
    errEl.innerHTML = '<div class="validation-list ' + (invalid.length ? "" : "ok") + '">' + valid.length + " valid row(s); " + invalid.length + " invalid row(s). Invalid rows are shown and will not be imported." + "</div>" +
      '<div class="card"><div class="table-wrap"><table class="data"><thead><tr><th>Line</th><th>Product</th><th>Code</th><th>Batch</th><th>Time Point</th><th>Planned</th><th>Validation</th></tr></thead><tbody>' + preview + "</tbody></table></div></div>" +
      '<button class="btn primary" style="margin-top:12px" data-act="import-confirm"' + (valid.length ? "" : " disabled") + ">Confirm import (" + valid.length + ")</button>";
  }

  var PENDING_IMPORT = [];

  function confirmImport() {
    if (!PENDING_IMPORT.length) return;
    var t = today();
    PENDING_IMPORT.forEach(function (r, i) {
      var protocolId = "imp";
      var id = "imp" + Date.now() + i;
      var sample = {
        id: id, sampleId: "IMP-" + String(S.samples.length + 1 + i).padStart(4, "0"),
        protocolId: protocolId, protocolNo: r.protocolNo || "IMPORTED",
        product: r.product, productCode: r.productCode || "—", batch: r.batch,
        storageCondition: r.storageCondition || "Not specified", pack: "Not specified",
        timePointMonths: parseInt(r.timePoint, 10) || 0, timePointLabel: r.timePoint || "—",
        manufacturingDate: null, expiryDate: null,
        plannedWithdrawal: r.plannedWithdrawal, actualWithdrawal: null, analysisStart: null, analysisCompleteDate: null,
        analyst: "", reviewer: "", reviewStatus: "not_started", reportStatus: "not_started", hold: false, holdReason: "", remarks: "Imported " + t
      };
      S.samples.push(sample);
      S.results[sample.sampleId] = [];
      store.audit({ user: S.currentUser, action: "import", entity: "sample", entityId: sample.sampleId, note: "Imported from monthly schedule" });
    });
    store.save();
    closeOverlay();
    alert("Imported " + PENDING_IMPORT.length + " sample(s). They appear in the Monthly Schedule and Samples.");
    PENDING_IMPORT = [];
    filters = { search: "", product: "", batch: "", status: "", storage: "", analyst: "", timePoint: "" };
    location.hash = "#/schedule";
    render();
  }

  function parseCSV(text) {
    text = (text || "").replace(/^\uFEFF/, "").trim();
    if (!text) return { error: "Nothing to import. Paste rows or choose a file." };
    var lines = text.split(/\r?\n/).filter(function (l) { return l.trim().length; });
    if (lines.length < 2) return { error: "Need a header row and at least one data row." };
    function splitLine(line) {
      var out = [], cur = "", q = false;
      for (var i = 0; i < line.length; i++) {
        var ch = line[i];
        if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
        else if ((ch === "," || ch === "\t") && !q) { out.push(cur); cur = ""; }
        else cur += ch;
      }
      out.push(cur);
      return out;
    }
    return { header: splitLine(lines[0]), rows: lines.slice(1).map(splitLine) };
  }
  function normalize(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, ""); }
  var FIELD_LABELS = { product: "Product", productCode: "Product Code", protocolNo: "Protocol No", batch: "Batch", storageCondition: "Storage Condition", timePoint: "Time Point", plannedWithdrawal: "Planned Withdrawal" };
  var FIELD_ALIASES = {
    product: ["product", "productname"], productCode: ["productcode", "code"], protocolNo: ["protocolno", "protocol"],
    batch: ["batch", "batchno", "batchnumber"], storageCondition: ["storagecondition", "storage"],
    timePoint: ["timepoint", "tp"], plannedWithdrawal: ["plannedwithdrawal", "plannedwithdrawaldate", "planned"]
  };
  function normalizeDate(s) {
    s = String(s || "").trim();
    if (!s) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    /* Excel serial date (e.g. 46007) -> YYYY-MM-DD */
    if (/^\d{4,5}(\.\d+)?$/.test(s)) {
      var serial = Math.floor(parseFloat(s));
      if (serial > 20000 && serial < 60000) {
        var dd = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
        return dd.getUTCFullYear() + "-" + String(dd.getUTCMonth() + 1).padStart(2, "0") + "-" + String(dd.getUTCDate()).padStart(2, "0");
      }
    }
    var m = s.match(/^(\d{1,2})[-\/ ]([A-Za-z]{3,})[-\/ ](\d{2,4})$/);
    if (m) {
      var months = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
      var mo = months[m[2].slice(0, 3).toLowerCase()]; var yr = parseInt(m[3], 10); if (yr < 100) yr += 2000;
      if (mo) return yr + "-" + String(mo).padStart(2, "0") + "-" + String(m[1]).padStart(2, "0");
    }
    m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})$/);
    if (m) { var y2 = parseInt(m[3], 10); if (y2 < 100) y2 += 2000; return y2 + "-" + String(m[2]).padStart(2, "0") + "-" + String(m[1]).padStart(2, "0"); }
    return s;
  }

  /* ---------- export ---------- */
  function csvCell(v) { v = v === null || v === undefined ? "" : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function downloadCSV(name, rows) { var csv = rows.map(function (r) { return r.map(csvCell).join(","); }).join("\r\n"); var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" }); var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(a.href); }
  function downloadDataUrl(name, dataUrl) { var a = document.createElement("a"); a.href = dataUrl; a.download = name; document.body.appendChild(a); a.click(); document.body.removeChild(a); }
  function downloadXls(name, rows, sheetName) {
    var esc = function (v) { return String(v === null || v === undefined ? "" : v).replace(/[&<>]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]; }); };
    var html = '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table border="1">' +
      rows.map(function (r) { return "<tr>" + r.map(function (c) { return "<td>" + esc(c) + "</td>"; }).join("") + "</tr>"; }).join("") +
      "</table></body></html>";
    var blob = new Blob([html], { type: "application/vnd.ms-excel" });
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(a.href);
  }
  function sampleCSV(list) {
    var head = ["Sample ID", "Product", "Product Code", "Batch", "Protocol No", "Storage Condition", "Time Point", "Planned Withdrawal", "Actual Withdrawal", "Analysis Due", "Analysis Start", "Analysis Complete", "AR No", "Analyst", "Reviewer", "Review Status", "Report Status", "Overall Status"];
    var rows = [head];
    list.forEach(function (s) {
      var d = computeDatesFor(s), st = statusOf(s);
      rows.push([s.sampleId, s.product, s.productCode, s.batch, s.protocolNo, s.storageCondition, s.timePointLabel, s.plannedWithdrawal || "", s.actualWithdrawal || "", d.analysisDue || "", s.analysisStart || "", s.analysisCompleteDate || "", s.arNumber || "", s.analyst, s.reviewer, s.reviewStatus, s.reportStatus, st.def.label]);
    });
    return rows;
  }
  function exportSet(kind) {
    var stamp = today();
    if (kind === "month") { var list = S.samples.filter(function (s) { return dates.monthKey(s.plannedWithdrawal) === scheduleMonth; }); downloadCSV("stability-schedule-" + scheduleMonth + ".csv", sampleCSV(list)); return; }
    if (kind === "pending") { downloadCSV("pending-withdrawals-" + stamp + ".csv", sampleCSV(S.samples.filter(function (s) { var c = statusOf(s).def.code; return c === "DUE_FOR_WITHDRAWAL" || c === "WITHDRAWAL_OVERDUE"; }))); return; }
    if (kind === "overdue") { downloadCSV("overdue-" + stamp + ".csv", sampleCSV(S.samples.filter(function (s) { var c = statusOf(s).def.code; return c === "ANALYSIS_OVERDUE" || c === "WITHDRAWAL_OVERDUE"; }))); return; }
    if (kind === "completed") { downloadCSV("completed-" + stamp + ".csv", sampleCSV(S.samples.filter(function (s) { return statusOf(s).def.code === "COMPLETED"; }))); return; }
    downloadCSV("stability-full-data-" + stamp + ".csv", sampleCSV(S.samples));
  }

  /* ---------- report ----------
   * Rendered in the supplied Hetero (R&D) Stability Report format:
   * Format F-02-01/ARD015. Field rows, a S.No/Test/Specification matrix across
   * the protocol's time points, packing conditions and the scheduled-date /
   * compiled / reviewed rows. */
  function ordinal(n) {
    if (n === 0) return "Initial";
    var s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]) + " Month";
  }
  function reportMetaFor(p) {
    if (p && p.reportMeta) return p.reportMeta;
    var cols = [{ label: "Initial", months: 0 }];
    (p && p.timePoints ? p.timePoints : []).forEach(function (m) { cols.push({ label: ordinal(m), months: m }); });
    return { site: S.settings.org, formatNo: "—", effectiveDate: null, humidity: "NA", packingConditions: "", timePointColumns: cols, analysisScheduled: [] };
  }

  function reportHTML(s) {
    var p = protocolOf(s.protocolId) || {};
    var meta = reportMetaFor(p);
    var columns = meta.timePointColumns || [{ label: "Initial", months: 0 }];
    var results = S.results[s.sampleId] || [];
    var isInitial = s.timePointMonths === 0;

    /* group consecutive tests by their protocol section number */
    var groups = [];
    results.forEach(function (r) {
      var def = SD.testById(r.testId) || {};
      var sec = def.section || "";
      var last = groups[groups.length - 1];
      if (last && last.sec === sec) last.items.push({ r: r, def: def });
      else groups.push({ sec: sec, items: [{ r: r, def: def }] });
    });

    var headCols = "<th>Test</th><th>Specification</th>" + columns.map(function (c) { return "<th>" + h(c.label) + "</th>"; }).join("");
    var matrix = groups.map(function (g) {
      return g.items.map(function (x, idx) {
        var cells = '<td class="rp-test">' + h(x.def.name || x.r.test) + "</td><td>" + h(x.r.specification) + "</td>";
        columns.forEach(function (c) {
          var val = (c.months === s.timePointMonths) ? (x.r.result || "") : "";
          cells += "<td>" + h(val) + "</td>";
        });
        var sno = idx === 0 ? '<td class="rp-sno" rowspan="' + g.items.length + '">' + h(g.sec) + "</td>" : "";
        return "<tr>" + sno + cells + "</tr>";
      }).join("");
    }).join("");

    var sch = meta.analysisScheduled || [];
    var schHead = sch.map(function (x) { return "<td>" + h(fmt(x.date)) + "</td>"; }).join("");
    var schedTable = sch.length
      ? '<table class="rp-sched"><thead><tr><td></td>' + schHead + "</tr></thead><tbody>" +
        "<tr><th>Analysis scheduled date</th>" + sch.map(function () { return "<td></td>"; }).join("") + "</tr>" +
        "<tr><th>Compiled by &amp; date</th>" + sch.map(function () { return "<td></td>"; }).join("") + "</tr>" +
        "<tr><th>Reviewed by &amp; date</th>" + sch.map(function () { return "<td></td>"; }).join("") + "</tr>" +
        "</tbody></table>"
      : "";

    var studyDate = meta.studyStartDate || s.plannedWithdrawal;
    var packing = meta.packingConditions || s.pack;

    return '<div class="report-preview">' +
      '<div class="rp-head"><div><h2 style="text-align:left">' + h(meta.site || "STABILITY LABORATORY") + "</h2>" +
      '<div style="color:var(--muted);font-size:11px">STABILITY REPORT</div></div>' +
      '<div style="text-align:right"><strong style="border:1px solid var(--line-strong);padding:4px 8px;border-radius:4px;font-family:var(--serif)">HETERO</strong></div></div>' +
      "<table><tbody>" +
      "<tr><th>Drug substance</th><td>" + h(s.product) + "</td><th>STP No.</th><td>" + h(s.protocolNo) + "</td><th>Date</th><td>" + h(fmt(studyDate)) + "</td></tr>" +
      "<tr><th>Temperature</th><td>" + h(s.storageCondition) + "</td><th>Humidity</th><td>" + h(meta.humidity || "NA") + "</td><th>Batch No.</th><td>" + h(s.batch) + "</td></tr>" +
      "</tbody></table>" +
      '<table class="rp-matrix"><thead><tr><th style="width:42px">S. No</th>' + headCols + "</tr></thead><tbody>" + matrix + "</tbody></table>" +
      '<p class="rp-pack"><strong>Packing conditions:</strong> ' + h(packing || "—") + "</p>" +
      schedTable +
      '<div class="rp-foot"><span>Format No: ' + h(meta.formatNo || "—") + "</span><span>Effective Date: " + h(meta.effectiveDate ? fmt(meta.effectiveDate) : "—") + "</span><span>Page 1 of 1</span></div>" +
      "</div>";
  }

  /* ---------- lifecycle modals & actions ---------- */
  function stamp() { return dates.nowStamp(); }
  function chamberOptions(sel) {
    return S.chambers.map(function (c) { return '<option value="' + h(c.id) + '"' + (sel === c.id ? " selected" : "") + ">" + h(c.id + " — " + c.name + " (" + c.temperature + (c.humidity && c.humidity !== "NA" ? " / " + c.humidity : "") + ")") + "</option>"; }).join("");
  }

  function addScheduleConditions(p, loading, conds) {
    var n = S.samples.length, total = 0;
    conds.forEach(function (lc, ci) {
      var base = lc.date || loading.date;
      var initialId = "SMP-" + String(++n).padStart(4, "0");
      S.samples.push({
        id: "g" + Date.now() + "_" + ci + "i", sampleId: initialId, protocolId: p.id, protocolNo: p.protocolNo,
        product: p.product, productCode: p.productCode, batch: p.batches[0], storageCondition: lc.condition, condition: lc.condition, pack: p.pack,
        timePointMonths: 0, timePointLabel: "Initial", manufacturingDate: null, expiryDate: null,
        plannedWithdrawal: base, actualWithdrawal: base, analysisStart: base, analysisCompleteDate: base,
        analyst: S.currentUser, reviewer: S.users[10] ? S.users[10].name : "Reviewer", reviewStatus: "approved", reportStatus: "approved", hold: false, holdReason: "", remarks: "Initial, generated at loading"
      });
      S.results[initialId] = [];
      total++;
      p.timePoints.forEach(function (tp, i) {
        var sid = "SMP-" + String(++n).padStart(4, "0");
        S.samples.push({
          id: "g" + Date.now() + "_" + ci + "_" + i, sampleId: sid, protocolId: p.id, protocolNo: p.protocolNo,
          product: p.product, productCode: p.productCode, batch: p.batches[0], storageCondition: lc.condition, condition: lc.condition, pack: p.pack,
          timePointMonths: tp, timePointLabel: tp + "M", manufacturingDate: null, expiryDate: null,
          plannedWithdrawal: dates.addMonths(base, tp), actualWithdrawal: null, analysisStart: null, analysisCompleteDate: null,
          analyst: "", reviewer: "", reviewStatus: "not_started", reportStatus: "not_started", hold: false, holdReason: "", remarks: "Generated from loading " + loading.loadingId
        });
        S.results[sid] = [];
        total++;
      });
    });
    store.audit({ user: S.currentUser, action: "generate", entity: "schedule", entityId: p.protocolNo, note: total + " samples (" + conds.length + " condition(s)) from loading " + loading.loadingId });
  }

  function generateScheduleForLoading(p, loading) {
    if (SD.lifecycle.samplesFor(S, p.id).length) return;
    var conds = (loading.conditions && loading.conditions.length) ? loading.conditions : [{ condition: p.storageCondition, date: loading.date }];
    addScheduleConditions(p, loading, conds);
  }

  function loadedConditionList(loading) {
    if (loading.conditions && loading.conditions.length) return loading.conditions.map(function (c) { return c.condition; });
    return loading.condition ? [loading.condition] : [];
  }
  function missingConditions(p, loading) {
    var temps = loadedConditionList(loading).map(condNum);
    return protocolConditionList(p).filter(function (c) { return temps.indexOf(condNum(c)) < 0; });
  }

  function autoChamberOptions(cond) {
    var mm = String(cond).match(/(-?\d{1,3})/);
    var want = mm ? mm[1] : null, match = "";
    if (want) S.chambers.forEach(function (c) { if (String(c.temperature).indexOf(want) >= 0) match = c.id; });
    return chamberOptions(match);
  }

  /* Step back: clear the chosen lifecycle step and everything after it, then reopen that step to redo. */
  function revertStep(id, key) {
    var pr = projectOf(id), p = protocolOf(id);
    if (!pr || !p) return;
    if (!confirm("Go back to the '" + key + "' step?\n\nThis clears that step and every step after it so you can redo them. Any data entered for those steps will be lost.")) return;
    var samples = SD.lifecycle.samplesFor(S, id);
    function wipeResults() { samples.forEach(function (s) { delete S.results[s.sampleId]; }); }
    function removeSamples() { wipeResults(); S.samples = S.samples.filter(function (s) { return s.protocolId !== id; }); }
    if (key === "protocol") {
      pr.approvals = [];
      pr.packing = null; pr.er = null; pr.loading = null; removeSamples();
      pr.documents = []; pr.finalReport = null; pr.deviations = [];
    } else if (key === "packing") {
      pr.packing = null; pr.er = null; pr.loading = null; removeSamples();
      pr.documents = []; pr.finalReport = null;
    } else if (key === "er") {
      pr.er = null; pr.loading = null; removeSamples();
      pr.documents = []; pr.finalReport = null;
    } else if (key === "loading" || key === "schedule") {
      pr.loading = null; removeSamples();
      pr.documents = []; pr.finalReport = null;
    } else if (key === "withdrawal") {
      samples.forEach(function (s) {
        if (s.timePointLabel === "Initial") return;
        s.actualWithdrawal = null; s.analysisStart = null; s.analysisCompleteDate = null; s.arNumber = null;
        s.reviewStatus = "not_started"; s.reportStatus = "not_started"; s.analyst = ""; s.reviewer = "";
        (S.results[s.sampleId] || []).forEach(function (r) { r.result = ""; r.status = "pending"; r.analyst = ""; r.date = ""; });
      });
      /* reopen any early-pull request that withdrew one of these samples */
      (S.pulls || []).forEach(function (ep) {
        var belongs = samples.some(function (s) { return s.sampleId === ep.sampleRef; });
        if (belongs && ep.status === "WITHDRAWN") {
          ep.status = "APPROVED"; ep.actualDate = null;
          ep.history.push({ at: stamp(), user: S.currentUser, action: "reverted", note: "Withdrawal reverted (step Back)" });
        }
      });
      pr.documents = []; pr.finalReport = null;
    } else if (key === "analysis") {
      samples.forEach(function (s) {
        if (s.timePointLabel === "Initial") return;
        s.analysisCompleteDate = null; s.arNumber = null; s.reviewStatus = "not_started"; s.reportStatus = "not_started";
      });
      pr.documents = []; pr.finalReport = null;
    } else if (key === "documents") {
      pr.documents = []; pr.finalReport = null;
    } else if (key === "report") {
      pr.finalReport = null;
    }
    store.audit({ user: S.currentUser, action: "update", entity: "lifecycle", entityId: p.protocolNo, note: "Reverted to step: " + key });
    store.save();
    if (key === "protocol") openProtocolForm(id);
    else if (key === "packing") openPack(id);
    else if (key === "loading" || key === "schedule") openLoad(id);
    else { closeOverlay(); render(); }
  }

  function openPack(id) {
    var p = protocolOf(id), pr = projectOf(id);
    if (pr.packing) { alert("Already packed: " + pr.packing.packingId); return; }
    var conds = protocolConditionList(p);
    var pack = p.pack || "";
    var tps = p.timePoints.join(", ") + " M";
    var blocks = conds.map(function (cond, i) {
      return '<table class="data sched" style="margin-top:12px"><thead><tr><th colspan="2" style="text-align:center">' + h("Condition " + (i + 1) + ": " + cond) + "</th></tr></thead><tbody>" +
        "<tr><th>Product</th><td>" + h(p.product) + "</td></tr>" +
        "<tr><th>Batch</th><td>" + h(p.batches.join(", ")) + "</td></tr>" +
        "<tr><th>Pack</th><td>" + h(pack) + "</td></tr>" +
        "<tr><th>Time Points</th><td>" + h(tps) + "</td></tr>" +
        '<tr><th>Quantity packed</th><td><input class="input" id="pkQty_' + i + '" value="' + h(p.timePoints.length + 1 + " time points") + '" /></td></tr>' +
        '<tr><th>Packing date</th><td><input class="input" type="date" id="pkDate_' + i + '" value="' + today() + '" /></td></tr>' +
        '<tr><th>Packed by</th><td><input class="input" id="pkBy_' + i + '" value="' + h(S.currentUser) + '" /></td></tr>' +
        '<tr><th>Remarks</th><td><input class="input" id="pkRemarks_' + i + '" placeholder="Optional — e.g. no. of bags/containers used, any deviation" /></td></tr>' +
        "</tbody></table>";
    }).join("");
    openOverlay(drawerHead("Sample Packing", p.protocolNo + " · " + p.product) + '<div class="drawer-b">' +
      blocks +
      '<div style="margin-top:16px"><button class="btn primary" data-act="pack-save" data-id="' + id + '">Save packing &amp; generate ER</button> <button class="btn ghost" data-act="close-overlay">Cancel</button></div>' +
      "</div>");
  }

  function openLoad(id) {
    var p = protocolOf(id), pr = projectOf(id);
    if (!pr.er) { alert("Generate the ER number first."); return; }
    if (pr.loading) { alert("Already loaded: " + pr.loading.loadingId); return; }
    var conds = protocolConditionList(p);
    var blocks = conds.map(function (cond, i) {
      return '<table class="data sched" style="margin-top:12px"><thead><tr><th colspan="2" style="text-align:center">' + h("Condition " + (i + 1) + ": " + cond) + "</th></tr></thead><tbody>" +
        '<tr><th>Chamber</th><td><select class="select" id="loadChamber_' + i + '">' + autoChamberOptions(cond) + "</select></td></tr>" +
        '<tr><th>Rack</th><td><input class="input" id="loadRack_' + i + '" value="R1" /></td></tr>' +
        '<tr><th>Shelf</th><td><input class="input" id="loadShelf_' + i + '" value="S1" /></td></tr>' +
        '<tr><th>Quantity</th><td><input class="input" id="loadQty_' + i + '" value="' + h(String(p.timePoints.length + 1)) + '" /></td></tr>' +
        '<tr><th>Loading date</th><td><input class="input" type="date" id="loadDate_' + i + '" value="' + today() + '" /></td></tr>' +
        '<tr><th>Loading time</th><td><input class="input" type="time" id="loadTime_' + i + '" value="10:00" /></td></tr>' +
        "</tbody></table>";
    }).join("");
    openOverlay(drawerHead("Chamber Loading", pr.er.erNumber + " · " + p.product) + '<div class="drawer-b">' +
      blocks +
      '<div style="margin-top:16px"><button class="btn primary" data-act="load-save" data-id="' + id + '">Confirm loading &amp; create schedule</button> <button class="btn ghost" data-act="close-overlay">Cancel</button></div>' +
      "</div>");
  }

  function openAddConditions(id) {
    var p = protocolOf(id), pr = projectOf(id);
    if (!pr.loading) { alert("Load samples first."); return; }
    var missing = missingConditions(p, pr.loading);
    if (!missing.length) { alert("All protocol conditions are already loaded."); return; }
    var qty = String(p.timePoints.length + 1);
    var blocks = missing.map(function (cond, i) {
      return '<table class="data sched" style="margin-top:12px"><thead><tr><th colspan="2" style="text-align:center">' + h("Add Condition " + (i + 1) + ": " + cond) + "</th></tr></thead><tbody>" +
        '<tr><th>Chamber</th><td><select class="select" id="laChamber_' + i + '">' + autoChamberOptions(cond) + "</select></td></tr>" +
        '<tr><th>Rack</th><td><input class="input" id="laRack_' + i + '" value="R1" /></td></tr>' +
        '<tr><th>Shelf</th><td><input class="input" id="laShelf_' + i + '" value="S1" /></td></tr>' +
        '<tr><th>Quantity</th><td><input class="input" id="laQty_' + i + '" value="' + h(qty) + '" /></td></tr>' +
        '<tr><th>Loading date</th><td><input class="input" type="date" id="laDate_' + i + '" value="' + today() + '" /></td></tr>' +
        '<tr><th>Loading time</th><td><input class="input" type="time" id="laTime_' + i + '" value="10:00" /></td></tr>' +
        "</tbody></table>";
    }).join("");
    openOverlay(drawerHead("Add Conditions to Loading", p.protocolNo + " · " + missing.length + " missing") + '<div class="drawer-b">' +
      '<div class="notice info">The existing loading is kept. Only these conditions are added, each with its own chamber and schedule.</div>' +
      blocks +
      '<div style="margin-top:16px"><button class="btn primary" data-act="load-add-save" data-id="' + id + '">Add conditions &amp; create schedule</button> <button class="btn ghost" data-act="close-overlay">Cancel</button></div>' +
      "</div>");
  }

  function monthLabel(m) { var s = ["th", "st", "nd", "rd"], v = m % 100; return m + (s[(v - 20) % 10] || s[v] || s[0]) + " month"; }

  /* Company protocol Schedule template (page 4 of F-01-01/ARD015) */
  var SCHED_ROWS = ["Description", "IR", "Water content /|LOD / TGA", "XRD", "Related compounds by", "Assay", "Enantiomeric purity|by HPLC", "Other test"];
  var SCHED_COLS = ["INITIAL", "1st month", "2nd month", "3rd month", "6th month", "9th month", "12th month"];
  var SCHED_DEFAULT_TICK = 6; /* first 6 rows default ticked, last 2 default X */
  function hHead(label) { return String(label).split("|").map(h).join("<br>"); }

  /* derive the protocol tests from the Schedule (rows marked tick) */
  function mapSchedTests() {
    var out = [];
    SCHED_ROWS.forEach(function (name, ci) {
      var any = SCHED_COLS.some(function (tp, ri) { var el = document.getElementById("npSc_" + ri + "_" + ci); return el && el.value === "\u2713"; });
      if (!any) return;
      var re = null;
      if (/description/i.test(name)) re = /description/i;
      else if (/infrared|^ir/i.test(name)) re = /infrared|\bIR\b/i;
      else if (/water|lod|tga/i.test(name)) re = /water|lod|loss on drying/i;
      else if (/xrd/i.test(name)) re = /xrd/i;
      else if (/related|impurity/i.test(name)) re = /related|impurity/i;
      else if (/assay/i.test(name)) re = /assay/i;
      if (!re) return;
      var found = (S.testLibrary || []).filter(function (t) { return re.test(t.name); })[0];
      if (found && out.indexOf(found.id) < 0) out.push(found.id);
    });
    return out;
  }

  function npCheck(id, label, checked) {
    return '<label class="check" style="cursor:pointer"><input type="checkbox" id="' + id + '"' + (checked ? " checked" : "") + ' /> <div class="c-label">' + h(label) + "</div></label>";
  }

  function openNewProtocol() { openProtocolForm(null); }

  function prefillProtocolForm(p) {
    var m = p.protocolMeta || {};
    function setv(id, val) { var el = document.getElementById(id); if (el) el.value = val == null ? "" : val; }
    function check(id, on) { var el = document.getElementById(id); if (el) el.checked = !!on; }
    function has(arr, x) { return (arr || []).indexOf(x) >= 0; }
    setv("npProduct", p.product);
    setv("npBatch", (p.batches || [])[0] || "");
    setv("npCode", m.projectCode || p.productCode || "");
    setv("npMfg", m.manufacturingLocation || "");
    setv("npStpNo", m.stpNo || "");
    setv("npDateIn", m.dateIn || today());
    check("npReason1", has(m.reason, "1. New product"));
    check("npReason2", has(m.reason, "2. New process / polymorph"));
    check("npReason3", has(m.reason, "3. Others (specify)"));
    setv("npReasonOther", m.reasonOther || "");
    check("npEncA", has(m.enclosures, "A. Initial Certificate of Analysis"));
    check("npEncB", has(m.enclosures, "B. Requested tests related documents"));
    check("npEncC", has(m.enclosures, "C. Any other (specify)"));
    check("npCondA", has(m.sampleConditions, "A. 40±2°C / 75±5% RH"));
    check("npCondB", has(m.sampleConditions, "B. 25±2°C / 60±5% RH"));
    check("npCondC", has(m.sampleConditions, "C. 5±3°C"));
    check("npCondD", has(m.sampleConditions, "D. -20°C±5°C"));
    check("npCondE", has(m.sampleConditions, "E. Extra samples loaded"));
    check("npCondF", has(m.sampleConditions, "F. Any other (specify)"));
    setv("npCondOther", m.sampleConditionOther || "");
    var st = m.sampleType || "1  Lab sample";
    check("npSampleType1", st.indexOf("1") === 0);
    check("npSampleType2", st.indexOf("2") === 0);
    check("npSampleType3", st.indexOf("3") === 0);
  }

  function prefillSchedule(p) {
    var m = p.protocolMeta || {}, sch = m.schedule || {}, pk = m.packing || {};
    function setv(id, val) { var el = document.getElementById(id); if (el) el.value = val == null ? "" : val; }
    setv("npPackInner", pk.innermost || "");
    setv("npPackMiddle", pk.middle || "");
    setv("npPackOuter", pk.outermost || "");
    (sch.conditions || []).forEach(function (cond, ci) {
      setv("npWaterText_" + ci, cond.waterText || "");
      setv("npRelatedText_" + ci, cond.relatedText || "");
      setv("npOtherTest_" + ci, cond.otherText || "");
      (cond.rows || []).forEach(function (row, ri) {
        (row.marks || []).forEach(function (mk, ti) {
          var el = document.getElementById("npSc_" + ci + "_" + ri + "_" + ti);
          if (el) el.value = (mk === true ? "\u2713" : mk === false ? "X" : (mk == null ? "" : mk));
        });
      });
    });
  }

  function readProtocolForm() {
    function chk(cid) { var el = document.getElementById(cid); return !!(el && el.checked); }
    function val(cid) { var el = document.getElementById(cid); return el ? String(el.value).trim() : ""; }
    var reasons = [];
    if (chk("npReason1")) reasons.push("1. New product");
    if (chk("npReason2")) reasons.push("2. New process / polymorph");
    if (chk("npReason3")) reasons.push("3. Others (specify)");
    var conds = [];
    if (chk("npCondA")) conds.push("A. 40±2°C / 75±5% RH");
    if (chk("npCondB")) conds.push("B. 25±2°C / 60±5% RH");
    if (chk("npCondC")) conds.push("C. 5±3°C");
    if (chk("npCondD")) conds.push("D. -20°C±5°C");
    if (chk("npCondE")) conds.push("E. Extra samples loaded");
    if (chk("npCondF")) conds.push("F. Any other (specify)");
    var at = [];
    ["A", "B", "C", "D", "E", "F"].forEach(function (l) { if (chk("npAt" + l)) at.push(l); });
    var enc = [];
    if (chk("npEncA")) enc.push("A. Initial Certificate of Analysis");
    if (chk("npEncB")) enc.push("B. Requested tests related documents");
    if (chk("npEncC")) enc.push("C. Any other (specify)");
    var sampleType = chk("npSampleType2") ? "2  Lab validation sample" : (chk("npSampleType3") ? "3  Others (specify)" : "1  Lab sample");
    var packing = { innermost: val("npPackInner"), middle: val("npPackMiddle"), outermost: val("npPackOuter") };
    var schedule = readNpSchedule();
    return {
      product: val("npProduct"), batch: val("npBatch"), code: val("npCode"),
      mfg: val("npMfg"), stpNo: val("npStpNo"), dateIn: val("npDateIn"),
      reasons: reasons, reasonOther: val("npReasonOther"), conds: conds, condOther: val("npCondOther"),
      conditionText: conds.length ? conds.map(function (c) { return c.replace(/^[A-F]\.\s*/, ""); }).join(", ") : "",
      studyAt: at, enclosures: enc, sampleType: sampleType,
      packing: packing,
      packingText: [packing.innermost, packing.middle, packing.outermost].filter(Boolean).join(" "),
      schedule: schedule,
      tests: mapSchedTests(),
      meta: {
        formNo: "F-01-01/ARD015", effectiveDate: "2022-11-26", department: "Analytical Research & Development",
        drugSubstance: val("npProduct"), batch: val("npBatch"), reason: reasons, reasonOther: val("npReasonOther"),
        sampleConditions: conds, sampleConditionOther: val("npCondOther"), studyAt: at, enclosures: enc, sampleType: sampleType,
        manufacturingLocation: val("npMfg"), stpNo: val("npStpNo"), projectCode: val("npCode"), dateIn: val("npDateIn"),
        preparedBy: S.currentUser, reviewedBy: "", approvedBy: "", approvedByArd: "",
        packing: packing, schedule: schedule
      }
    };
  }

  function openProtocolForm(editId) {
    var editing = !!editId;
    var ep = editing ? protocolOf(editId) : null;
    if (editing && !ep) return;
    var changeNote = "";
    if (editing) {
      var prj = projectOf(editId);
      var crs = (prj.approvals || []).filter(function (a) { return a.action === "changes_requested"; });
      var lc = crs[crs.length - 1];
      if (lc) changeNote = '<div class="notice"><strong>Change requested by ' + h(lc.level) + ':</strong> ' + h(lc.comment || "") + "</div>";
    }
    openOverlay(drawerHead(editing ? "Edit Stability Protocol" : "New Stability Protocol", "Analytical Research & Development (ARD)") + '<div class="drawer-b">' +
      '<div class="notice info">' + (editing ? "Change only what the Reviewer asked for, then save and resubmit. The protocol number stays the same." : "Fill this in your company format. The protocol is created as <strong>DRAFT</strong>; after submission it goes to Reviewer then Group Leader sign-off.") + "</div>" +
      changeNote +
      '<div class="eyebrow">Identification</div>' +
      '<label class="fld" style="margin-top:6px">Drug substance</label><input class="input" id="npProduct" placeholder="e.g. Anastrozole" />' +
      '<div class="grid-2" style="margin-top:8px">' +
      '<div><label class="fld">Batch No.</label><input class="input" id="npBatch" placeholder="e.g. HL-ANA/01615" /></div>' +
      '<div><label class="fld">Project Code</label><input class="input" id="npCode" placeholder="e.g. ANZ" /></div>' +
      "</div>" +
      '<div class="grid-2" style="margin-top:8px">' +
      '<div><label class="fld">Manufacturing Location</label><input class="input" id="npMfg" value="Hetero Labs Limited, Unit-II, Kazipally" /></div>' +
      '<div><label class="fld">STP No.</label><input class="input" id="npStpNo" placeholder="e.g. AL-009-04" /></div>' +
      "</div>" +
      '<div><label class="fld" style="margin-top:8px">Mfg Date</label><input class="input" type="date" id="npDateIn" value="' + today() + '" /></div>' +

      '<div class="proto-grid" style="grid-template-columns:1fr 1fr;margin-top:14px">' +
      '<div class="proto-col"><div class="eyebrow">Reason(s) for Stability study [1 to 3]</div>' +
      npCheck("npReason1", "1. New product", true) + npCheck("npReason2", "2. New process / polymorph", false) + npCheck("npReason3", "3. Others (specify)", false) +
      '<input class="input" id="npReasonOther" placeholder="Others — specify" style="margin-top:4px" />' +
      '<div class="eyebrow" style="margin-top:12px">Enclosures</div>' +
      npCheck("npEncA", "A. Initial Certificate of Analysis", true) +
      npCheck("npEncB", "B. Requested tests related documents", true) +
      npCheck("npEncC", "C. Any other (specify)", false) +
      "</div>" +
      '<div class="proto-col"><div class="eyebrow">Stability Study Required At</div>' +
      npCheck("npCondA", "A. 40±2°C / 75±5% RH", true) + npCheck("npCondB", "B. 25±2°C / 60±5% RH", true) +
      npCheck("npCondC", "C. 5±3°C", false) + npCheck("npCondD", "D. -20°C±5°C", false) +
      npCheck("npCondE", "E. Extra samples loaded", false) + npCheck("npCondF", "F. Any other (specify)", false) +
      '<input class="input" id="npCondOther" placeholder="Any other — specify" style="margin-top:4px" />' +
      '<div class="eyebrow" style="margin-top:12px">Sample Details</div>' +
      '<label class="check" style="cursor:pointer"><input type="radio" name="npSampleType" id="npSampleType1" checked /> <div class="c-label">1  Lab sample</div></label>' +
      '<label class="check" style="cursor:pointer"><input type="radio" name="npSampleType" id="npSampleType2" /> <div class="c-label">2  Lab validation sample</div></label>' +
      '<label class="check" style="cursor:pointer"><input type="radio" name="npSampleType" id="npSampleType3" /> <div class="c-label">3  Others (specify)</div></label>' +
      "</div>" +
      "</div>" +

      '<div id="npSchedule"></div>' +

      '<div class="eyebrow" style="margin-top:14px">E-Signatures (automatic)</div>' +
      '<p class="muted" style="font-size:12px;margin-top:4px"><strong>' + h(S.currentUser) + "</strong> will sign as <strong>Prepared By (Analyst)</strong> when this protocol is submitted. Reviewer and Approver names are captured automatically when they approve.</p>" +

      '<div style="margin-top:16px">' +
      (editing ? '<button class="btn primary" data-act="np-update" data-id="' + h(editId) + '">Save changes &amp; resubmit</button>' : '<button class="btn primary" data-act="np-save">Create protocol (Draft)</button>') +
      ' <button class="btn ghost" data-act="close-overlay">Cancel</button></div>' +
      '<p class="muted" style="margin-top:10px">' + (editing ? "Saving sends the protocol back for Reviewer sign-off; the earlier change request stays in the approval history." : "After creating, open the protocol and use <strong>Submit for review</strong> to send it for Reviewer and Group Leader sign-off.") + "</p>" +
      "</div>");
    renderNpSchedule();
    if (editing) { prefillProtocolForm(ep); renderNpSchedule(); prefillSchedule(ep); }
  }

  function npScheduleRows() {
    var tpEl = document.getElementById("npTp");
    var tps = String(tpEl ? tpEl.value : "").split(",").map(function (x) { return parseInt(x.trim(), 10); }).filter(function (n) { return n > 0; });
    if (!tps.length) tps = [1, 2, 3, 6, 9, 12];
    var labels = ["INITIAL"].concat(tps.map(monthLabel));
    var sel = document.getElementById("npTests");
    var names = [];
    if (sel && sel.selectedOptions) names = Array.prototype.slice.call(sel.selectedOptions).map(function (o) { return o.textContent || o.value; });
    return { labels: labels, names: names, all: names.concat(["Enantiomeric purity by HPLC", "Other test"]) };
  }

  var NP_CONDS = [["npCondA", "40±2°C / 75±5% RH"], ["npCondB", "25±2°C / 60±5% RH"], ["npCondC", "5±3°C"], ["npCondD", "-20°C±5°C"], ["npCondE", "Extra samples loaded"], ["npCondF", "Any other (specify)"]];

  function condTempOf(s) { var mm = String(s).match(/(-?\d{1,3})/); return mm ? parseInt(mm[1], 10) : 9999; }

  function npCondLabels() {
    var pairs = NP_CONDS.filter(function (p) { var c = document.getElementById(p[0]); return c && c.checked; });
    pairs.sort(function (a, b) { return condTempOf(a[1]) - condTempOf(b[1]); });
    var labels = pairs.map(function (p) { return p[1]; });
    return labels.length ? labels : [""];
  }

  function renderNpSchedule() {
    var el = document.getElementById("npSchedule");
    if (!el) return;
    var condLabels = npCondLabels();
    var tables = condLabels.map(function (cond, ci) {
      var headCells = SCHED_ROWS.map(function (n) {
        var extra = "";
        if (n.indexOf("Water content") === 0) extra = '<br><input class="input" id="npWaterText_' + ci + '" placeholder="type LOD / TGA" style="width:112px;margin-top:4px" />';
        if (n.indexOf("Related compounds") === 0) extra = '<br><input class="input" id="npRelatedText_' + ci + '" placeholder="type HPLC / GC" style="width:112px;margin-top:4px" />';
        if (n === "Other test") extra = ' /<br><input class="input" id="npOtherTest_' + ci + '" placeholder="type purpose" style="width:112px;margin-top:4px" />';
        return '<th class="num">' + hHead(n) + extra + "</th>";
      }).join("");
      var head = (cond ? '<tr><th class="num" colspan="' + (SCHED_ROWS.length + 1) + '" style="text-align:center">' + h(cond) + "</th></tr>" : "") +
        "<tr><th>Schedule</th>" + headCells + "</tr>";
      var body = SCHED_COLS.map(function (tp, ri) {
        return "<tr><td>" + h(tp) + "</td>" + SCHED_ROWS.map(function (n, ti) {
          var def = ti < SCHED_DEFAULT_TICK;
          return '<td class="num"><select class="select sched-sel" id="npSc_' + ci + "_" + ri + "_" + ti + '">' +
            '<option value="\u2713"' + (def ? " selected" : "") + ">\u2713</option>" +
            '<option value="X"' + (!def ? " selected" : "") + ">X</option>" +
            '<option value="@">@</option></select></td>';
        }).join("") + "</tr>";
      }).join("");
      return '<table class="data sched" style="margin-top:12px"><thead>' + head + "</thead><tbody>" + body + "</tbody></table>";
    }).join("");
    var packingTable = '<table class="data sched" style="margin-top:12px"><thead><tr><th colspan="2">Packing</th></tr></thead><tbody>' +
      '<tr><th>Innermost</th><td><input class="input" id="npPackInner" value="The material should be packed in LDPE bag purged with nitrogen, twisted and tied with tag," /></td></tr>' +
      '<tr><th>Middle</th><td><input class="input" id="npPackMiddle" value="then that bag should be inserted in ALUM bag heat sealed under nitrogen purge." /></td></tr>' +
      '<tr><th>Outermost</th><td><input class="input" id="npPackOuter" value="Finally kept in HDPE container along with silica gel." /></td></tr>' +
      "</tbody></table>";
    el.innerHTML = '<div class="table-wrap" style="margin-top:14px">' + packingTable + tables + "</div>" +
      '<p class="muted" style="font-size:11px">\u2713 = Tests to be analysed &nbsp;&nbsp; X = Tests not to be analysed &nbsp;&nbsp; @ = Tests to be analyzed on demand</p>';
  }

  function readNpSchedule() {
    var otherEl = document.getElementById("npOtherTest");
    var waterEl = document.getElementById("npWaterText");
    var relEl = document.getElementById("npRelatedText");
    var condLabels = npCondLabels();
    return {
      cols: SCHED_ROWS,
      otherTest: otherEl ? String(otherEl.value).trim() : "",
      waterText: waterEl ? String(waterEl.value).trim() : "",
      relatedText: relEl ? String(relEl.value).trim() : "",
      conditions: condLabels.map(function (cond, ci) {
        var wt = document.getElementById("npWaterText_" + ci);
        var rt = document.getElementById("npRelatedText_" + ci);
        var ot = document.getElementById("npOtherTest_" + ci);
        return {
          label: cond,
          waterText: wt ? String(wt.value).trim() : "",
          relatedText: rt ? String(rt.value).trim() : "",
          otherText: ot ? String(ot.value).trim() : "",
          rows: SCHED_COLS.map(function (tp, ri) {
            return { label: tp, marks: SCHED_ROWS.map(function (n, ti) { var el = document.getElementById("npSc_" + ci + "_" + ri + "_" + ti); return (el && el.value) ? el.value : "X"; }) };
          })
        };
      })
    };
  }

  function openNewUser() {
    openOverlay(drawerHead("Add User", "role-based access") + '<div class="drawer-b">' +
      '<label class="fld">Name</label><input class="input" id="nuName" />' +
      '<label class="fld" style="margin-top:10px">Email</label><input class="input" id="nuEmail" />' +
      '<label class="fld" style="margin-top:10px">Role</label><select class="select" id="nuRole"><option>Analyst</option><option>Reviewer</option><option>Group Leader</option><option>Protocol Preparer</option><option>Manager</option><option>Admin</option></select>' +
      '<div style="margin-top:16px"><button class="btn primary" data-act="nu-save">Add user</button> <button class="btn ghost" data-act="close-overlay">Cancel</button></div>' +
      "</div>");
  }

  function openChamber() {
    openOverlay(drawerHead("Add Chamber / Condition", "configurable, not hard-coded") + '<div class="drawer-b">' +
      '<label class="fld">Chamber ID</label><input class="input" id="chId" placeholder="CH-05" />' +
      '<label class="fld" style="margin-top:10px">Name</label><input class="input" id="chName" />' +
      '<label class="fld" style="margin-top:10px">Temperature</label><input class="input" id="chTemp" placeholder="25°C ± 2°C" />' +
      '<label class="fld" style="margin-top:10px">Humidity</label><input class="input" id="chHum" placeholder="60% RH ± 5% RH or NA" />' +
      '<label class="fld" style="margin-top:10px">Location</label><input class="input" id="chLoc" />' +
      '<label class="fld" style="margin-top:10px">Capacity</label><input class="input" id="chCap" type="number" value="100" />' +
      '<div style="margin-top:16px"><button class="btn primary" data-act="ch-save">Add chamber</button> <button class="btn ghost" data-act="close-overlay">Cancel</button></div>' +
      "</div>");
  }

  function finalReportHTML(id) {
    var p = protocolOf(id), pr = projectOf(id), samples = SD.lifecycle.samplesFor(S, id);
    var rows = samples.map(function (s) {
      var res = S.results[s.sampleId] || [];
      var oos = res.filter(function (r) { return r.status === "out_of_spec"; }).length;
      return "<tr><td>" + h(s.timePointLabel) + "</td><td>" + fmt(s.plannedWithdrawal) + "</td><td>" + (s.actualWithdrawal ? fmt(s.actualWithdrawal) : "—") + "</td><td>" + (s.analysisCompleteDate ? fmt(s.analysisCompleteDate) : "Pending") + "</td><td>" + (s.analysisCompleteDate ? (oos ? '<span class="badge tone-danger"><span class="dot"></span>' + oos + " OOS</span>" : '<span class="badge tone-success"><span class="dot"></span>Within spec</span>') : "—") + "</td></tr>";
    }).join("");
    return '<div class="report-preview"><div class="rp-head"><div><h2 style="text-align:left">' + h(p.product) + "</h2><div style=\"color:var(--muted);font-size:11px\">FINAL STABILITY REPORT</div></div><div style=\"text-align:right\"><strong style=\"border:1px solid var(--line-strong);padding:4px 8px;border-radius:4px;font-family:var(--serif)\">STABILITY</strong></div></div>" +
      "<table><tbody>" +
      "<tr><th>Product</th><td>" + h(p.product) + "</td><th>Product Code</th><td>" + h(p.productCode) + "</td></tr>" +
      "<tr><th>Batch</th><td>" + h(p.batches.join(", ")) + "</td><th>Protocol / STP</th><td>" + h(p.protocolNo) + "</td></tr>" +
      "<tr><th>Condition</th><td>" + h(p.storageCondition) + "</td><th>ER Number</th><td>" + (pr.er ? h(pr.er.erNumber) : "—") + "</td></tr>" +
      "<tr><th>Chamber</th><td>" + (pr.loading ? h(pr.loading.chamberName) : "—") + "</td><th>Study Type</th><td>Stability</td></tr>" +
      "</tbody></table>" +
      '<table><thead><tr><th>Time Point</th><th>Scheduled</th><th>Withdrawn</th><th>Analysis</th><th>Result</th></tr></thead><tbody>' + rows + "</tbody></table>" +
      '<p>Assembled automatically from approved protocol, packing, ER, chamber, withdrawal, analysis and review records. No value is re-typed.</p>' +
      '<div class="sign-grid"><div class="s">Prepared by<br>' + h(S.currentUser) + "</div><div class=\"s\">Reviewed by<br>" + (pr.finalReport && pr.finalReport.approvedBy || "") + "</div><div class=\"s\">Approved by<br>&nbsp;</div></div>" +
      "</div>";
  }

  function openFinalReport(id) {
    var p = protocolOf(id), pr = projectOf(id), samples = SD.lifecycle.samplesFor(S, id);
    if (!samples.length || !samples.every(function (s) { return s.analysisCompleteDate; })) {
      alert("Cannot assemble the final report: mandatory analyses are still open for this project.");
      return;
    }
    var fr = pr.finalReport || { status: "not_started" };
    var actions = fr.status === "approved" ? ""
      : fr.status === "under_review"
        ? '<button class="btn primary" data-act="final-approve" data-id="' + id + '">Approve final report</button>'
        : '<button class="btn primary" data-act="final-generate" data-id="' + id + '">Assemble final report</button>';
    openOverlay('<div class="drawer-h"><div><h2>Final Stability Report</h2><div class="muted" style="font-size:12px">' + h(p.product + " · " + p.protocolNo) + '</div></div><div class="spacer"></div>' + actions + ' <button class="x" data-act="close-overlay">&times;</button></div><div class="drawer-b">' + finalReportHTML(id) + "</div>");
  }

  function approveAction(id, level, action, comment) {
    var pr = projectOf(id);
    var nameByLevel = { "Preparer": S.currentUser, "Reviewer": "Dr. V. Sharma", "Group Leader": "Dr. L. Menon" };
    var who = nameByLevel[level] || S.currentUser;
    pr.approvals.push({ level: level, user: who, role: level, action: action, at: stamp(), comment: comment || "" });
    store.audit({ user: who, action: action, entity: "protocol", entityId: protocolOf(id).protocolNo, note: level + " " + action });
    store.save(); render();
  }
  function openChangesModal(id) {
    var p = protocolOf(id);
    var lvl = SD.lifecycle.protocolStatus(S, id) === "UNDER_REVIEW" ? "Reviewer" : "Group Leader";
    openOverlay(drawerHead("Request Changes", (p ? p.protocolNo : "") + " · " + lvl) + '<div class="drawer-b">' +
      '<label class="fld">What needs to be changed? (required)</label>' +
      '<textarea class="input" id="pcComment" rows="4" placeholder="e.g. Add XRD at 6th month; correct Mfg Date; add Related compounds"></textarea>' +
      '<div style="margin-top:14px"><button class="btn danger" data-act="proto-changes-save" data-id="' + id + '">Send back to Preparer</button> <button class="btn ghost" data-act="close-overlay">Cancel</button></div>' +
      '<p class="muted" style="margin-top:10px">The protocol goes back to the Preparer with your comment; status becomes <strong>Changes requested</strong>.</p>' +
      "</div>");
  }

  function doErGenerate(id) {
    var p = protocolOf(id), pr = projectOf(id);
    if (!pr.packing) { alert("Pack the samples first."); return; }
    if (pr.er) { alert("ER already generated: " + pr.er.erNumber); return; }
    pr.er = { erNumber: SD.ids.next(S, "er"), generatedAt: stamp() };
    store.audit({ user: S.currentUser, action: "generate", entity: "er", entityId: pr.er.erNumber, note: "ER generated for " + p.protocolNo });
    store.save(); render();
  }
  function doDocs(id) {
    var pr = projectOf(id), samples = SD.lifecycle.samplesFor(S, id);
    if (!samples.length || !samples.every(function (s) { return s.analysisCompleteDate; })) { alert("Complete all analyses first."); return; }
    DOC_TYPES.forEach(function (t) { pr.documents.push({ id: SD.ids.next(S, "doc"), type: t, at: stamp(), by: S.currentUser }); });
    store.audit({ user: S.currentUser, action: "generate", entity: "documents", entityId: protocolOf(id).protocolNo, note: DOC_TYPES.length + " documents generated" });
    store.save(); render();
  }
  function doFinalGenerate(id) {
    var pr = projectOf(id), samples = SD.lifecycle.samplesFor(S, id);
    if (!samples.length || !samples.every(function (s) { return s.analysisCompleteDate; })) { alert("Cannot assemble: mandatory analyses are open."); return; }
    pr.finalReport = { status: "under_review", generatedAt: stamp(), ref: SD.ids.next(S, "rep") };
    store.audit({ user: S.currentUser, action: "generate", entity: "final_report", entityId: pr.finalReport.ref, note: "Assembled from approved records" });
    store.save(); closeOverlay(); render();
  }
  function doFinalApprove(id) {
    var pr = projectOf(id);
    if (!pr.finalReport || pr.finalReport.status !== "under_review") { alert("Assemble the report first."); return; }
    pr.finalReport.status = "approved"; pr.finalReport.approvedAt = stamp(); pr.finalReport.approvedBy = S.currentUser;
    SD.lifecycle.samplesFor(S, id).forEach(function (s) { s.reportStatus = "approved"; });
    store.audit({ user: S.currentUser, action: "approve", entity: "final_report", entityId: pr.finalReport.ref || protocolOf(id).protocolNo, note: "Final report approved; project completed" });
    store.save(); closeOverlay(); render();
  }

  /* ---------- STP-driven analysis worksheet ---------- */
  var wsState = { protocolId: null, selected: [], results: {}, raw: {} };

  function openWorksheet(preselectId) {
    var opts = S.protocols.map(function (p) { return '<option value="' + h(p.id) + '"' + (preselectId === p.id ? " selected" : "") + ">" + h(p.protocolNo + " — " + p.product) + "</option>"; }).join("");
    openOverlay(drawerHead("New Analysis Worksheet", "select STP → select tests → enter weights") + '<div class="drawer-b">' +
      '<label class="fld">STP Number (read-only source)</label><select class="select" id="wsStp">' + opts + "</select>" +
      '<label class="fld" style="margin-top:10px">Time point (which sample this sheet is for)</label><select class="select" id="wsTimePoint"></select>' +
      '<div style="margin-top:12px"><div class="eyebrow">Tests (from the protocol — tick the ones to analyse)</div><div id="wsTests" class="ws-tests"></div></div>' +
      '<label class="fld" style="margin-top:10px">Attach instrument Excel (optional)</label><input class="input" type="file" id="wsExcel" accept=".xlsx,.xls,.csv" />' +
      '<div style="margin-top:14px"><button class="btn primary" data-act="ws-load">Load theory &amp; data entry</button> <button class="btn ghost" data-act="close-overlay">Cancel</button></div>' +
      '<div id="wsSheet" style="margin-top:18px"></div>' +
      "</div>");
    renderWsTests();
  }

  function renderWsTests() {
    var sel = document.getElementById("wsStp");
    var pid = sel ? sel.value : (S.protocols[0] || {}).id;
    var p = protocolOf(pid); if (!p) return;
    var html = p.tests.map(function (tid) {
      var t = SD.testById(tid);
      return '<label class="check" style="cursor:pointer"><input type="checkbox" data-ws-test="' + h(tid) + '" checked /> <div><div class="c-label">' + h(t.name) + '</div><div class="muted">' + h(t.specification) + "</div></div></label>";
    }).join("");
    document.getElementById("wsTests").innerHTML = html;
    var samples = SD.lifecycle.samplesFor(S, pid).sort(function (a, b) { return a.timePointMonths - b.timePointMonths; });
    document.getElementById("wsTimePoint").innerHTML = samples.map(function (s) {
      return '<option value="' + h(s.id) + '">' + h(s.timePointLabel + " — " + s.sampleId + " · planned " + fmt(s.plannedWithdrawal)) + "</option>";
    }).join("");
  }
  function sampleByRef(ref) {
    var s = store.getSample(ref);
    if (s) return s;
    for (var i = 0; i < S.samples.length; i++) if (S.samples[i].sampleId === ref) return S.samples[i];
    return null;
  }

  function wsLoad() {
    var pid = document.getElementById("wsStp").value;
    var p = protocolOf(pid); if (!p) { alert("Select an STP."); return; }
    var checked = Array.prototype.slice.call(document.querySelectorAll("[data-ws-test]")).filter(function (c) { return c.checked; }).map(function (c) { return c.getAttribute("data-ws-test"); });
    if (!checked.length) checked = p.tests.slice();
    var tpEl = document.getElementById("wsTimePoint");
    wsState = { protocolId: pid, selected: checked, results: {}, raw: {}, sampleId: tpEl ? tpEl.value : "" };
    renderWsSheet();
  }

  function renderWsSheet() {
    var p = protocolOf(wsState.protocolId), stp = stpFor(wsState.protocolId);
    if (!p) return;
    var sp = sampleByRef(wsState.sampleId);
    var head = '<div class="ws-head"><div><strong>' + h(stp ? stp.stpNumber : p.protocolNo) + " · Rev " + h(p.version) + '</strong><div class="muted">' + h(p.product) + " · " + h(p.batches.join(", ")) + " · " + h(p.storageCondition) + (sp ? " · Time point " + h(sp.timePointLabel) : "") + "</div></div></div>";
    var body = wsState.selected.map(function (tid) {
      var t = SD.testById(tid);
      var rec = ((stp && stp.tests) || []).filter(function (x) { return x.testId === tid; })[0] || {};
      var raw = wsState.raw[tid] || {};
      var html = '<div class="ws-test"><div class="ws-title">' + h(t.name) + ' <span class="pill">' + h(t.unit || "—") + "</span></div>";
      html += '<div class="ws-theory"><span class="eyebrow">Method / theory (from STP — read only)</span><div>' + h(rec.theory || "Refer approved STP.") + "</div></div>";
      if (rec.variables && rec.variables.length) {
        rec.variables.forEach(function (v) {
          html += '<label class="fld">' + h(v.label) + '</label><input class="input" id="ws_in_' + h(tid) + "_" + h(v.name) + '" value="' + h(raw[v.name] || "") + '" />';
        });
        html += '<div class="muted" style="font-size:11px">Formula: <code>' + h(rec.formula) + "</code>" + (rec.formulaNote ? " — " + h(rec.formulaNote) : "") + "</div>";
      } else {
        html += '<label class="fld">Result (enter actual)</label><input class="input" id="ws_in_' + h(tid) + '_result" value="' + h(raw.result || "") + '" />';
      }
      html += '<div class="ws-spec">Specification: ' + h(t.specification) + "</div>";
      html += '<label class="fld" style="margin-top:8px">Chromatogram / instrument file (optional)</label><input class="input" type="file" id="ws_chrom_' + h(tid) + '" accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx,.xls,.txt" />';
      var r = wsState.results[tid];
      if (r) html += '<div class="ws-verdict ' + (r.verdict === "PASS" ? "pass" : r.verdict === "FAIL" ? "fail" : "manual") + '">Result: ' + h(r.value) + " → " + h(r.verdict) + "</div>";
      return html + "</div>";
    }).join("");
    document.getElementById("wsSheet").innerHTML = '<div class="worksheet" id="wsPrintable">' + head + body +
      '<div class="ws-actions" style="margin-top:16px"><button class="btn primary" data-act="ws-calc">Calculate &amp; check specification</button> <button class="btn primary" data-act="ws-save">Save to time point</button> <button class="btn" data-act="ws-print">Print / PDF worksheet</button></div></div>';
  }

  function wsCalc() {
    var p = protocolOf(wsState.protocolId), stp = stpFor(wsState.protocolId);
    if (!p) return;
    wsState.selected.forEach(function (tid) {
      var t = SD.testById(tid);
      var rec = ((stp && stp.tests) || []).filter(function (x) { return x.testId === tid; })[0] || {};
      var raw = {}, value = "", numeric = NaN;
      if (rec.variables && rec.variables.length) {
        rec.variables.forEach(function (v) {
          var el = document.getElementById("ws_in_" + tid + "_" + v.name);
          raw[v.name] = el ? el.value : "";
        });
        var vars = {};
        rec.variables.forEach(function (v) { vars[v.name] = raw[v.name] !== "" ? parseFloat(raw[v.name]) : NaN; });
        try { value = SD.evalFormula(rec.formula, vars); numeric = value; } catch (e) { value = "Error"; numeric = NaN; }
      } else {
        var rEl = document.getElementById("ws_in_" + tid + "_result");
        raw.result = rEl ? rEl.value : "";
        value = raw.result; numeric = parseFloat(value);
      }
      if (typeof value === "number" && !isNaN(value)) value = Math.round(value * 1000) / 1000;
      wsState.raw[tid] = raw;
      wsState.results[tid] = { value: value === "" || value === null ? "—" : value, verdict: SD.checkSpec(numeric, t.specification) };
    });
    renderWsSheet();
  }

  function wsSave() {
    var stp = stpFor(wsState.protocolId);
    var sample = sampleByRef(wsState.sampleId);
    if (!sample) { alert("Choose a time point first."); return; }
    var rows = S.results[sample.sampleId] || [];
    wsState.selected.forEach(function (tid) {
      var t = SD.testById(tid);
      var rec = ((stp && stp.tests) || []).filter(function (x) { return x.testId === tid; })[0] || {};
      var raw = {}, value = "", numeric = NaN;
      if (rec.variables && rec.variables.length) {
        rec.variables.forEach(function (v) { var el = document.getElementById("ws_in_" + tid + "_" + v.name); raw[v.name] = el ? el.value : ""; });
        var vars = {}; rec.variables.forEach(function (v) { vars[v.name] = raw[v.name] !== "" ? parseFloat(raw[v.name]) : NaN; });
        try { value = SD.evalFormula(rec.formula, vars); numeric = value; } catch (e) { value = ""; }
      } else {
        var rEl = document.getElementById("ws_in_" + tid + "_result"); raw.result = rEl ? rEl.value : ""; value = raw.result; numeric = parseFloat(value);
      }
      if (typeof value === "number" && !isNaN(value)) value = Math.round(value * 1000) / 1000;
      var verdict = SD.checkSpec(numeric, t.specification);
      var row = rows.filter(function (x) { return x.testId === tid; })[0];
      if (!row) { row = { testId: tid, test: t.name, method: t.method, specification: t.specification, unit: t.unit, result: "", status: "pending" }; rows.push(row); }
      var chromEl = document.getElementById("ws_chrom_" + tid);
      var chromName = chromEl && chromEl.files && chromEl.files[0] ? chromEl.files[0].name : (row.chromatogram || "");
      store.audit({ user: S.currentUser, action: "update", entity: "result", entityId: sample.sampleId, field: t.name, oldValue: row.result, newValue: value === "" || value === null ? "" : value });
      row.result = value === "" || value === null ? "" : value;
      row.status = verdict === "PASS" ? "within_spec" : verdict === "FAIL" ? "out_of_spec" : (value !== "" ? "manual" : "pending");
      row.analyst = S.currentUser; row.date = today(); row.chromatogram = chromName;
    });
    var excelEl = document.getElementById("wsExcel");
    if (excelEl && excelEl.files && excelEl.files[0]) sample.instrumentExcel = excelEl.files[0].name;
    S.results[sample.sampleId] = rows;
    if (!sample.analysisStart) sample.analysisStart = today();
    store.save(); closeOverlay(); location.hash = "#/datasheet/" + wsState.protocolId; render();
  }

  function wsPrint() {
    var el = document.getElementById("wsPrintable");
    if (!el || !window.open) { window.print(); return; }
    var w = window.open("", "_blank");
    if (!w) { window.print(); return; }
    w.document.write('<html><head><title>Analysis Worksheet</title><style>' +
      'body{font-family:Segoe UI,Arial,sans-serif;font-size:12px;color:#152230;padding:20px}' +
      '.ws-test{border:1px solid #cdd8e2;border-radius:8px;padding:12px;margin-bottom:12px}' +
      '.ws-title{font-weight:700}.ws-theory{background:#f4f7fa;padding:8px 10px;border-radius:6px;margin:6px 0}' +
      '.ws-verdict{font-weight:700}.ws-verdict.pass{color:#1c7a4c}.ws-verdict.fail{color:#bd3b2e}.ws-verdict.manual{color:#a9660f}' +
      '.btn{display:none}.eyebrow{font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:#5c6b7a}' +
      'table{border-collapse:collapse;width:100%}</style></head><body>' + el.innerHTML + "</body></html>");
    w.document.close();
    w.focus();
    w.print();
  }

  /* ---------- R&D early pull form + workflow ---------- */
  var epCtx = { sample: null, official: null };

  function openEarlyPull(preselectRef) {
    var open = (S.samples || []).filter(function (s) { return s.plannedWithdrawal && !s.actualWithdrawal; });
    var opts = open.map(function (s) {
      return '<option value="' + h(s.id) + '"' + ((preselectRef && (s.sampleId === preselectRef || s.id === preselectRef)) ? " selected" : "") + ">" + h(s.sampleId + " — " + s.product + " · " + s.batch + " · " + s.timePointLabel) + "</option>";
    }).join("");
    openOverlay(drawerHead("R&D Early Pull Request", "advance sample withdrawal — official date unchanged") + '<div class="drawer-b">' +
      '<label class="fld">Sample / Time point</label><select class="select" id="epSample">' + (opts || '<option value="">No sample available</option>') + "</select>" +
      '<div id="epFields" style="margin-top:12px"></div>' +
      '<div style="margin-top:16px"><button class="btn primary" data-act="ep-save">Submit request</button> <button class="btn ghost" data-act="close-overlay">Cancel</button></div>' +
      "</div>");
    renderEpFields();
  }

  function renderEpFields() {
    var sel = document.getElementById("epSample");
    var s = sampleByRef(sel ? sel.value : "");
    var box = document.getElementById("epFields");
    if (!s) { epCtx = { sample: null, official: null }; box.innerHTML = '<div class="muted">No sample available for early pull (all schedule items may already be withdrawn).</div>'; return; }
    epCtx = { sample: s, official: s.plannedWithdrawal };
    var prj = projectOf(s.protocolId);
    var loadDate = (prj && prj.loading) ? prj.loading.date : null;
    var off = s.plannedWithdrawal;
    var minReq = dates.addDays(off, -30);
    var maxReq = off;
    var defReq = dates.addDays(off, -10);
    if (defReq < minReq) defReq = minReq;
    if (defReq > maxReq) defReq = maxReq;
    var defAdv = dates.diffDays(defReq, off);
    box.innerHTML =
      '<dl class="meta"><dt>Protocol No</dt><dd>' + h(s.protocolNo) + "</dd>" +
      "<dt>Product</dt><dd>" + h(s.product) + "</dd>" +
      "<dt>Batch No</dt><dd>" + h(s.batch) + "</dd>" +
      "<dt>Stability Condition</dt><dd>" + h(s.storageCondition) + "</dd>" +
      "<dt>Time Point</dt><dd>" + h(s.timePointLabel) + "</dd>" +
      "<dt>Load Date</dt><dd>" + (loadDate ? fmt(loadDate) : "—") + "</dd>" +
      "<dt>Official Withdrawal Date</dt><dd>" + fmt(s.plannedWithdrawal) + "</dd></dl>" +
      '<input type="hidden" id="epOfficial" value="' + h(s.plannedWithdrawal) + '" />' +
      '<input type="hidden" id="epMin" value="' + h(minReq) + '" /><input type="hidden" id="epMax" value="' + h(maxReq) + '" />' +
      '<label class="fld" style="margin-top:10px">Early Pull Required</label><select class="select" id="epRequired"><option value="yes">Yes</option><option value="no">No</option></select>' +
      '<label class="fld" style="margin-top:10px">Requested Pull Date (same date, or up to 30 days / 1 month before official: ' + fmt(minReq) + " → " + fmt(maxReq) + ')</label><input class="input" type="date" id="epReqDate" min="' + h(minReq) + '" max="' + h(maxReq) + '" value="' + h(defReq) + '" />' +
      '<label class="fld" style="margin-top:10px">Advance (auto — days earlier than official)</label><input class="input" id="epAdvanceShow" readonly value="' + defAdv + '" />' +
      '<label class="fld" style="margin-top:10px">Reason for Early Pull</label><input class="input" id="epReason" />' +
      '<label class="fld" style="margin-top:10px">Requested By</label><input class="input" id="epBy" value="' + h(S.currentUser) + '" />' +
      '<label class="fld" style="margin-top:10px">Priority</label><select class="select" id="epPriority"><option>Normal</option><option>Urgent</option></select>' +
      '<label class="fld" style="margin-top:10px">Remarks</label><input class="input" id="epRemarks" placeholder="Optional — e.g. meeting/request reference, urgency reason" />';
    var reqEl = document.getElementById("epReqDate");
    if (reqEl) reqEl.value = defReq;
    var advShow = document.getElementById("epAdvanceShow");
    if (advShow) advShow.value = defAdv;
  }

  function recomputeEp() {
    var req = document.getElementById("epReqDate");
    var advEl = document.getElementById("epAdvanceShow");
    if (!req || !epCtx.official) return;
    var adv = req.value ? dates.diffDays(req.value, epCtx.official) : null;
    if (advEl) advEl.value = (adv === null ? "" : adv);
  }

  function epSave() {
    var s = epCtx.sample || sampleByRef(document.getElementById("epSample").value);
    if (!s) { alert("Choose a sample."); return; }
    var reqEl = document.getElementById("epReqDate");
    var requested = reqEl ? reqEl.value : "";
    var reason = document.getElementById("epReason").value.trim();
    if (!reason) { alert("Reason for early pull is required."); return; }
    if (!requested) { alert("Requested pull date is required."); return; }
    var official = epCtx.official || s.plannedWithdrawal;
    var minReq = dates.addDays(official, -30);
    var maxReq = official;
    if (requested < minReq || requested > maxReq) { alert("Requested pull date must be within 30 days (1 month) before the official date (" + fmt(minReq) + " to " + fmt(maxReq) + ")."); return; }
    var adv = dates.diffDays(requested, official);
    var ep = {
      id: SD.ids.next(S, "ep"), sampleRef: s.sampleId, sampleInternalId: s.id, protocolId: s.protocolId,
      product: s.product, batch: s.batch, condition: s.storageCondition, timePointLabel: s.timePointLabel,
      officialDate: official, advanceDays: adv, requestedDate: requested, windowMin: minReq, windowMax: maxReq,
      reason: reason, requestedBy: document.getElementById("epBy").value.trim() || S.currentUser,
      priority: document.getElementById("epPriority").value, remarks: document.getElementById("epRemarks").value.trim(),
      status: "SUBMITTED", createdAt: stamp(),
      history: [{ at: stamp(), user: S.currentUser, action: "submitted", note: "Official " + official + "; early " + requested + " (" + adv + "d)" }]
    };
    S.pulls.unshift(ep);
    store.audit({ user: S.currentUser, action: "create", entity: "early_pull", entityId: ep.id, field: "requestedDate", oldValue: official, newValue: requested, note: reason });
    store.save(); closeOverlay(); location.hash = "#/earlypull"; render();
  }

  function epAction(id, action, note) {
    var ep = (S.pulls || []).filter(function (x) { return x.id === id; })[0];
    if (!ep) return;
    var before = ep.status;
    if (action === "reviewer_approve") ep.status = "REVIEWER_APPROVED";
    else if (action === "approve") ep.status = "APPROVED";
    else if (action === "reject") { ep.status = "REJECTED"; ep.rejectReason = note || "Rejected"; }
    ep.history.push({ at: stamp(), user: S.currentUser, action: action, note: note || "" });
    store.audit({ user: S.currentUser, action: action, entity: "early_pull", entityId: id, field: "status", oldValue: before, newValue: ep.status, note: note || "" });
    store.save(); render();
  }

  function openEpWithdraw(id) {
    var ep = (S.pulls || []).filter(function (x) { return x.id === id; })[0];
    if (!ep) return;
    var minDate = ep.windowMin || (ep.officialDate ? dates.addDays(ep.officialDate, -30) : null);
    var maxDate = ep.windowMax || ep.officialDate;
    var t = today();
    var inRange = t && (!minDate || t >= minDate) && (!maxDate || t <= maxDate);
    var defDate = ep.actualDate || (inRange ? t : (ep.requestedDate || t));
    openOverlay(drawerHead("Withdraw Sample (R&D Early Pull)", ep.id + " · " + ep.product) + '<div class="drawer-b">' +
      '<dl class="meta"><dt>Scheduled Withdrawal</dt><dd>' + fmt(ep.officialDate) + "</dd>" +
      "<dt>R&D Early Pull</dt><dd>" + fmt(ep.requestedDate) + "</dd>" +
      "<dt>Advance</dt><dd>" + ep.advanceDays + " days</dd></dl>" +
      '<label class="fld" style="margin-top:10px">Actual Withdrawal Date</label><input class="input" type="date" id="epwDate" value="' + h(defDate) + '" />' +
      '<label class="fld" style="margin-top:10px">Withdrawn By</label><input class="input" id="epwBy" value="' + h(S.currentUser) + '" />' +
      '<label class="fld" style="margin-top:10px">Quantity Withdrawn</label><input class="input" id="epwQty" />' +
      '<label class="fld" style="margin-top:10px">Sample ID</label><input class="input" id="epwSampleId" value="' + h(ep.sampleRef) + '" readonly />' +
      '<label class="fld" style="margin-top:10px">Remarks</label><input class="input" id="epwRemarks" />' +
      '<div style="margin-top:16px"><button class="btn primary" data-act="ep-withdraw-save" data-id="' + ep.id + '">' + (ep.actualDate ? "Save withdrawal date" : "Withdraw Sample") + '</button> <button class="btn ghost" data-act="close-overlay">Cancel</button></div>' +
      '<p class="muted" style="margin-top:10px">Any day from ' + fmt(minDate) + " to " + fmt(maxDate) + " (1 day to 1 month after loading). The official date is not changed.</p>" +
      "</div>");
    var dEl = document.getElementById("epwDate");
    if (dEl) dEl.value = defDate;
  }

  function epWithdrawSave(id) {
    var ep = (S.pulls || []).filter(function (x) { return x.id === id; })[0];
    if (!ep) return;
    var s = sampleByRef(ep.sampleRef);
    if (!s) { alert("Sample not found."); return; }
    var d = document.getElementById("epwDate").value;
    if (!d) { alert("Actual withdrawal date is required."); return; }
    var minDate = ep.windowMin || (ep.officialDate ? dates.addDays(ep.officialDate, -30) : ep.requestedDate);
    var maxDate = ep.windowMax || ep.officialDate;
    if (minDate && d < minDate) { alert("Actual withdrawal date cannot be before " + fmt(minDate) + "."); return; }
    if (maxDate && d > maxDate) { alert("Actual withdrawal date cannot be after " + fmt(maxDate) + "."); return; }
    store.updateSample(s.id, { actualWithdrawal: d }, S.currentUser);
    if (!s.analysisStart) store.updateSample(s.id, { analysisStart: d }, S.currentUser);
    ep.status = "WITHDRAWN"; ep.actualDate = d;
    ep.history.push({ at: stamp(), user: S.currentUser, action: "withdrawn", note: "Actual " + d + "; official " + ep.officialDate + " unchanged" });
    store.audit({ user: S.currentUser, action: "withdraw", entity: "early_pull", entityId: id, field: "actualWithdrawal", oldValue: null, newValue: d, note: "Official " + ep.officialDate + " unchanged" });
    store.save(); closeOverlay(); render();
  }

  /* ---------- events ---------- */
  function onViewClick(e) {
    var btn = e.target.closest("[data-act]");
    if (!btn) return;
    var act = btn.getAttribute("data-act"), id = btn.getAttribute("data-id");
    if (act === "open-sample") { location.hash = "#/sample/" + id; }
    else if (act === "wd-open") openWithdraw(id);
    else if (act === "start-analysis") {
      var s = store.getSample(id);
      store.updateSample(id, { analysisStart: today(), analyst: s.analyst || S.currentUser }, S.currentUser);
      render();
    } else if (act === "results-open") openResults(id);
    else if (act === "complete-analysis") {
      if (!allResultsEntered(store.getSample(id))) { alert("Enter a result for every test before completing the analysis."); return; }
      var cs = store.getSample(id);
      var patchCa = { analysisCompleteDate: today(), reviewStatus: "pending" };
      if (!cs.arNumber) patchCa.arNumber = SD.ids.next(S, "ar");
      store.updateSample(id, patchCa, S.currentUser);
      if (patchCa.arNumber) store.audit({ user: S.currentUser, action: "generate", entity: "ar", entityId: patchCa.arNumber, note: "AR number generated on analysis completion" });
      store.save(); render();
    } else if (act === "review-approve") {
      store.updateSample(id, { reviewStatus: "approved" }, S.currentUser);
      render();
    } else if (act === "report-generate") {
      var smp = store.getSample(id);
      store.updateSample(id, { reportStatus: "generated" }, S.currentUser);
      if (smp) store.audit({ user: S.currentUser, action: "generate", entity: "report", entityId: smp.sampleId, note: "Report generated from template" });
      store.save();
      location.hash = "#/reports/" + id;
    } else if (act === "report-approve") {
      var s2 = store.getSample(id);
      store.updateSample(id, { reportStatus: "approved" }, S.currentUser);
      if (s2) store.audit({ user: S.currentUser, action: "approve", entity: "report", entityId: s2.sampleId, note: "Report approved" });
      store.save();
      render();
    } else if (act === "report-preview") {
      var s3 = store.getSample(id);
      if (s3) { overlayReport(s3); }
    } else if (act === "export-samples") exportSet("full");
    else if (act === "export-month") exportSet("month");
    else if (act === "export-pending") exportSet("pending");
    else if (act === "export-overdue") exportSet("overdue");
    else if (act === "export-completed") exportSet("completed");
    else if (act === "export-excel") downloadXls("stability-full-data.xls", sampleCSV(S.samples), "Stability Data");
    else if (act === "export-original") {
      if (!S.sheet || !S.sheet.dataUrl) { alert("No uploaded Excel file is stored yet. Choose your file under Import Monthly Schedule first."); return; }
      downloadDataUrl(S.sheet.name || "uploaded-sheet", S.sheet.dataUrl);
    }
    else if (act === "export-same") {
      if (!S.sheet || !S.sheet.headers || !S.sheet.headers.length) { alert("No imported columns stored yet. Import your monthly schedule file first."); return; }
      var base = (S.sheet.name || "monthly-schedule").replace(/\.[^.]+$/, "");
      downloadCSV(base + "-same-columns.csv", [S.sheet.headers].concat(S.sheet.rows));
    }
    else if (act === "clear-filters") { filters = { search: "", product: "", batch: "", status: "", storage: "", analyst: "", timePoint: "" }; render(); }
    else if (act === "filter-product") { filters = { search: "", product: btn.getAttribute("data-code"), batch: "", status: "", storage: "", analyst: "", timePoint: "" }; location.hash = "#/samples"; render(); }
    else if (act === "protocol-open") openProtocol(id);
    else if (act === "set-month") { scheduleMonth = btn.getAttribute("data-month"); location.hash = "#/schedule"; render(); }
    else if (act === "back") { history.length > 1 ? history.back() : (location.hash = "#/"); }
    else if (act === "close-overlay") closeOverlay();
    else if (act === "import-parse") openImportPreview();
    else if (act === "import-confirm") confirmImport();
    else if (act === "import-clear") { document.getElementById("csvText").value = ""; document.getElementById("importResult").innerHTML = ""; }
    else if (act === "settings-save") {
      S.settings.withdrawalWindowDays = Math.max(0, parseInt(document.getElementById("setWindow").value, 10) || 0);
      S.settings.analysisDueDays = Math.max(0, parseInt(document.getElementById("setAnalysis").value, 10) || 0);
      S.settings.reportDueDays = Math.max(0, parseInt(document.getElementById("setReport").value, 10) || 0);
      store.audit({ user: S.currentUser, action: "update", entity: "settings", entityId: "timeline", note: "Rules updated" });
      store.save(); render();
    } else if (act === "reset-demo") {
      if (confirm("Reset all data to the labelled demo seed?")) { store.reset(SD.seed); S = store.state; SD.lifecycle.ensure(S); render(); }
    }
    else if (act === "new-protocol") openNewProtocol();
    else if (act === "proto-edit") openProtocolForm(id);
    else if (act === "step-back") revertStep(id, btn.getAttribute("data-key"));
    else if (act === "pack-open") openPack(id);
    else if (act === "er-generate") doErGenerate(id);
    else if (act === "load-open") openLoad(id);
    else if (act === "load-add") openAddConditions(id);
    else if (act === "doc-generate-all") doDocs(id);
    else if (act === "final-open") openFinalReport(id);
    else if (act === "chamber-new") openChamber();
    else if (act === "new-user") openNewUser();
    else if (act === "proto-submit") approveAction(id, "Preparer", "submitted", "Submitted for review");
    else if (act === "proto-review-approve") approveAction(id, "Reviewer", "approved", "Reviewed");
    else if (act === "proto-gl-approve") approveAction(id, "Group Leader", "approved", "Approved");
    else if (act === "proto-changes") openChangesModal(id);
    else if (act === "ws-new") openWorksheet(null);
    else if (act === "ws-new-stp") openWorksheet(id);
    else if (act === "ep-new") openEarlyPull(null);
    else if (act === "ep-open") { var sp0 = store.getSample(id); openEarlyPull(sp0 ? sp0.sampleId : null); }
    else if (act === "ep-reviewer-approve") epAction(id, "reviewer_approve", "Reviewer approved");
    else if (act === "ep-gl-approve") epAction(id, "approve", "Group Leader approved");
    else if (act === "ep-reject") { var rj = (typeof prompt === "function") ? prompt("Reason for rejection:") : ""; if (rj === null) return; epAction(id, "reject", rj || "Rejected"); }
    else if (act === "ep-withdraw") openEpWithdraw(id);
  }

  function overlayReport(s) {
    openOverlay('<div class="drawer-h"><div><h2>Report preview</h2><div class="muted" style="font-size:12px">' + h(s.sampleId) + '</div></div><div class="spacer"></div><button class="btn small" onclick="window.print()">Print</button> <button class="x" data-act="close-overlay">&times;</button></div><div class="drawer-b">' + reportHTML(store.getSample(s.id)) + "</div>");
  }

  function onViewChange(e) {
    var t = e.target;
    if (t.matches("[data-act='month-select']")) { scheduleMonth = t.value; render(); return; }
    if (t.matches("[data-act='proto-filter']")) { protoFilter = t.value; render(); return; }
    if (t.matches("[data-filter]")) { filters[t.getAttribute("data-filter")] = t.value; render(); return; }
    if (t.id === "csvFile" && t.files && t.files[0]) {
      var f = t.files[0];
      if (f.size > 4 * 1024 * 1024) alert("This file is larger than 4 MB; it may not fit in browser storage. The columns will still be imported, but keep the original file safe.");
      var dr = new FileReader();
      dr.onload = function () {
        S.sheet = S.sheet || {};
        S.sheet.name = f.name;
        S.sheet.mime = f.type || "";
        S.sheet.size = f.size;
        S.sheet.dataUrl = String(dr.result);
        store.save();
        var nm = document.getElementById("sheetName"); if (nm) nm.textContent = f.name;
      };
      dr.readAsDataURL(f);
      if (/\.xlsx$/i.test(f.name)) {
        /* auto-read the .xlsx rows into the import preview */
        var elx = document.getElementById("csvText");
        if (elx) elx.value = "Reading " + f.name + " …";
        if (f.arrayBuffer) {
          f.arrayBuffer().then(function (buf) { return SD.readXlsx(buf); }).then(function (res) {
            var lines = res.rows.map(function (r) { return r.map(csvCell).join(","); }).join("\r\n");
            var el = document.getElementById("csvText"); if (el) el.value = lines;
            openImportPreview();
          }).catch(function (e) { alert("Could not read .xlsx: " + e.message + " — please use CSV or paste the rows."); });
        }
      } else if (/\.(csv|txt)$/i.test(f.name)) {
        var tr = new FileReader();
        tr.onload = function () { var el = document.getElementById("csvText"); if (el) el.value = String(tr.result); };
        tr.readAsText(f);
      } else {
        var el2 = document.getElementById("csvText");
        if (el2) el2.value = "Old .xls format is not auto-read. Save it as .xlsx or CSV, or paste the rows here.";
      }
    }
  }

  function onViewInput(e) {
    var t = e.target;
    if (t.matches("[data-filter='search']")) { filters.search = t.value; }
  }

  function onViewKeydown(e) {
    if (e.target.matches("[data-filter='search']") && e.key === "Enter") { render(); }
  }

  function onOverlayClick(e) {
    if (e.target.classList.contains("overlay") || e.target.closest("[data-act='close-overlay']")) { closeOverlay(); return; }
    var btn = e.target.closest("[data-act]");
    if (!btn) return;
    var act = btn.getAttribute("data-act"), id = btn.getAttribute("data-id");
    if (act === "wd-save") {
      var dateEl = document.getElementById("wdDate");
      var val = dateEl ? dateEl.value : "";
      if (!val) { alert("Choose an actual withdrawal date."); return; }
      var patch = { actualWithdrawal: val };
      if (document.getElementById("wdStart").value === "yes") patch.analysisStart = val;
      var res = store.validateSample(Object.assign({}, store.getSample(id), patch));
      if (res.length) { alert(res.join("\n")); return; }
      store.updateSample(id, patch, S.currentUser);
      closeOverlay(); render();
    } else if (act === "results-save") {
      var sample = store.getSample(id);
      var rows = S.results[sample.sampleId] || [];
      var resultInputs = document.querySelectorAll("[data-result]");
      var statusInputs = document.querySelectorAll("[data-result-status]");
      Array.prototype.forEach.call(resultInputs, function (inp, i) {
        var idx = parseInt(inp.getAttribute("data-result"), 10);
        var val = inp.value.trim();
        var status = statusInputs[i] ? statusInputs[i].value : "pending";
        if (val && status === "pending") status = "within_spec";
        if (!val && status !== "na") status = "pending";
        if (!rows[idx]) return;
        if (rows[idx].result !== val || rows[idx].status !== status) {
          store.audit({ user: S.currentUser, action: "update", entity: "result", entityId: sample.sampleId, field: rows[idx].test, oldValue: rows[idx].result, newValue: val });
        }
        rows[idx].result = val; rows[idx].status = status;
        rows[idx].analyst = S.currentUser; rows[idx].date = today();
      });
      S.results[sample.sampleId] = rows;
      store.save(); closeOverlay(); render();
    } else if (act === "pack-save") {
      var pk = protocolOf(id), pkr = projectOf(id);
      var pkConds = protocolConditionList(pk);
      var pkRecords = pkConds.map(function (cond, i) {
        function g(base) { var el = document.getElementById(base + "_" + i); return el ? String(el.value).trim() : ""; }
        return {
          condition: cond,
          quantity: g("pkQty") || "Not specified",
          container: pk.pack || "",
          date: g("pkDate") || today(),
          by: g("pkBy") || S.currentUser,
          remarks: g("pkRemarks")
        };
      });
      pkr.packing = {
        packingId: SD.ids.next(S, "pk"),
        quantity: pkRecords[0].quantity, container: pkRecords[0].container, date: pkRecords[0].date, by: pkRecords[0].by, remarks: pkRecords[0].remarks,
        conditions: pkRecords
      };
      store.audit({ user: S.currentUser, action: "create", entity: "packing", entityId: pk.protocolNo, field: "packingId", oldValue: null, newValue: pkr.packing.packingId, note: "Sample packed (" + pkRecords.length + " condition(s))" });
      pkr.er = { erNumber: SD.ids.next(S, "er"), generatedAt: stamp() };
      store.audit({ user: S.currentUser, action: "generate", entity: "er", entityId: pkr.er.erNumber, note: "Auto-generated from packing " + pkr.packing.packingId });
      store.save(); closeOverlay(); render();
    } else if (act === "load-save") {
      var lp = protocolOf(id), lpr = projectOf(id);
      var lConds = protocolConditionList(lp);
      var loadRecords = lConds.map(function (cond, i) {
        function g(base) { var el = document.getElementById(base + "_" + i); return el ? String(el.value).trim() : ""; }
        var chId = g("loadChamber");
        var ch = S.chambers.filter(function (c) { return c.id === chId; })[0] || {};
        return {
          condition: cond, chamberId: chId, chamberName: ch.name || chId,
          chamberCondition: ch.temperature + (ch.humidity && ch.humidity !== "NA" ? " / " + ch.humidity : ""),
          rack: g("loadRack"), shelf: g("loadShelf"), qty: g("loadQty"),
          date: g("loadDate") || today(), time: g("loadTime"), by: S.currentUser
        };
      });
      if (loadRecords.some(function (r) { return !r.chamberId; })) { alert("Choose a chamber for every condition."); return; }
      lpr.loading = {
        loadingId: SD.ids.next(S, "load"),
        chamberId: loadRecords[0].chamberId, chamberName: loadRecords[0].chamberName, condition: loadRecords[0].chamberCondition,
        rack: loadRecords[0].rack, shelf: loadRecords[0].shelf, qty: loadRecords[0].qty,
        date: loadRecords[0].date, time: loadRecords[0].time, by: S.currentUser,
        conditions: loadRecords
      };
      store.audit({ user: S.currentUser, action: "create", entity: "loading", entityId: lp.protocolNo, field: "loadingId", oldValue: null, newValue: lpr.loading.loadingId, note: "Loaded " + loadRecords.length + " condition(s) into chambers" });
      generateScheduleForLoading(lp, lpr.loading);
      store.save(); closeOverlay(); render();
    } else if (act === "load-add-save") {
      var ap = protocolOf(id), apr = projectOf(id);
      if (!apr.loading) return;
      var missing = missingConditions(ap, apr.loading);
      var addedRecs = missing.map(function (cond, i) {
        function g(base) { var el = document.getElementById(base + "_" + i); return el ? String(el.value).trim() : ""; }
        var chId = g("laChamber");
        var ch = S.chambers.filter(function (c) { return c.id === chId; })[0] || {};
        return {
          condition: cond, chamberId: chId, chamberName: ch.name || chId,
          chamberCondition: ch.temperature + (ch.humidity && ch.humidity !== "NA" ? " / " + ch.humidity : ""),
          rack: g("laRack"), shelf: g("laShelf"), qty: g("laQty"),
          date: g("laDate") || today(), time: g("laTime"), by: S.currentUser
        };
      });
      if (addedRecs.some(function (r) { return !r.chamberId; })) { alert("Choose a chamber for every condition."); return; }
      if (!apr.loading.conditions) apr.loading.conditions = [{
        condition: apr.loading.condition, chamberId: apr.loading.chamberId, chamberName: apr.loading.chamberName,
        chamberCondition: apr.loading.condition, rack: apr.loading.rack, shelf: apr.loading.shelf, qty: apr.loading.qty,
        date: apr.loading.date, time: apr.loading.time, by: apr.loading.by
      }];
      apr.loading.conditions = apr.loading.conditions.concat(addedRecs);
      addScheduleConditions(ap, apr.loading, addedRecs);
      store.audit({ user: S.currentUser, action: "create", entity: "loading", entityId: ap.protocolNo, note: "Added " + addedRecs.length + " condition(s) to loading" });
      store.save(); closeOverlay(); render();
    } else if (act === "np-save") {
      var f = readProtocolForm();
      if (!f.product || !f.batch) { alert("Product and batch are required."); return; }
      var nid = "p" + Date.now();
      var autoNo = SD.ids.next(S, "prot"); /* STB-PROT-<year>-<seq> */
      var npParts = autoNo.split("-");
      var pcode = (f.code || "PROT").toUpperCase().replace(/[^A-Z0-9]/g, "") || "PROT";
      var protoNo = "STB-" + pcode + "-" + (npParts[2] || "") + "-" + (npParts[3] || "");
      S.protocols.push({
        id: nid, protocolNo: protoNo, product: f.product,
        productCode: f.code || "—", apiOrForm: "Drug substance",
        storageCondition: f.conditionText || "25°C ± 2°C / 60% RH ± 5% RH", humidity: "NA",
        pack: f.packingText || "Not specified", batches: [f.batch],
        timePoints: [1, 2, 3, 6, 9, 12], tests: f.tests.length ? f.tests : (S.testLibrary || []).slice(0, 6).map(function (t) { return t.id; }),
        effectiveDate: today(), version: "V1.0", status: "Active",
        reason: f.reasons.join("; ") || "—", projectCode: f.code || "—",
        manufacturingLocation: f.mfg, dateIn: f.dateIn,
        protocolMeta: f.meta
      });
      SD.lifecycle.ensure(S);
      store.audit({ user: S.currentUser, action: "create", entity: "protocol", entityId: protoNo, note: "Protocol created (company format, draft)" });
      store.save(); closeOverlay(); location.hash = "#/project/" + nid; render();
    } else if (act === "np-update") {
      var up = readProtocolForm();
      var upProto = protocolOf(id);
      if (!upProto) return;
      if (!up.product || !up.batch) { alert("Product and batch are required."); return; }
      upProto.product = up.product;
      upProto.batches = [up.batch];
      upProto.productCode = up.code || upProto.productCode;
      upProto.pack = up.packingText || upProto.pack;
      upProto.storageCondition = up.conditionText || upProto.storageCondition;
      upProto.reason = up.reasons.join("; ") || upProto.reason;
      upProto.projectCode = up.code || upProto.projectCode;
      upProto.manufacturingLocation = up.mfg;
      upProto.dateIn = up.dateIn;
      if (up.tests.length) upProto.tests = up.tests;
      var um = upProto.protocolMeta || (upProto.protocolMeta = {});
      um.drugSubstance = up.product; um.batch = up.batch;
      um.reason = up.reasons; um.reasonOther = up.reasonOther;
      um.sampleConditions = up.conds; um.sampleConditionOther = up.condOther;
      um.studyAt = up.studyAt; um.enclosures = up.enclosures; um.sampleType = up.sampleType;
      um.manufacturingLocation = up.mfg; um.stpNo = up.stpNo; um.projectCode = up.code; um.dateIn = up.dateIn;
      um.packing = up.packing;
      um.schedule = up.schedule;
      store.audit({ user: S.currentUser, action: "update", entity: "protocol", entityId: upProto.protocolNo, note: "Protocol edited after change request" });
      closeOverlay();
      approveAction(id, "Preparer", "submitted", "Resubmitted after changes");
      location.hash = "#/protocoldoc/" + id; render();
    } else if (act === "nu-save") {
      var uname = document.getElementById("nuName").value.trim();
      if (!uname) { alert("Name is required."); return; }
      S.users.push({ id: "u" + Date.now(), name: uname, role: document.getElementById("nuRole").value, email: document.getElementById("nuEmail").value.trim() || "—", status: "Active" });
      store.audit({ user: S.currentUser, action: "create", entity: "user", entityId: uname, note: "User added" });
      store.save(); closeOverlay(); render();
    } else if (act === "ch-save") {
      var cid = document.getElementById("chId").value.trim();
      if (!cid) { alert("Chamber ID is required."); return; }
      S.chambers.push({ id: cid, name: document.getElementById("chName").value.trim() || cid, temperature: document.getElementById("chTemp").value.trim() || "—", humidity: document.getElementById("chHum").value.trim() || "NA", location: document.getElementById("chLoc").value.trim() || "—", capacity: parseInt(document.getElementById("chCap").value, 10) || 0, status: "Active", qualification: "Pending" });
      store.audit({ user: S.currentUser, action: "create", entity: "chamber", entityId: cid, note: "Chamber added" });
      store.save(); closeOverlay(); render();
    } else if (act === "final-generate") doFinalGenerate(id);
    else if (act === "final-approve") doFinalApprove(id);
    else if (act === "ws-load") wsLoad();
    else if (act === "ws-calc") wsCalc();
    else if (act === "ws-save") wsSave();
    else if (act === "ws-print") wsPrint();
    else if (act === "proto-changes-save") {
      var cEl = document.getElementById("pcComment");
      var c = cEl ? String(cEl.value).trim() : "";
      if (!c) { alert("Please enter what needs to be changed."); return; }
      var lvl = SD.lifecycle.protocolStatus(S, id) === "UNDER_REVIEW" ? "Reviewer" : "Group Leader";
      closeOverlay();
      approveAction(id, lvl, "changes_requested", c);
    }
    else if (act === "ep-save") epSave();
    else if (act === "ep-withdraw-save") epWithdrawSave(id);
    else if (act === "close-overlay") closeOverlay();
  }

  function onOverlayChange(e) {
    if (e.target && e.target.id === "wsStp") renderWsTests();
    if (e.target && e.target.id === "epSample") renderEpFields();
    if (e.target && e.target.id === "epReqDate") recomputeEp();
    if (e.target && (e.target.id === "npTp" || e.target.id === "npTests")) renderNpSchedule();
    if (e.target && /^npCond/.test(e.target.id)) renderNpSchedule();
  }

  /* ---------- boot ---------- */
  renderNav();
  document.getElementById("roleSelect").value = S.role;
  document.getElementById("roleSelect").addEventListener("change", function (e) { S.role = e.target.value; render(); });
  document.getElementById("globalSearch").addEventListener("keydown", function (e) {
    if (e.key === "Enter") { filters.search = e.target.value; location.hash = "#/samples"; render(); }
  });
  document.getElementById("view").addEventListener("click", onViewClick);
  document.getElementById("view").addEventListener("change", onViewChange);
  document.getElementById("view").addEventListener("input", onViewInput);
  document.getElementById("view").addEventListener("keydown", onViewKeydown);
  overlay.addEventListener("click", onOverlayClick);
  overlay.addEventListener("change", onOverlayChange);
  overlay.addEventListener("input", function (e) { if (e.target && e.target.id === "epReqDate") recomputeEp(); });
  window.addEventListener("hashchange", render);

  function setBackend(text, ok) {
    var el = document.getElementById("backendNote");
    if (el) { el.textContent = text; el.style.color = ok ? "#7ee0a8" : ""; }
  }
  var dbConnected = false;
  if (SD.db && SD.db.enabled()) {
    setBackend("Connecting to Supabase…", false);
    SD.db.pull().then(function (remote) {
      if (remote && remote.samples) { store.state = remote; S = remote; SD.lifecycle.ensure(S); store.save(); render(); }
      return SD.db.push(S);
    }).then(function () {
      dbConnected = true;
      setBackend("Supabase connected", true);
      var origSave = store.save.bind(store);
      store.save = function () { origSave(); if (dbConnected) SD.db.push(store.state).catch(function () {}); };
    }).catch(function (e) {
      setBackend("Local storage · " + e.message, false);
    });
  } else {
    setBackend("Local storage (Supabase not configured)", false);
  }

  render();
})();
