/* Supabase Auth (email + password) for the Stability Dashboard.
 *
 * No library: talks to GoTrue over fetch. Uses ONLY the publishable key.
 * When enabled (SD_CONFIG.authMode === "supabase"):
 *   - no session  -> the app shows a login screen
 *   - session     -> requests carry the user's access token, so PostgREST/Storage
 *                    RLS can identify the user and enforce role permissions.
 *
 * The session is kept in localStorage under sd_auth_session. The refresh token is
 * stored so a short-lived access token can be renewed; the service-role key is
 * never used in the browser.
 */
(function (global) {
  "use strict";
  var SD = global.SD = global.SD || {};
  var SESSION_KEY = "sd_auth_session";

  function cfg() { return global.SD_CONFIG || {}; }
  function enabled() { return cfg().authMode === "supabase" && !!(cfg().url && cfg().key); }
  function session() {
    try { return JSON.parse(global.localStorage.getItem(SESSION_KEY) || "null"); } catch (e) { return null; }
  }
  function setSession(s) {
    try { global.localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch (e) { /* private mode */ }
  }
  function clearSession() {
    try { global.localStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
  }
  function token() { var s = session(); return s && s.access_token ? s.access_token : null; }
  function currentUser() { var s = session(); return s && s.user ? (s.user.email || s.user.id) : null; }
  function headers() {
    var c = cfg(), t = token();
    return { "apikey": c.key, "Authorization": "Bearer " + (t || c.key), "Content-Type": "application/json" };
  }

  function authHeaders() {
    var c = cfg();
    return { "apikey": c.key, "Content-Type": "application/json" };
  }

  function readError(r, j) {
    return (j && (j.error_description || j.msg || j.message || j.error)) || ("HTTP " + r.status);
  }

  function signIn(email, password) {
    var c = cfg();
    return fetch(c.url + "/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ email: email, password: password })
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) throw new Error(readError(r, j));
        setSession({
          access_token: j.access_token,
          refresh_token: j.refresh_token,
          expires_at: Date.now() + ((j.expires_in || 3600) * 1000),
          user: j.user || null
        });
        return j.user || null;
      });
    });
  }

  /* Refresh the access token once it is close to expiry. Returns a Promise. */
  function refresh() {
    var s = session(), c = cfg();
    if (!s || !s.refresh_token) return Promise.reject(new Error("No session"));
    return fetch(c.url + "/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ refresh_token: s.refresh_token })
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) { clearSession(); throw new Error(readError(r, j)); }
        s.access_token = j.access_token;
        s.refresh_token = j.refresh_token || s.refresh_token;
        s.expires_at = Date.now() + ((j.expires_in || 3600) * 1000);
        setSession(s);
        return s;
      });
    });
  }

  /* The signed-in user's profile row (role lives in public.profiles). */
  function profile() {
    var s = session(), c = cfg();
    if (!s || !s.user || !s.user.id) return Promise.resolve(null);
    return fetch(c.url + "/rest/v1/profiles?id=eq." + encodeURIComponent(s.user.id) + "&select=*", { headers: headers() })
      .then(function (r) { if (!r.ok) return null; return r.json(); })
      .then(function (rows) { return (rows && rows[0]) || null; })
      .catch(function () { return null; });
  }

  function signOut() { clearSession(); }

  SD.auth = {
    enabled: enabled,
    session: session,
    token: token,
    headers: headers,
    currentUser: currentUser,
    signIn: signIn,
    refresh: refresh,
    profile: profile,
    signOut: signOut
  };
})(typeof window !== "undefined" ? window : globalThis);
