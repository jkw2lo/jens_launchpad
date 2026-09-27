(function () {
  "use strict";

  // Every project lives on the same origin (jkw2lo.github.io), so localStorage
  // is shared with them. Prefix every key to stay out of their way.
  var KEY = {
    order: "jens_launchpad:order",
    hidden: "jens_launchpad:hidden",
    opens: "jens_launchpad:opens",
    skin: "jens_launchpad:skin",
    look: "jens_launchpad:look",
    repos: "jens_launchpad:repos",
    prefsAt: "jens_launchpad:prefs-at"
  };
  // Settings that follow you across devices when signed in (last change wins).
  var PREF_KEYS = [KEY.order, KEY.hidden, KEY.look, KEY.skin];
  var SELF_REPO = "jens_launchpad";
  var OWNER = window.GITHUB_USER || "";
  var WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
  var REPO_CACHE_MS = 6 * 60 * 60 * 1000;

  var SKINS = [
    { id: "mist", label: "Mist" },
    { id: "prism", label: "Prism" },
    { id: "brutal", label: "Brutal" },
    { id: "bauhaus", label: "Bauhaus" }
  ];
  // Each style has a five-colour palette. "Project colours" decides how tiles use it:
  //   type      – one colour per project type (palette order = CATEGORIES order)
  //   same      – every project uses colour 1 (and colour 2 as its second shape)
  //   different – projects take turns through the palette
  var MODES = [["type", "By type"], ["same", "Same"], ["different", "Different"]];
  var DEFAULT_LOOK = {
    mode: "type",
    legend: "show", // the colour key under the title, shown with "By type" colours
    mist: { bg: "#f3f4f6", tile: "#ffffff", accent: "#16181d", palette: ["#4f6bdc", "#1f9d8a", "#d98a1c", "#d9487a", "#5b6472"] },
    prism: { bg: "#fbf7f0", pattern: "a", palette: ["#ff7a59", "#4361ee", "#06d6a0", "#f72585", "#ffd166"] },
    brutal: { bg: "#e6e2ff", accent: "#ff5fa2", palette: ["#4f6bff", "#a9c7ff", "#c9bcff", "#7b4dff", "#ffffff"] },
    bauhaus: { bg: "#efe8d8", pattern: "a", palette: ["#d23a2b", "#1f4f96", "#e8b124", "#141414", "#8f8676"] }
  };

  var CATS = window.CATEGORIES || [];
  var CAT_IDS = CATS.map(function (c) { return c.id; });

  var grid = document.getElementById("grid");
  var summary = document.getElementById("summary");
  var legend = document.getElementById("legend");
  var customizeBtn = document.getElementById("customize");
  var editPanel = document.getElementById("editPanel");
  var lookPanel = document.getElementById("lookPanel");
  var lookBody = document.getElementById("lookBody");
  var lookNote = document.getElementById("lookNote");
  var boxItems = document.getElementById("boxItems");
  var boxNote = document.getElementById("boxNote");
  var doneFab = document.getElementById("doneFab");
  var lookStyle = document.getElementById("lookStyle");
  var root = document.documentElement;
  var editing = false;

  // ---------- storage ----------
  function load(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      return v == null ? fallback : JSON.parse(v);
    } catch (e) { return fallback; }
  }
  var applyingRemote = false;
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
    if (!applyingRemote && PREF_KEYS.indexOf(key) >= 0) prefsChanged();
  }
  function loadList(key) {
    var v = load(key, []);
    return Array.isArray(v) ? v : [];
  }

  // ---------- projects ----------
  var projects, byId;
  function setProjects(list) {
    projects = list;
    byId = {};
    list.forEach(function (p, i) {
      byId[p.id] = p;
      p.url = p.url || "https://" + OWNER + ".github.io/" + p.repo + "/";
      if (CAT_IDS.indexOf(p.cat) < 0) p.cat = "more";
      p.idx = i; // stable slot for "Different" colours
    });
  }
  setProjects(window.PROJECTS.slice());

  // Full order of every known project, including the ones in the box.
  function fullOrder() {
    var ids = loadList(KEY.order).filter(function (id) { return byId[id]; });
    projects.forEach(function (p) { if (ids.indexOf(p.id) < 0) ids.push(p.id); });
    return ids;
  }
  function hiddenIds() { return loadList(KEY.hidden); }
  function isHidden(id) { return hiddenIds().indexOf(id) >= 0; }
  function visibleIds() {
    var h = hiddenIds();
    return fullOrder().filter(function (id) { return h.indexOf(id) < 0; });
  }
  function tiles() { return Array.prototype.slice.call(grid.children); }

  // Save the on-screen order, keeping boxed projects in the slot they came from.
  function saveOrderFromDom() {
    var dom = tiles().map(function (t) { return t.dataset.id; });
    var h = hiddenIds();
    var next = fullOrder().map(function (id) { return h.indexOf(id) >= 0 ? id : dom.shift(); });
    loadList(KEY.order).forEach(function (id) { if (!byId[id] && next.indexOf(id) < 0) next.push(id); });
    save(KEY.order, next.filter(Boolean));
  }

  // ---------- open counts ----------
  function recentOpens() {
    var all = load(KEY.opens, {});
    if (!all || typeof all !== "object") all = {};
    var cutoff = Date.now() - WINDOW_MS;
    Object.keys(all).forEach(function (id) {
      all[id] = (Array.isArray(all[id]) ? all[id] : []).filter(function (t) { return t > cutoff; });
    });
    return all;
  }
  function recordOpen(id) {
    var all = recentOpens(), t = Date.now();
    (all[id] = all[id] || []).push(t);
    save(KEY.opens, all);
    if (window.LaunchpadSync) LaunchpadSync.recordOpen(id, t);
  }
  function ago(t) {
    var m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return "just now";
    if (m < 60) return m + "m ago";
    var h = Math.round(m / 60);
    if (h < 24) return h + "h ago";
    var d = Math.round(h / 24);
    return d === 1 ? "yesterday" : d + "d ago";
  }

  // ---------- helpers ----------
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function icon(name) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (window.ICONS[name] || window.ICONS.spark) + "</svg>";
  }
  var SVG = {
    prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    grip: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="6" r="1.3"/><circle cx="15" cy="6" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="9" cy="18" r="1.3"/><circle cx="15" cy="18" r="1.3"/></svg>'
  };
  function catLabel(id) {
    for (var i = 0; i < CATS.length; i++) if (CATS[i].id === id) return CATS[i].label;
    return id;
  }
  // Pick dark or light text for a background colour.
  function inkFor(hex) {
    var n = parseInt(String(hex).slice(1), 16);
    if (isNaN(n)) return "#0d0b1f";
    var rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    var L = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    return L > 0.36 ? "#0d0b1f" : "#ffffff";
  }

  // ---------- rendering ----------
  function tileHtml(p) {
    return (
      '<li class="tile" data-id="' + esc(p.id) + '" data-cat="' + esc(p.cat) + '"' + tileVars(p) + ">" +
        '<a class="tile-link" href="' + esc(p.url) + '" draggable="false"' + (editing ? ' tabindex="-1"' : "") + ">" +
          '<span class="deco" aria-hidden="true"><i class="d1"></i><i class="d2"></i></span>' +
          '<span class="icon">' + icon(p.icon) + "</span>" +
          '<span class="text"><span class="name">' + esc(p.name) + "</span>" +
          '<span class="blurb" title="' + esc(p.blurb || "") + '">' + esc(p.blurb || "") + "</span></span>" +
          '<span class="stat"></span>' +
        "</a>" +
        '<span class="move">' +
          '<span class="grip" aria-hidden="true">' + SVG.grip + "</span>" +
          '<button type="button" data-move="-1" aria-label="Move ' + esc(p.name) + ' earlier">' + SVG.prev + "</button>" +
          '<button type="button" data-move="1" aria-label="Move ' + esc(p.name) + ' later">' + SVG.next + "</button>" +
          '<button type="button" class="hide" data-hide aria-label="Put ' + esc(p.name) + ' back in the box">' + SVG.close + "</button>" +
        "</span>" +
      "</li>"
    );
  }
  function makeTile(p) {
    var tmp = document.createElement("ul");
    tmp.innerHTML = tileHtml(p);
    return tmp.firstChild;
  }

  // ---------- project colours ----------
  function colourSlot(p, pal) {
    if (look.mode === "same") return 0;
    if (look.mode === "type") return Math.max(0, CAT_IDS.indexOf(p.cat)) % pal.length;
    return p.idx % pal.length;
  }
  function tileVars(p) {
    var pal = look[currentSkin()].palette;
    var k = colourSlot(p, pal);
    var c1 = pal[k], c2 = pal[(k + 1) % pal.length], ink = inkFor(c1);
    return ' style="--p1:' + esc(c1) + ";--p2:" + esc(c2) + ";--p1-ink:" + ink +
      ";--p1-muted:" + (ink === "#ffffff" ? "rgba(255,255,255,.85)" : "rgba(13,11,31,.72)") + '"';
  }
  function paintTiles() {
    tiles().forEach(function (t) {
      var tmp = document.createElement("div");
      tmp.innerHTML = "<i" + tileVars(byId[t.dataset.id]) + "></i>";
      t.setAttribute("style", tmp.firstChild.getAttribute("style"));
    });
  }

  function renderGrid() {
    grid.innerHTML = visibleIds().map(function (id) { return tileHtml(byId[id]); }).join("");
  }

  function renderBox() {
    var ids = fullOrder().filter(isHidden);
    boxItems.innerHTML = ids.length
      ? ids.map(function (id) {
          var p = byId[id];
          return '<li><button type="button" class="chip" data-show="' + esc(id) + '" aria-label="Add ' + esc(p.name) + ' to the launchpad">' +
            '<span class="chip-icon">' + icon(p.icon) + '</span><span class="chip-name">' + esc(p.name) + "</span>" +
            '<span class="chip-plus">' + SVG.plus + "</span></button></li>";
        }).join("")
      : '<li class="box-empty">Empty. Every project is on your launchpad.</li>';
    boxNote.textContent = ids.length
      ? ids.length + (ids.length === 1 ? " project" : " projects") + " tucked away · tap to add back"
      : "";
  }

  function renderStats() {
    var all = recentOpens();
    var total = 0, top = null, topN = 0;
    tiles().forEach(function (t) {
      var list = all[t.dataset.id] || [];
      var n = list.length;
      total += n;
      if (n > topN) { topN = n; top = byId[t.dataset.id]; }
      t.querySelector(".stat").innerHTML =
        "<b>" + n + "</b> <span class=\"unit\">" + (n === 1 ? "open" : "opens") + "</span>" +
        (n ? '<span class="sep"> · </span><span class="last">' + ago(list[list.length - 1]) + "</span>" : "");
      t.classList.toggle("is-cold", !n);
    });
    summary.innerHTML = total
      ? '<span class="sum-line"><b>' + total + "</b> " + (total === 1 ? "launch" : "launches") + " this month</span>" +
        '<span class="sum-line">Most used: <b>' + esc(top.name) + "</b></span>"
      : '<span class="sum-line">No launches yet this month</span>';
    renderFoot();
  }
  function renderFoot() {
    var signedIn = window.LaunchpadSync && LaunchpadSync.state.status === "in";
    document.getElementById("foot").textContent = signedIn
      ? "Launch counts cover the last 30 days. Counts and settings are synced across your signed-in devices."
      : "Launch counts cover the last 30 days on this device. Sign in under Customize to sync every device.";
  }

  function renderLegend() {
    var used = {};
    tiles().forEach(function (t) { used[t.dataset.cat] = true; });
    var pal = look[currentSkin()].palette;
    legend.hidden = look.mode !== "type" || look.legend === "hide";
    legend.innerHTML = CATS.map(function (c, i) {
      return used[c.id] ? '<li><i style="background:' + esc(pal[i % pal.length]) + '"></i>' + esc(c.label) + "</li>" : "";
    }).join("");
  }

  function render() {
    renderGrid();
    renderBox();
    renderStats();
    renderLegend();
  }

  // ---------- look (skin, colours, patterns) ----------
  var look = normalizeLook(load(KEY.look, {}));
  function normalizeLook(saved) {
    saved = saved || {};
    var out = {
      mode: MODES.some(function (m) { return m[0] === saved.mode; }) ? saved.mode : DEFAULT_LOOK.mode,
      legend: saved.legend === "hide" ? "hide" : "show"
    };
    SKINS.forEach(function (s) {
      var d = DEFAULT_LOOK[s.id], v = saved[s.id] || {};
      var o = Object.assign({}, d, v);
      o.palette = d.palette.map(function (c, i) {
        var got = Array.isArray(v.palette) ? v.palette[i] : v[CAT_IDS[i]]; // older saves kept Brutal colours by type name
        return /^#[0-9a-f]{6}$/i.test(got || "") ? got : c;
      });
      out[s.id] = o;
    });
    return out;
  }
  function currentSkin() {
    var s = root.dataset.skin;
    return DEFAULT_LOOK[s] ? s : "mist";
  }

  function applyLook() {
    var m = look.mist, p = look.prism, b = look.brutal, h = look.bauhaus;
    var css = "";
    css += '[data-skin="mist"]{--bg:' + m.bg + ";--tile-bg:" + m.tile + ";--accent:" + m.accent + ";--accent-ink:" + inkFor(m.accent) +
      ";--ctrl-on-bg:" + m.accent + ";--ctrl-on-ink:" + inkFor(m.accent) + "}";
    css += '[data-skin="prism"]{--bg:' + p.bg + "}";
    css += '[data-skin="brutal"]{--bg:' + b.bg + ";--accent:" + b.accent + ";--accent-ink:" + inkFor(b.accent) +
      ";--stat-bg:" + b.accent + ";--stat-ink:" + inkFor(b.accent) + ";--ctrl-on-bg:" + b.accent + ";--ctrl-on-ink:" + inkFor(b.accent) +
      ";--focus:" + b.accent + ";--title-shadow:" + b.accent + "}";
    css += '[data-skin="bauhaus"]{--bg:' + h.bg + ";--b1:" + h.palette[0] + ";--b2:" + h.palette[1] +
      ";--ctrl-on-bg:" + h.palette[0] + ";--ctrl-on-ink:" + inkFor(h.palette[0]) +
      ";--accent:" + h.palette[1] + ";--accent-ink:" + inkFor(h.palette[1]) + ";--focus:" + h.palette[0] + "}";
    lookStyle.textContent = css;

    var skin = currentSkin();
    grid.dataset.pat = look[skin].pattern || "a";
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = look[skin].bg;
    paintTiles();
    renderLegend();
  }

  function seg(key, label, options, value) {
    return '<div class="field"><span class="field-label">' + label + '</span><div class="seg" role="radiogroup" aria-label="' + label + '">' +
      options.map(function (o) {
        return '<button type="button" role="radio" data-' + key + '="' + o[0] + '" aria-checked="' + (o[0] === value) + '">' + o[1] + "</button>";
      }).join("") + "</div></div>";
  }
  function colours(label, fields, values) {
    return '<div class="field"><span class="field-label">' + label + '</span><div class="colours">' +
      fields.map(function (f) {
        return '<label class="colour"><input type="color" data-look="' + f[0] + '" value="' + esc(values[f[0]]) + '"><span>' + esc(f[1]) + "</span></label>";
      }).join("") + "</div></div>";
  }
  function paletteField(names, pal) {
    return '<div class="field"><span class="field-label">Colours</span><div class="colours">' +
      names.map(function (n, i) {
        return '<label class="colour"><input type="color" data-pal="' + i + '" value="' + esc(pal[i]) + '"><span>' + esc(n) + "</span></label>";
      }).join("") + "</div></div>";
  }
  function patterns(value) {
    var sample = projects[0];
    return '<div class="field"><span class="field-label">Pattern</span><div class="pats" role="radiogroup" aria-label="Pattern">' +
      ["a", "b", "c"].map(function (k) {
        return '<button type="button" role="radio" class="pat" data-pattern="' + k + '" aria-checked="' + (k === value) + '" aria-label="Pattern ' + k.toUpperCase() + '">' +
          '<span class="pat-view" data-pat="' + k + '"><span class="tile mini"' + tileVars(sample) + ">" +
          '<span class="deco" aria-hidden="true"><i class="d1"></i><i class="d2"></i></span></span></span>' +
          '<span class="pat-label">' + k.toUpperCase() + "</span></button>";
      }).join("") + "</div></div>";
  }

  function renderLook() {
    var skin = currentSkin(), L = look[skin];
    var html = '<div class="field"><span class="field-label">Style</span><div class="seg skins" role="radiogroup" aria-label="Style">' +
      SKINS.map(function (s) {
        return '<button type="button" role="radio" data-skin-choice="' + s.id + '" aria-checked="' + (s.id === skin) + '">' +
          '<span class="sw sw-' + s.id + '" aria-hidden="true"></span>' + s.label + "</button>";
      }).join("") + "</div></div>";

    html += seg("mode", "Project colours", MODES, look.mode);
    if (look.mode === "type") html += seg("legend", "Colour key", [["show", "Show"], ["hide", "Hide"]], look.legend);
    if (L.pattern) html += patterns(L.pattern);
    var names = look.mode === "type" ? CATS.map(function (c) { return c.label; })
      : look.mode === "same" ? ["Colour", "Second colour"]
      : ["Colour 1", "Colour 2", "Colour 3", "Colour 4", "Colour 5"];
    // Mist and Brutal only use one colour per tile, so "Same" needs just the one.
    if (look.mode === "same" && (skin === "mist" || skin === "brutal")) names = ["Colour"];
    html += paletteField(names, L.palette);
    var page = [["bg", "Background"]];
    if (skin === "mist") page = [["bg", "Background"], ["tile", "Tiles"], ["accent", "Buttons"]];
    if (skin === "brutal") page = [["bg", "Background"], ["accent", "Accent"]];
    html += colours("Page", page, L);
    html += '<div class="look-foot"><button type="button" class="btn ghost small" data-reset-look>Restore default ' + esc(skinLabel(skin)) + " look</button></div>";
    lookBody.innerHTML = html;
    lookNote.textContent = skinLabel(skin) + " · " + MODES.filter(function (m) { return m[0] === look.mode; })[0][1].toLowerCase() + " colours";
  }
  function skinLabel(id) {
    for (var i = 0; i < SKINS.length; i++) if (SKINS[i].id === id) return SKINS[i].label;
    return id;
  }

  function setSkin(skin, persist) {
    if (!DEFAULT_LOOK[skin]) skin = "mist";
    root.dataset.skin = skin;
    if (persist) save(KEY.skin, skin);
    applyLook();
    renderLook();
  }
  function saveLook() { save(KEY.look, look); }

  lookBody.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    var skin = currentSkin();
    if (b.dataset.skinChoice) { setSkin(b.dataset.skinChoice, true); focusSame("[data-skin-choice='" + b.dataset.skinChoice + "']"); return; }
    if (b.dataset.pattern) { look[skin].pattern = b.dataset.pattern; }
    else if (b.dataset.mode) { look.mode = b.dataset.mode; }
    else if (b.dataset.legend) { look.legend = b.dataset.legend; }
    else if (b.hasAttribute("data-reset-look")) { look[skin] = JSON.parse(JSON.stringify(DEFAULT_LOOK[skin])); }
    else return;
    saveLook();
    applyLook();
    var sel = b.dataset.pattern ? "[data-pattern='" + b.dataset.pattern + "']" : b.dataset.mode ? "[data-mode='" + b.dataset.mode + "']" : b.dataset.legend ? "[data-legend='" + b.dataset.legend + "']" : "[data-reset-look]";
    renderLook();
    focusSame(sel);
  });
  lookBody.addEventListener("input", function (e) {
    var d = e.target.dataset || {};
    if (d.look) look[currentSkin()][d.look] = e.target.value;
    else if (d.pal) look[currentSkin()].palette[+d.pal] = e.target.value;
    else return;
    applyLook();
  });
  lookBody.addEventListener("change", function (e) {
    if (e.target.dataset && (e.target.dataset.look || e.target.dataset.pal)) saveLook();
  });
  // Arrow keys move between options in each radio group.
  lookBody.addEventListener("keydown", function (e) {
    var d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    var b = e.target.closest('[role="radio"]');
    if (!d || !b) return;
    e.preventDefault();
    var group = Array.prototype.slice.call(b.parentNode.querySelectorAll('[role="radio"]'));
    group[(group.indexOf(b) + d + group.length) % group.length].click();
  });
  function focusSame(selector) {
    var el = lookBody.querySelector(selector);
    if (el) el.focus();
  }

  // ---------- launching ----------
  grid.addEventListener("click", function (e) {
    var moveBtn = e.target.closest("[data-move]");
    if (moveBtn) { moveBy(moveBtn.closest(".tile"), +moveBtn.dataset.move, moveBtn); return; }
    var hideBtn = e.target.closest("[data-hide]");
    if (hideBtn) { hideProject(hideBtn.closest(".tile")); return; }
    var link = e.target.closest(".tile-link");
    if (!link) return;
    if (editing) { e.preventDefault(); return; }
    recordOpen(link.parentNode.dataset.id);
  });
  // Middle-click / new-tab opens count too.
  grid.addEventListener("auxclick", function (e) {
    var link = e.target.closest(".tile-link");
    if (link && e.button === 1 && !editing) { recordOpen(link.parentNode.dataset.id); renderStats(); }
  });
  // Coming back with the Back button restores the page from cache; refresh the numbers.
  window.addEventListener("pageshow", renderStats);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) renderStats(); });

  // ---------- customize mode ----------
  var wide = window.matchMedia("(min-width: 700px)");
  function setEditing(on) {
    editing = on;
    document.body.classList.toggle("editing", on);
    customizeBtn.setAttribute("aria-pressed", on ? "true" : "false");
    customizeBtn.querySelector(".label").textContent = on ? "Done" : "Customize";
    customizeBtn.setAttribute("aria-label", on ? "Done customizing" : "Customize");
    editPanel.hidden = !on;
    doneFab.hidden = !on;
    if (on) { lookPanel.open = wide.matches; renderLook(); }
    tiles().forEach(function (t) {
      var a = t.querySelector(".tile-link");
      if (on) a.tabIndex = -1; else a.removeAttribute("tabindex");
    });
  }
  customizeBtn.addEventListener("click", function () { setEditing(!editing); });
  doneFab.addEventListener("click", function () { setEditing(false); customizeBtn.focus(); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && editing && !drag) { setEditing(false); customizeBtn.focus(); }
  });

  document.getElementById("resetOrder").addEventListener("click", function () {
    save(KEY.order, []);
    var want = visibleIds();
    flip(function () {
      var map = {};
      tiles().forEach(function (t) { map[t.dataset.id] = t; });
      want.forEach(function (id) { if (map[id]) grid.appendChild(map[id]); });
    });
  });

  // The box: hidden projects wait here until they're tapped back in.
  function hideProject(tile) {
    var id = tile.dataset.id;
    var next = tile.nextElementSibling || tile.previousElementSibling;
    var h = hiddenIds();
    if (h.indexOf(id) < 0) h.push(id);
    save(KEY.hidden, h);
    flip(function () { tile.remove(); });
    renderBox();
    renderStats();
    renderLegend();
    var focusTarget = next && next.querySelector("[data-hide]");
    if (focusTarget) focusTarget.focus();
  }
  boxItems.addEventListener("click", function (e) {
    var chip = e.target.closest("[data-show]");
    if (!chip) return;
    var id = chip.dataset.show;
    save(KEY.hidden, hiddenIds().filter(function (x) { return x !== id; }));
    // Put it back in the slot it came from.
    var ids = visibleIds(), i = ids.indexOf(id);
    var after = null;
    for (var k = i + 1; k < ids.length; k++) {
      after = grid.querySelector('.tile[data-id="' + CSS.escape(ids[k]) + '"]');
      if (after) break;
    }
    var tile = makeTile(byId[id]);
    flip(function () { grid.insertBefore(tile, after); }, tile);
    if (tile.animate) tile.animate([{ opacity: 0, transform: "scale(.85)" }, { opacity: 1, transform: "none" }], { duration: 260, easing: "cubic-bezier(.2,.8,.2,1)" });
    renderBox();
    renderStats();
    renderLegend();
    var nextChip = boxItems.querySelector("[data-show]");
    (nextChip || customizeBtn).focus();
  });

  // Animate tiles from their old spot to their new one after a DOM change.
  function flip(mutate, skip) {
    var before = new Map();
    tiles().forEach(function (t) { if (t !== skip) before.set(t, { x: t.offsetLeft, y: t.offsetTop }); });
    mutate();
    before.forEach(function (b, t) {
      if (!t.isConnected) return;
      var dx = b.x - t.offsetLeft, dy = b.y - t.offsetTop;
      if ((dx || dy) && t.animate) {
        t.animate([{ transform: "translate(" + dx + "px," + dy + "px)" }, { transform: "none" }],
          { duration: 220, easing: "cubic-bezier(.2,.8,.2,1)" });
      }
    });
  }

  function moveBy(tile, dir, focusBtn) {
    var list = tiles();
    var i = list.indexOf(tile), j = i + dir;
    if (j < 0 || j >= list.length) return;
    flip(function () {
      if (dir < 0) grid.insertBefore(tile, list[j]);
      else grid.insertBefore(tile, list[j].nextSibling);
    });
    saveOrderFromDom();
    if (focusBtn) focusBtn.focus();
  }

  // Pointer-based drag. A mouse can grab a tile anywhere; touch uses the ⠿ grip
  // so the rest of the tile still scrolls the page.
  var drag = null;

  grid.addEventListener("pointerdown", function (e) {
    if (!editing || e.button !== 0 || e.target.closest("button")) return;
    if (e.pointerType !== "mouse" && !e.target.closest(".grip")) return;
    var tile = e.target.closest(".tile");
    if (!tile) return;
    var r = tile.getBoundingClientRect();
    drag = {
      tile: tile, pid: e.pointerId, active: false,
      sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY,
      offX: e.clientX - r.left, offY: e.clientY - r.top, raf: 0
    };
    try { tile.setPointerCapture(e.pointerId); } catch (err) {}
  });

  function onMove(e) {
    if (!drag || e.pointerId !== drag.pid) return;
    drag.x = e.clientX; drag.y = e.clientY;
    if (!drag.active) {
      if (Math.hypot(drag.x - drag.sx, drag.y - drag.sy) < 6) return;
      drag.active = true;
      drag.tile.classList.add("dragging");
      document.body.classList.add("is-dragging");
      drag.raf = requestAnimationFrame(autoScroll);
    }
    e.preventDefault();
    follow();
    swapUnderPointer();
  }

  function follow() {
    var g = grid.getBoundingClientRect();
    var t = drag.tile;
    var x = drag.x - drag.offX - (g.left + t.offsetLeft);
    var y = drag.y - drag.offY - (g.top + t.offsetTop);
    t.style.transform = "translate(" + x + "px," + y + "px)";
  }

  function swapUnderPointer() {
    var g = grid.getBoundingClientRect();
    var list = tiles();
    var target = null;
    for (var k = 0; k < list.length; k++) {
      var t = list[k];
      if (t === drag.tile) continue;
      var l = g.left + t.offsetLeft, tp = g.top + t.offsetTop;
      if (drag.x >= l && drag.x <= l + t.offsetWidth && drag.y >= tp && drag.y <= tp + t.offsetHeight) { target = t; break; }
    }
    if (!target) return;
    var from = list.indexOf(drag.tile), to = list.indexOf(target);
    flip(function () {
      grid.insertBefore(drag.tile, from < to ? target.nextSibling : target);
    }, drag.tile);
    follow();
  }

  function autoScroll() {
    if (!drag || !drag.active) return;
    var edge = 70, v = 0;
    if (drag.y < edge) v = -Math.ceil((edge - drag.y) / 5);
    else if (drag.y > innerHeight - edge) v = Math.ceil((drag.y - (innerHeight - edge)) / 5);
    if (v) { window.scrollBy(0, v); follow(); swapUnderPointer(); }
    drag.raf = requestAnimationFrame(autoScroll);
  }

  function onUp(e) {
    if (!drag || e.pointerId !== drag.pid) return;
    var d = drag;
    drag = null;
    cancelAnimationFrame(d.raf);
    if (!d.active) return;
    var t = d.tile;
    var from = t.style.transform;
    t.style.transform = "";
    t.classList.remove("dragging");
    document.body.classList.remove("is-dragging");
    if (t.animate && from) {
      t.animate([{ transform: from }, { transform: "none" }], { duration: 200, easing: "cubic-bezier(.2,.8,.2,1)" });
    }
    saveOrderFromDom();
    if (pendingRemote) { var pr = pendingRemote; pendingRemote = null; applyRemotePrefs(pr[0], pr[1]); }
  }
  window.addEventListener("pointermove", onMove, { passive: false });
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);

  // ---------- new projects from GitHub ----------
  // Any repo with a GitHub Pages site that isn't in projects.js gets a tile automatically.
  var lastExtra = "";
  function pretty(name) {
    return name.replace(/[-_]+/g, " ").replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }
  function mergeRepos(repos) {
    var known = {};
    window.PROJECTS.forEach(function (p) { known[p.repo] = true; });
    var extra = repos.filter(function (r) { return !known[r.name] && r.name !== SELF_REPO; }).map(function (r) {
      return { id: "gh:" + r.name, repo: r.name, name: pretty(r.name), blurb: r.desc || "New project", icon: "spark", cat: "more" };
    });
    var sig = extra.map(function (p) { return p.id; }).join(",");
    if (sig === lastExtra) return;
    lastExtra = sig;
    setProjects(window.PROJECTS.concat(extra));
    if (!drag) render();
  }
  function discover() {
    if (!OWNER || !window.fetch) return;
    var cache = load(KEY.repos, null);
    if (cache && Array.isArray(cache.list)) {
      mergeRepos(cache.list);
      if (Date.now() - cache.t < REPO_CACHE_MS) return;
    }
    fetch("https://api.github.com/users/" + encodeURIComponent(OWNER) + "/repos?per_page=100")
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (list) {
        var repos = list.filter(function (r) { return r.has_pages && !r.fork && !r.archived; })
          .map(function (r) { return { name: r.name, desc: r.description || "" }; });
        save(KEY.repos, { t: Date.now(), list: repos });
        mergeRepos(repos);
      })
      .catch(function () {});
  }

  // ---------- sync (sign in to count launches on every device) ----------
  var accountBody = document.getElementById("accountBody");
  function renderAccount() {
    var st = LaunchpadSync.state, html = "";
    if (st.status === "in") {
      var who = st.user && (st.user.email || st.user.name) || "your account";
      html = '<p class="account-line"><span class="dot on" aria-hidden="true"></span>Signed in as <b>' + esc(who) + "</b>. Launch counts, order, the box and your look follow you to every device signed in to this account.</p>" +
        '<div class="account-actions"><button type="button" class="btn ghost small" data-signout>Sign out</button>' +
        '<span class="account-note">Signing out here also signs Groundwork out on this device.</span></div>';
    } else if (st.status === "loading") {
      html = '<p class="account-line"><span class="dot busy" aria-hidden="true"></span>Connecting…</p>';
    } else {
      html = (st.status === "error" ? '<p class="account-line error" role="alert">' + esc(st.msg) + "</p>" : "") +
        '<div class="account-actions">' +
        '<button type="button" class="btn small" data-signin="google">Sign in with Google</button>' +
        '<button type="button" class="btn small" data-signin="github">Sign in with GitHub</button>' +
        (st.status === "error" && st.user ? '<button type="button" class="btn ghost small" data-signout>Sign out</button>' : "") +
        "</div>" +
        '<p class="account-note">Use the same one on every device. It\'s the same sign-in as Groundwork.</p>';
    }
    accountBody.innerHTML = html;
  }
  accountBody.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.signin) LaunchpadSync.signIn(b.dataset.signin);
    else if (b.hasAttribute("data-signout")) LaunchpadSync.signOut();
  });

  // Settings sync: stamp every local change, push it (batched), and take a
  // newer copy from another device when one arrives.
  var pushTimer = 0;
  function prefsSnapshot() {
    return { order: loadList(KEY.order), hidden: hiddenIds(), look: look, skin: currentSkin() };
  }
  function prefsChanged() {
    save(KEY.prefsAt, Date.now());
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () {
      if (window.LaunchpadSync) LaunchpadSync.pushPrefs(prefsSnapshot(), load(KEY.prefsAt, 0));
    }, 600);
  }
  var pendingRemote = null;
  function applyRemotePrefs(p, at) {
    if (drag) { pendingRemote = [p, at]; return; }
    applyingRemote = true;
    if (Array.isArray(p.order)) save(KEY.order, p.order);
    if (Array.isArray(p.hidden)) save(KEY.hidden, p.hidden);
    if (p.look) { look = normalizeLook(p.look); save(KEY.look, look); }
    if (p.skin && DEFAULT_LOOK[p.skin]) { root.dataset.skin = p.skin; save(KEY.skin, p.skin); }
    save(KEY.prefsAt, at);
    applyingRemote = false;
    applyLook();
    render();
    if (editing) renderLook();
  }

  // ---------- go ----------
  var urlSkin = null;
  try { urlSkin = new URLSearchParams(location.search).get("skin"); } catch (e) {}
  root.dataset.skin = DEFAULT_LOOK[urlSkin] ? urlSkin : (load(KEY.skin, "mist") || "mist");
  applyLook();
  render();
  discover();
  LaunchpadSync.init({
    change: function () { renderAccount(); renderFoot(); },
    getLocal: recentOpens,
    setLocal: function (opens) { save(KEY.opens, opens); renderStats(); },
    getPrefs: function () { return { prefs: prefsSnapshot(), at: load(KEY.prefsAt, 0) || 0 }; },
    setPrefs: applyRemotePrefs
  });
})();
