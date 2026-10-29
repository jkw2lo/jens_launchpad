// Lets the launchpad install as an app and open without a connection.
// Network first, so a new commit shows up as soon as you're online; the copy
// in the cache is only used when the network fails. Only the launchpad's own
// files are handled: the other projects, GitHub, Firebase and fonts go straight
// to the network as usual.
var CACHE = "launchpad-v1";
var SHELL = ["./", "index.html", "css/styles.css", "js/projects.js", "js/sync.js", "js/app.js", "manifest.webmanifest", "icons/icon-192.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET" || !req.url.startsWith(self.registration.scope)) return;
  e.respondWith(fetch(req).then(function (res) {
    if (res.ok) {
      // One copy per file, whatever its ?v= or ?skin=, so the cache doesn't grow with every release.
      var copy = res.clone(), key = new URL(req.url);
      key.search = "";
      caches.open(CACHE).then(function (c) { c.put(key.href, copy); });
    }
    return res;
  }).catch(function () {
    // Offline: ignore ?v= so a cached script still matches a newer page, and
    // fall back to the launchpad itself for any page.
    return caches.match(req, { ignoreSearch: true }).then(function (hit) {
      return hit || (req.mode === "navigate" ? caches.match("index.html", { ignoreSearch: true }) : Response.error());
    });
  }));
});
