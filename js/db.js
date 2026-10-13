/* Supabase sync for the stability dashboard.
 * Uses the publishable (browser) key over PostgREST — no library, no network
 * dependency beyond fetch. The whole workspace state is stored as one JSON row so
 * the dashboard works identically offline (localStorage) and online (Supabase).
 * Only the publishable key is used; the secret/service key is never read or sent.
 */
(function (global) {
  "use strict";

  function cfg() { return global.SD_CONFIG || {}; }
  function enabled() { var c = cfg(); return !!(c.url && c.key && typeof fetch === "function"); }
  function headers() {
    var c = cfg();
    return {
      "Content-Type": "application/json",
      "apikey": c.key,
      "Authorization": "Bearer " + c.key
    };
  }

  function pull() {
    var c = cfg();
    return fetch(c.url + "/rest/v1/stability_state?id=eq.default&select=data", { headers: headers() })
      .then(function (r) {
        if (r.status === 404) throw new Error("stability_state table missing — run supabase/stability-schema.sql");
        if (r.status === 401 || r.status === 403) throw new Error("key rejected (HTTP " + r.status + ")");
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (rows) { return rows && rows[0] ? rows[0].data : null; });
  }

  function push(state) {
    var c = cfg();
    return fetch(c.url + "/rest/v1/stability_state?on_conflict=id", {
      method: "POST",
      headers: Object.assign(headers(), { "Prefer": "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify([{ id: "default", data: state }])
    }).then(function (r) {
      if (r.status === 404) throw new Error("stability_state table missing — run supabase/stability-schema.sql");
      if (!r.ok) throw new Error("HTTP " + r.status);
      return true;
    });
  }

  /* Upload a controlled document to a Supabase Storage bucket using the publishable
   * key (server-side RLS decides who may write). No secret key is used in the browser. */
  function upload(bucket, path, file) {
    var c = cfg();
    return fetch(c.url + "/storage/v1/object/" + encodeURIComponent(bucket) + "/" + path, {
      method: "POST",
      headers: { "apikey": c.key, "Authorization": "Bearer " + c.key, "x-upsert": "true", "Content-Type": file.type || "application/octet-stream" },
      body: file
    }).then(function (r) {
      if (!r.ok) throw new Error("Storage upload failed (HTTP " + r.status + ")" + (r.status === 404 ? " — bucket '" + bucket + "' missing" : ""));
      return true;
    });
  }

  global.SD = global.SD || {};
  global.SD.db = { enabled: enabled, pull: pull, push: push, upload: upload };
})(typeof window !== "undefined" ? window : globalThis);
