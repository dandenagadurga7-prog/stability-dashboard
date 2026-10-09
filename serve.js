/* Zero-dependency static server for local verification of the dashboard. */
var http = require("http");
var fs = require("fs");
var path = require("path");
var root = __dirname;
var port = process.env.PORT || 4173;
var types = { ".html": "text/html", ".css": "text/css", ".js": "application/javascript", ".json": "application/json", ".csv": "text/csv" };

http.createServer(function (req, res) {
  var p = decodeURIComponent((req.url || "/").split("?")[0]);
  if (p === "/") p = "/index.html";
  if (p === "/sd-config.js") {
    /* expose only the publishable (browser) key from .env.local; never the secret */
    var env = {};
    try {
      fs.readFileSync(path.join(root, "..", ".env.local"), "utf8").split(/\r?\n/).forEach(function (l) {
        var i = l.indexOf("=");
        if (i > 0 && !/^\s*#/.test(l)) env[l.slice(0, i).trim()] = l.slice(i + 1).trim();
      });
    } catch (e) { /* no env file: dashboard stays on localStorage */ }
    var body = "window.SD_CONFIG = " + JSON.stringify({
      url: env.NEXT_PUBLIC_SUPABASE_URL || "",
      key: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ""
    }) + ";";
    res.writeHead(200, { "Content-Type": "application/javascript" });
    res.end(body);
    return;
  }
  var file = path.join(root, p);
  if (file.indexOf(root) !== 0) { res.writeHead(403); res.end("forbidden"); return; }
  fs.readFile(file, function (err, data) {
    if (err) { res.writeHead(404, { "Content-Type": "text/plain" }); res.end("404 not found"); return; }
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "text/plain" });
    res.end(data);
  });
}).listen(port, function () { console.log("stability dashboard listening on http://localhost:" + port); });
