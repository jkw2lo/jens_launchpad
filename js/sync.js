/* =========================================================
   Sync: launch counts and settings across devices

   Optional sign-in (Google or GitHub) through the shared Firebase project
   `github-projects-5d4e4`, the same one Groundwork uses. Each account gets one
   document, launchpad/{uid}:
       opens:   { projectId: [timestamps] }   merged by union, never overwritten
       prefs:   { order, hidden, look, skin } the most recent change wins
       prefsAt: when prefs last changed (ms)
 Every device also keeps its own
   copy in localStorage, so the page works signed out or offline and catches
   the account up next time it loads.

   The Firebase SDK (~500KB) is only downloaded once this browser has signed
   in, or when the sign-in button is pressed.

   Needs this Firestore rule in the project (Firestore → Rules), next to
   Groundwork's:
       match /launchpad/{uid} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }

   Because Groundwork lives on the same site (jkw2lo.github.io) and uses the
   same project, signing in to one signs in to the other on that device.
   ========================================================= */
(function () {
  "use strict";

  var CONFIG = {
    apiKey: "AIzaSyBeIyBs3FtSx9T_wlJHsCqkfxZkhbX3Qhk",
    authDomain: "github-projects-5d4e4.firebaseapp.com",
    projectId: "github-projects-5d4e4",
    storageBucket: "github-projects-5d4e4.firebasestorage.app",
    messagingSenderId: "745706177240",
    appId: "1:745706177240:web:8e3f1f92ceafb1fa444dad"
  };
  var SDK = "https://cdn.jsdelivr.net/npm/firebase@10.14.1/";
  var PARTS = ["firebase-app-compat.js", "firebase-auth-compat.js", "firebase-firestore-compat.js"];
  var COLLECTION = "launchpad";
  var SEEN = "jens_launchpad:signed-in";
  var WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

  // status: loading | out | in | error
  var state = { status: "out", user: null, msg: "" };
  var hooks = { change: null, getLocal: null, setLocal: null };
  var sdk = null, watching = false, unsubscribe = null, docRef = null;

  function set(status, msg) {
    state.status = status;
    state.msg = msg || "";
    if (hooks.change) hooks.change();
  }

  function loadScript(src) {
    return new Promise(function (ok, no) {
      var el = document.createElement("script");
      el.src = src;
      el.async = false;
      el.onload = ok;
      el.onerror = function () { no(new Error("Couldn't load the sign-in library. Check the connection and try again.")); };
      document.head.appendChild(el);
    });
  }
  function loadSdk() {
    if (!sdk) {
      sdk = PARTS.reduce(function (p, part) { return p.then(function () { return loadScript(SDK + part); }); }, Promise.resolve())
        .then(function () {
          if (!window.firebase.apps.length) window.firebase.initializeApp(CONFIG);
          return window.firebase;
        })
        .catch(function (e) { sdk = null; throw e; });
    }
    return sdk;
  }

  // Union two { id: [timestamps] } maps, dropping anything older than 30 days.
  function merge(a, b) {
    var out = {}, cutoff = Date.now() - WINDOW_MS;
    [a || {}, b || {}].forEach(function (src) {
      Object.keys(src).forEach(function (id) {
        (Array.isArray(src[id]) ? src[id] : []).forEach(function (t) {
          if (typeof t === "number" && t > cutoff) (out[id] = out[id] || {})[t] = true;
        });
      });
    });
    Object.keys(out).forEach(function (id) {
      out[id] = Object.keys(out[id]).map(Number).sort(function (x, y) { return x - y; });
    });
    return out;
  }
  function sameOpens(a, b) { return JSON.stringify(merge(a, {})) === JSON.stringify(merge(b, {})); }

  function reason(e) {
    var code = (e && e.code) || "";
    if (code === "permission-denied" || code === "firestore/permission-denied") {
      return "Signed in, but the database said no. The launchpad rule needs adding in Firestore (see the README).";
    }
    if (code === "auth/unauthorized-domain") return location.hostname + " isn't an authorised domain in the Firebase project.";
    if (code === "auth/account-exists-with-different-credential") {
      return "That email already signs in with the other provider. Use that one instead.";
    }
    if (code === "auth/network-request-failed" || code === "unavailable") return "Couldn't reach the server. Check the connection.";
    return (e && e.message) || "Something went wrong.";
  }

  function start() {
    return loadSdk().then(function (fb) {
      if (watching) return fb;
      watching = true;
      fb.auth().onAuthStateChanged(function (user) {
        if (unsubscribe) { unsubscribe(); unsubscribe = null; }
        docRef = null;
        if (!user) { state.user = null; return set("out"); }
        try { localStorage.setItem(SEEN, "1"); } catch (e) {}
        state.user = { name: user.displayName || "", email: user.email || "" };
        set("loading");
        docRef = fb.firestore().collection(COLLECTION).doc(user.uid);
        var ref = docRef;
        // Pull the account's copy, fold in this device's, and write the result back.
        // Opens are unioned; for settings, whichever side changed last wins.
        fb.firestore().runTransaction(function (tx) {
          return tx.get(ref).then(function (snap) {
            var data = snap.exists ? snap.data() : {};
            var merged = merge(data.opens || {}, hooks.getLocal());
            var local = hooks.getPrefs();
            var remoteAt = data.prefsAt || 0;
            var takeRemote = !!data.prefs && remoteAt > local.at;
            var doc = { opens: merged, updated: fb.firestore.FieldValue.serverTimestamp() };
            if (takeRemote) { doc.prefs = data.prefs; doc.prefsAt = remoteAt; }
            else { doc.prefs = JSON.parse(JSON.stringify(local.prefs)); doc.prefsAt = local.at || Date.now(); }
            tx.set(ref, doc);
            return { opens: merged, prefs: takeRemote ? data.prefs : null, at: remoteAt };
          });
        }).then(function (res) {
          if (ref !== docRef) return;
          hooks.setLocal(res.opens);
          if (res.prefs) hooks.setPrefs(res.prefs, res.at);
          set("in");
          // Live: opens made on another device show up here straight away.
          unsubscribe = ref.onSnapshot(function (snap) {
            if (!snap.exists) return;
            var data = snap.data();
            var local = hooks.getLocal();
            var next = merge(local, data.opens || {});
            if (!sameOpens(next, local)) hooks.setLocal(next);
            if (data.prefs && (data.prefsAt || 0) > hooks.getPrefs().at) hooks.setPrefs(data.prefs, data.prefsAt);
          }, function (e) { set("error", reason(e)); });
        }).catch(function (e) { set("error", reason(e)); });
      });
      return fb;
    });
  }

  window.LaunchpadSync = {
    state: state,
    // hooks: { change(), getLocal() -> opens map, setLocal(opens) }
    init: function (h) {
      hooks = h;
      var seen = false;
      try { seen = localStorage.getItem(SEEN) === "1"; } catch (e) {}
      if (!seen) return set("out");
      set("loading");
      start().catch(function (e) { set("error", reason(e)); });
    },
    signIn: function (which) {
      set("loading");
      start().then(function (fb) {
        var provider = which === "github" ? new fb.auth.GithubAuthProvider() : new fb.auth.GoogleAuthProvider();
        return fb.auth().signInWithPopup(provider).catch(function (e) {
          // Phones and in-app browsers often block popups; fall back to a full-page redirect.
          if (e.code === "auth/popup-closed-by-user" || e.code === "auth/cancelled-popup-request") return set(state.user ? "in" : "out");
          if (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment") {
            try { localStorage.setItem(SEEN, "1"); } catch (err) {} // so the page picks the session up on return
            return fb.auth().signInWithRedirect(provider);
          }
          throw e;
        });
      }).catch(function (e) { set("error", reason(e)); });
    },
    signOut: function () {
      loadSdk().then(function (fb) { return fb.auth().signOut(); }).catch(function () {});
      try { localStorage.removeItem(SEEN); } catch (e) {}
      if (unsubscribe) { unsubscribe(); unsubscribe = null; }
      docRef = null;
      state.user = null;
      set("out");
    },
    // Best effort: the page may navigate away before this lands. The union on
    // the next load catches anything that didn't make it.
    recordOpen: function (id, t) {
      if (state.status !== "in" || !docRef || !window.firebase) return;
      var patch = { opens: {} };
      patch.opens[id] = window.firebase.firestore.FieldValue.arrayUnion(t);
      docRef.set(patch, { merge: true }).catch(function () {});
    },
    // Replace the account's settings with this device's.
    pushPrefs: function (prefs, at) {
      if (state.status !== "in" || !docRef) return;
      docRef.update({ prefs: JSON.parse(JSON.stringify(prefs)), prefsAt: at }).catch(function () {});
    }
  };
})();
