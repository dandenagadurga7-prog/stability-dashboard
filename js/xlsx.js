/* Dependency-free .xlsx reader.
 * An .xlsx is a ZIP of XML parts. This reads the ZIP central directory, inflates
 * the parts with the browser's DecompressionStream, and extracts the first
 * worksheet into a 2-D array of strings. No external library, no network.
 * .xls (old binary) is NOT supported — use .xlsx or CSV.
 */
(function (global) {
  "use strict";

  function u16(dv, o) { return dv.getUint16(o, true); }
  function u32(dv, o) { return dv.getUint32(o, true); }
  function decode(bytes) { return new TextDecoder("utf-8").decode(bytes); }
  function xmlUnescape(s) {
    return String(s).replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  }
  function colToIndex(letters) {
    var idx = 0;
    for (var i = 0; i < letters.length; i++) idx = idx * 26 + (letters.charCodeAt(i) - 64);
    return idx - 1;
  }

  function inflateRaw(bytes) {
    if (typeof DecompressionStream === "undefined") {
      return Promise.reject(new Error("This browser cannot read .xlsx; please use CSV."));
    }
    var ds = new DecompressionStream("deflate-raw");
    var src = new ReadableStream({ start: function (c) { c.enqueue(bytes); c.close(); } });
    var stream = src.pipeThrough(ds);
    return new Response(stream).arrayBuffer().then(function (buf) { return new Uint8Array(buf); });
  }

  /* entries: { name: {method, csize, lho} } from the central directory */
  function readEntry(bytes, dv, entry) {
    var lp = entry.lho;
    if (u32(dv, lp) !== 0x04034b50) throw new Error("Corrupt .xlsx (bad local header)");
    var nl = u16(dv, lp + 26), el = u16(dv, lp + 28);
    var start = lp + 30 + nl + el;
    var data = bytes.subarray(start, start + entry.csize);
    if (entry.method === 0) return Promise.resolve(decode(data));
    return inflateRaw(data).then(decode);
  }

  function readXlsx(arrayBuffer) {
    var bytes = new Uint8Array(arrayBuffer);
    var dv = new DataView(arrayBuffer);
    var eocd = -1;
    for (var i = bytes.length - 22; i >= 0 && i >= bytes.length - 22 - 65535; i--) {
      if (u32(dv, i) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) return Promise.reject(new Error("Not a valid .xlsx (ZIP) file."));
    var count = u16(dv, eocd + 10), cdOff = u32(dv, eocd + 16);
    var files = {}, p = cdOff;
    for (var n = 0; n < count; n++) {
      if (u32(dv, p) !== 0x02014b50) break;
      var method = u16(dv, p + 10), csize = u32(dv, p + 20);
      var nameLen = u16(dv, p + 28), extraLen = u16(dv, p + 30), commLen = u16(dv, p + 32);
      var lho = u32(dv, p + 42);
      files[decode(bytes.subarray(p + 46, p + 46 + nameLen))] = { method: method, csize: csize, lho: lho };
      p = p + 46 + nameLen + extraLen + commLen;
    }
    function get(name) {
      return files[name] ? readEntry(bytes, dv, files[name]) : Promise.resolve("");
    }

    return get("xl/sharedStrings.xml").then(function (sharedXml) {
      var shared = [], re = /<si>([\s\S]*?)<\/si>/g, m;
      while ((m = re.exec(sharedXml))) {
        var texts = "", tre = /<t[^>]*>([\s\S]*?)<\/t>/g, tm;
        while ((tm = tre.exec(m[1]))) texts += xmlUnescape(tm[1]);
        shared.push(texts);
      }
      var sheetName = null;
      for (var k in files) { if (/^xl\/worksheets\/sheet\d+\.xml$/.test(k)) { sheetName = k; break; } }
      if (!sheetName) return Promise.reject(new Error("No worksheet found in the .xlsx file."));
      return get(sheetName).then(function (sheetXml) {
        var rows = [], rre = /<row[^>]*>([\s\S]*?)<\/row>/g, rm;
        while ((rm = rre.exec(sheetXml))) {
          var cells = [], cre = /<c\b([^>]*?)\/>|<c\b([^>]*?)>([\s\S]*?)<\/c>/g, cm, colIdx = 0;
          while ((cm = cre.exec(rm[1]))) {
            var attrs = cm[1] !== undefined ? cm[1] : cm[2];
            var inner = cm[3] || "";
            var rAttr = (attrs.match(/\br="([A-Z]+)\d+"/) || [])[1];
            var tAttr = (attrs.match(/\bt="([^"]+)"/) || [])[1];
            if (rAttr) colIdx = colToIndex(rAttr);
            var val = "";
            if (tAttr === "s") {
              var vm = inner.match(/<v>([\s\S]*?)<\/v>/);
              if (vm) val = shared[parseInt(xmlUnescape(vm[1]), 10)] || "";
            } else if (tAttr === "inlineStr") {
              var im = inner.match(/<t[^>]*>([\s\S]*?)<\/t>/);
              val = im ? xmlUnescape(im[1]) : "";
            } else {
              var vv = inner.match(/<v>([\s\S]*?)<\/v>/);
              if (vv) val = xmlUnescape(vv[1]);
            }
            cells[colIdx] = val;
            colIdx++;
          }
          rows.push(cells);
        }
        var width = 0;
        rows.forEach(function (r) { width = Math.max(width, r.length); });
        rows = rows.map(function (r) {
          var out = [];
          for (var j = 0; j < width; j++) out.push(r[j] !== undefined ? r[j] : "");
          return out;
        }).filter(function (r) { return r.some(function (c) { return c !== ""; }); });
        return { rows: rows };
      });
    });
  }

  global.SD = global.SD || {};
  global.SD.readXlsx = readXlsx;
})(typeof window !== "undefined" ? window : globalThis);
