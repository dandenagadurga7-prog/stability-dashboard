/* DEMO DATA — placeholder pending the approved Protocol / Stability Report /
 * Monthly Schedule files. Test names, methods, specifications and time points
 * below are generic ICH-style placeholders, NOT the member's approved data.
 * Replace via protocol editing or Excel import once the reference files exist.
 */
(function (global) {
  "use strict";
  var SD = global.SD;
  var off = function (n) { return SD.dates.addDays(SD.dates.todayISO(), n); };

  var TEST_LIBRARY = [
    { id: "appearance", name: "Description", method: "Visual", specification: "White, circular, biconvex film-coated tablet; free from visible defects", unit: "" },
    { id: "identification", name: "Identification", method: "HPLC", specification: "Principal peak RT corresponds to that of the standard", unit: "" },
    { id: "assay", name: "Assay", method: "HPLC", specification: "95.0% – 105.0%", unit: "%" },
    { id: "related", name: "Related Substances", method: "HPLC", specification: "Any individual impurity ≤ 0.5%; Total impurities ≤ 2.0%", unit: "%" },
    { id: "dissolution", name: "Dissolution", method: "USP Apparatus II, 900 mL", specification: "Not less than 80% (Q) in 30 minutes", unit: "%" },
    { id: "water", name: "Water Content", method: "Karl Fischer", specification: "Not more than 3.0% w/w", unit: "% w/w" },
    { id: "ph", name: "pH", method: "Potentiometry", specification: "4.5 – 7.0", unit: "" },
    { id: "uniformity", name: "Uniformity of Dosage Units", method: "HPLC", specification: "Complies (Acceptance Value ≤ 15.0)", unit: "" },

    /* --- TROFINETIDE, exactly as printed on the supplied Stability Report
       (Hetero R&D Kazipally, Format F-02-01/ARD015). These are real, not demo. --- */
    { id: "tfd_description", section: "1.0", name: "Description", method: "Visual", specification: "White to off-white solid.", unit: "" },
    { id: "tfd_ir", section: "2.0", name: "Identification by IR (KBr)", method: "IR (KBr)", specification: "The Infrared spectrum of the test sample should match with that of Trofinetide reference standard.", unit: "" },
    { id: "tfd_hplc_id", section: "2.0", name: "Identification by HPLC", method: "HPLC", specification: "The retention time of the major peak in the chromatogram of the test solution should correspond to that of the chromatogram of the standard solution, as obtained in the Assay by HPLC test.", unit: "" },
    { id: "tfd_water", section: "3.0", name: "Water content by KF (% w/w)", method: "Karl Fischer", specification: "Not more than 8.0", unit: "% w/w" },
    { id: "tfd_pxrd", section: "4.0", name: "p-XRD", method: "X-ray powder diffraction", specification: "The test sample X-ray powder diffraction pattern shall be concordant with Amorphous form.", unit: "" },
    { id: "tfd_mpo", section: "5.0", name: "MPO", method: "HPLC", specification: "Not more than 0.25", unit: "%" },
    { id: "tfd_gpc", section: "5.0", name: "GPC", method: "HPLC", specification: "Not more than 0.05", unit: "%" },
    { id: "tfd_srt", section: "5.0", name: "SRT", method: "HPLC", specification: "Not more than 0.05", unit: "%" },
    { id: "tfd_bcg", section: "5.0", name: "BCG", method: "HPLC", specification: "Not more than 0.05", unit: "%" },
    { id: "tfd_tfd1", section: "5.0", name: "TFD1", method: "HPLC", specification: "Not more than 0.05", unit: "%" },
    { id: "tfd_tfd2i", section: "5.0", name: "TFD2(i)", method: "HPLC", specification: "Not more than 0.05", unit: "%" },
    { id: "tfd_max_single", section: "5.0", name: "Maximum single impurity", method: "HPLC", specification: "Not more than 0.05", unit: "%" },
    { id: "tfd_total", section: "5.0", name: "Total impurities", method: "HPLC", specification: "Not more than 1.0", unit: "%" },
    { id: "tfd_assay", section: "6.0", name: "Assay by HPLC (% w/w, On anhydrous basis)", method: "HPLC", specification: "Not less than 98.0 and not more than 102.0", unit: "% w/w" },

    /* --- ANASTROZOLE, exactly as printed on STP AL-009-04 (Hetero Labs Ltd, Unit-I).
       'theory' is the method/acceptance text from that STP, supplied by the member. --- */
    { id: "anz_description", section: "1.0", name: "Description", method: "Visual", specification: "White or almost white powder.", unit: "", theory: "Examine visually. The sample should be a white or almost white powder (Ph. Eur.)." },
    { id: "anz_solubility", section: "2.0", name: "Solubility", method: "Visual", specification: "Very slightly soluble in water, freely soluble in anhydrous ethanol, practically insoluble in cyclohexane.", unit: "", theory: "Determine solubility in water, anhydrous ethanol and cyclohexane (Ph. Eur.)." },
    { id: "anz_ir", section: "3.1", name: "Identification by IR absorption", method: "IR (KBr disc)", specification: "The Infrared absorption spectrum of the finely ground sample in KBr dispersion compressed into a disc should exhibit maxima only at the same wavelengths as that of a similar preparation of Anastrozole Working Standard.", unit: "", theory: "The Infrared absorption spectrum of the finely ground sample in KBr dispersion compressed into a disc should exhibit maxima only at the same wavelengths as that of a similar preparation of Anastrozole Working Standard (Ph. Eur.)." },
    { id: "anz_hplc_id", section: "3.2", name: "Identification by HPLC", method: "HPLC", specification: "The retention time of the major peak in the chromatogram of the assay preparation should correspond to that in the chromatogram of the standard preparation, as obtained in the assay by HPLC on anhydrous basis test.", unit: "", theory: "The retention time of the major peak in the chromatogram of the assay preparation should correspond to that in the chromatogram of the standard preparation, as obtained in the assay by HPLC on anhydrous basis test (In-House)." },
    { id: "anz_xrd", section: "4.0", name: "XRD", method: "X-ray powder diffraction", specification: "The X-ray diffractogram of the sample should match with that of Anastrozole (Form-II) Working Standard exhibiting 2\u03b8 values at about 9.6, 10.9, 12.5, 16.6, 17.1, 18.6, 19.6, 22.1, 22.7, 28.9, 29.3, 30.6, 31.7, 33.6 and 35.2\u00b0 \u00b1 0.2\u00b0.", unit: "", theory: "The X-ray diffractogram of the sample should match with that of Anastrozole (Form-II) Working Standard exhibiting 2\u03b8 values at about 9.6, 10.9, 12.5, 16.6, 17.1, 18.6, 19.6, 22.1, 22.7, 28.9, 29.3, 30.6, 31.7, 33.6 and 35.2\u00b0 \u00b1 0.2\u00b0 (In-House)." },
    { id: "anz_water", section: "5.0", name: "Water content", method: "Karl Fischer", specification: "Not more than 0.30% w/w", unit: "% w/w", theory: "Determined by Karl Fischer titration (Ph. Eur. & In-House)." },
    { id: "anz_lod", section: "6.0", name: "Loss on drying", method: "Gravimetric", specification: "Not more than 0.50% w/w", unit: "% w/w", theory: "Determined by loss on drying (In-House)." },
    { id: "anz_sulphated_ash", section: "7.0", name: "Sulphated Ash", method: "Gravimetric", specification: "Not more than 0.10% w/w", unit: "% w/w", theory: "Determined by sulphated ash (Ph. Eur.)." },
    { id: "anz_rel_unspec", section: "8.0", name: "Individual unspecified impurity", method: "HPLC", specification: "Not more than 0.10%", unit: "%", theory: "Related substances by HPLC \u2014 % of individual unspecified impurity (Ph. Eur.)." },
    { id: "anz_rel_total", section: "8.0", name: "Total impurities", method: "HPLC", specification: "Not more than 0.20%", unit: "%", theory: "Related substances by HPLC \u2014 % of total impurities (Ph. Eur.)." },
    { id: "anz_assay", section: "9.0", name: "Assay by HPLC (On anhydrous basis)", method: "HPLC", specification: "Not less than 98.0% and Not more than 102.0% w/w", unit: "% w/w", theory: "Assay by HPLC, calculated on anhydrous basis against the Anastrozole working standard (Ph. Eur.)." },
    { id: "anz_residual", section: "10.0", name: "Residual solvents by GC", method: "Gas Chromatography (HS-GC)", specification: "Method-I: Methanol NMT 3000 ppm; Isopropyl alcohol NMT 5000 ppm; Methylene chloride NMT 600 ppm; Tertiary butyl methyl ether NMT 5000 ppm; n-Hexane NMT 290 ppm; Diisopropyl ether NMT 100 ppm; Ethyl acetate NMT 5000 ppm; Toluene NMT 890 ppm. Method-II: Chloroform NMT 60 ppm; Dimethyl formamide NMT 880 ppm.", unit: "ppm", theory: "Residual solvents determined by gas chromatography, Method-I and Method-II (In-House)." }
  ];

  var PROTOCOLS = [
    /* REAL — taken verbatim from the supplied Stability Report (photo, 2026-10-03). */
    {
      id: "p0",
      protocolNo: "HK-TP/IH-STP/TFD-05",
      product: "Trofinetide",
      productCode: "TFD",
      apiOrForm: "Drug substance",
      storageCondition: "-20°C N2 Pack",
      humidity: "NA",
      pack: "LDPE bag twisted and tied with tag, inserted in Quad laminated aluminum bag along with silica gel, molecular sieve and o-buster, heat sealed under nitrogen atmosphere, kept in HDPE Container.",
      batches: ["HK-TFD/034"],
      timePoints: [1, 2, 3, 6, 9, 12],
      tests: ["tfd_description", "tfd_ir", "tfd_hplc_id", "tfd_water", "tfd_pxrd", "tfd_mpo", "tfd_gpc", "tfd_srt", "tfd_bcg", "tfd_tfd1", "tfd_tfd2i", "tfd_max_single", "tfd_total", "tfd_assay"],
      effectiveDate: "2022-11-26",
      version: "F-02-01/ARD015",
      status: "Active",
      reportMeta: {
        site: "HETERO (R&D), KAZIPALLY",
        formatNo: "F-02-01/ARD015",
        effectiveDate: "2022-11-26",
        studyStartDate: "2025-06-06",
        humidity: "NA",
        packingConditions: "The material should be packed in LDPE bag twisted and tied with tag, then that bag should be inserted in Quad laminated aluminum bag along with silica gel, molecular sieve and o-buster heat sealed under nitrogen atmosphere. Finally, kept in HDPE Container.",
        timePointColumns: [
          { label: "Initial", months: 0 }, { label: "1st Month", months: 1 }, { label: "2nd Month", months: 2 },
          { label: "3rd Month", months: 3 }, { label: "6th Month", months: 6 }, { label: "9th Month", months: 9 }, { label: "12th Month", months: 12 }
        ],
        analysisScheduled: [
          { months: 1, date: "2025-07-05" }, { months: 2, date: "2025-08-05" }, { months: 3, date: "2025-09-05" },
          { months: 6, date: "2025-12-05" }, { months: 9, date: "2026-03-05" }, { months: 12, date: "2026-06-05" }
        ],
        initialResults: {
          tfd_description: "White Solid", tfd_ir: "Complies", tfd_hplc_id: "NA", tfd_water: "5.5",
          tfd_pxrd: "Complies", tfd_mpo: "NA", tfd_gpc: "NA", tfd_srt: "NA", tfd_bcg: "NA",
          tfd_tfd1: "NA", tfd_tfd2i: "NA", tfd_max_single: "NA", tfd_total: "NA", tfd_assay: "NA"
        }
      }
    },
    /* REAL Anastrozole — from the supplied Stability Protocol (F-01-01/ARD015) and STP AL-009-04. */
    {
      id: "panz",
      protocolNo: "AL-009-04",
      product: "Anastrozole",
      productCode: "ANZ",
      apiOrForm: "Drug substance",
      storageCondition: "25°C ± 2°C / 60% RH ± 5% RH",
      humidity: "60% RH ± 5% RH",
      pack: "LDPE bag purged with nitrogen, twisted and tied with tag, then inserted in ALUM bag heat sealed under nitrogen purge; finally kept in HDPE container along with silica gel.",
      batches: ["HL-ANA/01615"],
      timePoints: [1, 2, 3, 6, 9, 12],
      tests: ["anz_description", "anz_solubility", "anz_ir", "anz_hplc_id", "anz_xrd", "anz_water", "anz_lod", "anz_sulphated_ash", "anz_rel_unspec", "anz_rel_total", "anz_assay", "anz_residual"],
      effectiveDate: "2023-03-20",
      version: "AL-009-04",
      status: "Active",
      reason: "New product",
      manufacturingLocation: "Hetero Labs Limited, Unit-II, Kazipally",
      projectCode: "ANZ",
      dateIn: "2025-01-04",
      reportMeta: {
        site: "HETERO (R&D), KAZIPALLY",
        formatNo: "F-02-01/ARD015",
        effectiveDate: "2022-11-26",
        studyStartDate: "2025-01-04",
        humidity: "NA",
        packingConditions: "The material should be packed in LDPE bag purged with nitrogen, twisted and tied with tag, then that bag should be inserted in ALUM bag heat sealed under nitrogen purge; finally kept in HDPE container along with silica gel.",
        timePointColumns: [
          { label: "Initial", months: 0 }, { label: "1st Month", months: 1 }, { label: "2nd Month", months: 2 },
          { label: "3rd Month", months: 3 }, { label: "6th Month", months: 6 }, { label: "9th Month", months: 9 }, { label: "12th Month", months: 12 }
        ],
        analysisScheduled: [
          { months: 1, date: "2025-02-04" }, { months: 2, date: "2025-03-04" }, { months: 3, date: "2025-04-04" },
          { months: 6, date: "2025-07-04" }, { months: 9, date: "2025-10-04" }, { months: 12, date: "2026-01-04" }
        ],
        initialResults: {
          anz_description: "White or almost white powder", anz_solubility: "Complies", anz_ir: "Complies", anz_hplc_id: "NA",
          anz_xrd: "Complies", anz_water: "NA", anz_lod: "NA", anz_sulphated_ash: "NA",
          anz_rel_unspec: "NA", anz_rel_total: "NA", anz_assay: "NA", anz_residual: "NA"
        }
      }
    },
    { id: "p1", protocolNo: "STB/ATV/2025-01", product: "Atorvastatin Calcium Tablets 10 mg", productCode: "ATV10", storageCondition: "25°C ± 2°C / 60% RH ± 5% RH (Long term)", pack: "10 x 10 Alu-Alu blister", batches: ["ATV10-2501", "ATV10-2502"], timePoints: [3, 6, 9, 12, 18, 24], tests: ["appearance", "identification", "assay", "related", "dissolution", "uniformity"], effectiveDate: "2025-01-15", version: "V1.0", status: "Active" },
    { id: "p2", protocolNo: "STB/MET/2025-02", product: "Metformin Hydrochloride ER Tablets 500 mg", productCode: "MET500", storageCondition: "25°C ± 2°C / 60% RH ± 5% RH (Long term)", pack: "10 x 15 HDPE bottle", batches: ["MET500-2501", "MET500-2502"], timePoints: [3, 6, 9, 12, 18, 24], tests: ["appearance", "identification", "assay", "related", "water", "dissolution"], effectiveDate: "2025-02-04", version: "V1.0", status: "Active" },
    { id: "p3", protocolNo: "STB/AMX/2025-03", product: "Amoxicillin Dispersible Tablets 250 mg", productCode: "AMX250", storageCondition: "40°C ± 2°C / 75% RH ± 5% RH (Accelerated)", pack: "10 x 10 Alu strip", batches: ["AMX250-2501", "AMX250-2502"], timePoints: [1, 2, 3, 6], tests: ["appearance", "identification", "assay", "related", "water", "uniformity"], effectiveDate: "2025-03-10", version: "V1.0", status: "Active" },
    { id: "p4", protocolNo: "STB/PAR/2025-04", product: "Paracetamol Oral Suspension 125 mg/5 mL", productCode: "PAR125", storageCondition: "30°C ± 2°C / 65% RH ± 5% RH (Intermediate)", pack: "100 mL amber PET bottle", batches: ["PAR125-2501"], timePoints: [1, 2, 3, 6], tests: ["appearance", "identification", "assay", "related", "ph"], effectiveDate: "2025-04-01", version: "V1.1", status: "Active" },
    { id: "p5", protocolNo: "STB/LOS/2025-05", product: "Losartan Potassium Tablets 50 mg", productCode: "LOS50", storageCondition: "25°C ± 2°C / 60% RH ± 5% RH (Long term)", pack: "10 x 10 Blister", batches: ["LOS50-2501", "LOS50-2502"], timePoints: [3, 6, 9, 12, 18, 24], tests: ["appearance", "identification", "assay", "related", "dissolution", "water"], effectiveDate: "2025-05-20", version: "V1.0", status: "Active" },
    { id: "p6", protocolNo: "STB/OME/2025-06", product: "Omeprazole Delayed-Release Capsules 20 mg", productCode: "OME20", storageCondition: "40°C ± 2°C / 75% RH ± 5% RH (Accelerated)", pack: "10 x 10 Alu-Alu blister", batches: ["OME20-2501"], timePoints: [1, 2, 3, 6], tests: ["appearance", "identification", "assay", "related", "water"], effectiveDate: "2025-06-12", version: "V1.0", status: "Active" },
    { id: "p7", protocolNo: "STB/ROS/2025-07", product: "Rosuvastatin Tablets 10 mg", productCode: "ROS10", storageCondition: "25°C ± 2°C / 60% RH ± 5% RH (Long term)", pack: "10 x 10 Alu-Alu blister", batches: ["ROS10-2501"], timePoints: [3, 6, 9, 12, 18, 24], tests: ["appearance", "identification", "assay", "related", "dissolution"], effectiveDate: "2025-07-03", version: "V1.0", status: "Active" },
    { id: "p8", protocolNo: "STB/CEF/2025-08", product: "Cefixime Dry Syrup 50 mg/5 mL", productCode: "CEF50", storageCondition: "30°C ± 2°C / 65% RH ± 5% RH (Intermediate)", pack: "30 mL HDPE bottle with 20 mL water", batches: ["CEF50-2501"], timePoints: [1, 2, 3, 6], tests: ["appearance", "identification", "assay", "related", "ph"], effectiveDate: "2025-08-18", version: "V1.0", status: "Active" }
  ];

  var ANALYSTS = ["S. Rao", "P. Kumar", "M. Iyer", "A. Dhamodar", "R. Reddy", "K. Nair"];
  var REVIEWERS = ["Dr. V. Sharma", "Dr. L. Menon"];

  /* [protocolId, batch, tpMonths, plannedOffset, actualOffset, startOffset, completeOffset, reviewStatus, reportStatus, hold] */
  var SPEC = [
    ["p1", "ATV10-2501", 3, -40, -38, -37, -22, "approved", "approved", false],
    ["p1", "ATV10-2501", 6, -6, -6, -5, null, "not_started", "not_started", false],
    ["p1", "ATV10-2501", 9, 4, null, null, null, "not_started", "not_started", false],
    ["p1", "ATV10-2501", 24, 60, null, null, null, "not_started", "not_started", false],
    ["p1", "ATV10-2502", 3, -3, null, null, null, "not_started", "not_started", false],
    ["p1", "ATV10-2502", 6, 25, null, null, null, "not_started", "not_started", false],
    ["p2", "MET500-2501", 3, -18, null, null, null, "not_started", "not_started", false],
    ["p2", "MET500-2501", 6, -2, null, null, null, "not_started", "not_started", false],
    ["p2", "MET500-2501", 9, 30, null, null, null, "not_started", "not_started", false],
    ["p2", "MET500-2502", 3, -30, -29, -28, -13, "pending", "not_started", false],
    ["p2", "MET500-2502", 6, 15, null, null, null, "not_started", "not_started", false],
    ["p3", "AMX250-2501", 1, -20, -19, -18, null, "not_started", "not_started", false],
    ["p3", "AMX250-2501", 2, -10, -9, -8, null, "not_started", "not_started", false],
    ["p3", "AMX250-2501", 3, 0, null, null, null, "not_started", "not_started", false],
    ["p3", "AMX250-2502", 1, -5, -5, -4, null, "not_started", "not_started", false],
    ["p3", "AMX250-2502", 6, 45, null, null, null, "not_started", "not_started", false],
    ["p4", "PAR125-2501", 1, -25, -24, -23, -8, "approved", "generated", false],
    ["p4", "PAR125-2501", 2, -1, null, null, null, "not_started", "not_started", false],
    ["p4", "PAR125-2501", 3, 35, null, null, null, "not_started", "not_started", false],
    ["p5", "LOS50-2501", 3, -50, -48, -47, -30, "approved", "approved", false],
    ["p5", "LOS50-2501", 6, -8, null, null, null, "not_started", "not_started", false],
    ["p5", "LOS50-2501", 9, 5, null, null, null, "not_started", "not_started", false],
    ["p5", "LOS50-2501", 12, 40, null, null, null, "not_started", "not_started", false],
    ["p5", "LOS50-2502", 3, -14, -14, -13, null, "not_started", "not_started", false],
    ["p6", "OME20-2501", 1, -3, -3, -2, -1, "pending", "not_started", false],
    ["p6", "OME20-2501", 2, 12, null, null, null, "not_started", "not_started", false],
    ["p6", "OME20-2501", 3, 0, null, null, null, "not_started", "not_started", true],
    ["p7", "ROS10-2501", 3, -22, -21, -20, -6, "approved", "generated", false],
    ["p7", "ROS10-2501", 6, 20, null, null, null, "not_started", "not_started", false],
    ["p7", "ROS10-2501", 9, -1, null, null, null, "not_started", "not_started", false],
    ["p8", "CEF50-2501", 1, 0, null, null, null, "not_started", "not_started", false],
    ["p8", "CEF50-2501", 2, -2, null, null, null, "not_started", "not_started", false],
    ["p8", "CEF50-2501", 3, -35, -34, -33, -18, "approved", "approved", false],
    ["p8", "CEF50-2501", 6, 55, null, null, null, "not_started", "not_started", false]
  ];

  /* REAL Trofinetide study (batch HK-TFD/034). Dates are the analysis scheduled
   * dates printed on the report; the report itself is a blank template, so the
   * workflow states below are the demo progression, not claimed lab results. */
  /* [tpLabel, tpMonths, planned, actual, start, complete, reviewStatus, reportStatus] */
  var TFD_SPEC = [
    ["Initial", 0, "2025-06-06", "2025-06-06", "2025-06-06", "2025-06-10", "approved", "approved"],
    ["1M", 1, "2025-07-05", "2025-07-05", "2025-07-05", "2025-07-10", "approved", "approved"],
    ["2M", 2, "2025-08-05", "2025-08-05", "2025-08-05", "2025-08-09", "approved", "generated"],
    ["3M", 3, "2025-09-05", "2025-09-05", "2025-09-05", "2025-09-10", "pending", "not_started"],
    ["6M", 6, "2025-12-05", "2025-12-05", "2025-12-05", null, "not_started", "not_started"],
    ["9M", 9, "2026-03-05", "2026-03-05", null, null, "not_started", "not_started"],
    ["12M", 12, "2026-06-05", null, null, null, "not_started", "not_started"]
  ];

  /* REAL Anastrozole study (batch HL-ANA/01615), time points from the protocol
   * schedule. 1M/2M/3M carry entered results so the cumulative data sheet fills. */
  var ANZ_SPEC = [
    ["Initial", 0, "2025-01-04", "2025-01-04", "2025-01-04", "2025-01-08", "approved", "approved"],
    ["1M", 1, "2025-02-04", "2025-02-04", "2025-02-04", "2025-02-08", "approved", "approved"],
    ["2M", 2, "2025-03-04", "2025-03-04", "2025-03-04", "2025-03-08", "approved", "approved"],
    ["3M", 3, "2025-04-04", "2025-04-04", "2025-04-04", "2025-04-09", "approved", "generated"],
    ["6M", 6, "2025-07-04", "2025-07-04", "2025-07-04", null, "not_started", "not_started"],
    ["9M", 9, "2025-10-04", "2025-10-04", null, null, "not_started", "not_started"],
    ["12M", 12, "2026-01-04", null, null, null, "not_started", "not_started"]
  ];

  function protocolById(id) { for (var i = 0; i < PROTOCOLS.length; i++) if (PROTOCOLS[i].id === id) return PROTOCOLS[i]; return null; }
  function testById(id) { for (var i = 0; i < TEST_LIBRARY.length; i++) if (TEST_LIBRARY[i].id === id) return TEST_LIBRARY[i]; return null; }

  var DEMO_VALUES = {
    appearance: "Complies", identification: "Complies", assay: "99.4", related: "0.12 / 0.38", dissolution: "94", water: "1.8", ph: "6.2", uniformity: "Complies",
    tfd_description: "White to off-white solid", tfd_ir: "Complies", tfd_hplc_id: "Complies", tfd_water: "5.1", tfd_pxrd: "Complies",
    tfd_mpo: "0.02", tfd_gpc: "0.01", tfd_srt: "0.01", tfd_bcg: "0.01", tfd_tfd1: "0.01", tfd_tfd2i: "0.02", tfd_max_single: "0.02", tfd_total: "0.15", tfd_assay: "99.7"
  };

  function buildResults(sample, protocol) {
    var rows = [];
    var inAnalysis = !!sample.analysisStart;
    var complete = !!sample.analysisCompleteDate;
    var oosIndex = (sample.sampleId === "SMP-0013") ? "assay" : null;
    var enteredCount = complete ? protocol.tests.length : (inAnalysis ? 2 : 0);
    var initial = protocol.reportMeta && protocol.reportMeta.initialResults;
    for (var i = 0; i < protocol.tests.length; i++) {
      var tid = protocol.tests[i];
      var t = testById(tid);
      var entered = i < enteredCount;
      var value = entered ? DEMO_VALUES[tid] : "";
      if (sample.timePointMonths === 0 && initial && initial[tid] !== undefined) value = initial[tid];
      var status = entered ? "within_spec" : "pending";
      if (value === "NA") status = "na";
      if (entered && oosIndex === tid) { value = "92.4"; status = "out_of_spec"; }
      rows.push({
        testId: tid, test: t.name, method: t.method, specification: t.specification, unit: t.unit,
        result: value, status: status,
        analyst: entered ? sample.analyst : "",
        date: entered ? (complete ? sample.analysisCompleteDate : sample.analysisStart) : "",
        reviewer: (complete && sample.reviewStatus === "approved") ? sample.reviewer : "",
        remarks: ""
      });
    }
    return rows;
  }

  function seed() {
    var protocols = JSON.parse(JSON.stringify(PROTOCOLS));
    var samples = [];
    var results = {};
    var arCounter = 0;

    var tfd = protocolById("p0");
    TFD_SPEC.forEach(function (r, i) {
      var sample = {
        id: "t" + (i + 1),
        sampleId: "TFD-" + String(i + 1).padStart(4, "0"),
        protocolId: "p0", protocolNo: tfd.protocolNo, product: tfd.product, productCode: tfd.productCode,
        batch: "HK-TFD/034", storageCondition: tfd.storageCondition, pack: tfd.pack,
        timePointMonths: r[1], timePointLabel: r[0],
        manufacturingDate: null, expiryDate: null,
        plannedWithdrawal: r[2], actualWithdrawal: r[3], analysisStart: r[4], analysisCompleteDate: r[5],
        analyst: ANALYSTS[i % ANALYSTS.length], reviewer: REVIEWERS[i % REVIEWERS.length],
        reviewStatus: r[6], reportStatus: r[7], hold: false, holdReason: "", remarks: "",
        arNumber: r[5] ? "AR-2026-" + String(++arCounter).padStart(6, "0") : null
      };
      samples.push(sample);
      results[sample.sampleId] = buildResults(sample, tfd);
    });

    var anz = protocolById("panz");
    ANZ_SPEC.forEach(function (r, i) {
      var sample = {
        id: "a" + (i + 1),
        sampleId: "ANZ-" + String(i + 1).padStart(4, "0"),
        protocolId: "panz", protocolNo: anz.protocolNo, product: anz.product, productCode: anz.productCode,
        batch: "HL-ANA/01615", storageCondition: anz.storageCondition, pack: anz.pack,
        timePointMonths: r[1], timePointLabel: r[0],
        manufacturingDate: null, expiryDate: null,
        plannedWithdrawal: r[2], actualWithdrawal: r[3], analysisStart: r[4], analysisCompleteDate: r[5],
        analyst: ANALYSTS[i % ANALYSTS.length], reviewer: REVIEWERS[i % REVIEWERS.length],
        reviewStatus: r[6], reportStatus: r[7], hold: false, holdReason: "", remarks: "",
        arNumber: r[5] ? "AR-2026-" + String(++arCounter).padStart(6, "0") : null
      };
      samples.push(sample);
      results[sample.sampleId] = buildResults(sample, anz);
    });

    for (var i = 0; i < SPEC.length; i++) {
      var r = SPEC[i];
      var p = protocolById(r[0]);
      var tp = r[2];
      var planned = r[3] === null ? null : off(r[3]);
      var actual = r[4] === null ? null : off(r[4]);
      var start = r[5] === null ? null : off(r[5]);
      var complete = r[6] === null ? null : off(r[6]);
      var mfg = SD.dates.addMonths(planned || SD.dates.todayISO(), -tp);
      var sampleId = "SMP-" + String(i + 1).padStart(4, "0");
      var sample = {
        id: "s" + (i + 1),
        sampleId: sampleId,
        protocolId: p.id,
        protocolNo: p.protocolNo,
        product: p.product,
        productCode: p.productCode,
        batch: r[1],
        storageCondition: p.storageCondition,
        pack: p.pack,
        timePointMonths: tp,
        timePointLabel: tp + "M",
        manufacturingDate: mfg,
        expiryDate: SD.dates.addMonths(mfg, 24),
        plannedWithdrawal: planned,
        actualWithdrawal: actual,
        analysisStart: start,
        analysisCompleteDate: complete,
        analyst: ANALYSTS[i % ANALYSTS.length],
        reviewer: REVIEWERS[i % REVIEWERS.length],
        reviewStatus: r[7],
        reportStatus: r[8],
        hold: !!r[9],
        holdReason: r[9] ? "Pending QA investigation (demo)" : "",
        remarks: "",
        arNumber: complete ? "AR-2026-" + String(++arCounter).padStart(6, "0") : null
      };
      samples.push(sample);
      results[sampleId] = buildResults(sample, p);
    }

    var chambers = [
      { id: "CH-01", name: "Stability Chamber 01", temperature: "25°C ± 2°C", humidity: "60% RH ± 5% RH", location: "Stability Room 1", capacity: 200, status: "In Use", qualification: "Qualified" },
      { id: "CH-02", name: "Stability Chamber 02", temperature: "30°C ± 2°C", humidity: "65% RH ± 5% RH", location: "Stability Room 1", capacity: 200, status: "In Use", qualification: "Qualified" },
      { id: "CH-03", name: "Stability Chamber 03", temperature: "40°C ± 2°C", humidity: "75% RH ± 5% RH", location: "Stability Room 2", capacity: 160, status: "In Use", qualification: "Qualified" },
      { id: "CH-04", name: "Freezer Chamber 04", temperature: "-20°C ± 5°C", humidity: "NA", location: "Cold Room", capacity: 80, status: "In Use", qualification: "Qualified" }
    ];
    var users = [
      { id: "u1", name: "A. Dhamodar", role: "Manager", email: "a.dhamodar@example.com", status: "Active" },
      { id: "u2", name: "S. Rao", role: "Analyst", email: "s.rao@example.com", status: "Active" },
      { id: "u3", name: "P. Kumar", role: "Analyst", email: "p.kumar@example.com", status: "Active" },
      { id: "u4", name: "M. Iyer", role: "Analyst", email: "m.iyer@example.com", status: "Active" },
      { id: "u5", name: "R. Reddy", role: "Analyst", email: "r.reddy@example.com", status: "Active" },
      { id: "u6", name: "K. Nair", role: "Analyst", email: "k.nair@example.com", status: "Active" },
      { id: "u7", name: "B. Das", role: "Analyst", email: "b.das@example.com", status: "Active" },
      { id: "u8", name: "T. Bhatt", role: "Analyst", email: "t.bhatt@example.com", status: "Active" },
      { id: "u9", name: "N. Joshi", role: "Analyst", email: "n.joshi@example.com", status: "Active" },
      { id: "u10", name: "V. Menon", role: "Analyst", email: "v.menon@example.com", status: "Active" },
      { id: "u11", name: "Dr. V. Sharma", role: "Reviewer", email: "v.sharma@example.com", status: "Active" },
      { id: "u12", name: "Dr. L. Menon", role: "Group Leader", email: "l.menon@example.com", status: "Active" },
      { id: "u13", name: "System Admin", role: "Admin", email: "admin@example.com", status: "Active" }
    ];

    function approvalsChain(a, b, c) {
      return [
        { level: "Preparer", user: "A. Dhamodar", role: "Protocol Preparer", action: "submitted", at: off(-a) + " 09:10:00", comment: "Prepared and submitted" },
        { level: "Reviewer", user: "Dr. V. Sharma", role: "Reviewer", action: "approved", at: off(-b) + " 11:30:00", comment: "Reviewed; no observations" },
        { level: "Group Leader", user: "Dr. L. Menon", role: "Group Leader", action: "approved", at: off(-c) + " 15:45:00", comment: "Approved" }
      ];
    }
    var NOW = SD.dates.todayISO();
    var projects = {};
    PROTOCOLS.forEach(function (p) { projects[p.id] = { protocolId: p.id, approvals: [], packing: null, er: null, loading: null, documents: [], finalReport: { status: "not_started" }, deviations: [] }; });
    projects.p0.approvals = approvalsChain(90, 88, 86);
    projects.p0.packing = { packingId: "PK-2026-00001", quantity: "7 time points", container: "LDPE + Quad laminated aluminium + HDPE", date: "2025-05-28", by: "A. Dhamodar", remarks: "Packed under nitrogen" };
    projects.p0.er = { erNumber: "ER-2026-000001", generatedAt: off(-1) };
    projects.p0.loading = { loadingId: "LOAD-2026-000001", chamberId: "CH-04", chamberName: "Freezer Chamber 04", condition: "-20°C N2 Pack", rack: "R1", shelf: "S2", qty: "7", date: "2025-06-06", time: "10:20", by: "A. Dhamodar" };
    projects.p1.approvals = approvalsChain(60, 58, 56);
    projects.p1.packing = { packingId: "PK-2026-00002", quantity: "24 time points", container: "10 x 10 Alu-Alu blister", date: "2025-06-01", by: "S. Rao", remarks: "" };
    projects.p1.er = { erNumber: "ER-2026-000002", generatedAt: off(-1) };
    projects.p1.loading = { loadingId: "LOAD-2026-000002", chamberId: "CH-01", chamberName: "Stability Chamber 01", condition: "25°C ± 2°C / 60% RH ± 5% RH", rack: "R2", shelf: "S1", qty: "24", date: "2025-06-04", time: "09:40", by: "S. Rao" };
    projects.p2.approvals = approvalsChain(40, 38, 36);
    projects.p2.packing = { packingId: "PK-2026-00003", quantity: "20 time points", container: "10 x 15 HDPE bottle", date: "2025-07-02", by: "P. Kumar", remarks: "" };
    projects.p3.approvals = [{ level: "Preparer", user: "A. Dhamodar", role: "Protocol Preparer", action: "submitted", at: off(-4) + " 10:05:00", comment: "Submitted for review" }];
    projects.p4.approvals = [
      { level: "Preparer", user: "A. Dhamodar", role: "Protocol Preparer", action: "submitted", at: off(-9) + " 10:05:00", comment: "Submitted" },
      { level: "Reviewer", user: "Dr. V. Sharma", role: "Reviewer", action: "approved", at: off(-6) + " 14:20:00", comment: "Reviewed" }
    ];
    projects.p5.approvals = approvalsChain(20, 18, 16);
    projects.p7.approvals = approvalsChain(70, 68, 66);
    projects.p7.packing = { packingId: "PK-2026-00004", quantity: "20 time points", container: "10 x 10 Alu-Alu blister", date: "2025-06-20", by: "M. Iyer", remarks: "" };
    projects.p7.er = { erNumber: "ER-2026-000003", generatedAt: off(-1) };
    projects.p7.loading = { loadingId: "LOAD-2026-000003", chamberId: "CH-02", chamberName: "Stability Chamber 02", condition: "30°C ± 2°C / 65% RH ± 5% RH", rack: "R3", shelf: "S1", qty: "20", date: "2025-06-25", time: "11:00", by: "M. Iyer" };
    projects.p7.documents = [{ id: "DOC-2026-00001", type: "Stability Data Sheet", at: off(-2) + " 12:00:00", by: "A. Dhamodar" }];
    projects.p7.finalReport = { status: "under_review", generatedAt: off(-1) + " 16:00:00" };
    projects.p8.approvals = approvalsChain(75, 73, 71);
    projects.p8.packing = { packingId: "PK-2026-00005", quantity: "20 time points", container: "30 mL HDPE bottle", date: "2025-06-18", by: "K. Nair", remarks: "" };
    projects.p8.er = { erNumber: "ER-2026-000004", generatedAt: off(-1) };
    projects.p8.loading = { loadingId: "LOAD-2026-000004", chamberId: "CH-03", chamberName: "Stability Chamber 03", condition: "40°C ± 2°C / 75% RH ± 5% RH", rack: "R1", shelf: "S3", qty: "20", date: "2025-06-22", time: "15:10", by: "K. Nair" };
    projects.p8.documents = [{ id: "DOC-2026-00002", type: "Stability Summary", at: off(-4) + " 10:00:00", by: "A. Dhamodar" }];
    projects.p8.finalReport = { status: "approved", generatedAt: off(-3) + " 10:00:00", approvedAt: off(-1) + " 09:00:00", approvedBy: "Dr. L. Menon" };
    projects.panz.approvals = approvalsChain(640, 638, 636);
    projects.panz.packing = { packingId: "PK-2026-00007", quantity: "7 time points", container: "LDPE + ALUM + HDPE with silica gel", date: "2025-01-02", by: "M.N Subramanyeswara Rao", remarks: "Packed under nitrogen purge" };
    projects.panz.er = { erNumber: "ER-2026-000006", generatedAt: off(-1) };
    projects.panz.loading = { loadingId: "LOAD-2026-000006", chamberId: "CH-01", chamberName: "Stability Chamber 01", condition: "25°C ± 2°C / 60% RH ± 5% RH", rack: "R1", shelf: "S1", qty: "7", date: "2025-01-04", time: "09:30", by: "M.N Subramanyeswara Rao" };

    /* STP master. Method/theory text is taken from the supplied report where it is
     * a method statement; otherwise it is a labelled placeholder until the approved
     * STP is supplied. The Assay formula below is an explicit DEMO so the
     * "weights in -> PASS/FAIL out" path can be demonstrated. */
    function buildStp(p) {
      return {
        id: p.id, stpNumber: (p.protocolMeta && p.protocolMeta.stpNo) || p.protocolNo, version: p.version, effectiveDate: p.effectiveDate,
        status: "Approved", product: p.product,
        tests: p.tests.map(function (tid) {
          var t = testById(tid);
          var statementLike = /spectrum|pattern|retention time|match|concordant|diffractogram/i.test(t.specification);
          var rec = {
            testId: tid,
            theory: t.theory || (statementLike ? t.specification : "Method / theory to be supplied from the approved STP (" + p.protocolNo + ")."),
            variables: [], formula: null
          };
          if (/assay/i.test(tid)) {
            rec.variables = [{ name: "sampleArea", label: "Sample peak area" }, { name: "stdArea", label: "Standard peak area" }];
            rec.formula = "sampleArea/stdArea*100";
            rec.formulaNote = "DEMO formula — replace with the approved STP formula";
          }
          return rec;
        })
      };
    }
    global.SD.buildStp = buildStp;
    var stps = PROTOCOLS.map(buildStp);

    /* R&D Early Pull / Advance Sample Withdrawal Requests — an ADD-ON to the
     * official schedule. officialDate is a snapshot; sample.plannedWithdrawal is
     * never changed by this feature. */
    var pulls = [
      { id: "EP-2026-000001", sampleRef: "ANZ-0007", protocolId: "panz", product: "Anastrozole", batch: "HL-ANA/01615",
        condition: "25°C ± 2°C / 60% RH ± 5% RH", timePointLabel: "12M",
        officialDate: "2026-01-04", advanceDays: 10, requestedDate: "2025-12-25",
        reason: "R&D required early data for formulation decision", requestedBy: "A. Dhamodar", priority: "Urgent", remarks: "",
        status: "APPROVED", createdAt: off(-40) + " 10:00:00",
        history: [
          { at: off(-40) + " 10:00:00", user: "A. Dhamodar", action: "submitted", note: "Submitted for review" },
          { at: off(-39) + " 11:15:00", user: "Dr. V. Sharma", action: "reviewer_approved", note: "Reviewed" },
          { at: off(-38) + " 15:20:00", user: "Dr. L. Menon", action: "approved", note: "Group Leader approved" }
        ] },
      { id: "EP-2026-000002", sampleRef: "TFD-0007", protocolId: "p0", product: "Trofinetide", batch: "HK-TFD/034",
        condition: "-20°C N2 Pack", timePointLabel: "12M",
        officialDate: "2026-06-05", advanceDays: 7, requestedDate: "2026-05-29",
        reason: "Early stability check requested by R&D", requestedBy: "S. Rao", priority: "Normal", remarks: "",
        status: "SUBMITTED", createdAt: off(-2) + " 09:00:00",
        history: [{ at: off(-2) + " 09:00:00", user: "S. Rao", action: "submitted", note: "Awaiting reviewer" }] },
      { id: "EP-2026-000003", sampleRef: "TFD-0005", protocolId: "p0", product: "Trofinetide", batch: "HK-TFD/034",
        condition: "-20°C N2 Pack", timePointLabel: "6M",
        officialDate: "2025-12-05", advanceDays: 20, requestedDate: "2025-11-15",
        reason: "Trial requirement", requestedBy: "K. Nair", priority: "Normal", remarks: "",
        status: "REJECTED", rejectReason: "Chamber sample not available at the requested date; keep to official schedule.",
        createdAt: off(-50) + " 12:00:00",
        history: [
          { at: off(-50) + " 12:00:00", user: "K. Nair", action: "submitted", note: "Submitted" },
          { at: off(-49) + " 10:00:00", user: "Dr. V. Sharma", action: "rejected", note: "Chamber sample not available at the requested date; keep to official schedule." }
        ] }
    ];

    var audit = [
      { id: "aud_seed1", at: off(-1) + " 09:14:02", user: "A. Dhamodar", action: "update", entity: "sample", entityId: "SMP-0002", field: "analysisStart", oldValue: null, newValue: off(-5), note: null },
      { id: "aud_seed2", at: off(-2) + " 16:40:11", user: "S. Rao", action: "update", entity: "sample", entityId: "SMP-0025", field: "analysisCompleteDate", oldValue: null, newValue: off(-1), note: null },
      { id: "aud_seed3", at: off(-3) + " 11:02:47", user: "Dr. V. Sharma", action: "approve", entity: "report", entityId: "SMP-0001", field: "reportStatus", oldValue: "generated", newValue: "approved", note: "Report approved (demo)" }
    ];

    return {
      settings: { withdrawalWindowDays: 7, analysisDueDays: 15, reportDueDays: 7, org: "AR&D Stability Laboratory" },
      testLibrary: TEST_LIBRARY,
      protocols: protocols,
      samples: samples,
      results: results,
      audit: audit,
      chambers: chambers,
      users: users,
      stps: stps,
      projects: projects,
      pulls: pulls,
      counters: { prot: 10, pk: 7, er: 6, load: 6, wd: 0, doc: 2, rep: 0, ar: arCounter, ep: 3 },
      deviations: [],
      currentUser: "A. Dhamodar",
      role: "Manager",
      demo: true
    };
  }

  global.SD.seed = seed;
  global.SD.testById = testById;
  global.SD.protocolById = protocolById;
})(window);
