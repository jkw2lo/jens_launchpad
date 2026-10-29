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
    prefsAt: "jens_launchpad:prefs-at",
    layout: "jens_launchpad:layout", // single layout from before named layouts (migrated)
    layouts: "jens_launchpad:layouts",
    layoutUse: "jens_launchpad:layout-use", // which layout this device shows; not synced
    overviews: "jens_launchpad:overviews", // which repos have an overview/overview.json
    share: "jens_launchpad:share" // the projects picked for showcase.html, its title and intro
  };
  // Settings that follow you across devices when signed in (last change wins).
  var PREF_KEYS = [KEY.hidden, KEY.look, KEY.skin, KEY.layouts, KEY.share];
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
  var dock = document.getElementById("dock");
  var boxCount = document.getElementById("boxCount");
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
    var ids = (layout.order || []).filter(function (id) { return byId[id]; });
    projects.forEach(function (p) { if (ids.indexOf(p.id) < 0) ids.push(p.id); });
    return ids;
  }
  function hiddenIds() { return loadList(KEY.hidden); }
  function isHidden(id) { return hiddenIds().indexOf(id) >= 0; }
  function visibleIds() {
    var h = hiddenIds();
    return fullOrder().filter(function (id) { return h.indexOf(id) < 0; });
  }
  function tiles() { return Array.prototype.slice.call(grid.querySelectorAll(":scope > .tile")); }

  // Save the on-screen order, keeping boxed projects in the slot they came from.
  function saveOrderFromDom() {
    var dom = tiles().map(function (t) { return t.dataset.id; });
    var h = hiddenIds();
    var next = fullOrder().map(function (id) { return h.indexOf(id) >= 0 ? id : dom.shift(); });
    (layout.order || []).forEach(function (id) { if (!byId[id] && next.indexOf(id) < 0) next.push(id); });
    layout.order = next.filter(Boolean);
    saveLayout();
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
  function tileHtml(p, cell) {
    return (
      '<li class="tile" data-id="' + esc(p.id) + '" data-cat="' + esc(p.cat) + '"' +
      (cell != null ? ' data-cell="' + cell + '"' : "") + tileVars(p) + ">" +
        '<a class="tile-link" href="' + esc(p.url) + '" draggable="false"' + (editing ? ' tabindex="-1"' : "") + ">" +
          '<span class="deco" aria-hidden="true"><i class="d1"></i><i class="d2"></i></span>' +
          '<span class="icon">' + icon(p.icon) + "</span>" +
          '<span class="text"><span class="name">' + esc(p.name) + "</span>" +
          '<span class="blurb" title="' + esc(p.blurb || "") + '">' + esc(p.blurb || "") + "</span></span>" +
          '<span class="stat"></span>' +
        "</a>" +
        (overviews.has[p.repo] ? '<a class="about" href="overview.html?p=' + encodeURIComponent(p.repo) + '" aria-label="About ' + esc(p.name) + '">About</a>' : "") +
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
    pickLayout();
    var board = layout.mode === "grid";
    grid.classList.toggle("board", board);
    grid.style.setProperty("--cols", layout.cols);
    if (!board) {
      grid.innerHTML = visibleIds().map(function (id) { return tileHtml(byId[id]); }).join("");
    } else {
      renderBoard();
    }
    renderLayoutBar();
  }

  // ---------- custom grid (a board of squares, like Groundwork) ----------
  // layout.cells holds a project id (or null) per square, row by row. Projects
  // not on the board sit in the tray underneath; new ones take the first free square.
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  // ---------- named layouts (like Groundwork) ----------
  // Layouts are shared by every device (and synced); each device picks which
  // one it shows, so a phone and a desktop can differ. Each layout has its own
  // mode, order (for Auto) and board (for Custom grid). The box and look are shared.
  var MAX_LAYOUTS = 8;
  function normLayout(l, i) {
    l = l || {};
    var cols = clamp(parseInt(l.cols, 10) || 4, 1, 6), rows = clamp(parseInt(l.rows, 10) || 4, 1, 12);
    var cells = Array.isArray(l.cells) ? l.cells.slice(0, cols * rows) : [];
    while (cells.length < cols * rows) cells.push(null);
    return {
      id: String(l.id || "l" + i),
      name: String(l.name || (i ? "Layout " + (i + 1) : "Main")).slice(0, 40),
      mode: l.mode === "grid" ? "grid" : "auto",
      cols: cols, rows: rows, cells: cells,
      seen: Array.isArray(l.seen) ? l.seen : [],
      order: Array.isArray(l.order) ? l.order : []
    };
  }
  // Builds the list, turning an older single layout (+ order) into "Main".
  function layoutsFrom(list, legacyLayout, legacyOrder) {
    if (!Array.isArray(list) || !list.length) {
      list = [Object.assign({}, legacyLayout || {}, { id: "main", name: "Main", order: Array.isArray(legacyOrder) ? legacyOrder : [] })];
    }
    var ids = {};
    return list.slice(0, MAX_LAYOUTS).map(normLayout).filter(function (l) {
      if (ids[l.id]) return false;
      ids[l.id] = true;
      return true;
    });
  }
  var layouts = layoutsFrom(load(KEY.layouts, null), load(KEY.layout, null), loadList(KEY.order));
  var editId = null; // the layout open in Customize (may differ from this device's)
  function findLayout(id) {
    for (var i = 0; i < layouts.length; i++) if (layouts[i].id === id) return layouts[i];
    return null;
  }
  function deviceLayout() { return findLayout(load(KEY.layoutUse, null)) || layouts[0]; }
  var layout = deviceLayout();
  function pickLayout() { layout = (editing && findLayout(editId)) || deviceLayout(); }
  function saveLayout() { save(KEY.layouts, layouts); }

  function isFree(i) {
    var id = layout.cells[i];
    return !id || !byId[id] || isHidden(id);
  }
  function firstFree() {
    for (var i = 0; i < layout.cells.length; i++) if (isFree(i)) return i;
    return -1;
  }
  // Give new projects a square, and free the squares of boxed ones.
  function ensureLayout() {
    var changed = false, h = hiddenIds();
    layout.cells = layout.cells.map(function (id) {
      if (id && h.indexOf(id) >= 0) { changed = true; return null; }
      return id;
    });
    visibleIds().forEach(function (id) {
      if (layout.seen.indexOf(id) >= 0) return;
      layout.seen.push(id);
      changed = true;
      if (layout.cells.indexOf(id) < 0) {
        var f = firstFree();
        if (f >= 0) layout.cells[f] = id;
      }
    });
    if (changed) saveLayout();
  }
  // First time on the grid: lay the current order out row by row.
  function startBoard() {
    var ids = visibleIds();
    if (layout.cells.some(function (id, i) { return !isFree(i); })) return;
    layout.rows = clamp(Math.ceil(ids.length / layout.cols), 1, 12);
    layout.cells = [];
    for (var i = 0; i < layout.cols * layout.rows; i++) layout.cells.push(ids[i] || null);
    layout.seen = projects.map(function (p) { return p.id; });
  }

  function renderBoard() {
    ensureLayout();
    var placed = {}, html = "";
    // Outside Customize, rows that are empty all the way to the bottom take no space.
    var shown = layout.cells.length;
    if (!editing) {
      var last = -1;
      layout.cells.forEach(function (id, i) { if (!isFree(i)) last = i; });
      shown = last < 0 ? 0 : (Math.floor(last / layout.cols) + 1) * layout.cols;
    }
    layout.cells.slice(0, shown).forEach(function (id, i) {
      if (!isFree(i)) { placed[id] = true; html += tileHtml(byId[id], i); }
      else html += '<li class="slot" data-cell="' + i + '"><span>Empty</span></li>';
    });
    var tray = visibleIds().filter(function (id) { return !placed[id]; });
    html += '<li class="tray-label" data-tray>' + (tray.length
      ? "Not on the board. Drag or tap to place these."
      : "Drop a tile here to take it off the board.") + "</li>";
    tray.forEach(function (id) { html += tileHtml(byId[id], null); });
    grid.innerHTML = html;
    if (picked) {
      var t = grid.querySelector('.tile[data-id="' + CSS.escape(picked) + '"]');
      if (t) t.classList.add("picked"); else if (!isHidden(picked)) picked = null;
    }
    document.body.classList.toggle("picking", !!picked);
  }

  // Move a project onto a square (swapping with whatever is there) or into the tray.
  function placeAt(id, target) {
    var from = layout.cells.indexOf(id);
    if (target.hasAttribute("data-tray") || (target.classList.contains("tile") && target.dataset.cell == null)) {
      if (from < 0) return;
      layout.cells[from] = null;
    } else {
      var to = +target.dataset.cell;
      if (to === from) return;
      var other = isFree(to) ? null : layout.cells[to];
      layout.cells[to] = id;
      if (from >= 0) layout.cells[from] = other;
    }
    saveLayout();
    flipById(renderBoard);
  }

  // Like flip(), but matched by project id so it survives a full re-render.
  function flipById(mutate) {
    var before = {};
    tiles().forEach(function (t) { before[t.dataset.id] = { x: t.offsetLeft, y: t.offsetTop }; });
    mutate();
    tiles().forEach(function (t) {
      var b = before[t.dataset.id];
      if (!b || !t.animate) return;
      var dx = b.x - t.offsetLeft, dy = b.y - t.offsetTop;
      if (dx || dy) t.animate([{ transform: "translate(" + dx + "px," + dy + "px)" }, { transform: "none" }], { duration: 240, easing: "cubic-bezier(.2,.8,.2,1)" });
    });
    renderStats();
    if (editing) tiles().forEach(function (t) { t.querySelector(".tile-link").tabIndex = -1; });
  }

  // Tap a project, then tap a square (or the tray) to put it there.
  var picked = null;
  function boardTap(el) {
    if (el.classList.contains("tile") && !picked) { picked = el.dataset.id; }
    else if (el.classList.contains("tile") && picked === el.dataset.id) { picked = null; }
    else if (picked) {
      var id = picked;
      picked = null;
      if (isHidden(id)) {
        save(KEY.hidden, hiddenIds().filter(function (x) { return x !== id; }));
        layout.seen.indexOf(id) < 0 && layout.seen.push(id);
        if (layout.cells.indexOf(id) < 0 && (el.hasAttribute("data-tray") || el.dataset.cell == null)) { saveLayout(); flipById(renderBoard); }
        else placeAt(id, el);
        renderBox();
        renderLegend();
        return;
      }
      placeAt(id, el);
      return;
    }
    else return;
    tiles().forEach(function (t) { t.classList.toggle("picked", t.dataset.id === picked); });
    document.body.classList.toggle("picking", !!picked);
  }

  function resizeBoard(cols, rows) {
    cols = clamp(cols, 1, 6); rows = clamp(rows, 1, 12);
    var cells = [];
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
      cells.push(r < layout.rows && c < layout.cols ? layout.cells[r * layout.cols + c] : null);
    }
    layout.cols = cols; layout.rows = rows; layout.cells = cells;
    saveLayout();
    render();
  }

  var layoutBar = document.getElementById("layoutBar");
  function renderLayoutBar() {
    var g = layout.mode === "grid";
    var mine = deviceLayout().id;
    var html = '<div class="layout-tabs" role="tablist" aria-label="Layouts">' +
      layouts.map(function (l) {
        return '<button type="button" role="tab" data-tab="' + esc(l.id) + '" aria-selected="' + (l.id === layout.id) + '">' +
          '<span class="tab-name">' + esc(l.name) + "</span>" + (l.id === mine ? '<span class="tab-badge">this device</span>' : "") + "</button>";
      }).join("") +
      (layouts.length < MAX_LAYOUTS ? '<button type="button" class="tab-new" data-new-layout>+ New layout</button>' : "") +
      "</div>";
    html += '<div class="layout-row">' +
      '<label class="name-field"><span>Name</span><input type="text" maxlength="40" data-layout-name value="' + esc(layout.name) + '"></label>' +
      (layout.id === mine
        ? '<span class="use-note">✓ Shown on this device</span>'
        : '<button type="button" class="btn small" data-use-layout>Use on this device</button>') +
      (layouts.length > 1 ? '<button type="button" class="btn ghost small" data-delete-layout>Delete layout</button>' : "") +
      "</div>";
    html += '<div class="layout-row">';
    html += '<div class="seg" role="radiogroup" aria-label="Layout">' +
      [["auto", "Auto"], ["grid", "Custom grid"]].map(function (o) {
        return '<button type="button" role="radio" data-layout="' + o[0] + '" aria-checked="' + (layout.mode === o[0]) + '">' + o[1] + "</button>";
      }).join("") + "</div>";
    if (g) {
      html += stepper("cols", "Columns", layout.cols) + stepper("rows", "Rows", layout.rows) +
        '<button type="button" class="btn ghost small" data-clear-board>Clear board</button>';
    } else {
      html += '<button type="button" class="btn ghost small" id="resetOrder">Reset order</button>';
    }
    html += "</div>";
    layoutBar.innerHTML = html;
    document.getElementById("editHint").innerHTML = g
      ? '<span class="hint-drag">Drag a tile onto any square, or click a tile and then a square.</span>' +
        '<span class="hint-grip">Tap a project, then tap a square.</span> Empty squares stay empty. <b>✕</b> puts a project back in the box.'
      : '<span class="hint-drag">Drag tiles to reorder.</span><span class="hint-grip">Drag <b>⠿</b> to reorder.</span> <b>✕</b> puts a project back in the box.';
  }
  function stepper(key, label, value) {
    return '<span class="stepper" role="group" aria-label="' + label + '"><span class="stepper-label">' + label + "</span>" +
      '<button type="button" data-step="' + key + '" data-d="-1" aria-label="Fewer ' + label.toLowerCase() + '">−</button>' +
      '<b aria-live="polite">' + value + "</b>" +
      '<button type="button" data-step="' + key + '" data-d="1" aria-label="More ' + label.toLowerCase() + '">+</button></span>';
  }
  layoutBar.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.layout) {
      if (b.dataset.layout === layout.mode) return;
      layout.mode = b.dataset.layout;
      if (layout.mode === "grid") startBoard();
      picked = null;
      saveLayout();
      render();
      var again = layoutBar.querySelector('[data-layout="' + layout.mode + '"]');
      if (again) again.focus();
    } else if (b.dataset.step) {
      var d = +b.dataset.d;
      resizeBoard(layout.cols + (b.dataset.step === "cols" ? d : 0), layout.rows + (b.dataset.step === "rows" ? d : 0));
      var same = layoutBar.querySelector('[data-step="' + b.dataset.step + '"][data-d="' + b.dataset.d + '"]');
      if (same) same.focus();
    } else if (b.hasAttribute("data-clear-board")) {
      layout.cells = layout.cells.map(function () { return null; });
      saveLayout();
      flipById(renderBoard);
    } else if (b.id === "resetOrder") {
      resetOrder();
    } else if (b.dataset.tab) {
      editId = b.dataset.tab;
      picked = null;
      render();
      focusLayoutBar('[data-tab="' + CSS.escape(editId) + '"]');
    } else if (b.hasAttribute("data-new-layout")) {
      // A new layout starts as a copy of the one being edited.
      var copy = JSON.parse(JSON.stringify(layout));
      copy.id = "l" + Date.now().toString(36);
      copy.name = "Layout " + (layouts.length + 1);
      layouts.push(copy);
      editId = copy.id;
      saveLayout();
      render();
      var nameInput = layoutBar.querySelector("[data-layout-name]");
      if (nameInput) { nameInput.focus(); nameInput.select(); }
    } else if (b.hasAttribute("data-use-layout")) {
      save(KEY.layoutUse, layout.id);
      renderLayoutBar();
      focusLayoutBar(".use-note");
    } else if (b.hasAttribute("data-delete-layout")) {
      if (layouts.length < 2 || !window.confirm('Delete the layout "' + layout.name + '"? Devices using it will switch to another layout.')) return;
      layouts = layouts.filter(function (l) { return l !== layout; });
      saveLayout();
      editId = deviceLayout().id;
      picked = null;
      render();
      focusLayoutBar('[aria-selected="true"]');
    }
  });
  layoutBar.addEventListener("input", function (e) {
    if (!e.target.hasAttribute("data-layout-name")) return;
    layout.name = e.target.value.slice(0, 40);
    var tab = layoutBar.querySelector('[data-tab="' + CSS.escape(layout.id) + '"] .tab-name');
    if (tab) tab.textContent = layout.name || "Untitled";
    saveLayout();
  });
  function focusLayoutBar(sel) {
    var el = layoutBar.querySelector(sel);
    if (el) { if (!el.hasAttribute("tabindex") && el.tagName === "SPAN") el.tabIndex = -1; el.focus(); }
  }

  function renderBox() {
    var ids = fullOrder().filter(isHidden);
    boxItems.innerHTML = ids.length
      ? ids.map(function (id) {
          var p = byId[id];
          return '<li><button type="button" class="chip' + (picked === id ? " picked" : "") + '" data-show="' + esc(id) + '" aria-pressed="' + (picked === id) + '"' +
            ' aria-label="' + (layout.mode === "grid" ? "Pick " + esc(p.name) + ", then choose a square" : "Add " + esc(p.name) + " to the launchpad") + '">' +
            '<span class="chip-icon">' + icon(p.icon) + '</span><span class="chip-name">' + esc(p.name) + "</span>" +
            '<span class="chip-plus">' + SVG.plus + "</span></button></li>";
        }).join("")
      : '<li class="box-empty">Empty. Drop a tile here, or tap its <b>✕</b>, to tuck it away.</li>';
    boxCount.textContent = ids.length ? "· " + ids.length : "";
    boxNote.textContent = !ids.length ? ""
      : layout.mode === "grid" ? "Tap one, then tap a square to place it."
      : "Tap one to add it back.";
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
    if (editing) renderShare();
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
  var justDragged = false;
  grid.addEventListener("click", function (e) {
    if (justDragged) { justDragged = false; e.preventDefault(); return; }
    var moveBtn = e.target.closest("[data-move]");
    if (moveBtn) { moveBy(moveBtn.closest(".tile"), +moveBtn.dataset.move, moveBtn); return; }
    var hideBtn = e.target.closest("[data-hide]");
    if (hideBtn) { hideProject(hideBtn.closest(".tile")); return; }
    if (editing && layout.mode === "grid") {
      var spot = e.target.closest(".tile, .slot, [data-tray]");
      e.preventDefault();
      if (spot) boardTap(spot);
      return;
    }
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
    dock.hidden = !on;
    if (on) { lookPanel.open = wide.matches; renderLook(); }
    editId = on ? deviceLayout().id : null;
    if (!on && picked) { picked = null; document.body.classList.remove("picking"); }
    // Re-render: Customize may have been showing a different layout than this device's.
    render();
  }
  customizeBtn.addEventListener("click", function () { setEditing(!editing); });
  doneFab.addEventListener("click", function () { setEditing(false); customizeBtn.focus(); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && editing && !drag) { setEditing(false); customizeBtn.focus(); }
  });

  function resetOrder() {
    layout.order = [];
    saveLayout();
    var want = visibleIds();
    flip(function () {
      var map = {};
      tiles().forEach(function (t) { map[t.dataset.id] = t; });
      want.forEach(function (id) { if (map[id]) grid.appendChild(map[id]); });
    });
  }

  // The box: hidden projects wait here until they're tapped back in.
  function hideProject(tile) {
    var id = tile.dataset.id;
    var next = tile.nextElementSibling || tile.previousElementSibling;
    var h = hiddenIds();
    if (h.indexOf(id) < 0) h.push(id);
    save(KEY.hidden, h);
    if (layout.mode === "grid") {
      if (picked === id) picked = null;
      flipById(renderBoard);
      next = null;
    } else {
      flip(function () { tile.remove(); });
    }
    renderBox();
    renderStats();
    renderLegend();
    var focusTarget = next && next.querySelector("[data-hide]");
    if (focusTarget) focusTarget.focus();
  }
  dock.addEventListener("click", function (e) {
    if (e.target.closest("[data-show], button") || !picked || isHidden(picked)) return;
    var t = grid.querySelector('.tile[data-id="' + CSS.escape(picked) + '"]');
    picked = null;
    document.body.classList.remove("picking");
    if (t) hideProject(t);
  });
  boxItems.addEventListener("click", function (e) {
    var chip = e.target.closest("[data-show]");
    if (!chip) return;
    var id = chip.dataset.show;
    if (layout.mode === "grid") {
      // Pick it up; the next square tapped is where it goes.
      picked = picked === id ? null : id;
      tiles().forEach(function (t) { t.classList.remove("picked"); });
      document.body.classList.toggle("picking", !!picked);
      renderBox();
      var again = boxItems.querySelector('[data-show="' + CSS.escape(id) + '"]');
      if (again) again.focus();
      return;
    }
    save(KEY.hidden, hiddenIds().filter(function (x) { return x !== id; }));
    if (layout.mode === "grid") {
      // On the board it takes the first free square, or waits in the tray.
      if (layout.cells.indexOf(id) < 0) {
        var f = firstFree();
        if (f >= 0) { layout.cells[f] = id; saveLayout(); }
      }
      flipById(renderBoard);
      renderBox();
      renderLegend();
      (boxItems.querySelector("[data-show]") || customizeBtn).focus();
      return;
    }
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
    if (layout.mode === "grid") {
      if (tile.dataset.cell == null) return;
      var to = +tile.dataset.cell + dir;
      var target = grid.querySelector(':scope > [data-cell="' + to + '"]');
      if (!target) return;
      var id = tile.dataset.id;
      placeAt(id, target);
      var again = grid.querySelector('.tile[data-id="' + CSS.escape(id) + '"] [data-move="' + dir + '"]');
      if (again) again.focus();
      return;
    }
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
    track();
  }
  function overDock() {
    var r = dock.getBoundingClientRect();
    return !dock.hidden && r.width > 0 && drag.x >= r.left && drag.x <= r.right && drag.y >= r.top && drag.y <= r.bottom;
  }
  function track() {
    var inDock = overDock();
    dock.classList.toggle("drop-target", inDock);
    drag.toBox = inDock;
    if (inDock) { if (drag.over) { drag.over.classList.remove("drop-target"); drag.over = null; } return; }
    if (layout.mode === "grid") markDrop(); else swapUnderPointer();
  }

  function dropUnderPointer() {
    var g = grid.getBoundingClientRect();
    var list = grid.querySelectorAll(":scope > .tile, :scope > .slot, :scope > [data-tray]");
    for (var k = 0; k < list.length; k++) {
      var t = list[k];
      if (t === drag.tile) continue;
      var l = g.left + t.offsetLeft, tp = g.top + t.offsetTop;
      if (drag.x >= l && drag.x <= l + t.offsetWidth && drag.y >= tp && drag.y <= tp + t.offsetHeight) return t;
    }
    return null;
  }
  function markDrop() {
    var t = dropUnderPointer();
    if (t === drag.over) return;
    if (drag.over) drag.over.classList.remove("drop-target");
    drag.over = t;
    if (t) t.classList.add("drop-target");
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
    if (v) { window.scrollBy(0, v); follow(); track(); }
    drag.raf = requestAnimationFrame(autoScroll);
  }

  function onUp(e) {
    if (!drag || e.pointerId !== drag.pid) return;
    var d = drag;
    drag = null;
    cancelAnimationFrame(d.raf);
    if (!d.active) return;
    justDragged = true;
    setTimeout(function () { justDragged = false; }, 0);
    var t = d.tile;
    dock.classList.remove("drop-target");
    if (d.toBox) {
      // Dropped on the box: tuck it away.
      if (d.over) d.over.classList.remove("drop-target");
      t.style.transform = "";
      t.classList.remove("dragging");
      document.body.classList.remove("is-dragging");
      if (layout.mode !== "grid") saveOrderFromDom();
      hideProject(t);
      return;
    }
    if (layout.mode === "grid") {
      if (d.over) d.over.classList.remove("drop-target");
      t.classList.remove("dragging");
      document.body.classList.remove("is-dragging");
      if (d.over) {
        // Let the dropped tile glide from where it was let go.
        var r = t.getBoundingClientRect();
        t.style.transform = "";
        var id = t.dataset.id;
        placeAt(id, d.over);
        var nt = grid.querySelector('.tile[data-id="' + CSS.escape(id) + '"]');
        if (nt && nt.animate) {
          var r2 = nt.getBoundingClientRect();
          nt.animate([{ transform: "translate(" + (r.left - r2.left) + "px," + (r.top - r2.top) + "px)" }, { transform: "none" }], { duration: 200, easing: "cubic-bezier(.2,.8,.2,1)" });
        }
      } else {
        var back = t.style.transform;
        t.style.transform = "";
        if (t.animate && back) t.animate([{ transform: back }, { transform: "none" }], { duration: 200, easing: "cubic-bezier(.2,.8,.2,1)" });
      }
      if (pendingRemote) { var p0 = pendingRemote; pendingRemote = null; applyRemotePrefs(p0[0], p0[1]); }
      return;
    }
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
    checkOverviews();
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

  // ---------- overviews ----------
  // A project gets an About link when its repo has overview/overview.json (see OVERVIEW.md).
  // Tiles show what the last visit found straight away; then every project is checked again
  // with one HEAD request, so a new overview shows up on the next visit. Each repo is asked
  // at most once per page load, so a failing one never loops.
  var overviews = load(KEY.overviews, null) || { has: {} };
  var checkingOverviews = false;
  var overviewAsked = {};
  function checkOverviews() {
    if (!window.fetch || checkingOverviews) return;
    var todo = projects.filter(function (p) { return p.repo && !overviewAsked[p.repo]; });
    if (!todo.length) return;
    todo.forEach(function (p) { overviewAsked[p.repo] = true; });
    checkingOverviews = true;
    Promise.all(todo.map(function (p) {
      return fetch(p.url + "overview/overview.json", { method: "HEAD", cache: "no-cache" })
        // only a 404 means "no overview"; rate limits and network errors keep what we knew
        .then(function (r) { return r.ok ? true : r.status === 404 ? false : null; }, function () { return null; })
        .then(function (ok) { return [p.repo, ok]; });
    })).then(function (results) {
      var changed = false;
      results.forEach(function (r) {
        if (r[1] === null) return;
        if (overviews.has[r[0]] !== r[1]) changed = true;
        overviews.has[r[0]] = r[1];
      });
      save(KEY.overviews, overviews);
      checkingOverviews = false;
      if (changed && !drag) render();
      checkOverviews(); // pick up any project discovered meanwhile
    });
  }

  // ---------- share: pick projects for the public showcase page ----------
  // showcase.html is the page for other people. The picks are kept as repo names, in the
  // showcase's own order, the same names its link carries (showcase.html?p=a,b&t=…&i=…&v=…),
  // so a link keeps working whatever happens here. Until you change anything, it's every
  // project with an overview, in launchpad order.
  var shareBody = document.getElementById("shareBody");
  document.getElementById("sharePanel").addEventListener("toggle", function () { if (this.open) loadVisits(); });
  var SHARE_VIEWS = [["grid", "Grid"], ["feature", "Featured"], ["list", "List"]];
  var share = normalizeShare(load(KEY.share, null));
  function normalizeShare(v) {
    v = v && typeof v === "object" ? v : {};
    return {
      repos: Array.isArray(v.repos) ? v.repos.filter(function (r) { return typeof r === "string"; }) : null,
      view: SHARE_VIEWS.some(function (x) { return x[0] === v.view; }) ? v.view : "grid",
      welcome: !!v.welcome, // open on the welcome screen, as tracked links do
      title: typeof v.title === "string" ? v.title.slice(0, 80) : "",
      intro: typeof v.intro === "string" ? v.intro.slice(0, 280) : "",
      // tracked links: { id (the k= code), label (yours only), name (the greeting), url, at }
      links: Array.isArray(v.links) ? v.links.filter(function (l) {
        return l && typeof l.id === "string" && typeof l.url === "string";
      }).map(function (l) {
        return { id: l.id.slice(0, 24), label: String(l.label || "").slice(0, 60), name: String(l.name || "").slice(0, 40),
          title: String(l.title || "").slice(0, 80), url: l.url, at: +l.at || 0 };
      }) : []
    };
  }
  function shareable() { return fullOrder().map(function (id) { return byId[id]; }).filter(function (p) { return p && p.repo; }); }
  function knownRepos() { var k = {}; shareable().forEach(function (p) { k[p.repo] = p; }); return k; }
  // The showcase's order: yours once you've changed anything, else launchpad order
  function pickedRepos() {
    var k = knownRepos();
    var list = share.repos || shareable().filter(function (p) { return overviews.has[p.repo]; }).map(function (p) { return p.repo; });
    return list.filter(function (r) { return k[r]; });
  }
  function sharedProjects() { var k = knownRepos(); return pickedRepos().map(function (r) { return k[r]; }); }
  function ownShare() { share.repos = pickedRepos(); }
  // o.title / o.intro override the showcase's own, for a tracked link with its own wording
  function shareLink(o) {
    o = o || {};
    var title = o.title != null ? o.title : share.title, intro = o.intro != null ? o.intro : share.intro;
    var q = "p=" + pickedRepos().map(encodeURIComponent).join(",");
    if (title) q += "&t=" + encodeURIComponent(title);
    if (intro) q += "&i=" + encodeURIComponent(intro);
    if (share.view !== "grid") q += "&v=" + share.view;
    if (share.welcome) q += "&w=1";
    return new URL("showcase.html", location.href).href.split("?")[0] + "?" + q;
  }
  function renderShare() {
    var picked = sharedProjects(), on = {};
    picked.forEach(function (p) { on[p.repo] = true; });
    var rest = shareable().filter(function (p) { return !on[p.repo]; });
    var none = function (p) { return overviews.has[p.repo] ? "" : ' <span class="chip-none">no overview</span>'; };
    shareBody.innerHTML =
      '<div class="share-fields">' +
        '<label>Title<input data-share-field="title" maxlength="80" placeholder="Projects" value="' + esc(share.title) + '"></label>' +
        '<label>Intro (optional)<input data-share-field="intro" maxlength="280" placeholder="A line for whoever you send it to" value="' + esc(share.intro) + '"></label>' +
      "</div>" +
      '<div class="share-views"><span class="field-label">Layout</span><div class="seg" role="group" aria-label="Showcase layout">' +
        SHARE_VIEWS.map(function (v) {
          return '<button type="button" data-share-view="' + v[0] + '" aria-pressed="' + (share.view === v[0]) + '">' + v[1] + "</button>";
        }).join("") + "</div>" +
        '<span class="share-hint">' + { grid: "Cards in rows", feature: "The first project gets a big card on top", list: "One project per row, picture beside the words" }[share.view] + "</span></div>" +
      '<div class="share-views"><span class="field-label">Opens on</span><div class="seg" role="group" aria-label="What the link opens on">' +
        '<button type="button" data-share-welcome="0" aria-pressed="' + !share.welcome + '">The projects</button>' +
        '<button type="button" data-share-welcome="1" aria-pressed="' + share.welcome + '">A welcome screen</button></div>' +
        '<span class="share-hint">Tracked links always open on it, so with this on they look the same as any other link</span></div>' +
      '<div class="share-sub"><span class="field-label">On the showcase · ' + picked.length + "</span>" +
        '<span class="share-hint">Drag to reorder, or use the arrows</span></div>' +
      (picked.length ? '<ol class="share-order" aria-label="Showcase order">' + picked.map(function (p, i) {
        return '<li draggable="true" data-order="' + esc(p.repo) + '">' +
          '<span class="share-grip" aria-hidden="true">' + SVG.grip + "</span>" +
          '<span class="share-num">' + (i + 1) + "</span>" +
          '<span class="chip-icon">' + icon(p.icon) + "</span>" +
          '<span class="share-name">' + esc(p.name) + none(p) + "</span>" +
          '<button type="button" data-share-move="-1" data-repo="' + esc(p.repo) + '" aria-label="Move ' + esc(p.name) + ' up"' + (i ? "" : " disabled") + ">" + SVG.prev + "</button>" +
          '<button type="button" data-share-move="1" data-repo="' + esc(p.repo) + '" aria-label="Move ' + esc(p.name) + ' down"' + (i < picked.length - 1 ? "" : " disabled") + ">" + SVG.next + "</button>" +
          '<button type="button" data-share-remove="' + esc(p.repo) + '" aria-label="Take ' + esc(p.name) + ' off the showcase">' + SVG.close + "</button>" +
        "</li>";
      }).join("") + "</ol>" : '<p class="share-note">Nothing yet. Add projects from below.</p>') +
      (rest.length ? '<div class="share-sub"><span class="field-label">Not on it</span><span class="share-hint">Click to add at the end</span></div>' +
        '<ul class="share-picks" aria-label="Projects you can add">' + rest.map(function (p) {
          return '<li><button type="button" class="chip" data-share-add="' + esc(p.repo) + '">' +
            '<span class="chip-icon">' + icon(p.icon) + "</span>" + esc(p.name) + none(p) +
            '<span class="chip-plus">' + SVG.plus + "</span></button></li>";
        }).join("") + "</ul>" : "") +
      '<div class="share-link">' +
        '<input readonly aria-label="Showcase link" id="shareUrl" value="' + esc(shareLink()) + '">' +
        '<button type="button" class="btn small primary" data-share-act="copy">Copy link</button>' +
        '<a class="btn small" id="shareOpen" href="' + esc(shareLink()) + '" target="_blank" rel="noopener">Open</a>' +
        (share.repos ? '<button type="button" class="btn small ghost" data-share-act="reset">Back to everything with an overview</button>' : "") +
      "</div>" +
      '<div class="share-sub"><span class="field-label">Tracked links</span>' +
        '<span class="share-hint">Each opens on the welcome screen, and its button records a visit</span></div>' +
      '<div class="share-track">' +
        '<label>Who it\'s for <span class="share-hint">only you see this</span>' +
          '<input data-track="label" maxlength="60" placeholder="e.g. Acme, Sam (recruiter)"></label>' +
        '<label>Greeting name <span class="share-hint">blank for a general welcome</span>' +
          '<input data-track="name" maxlength="40" placeholder="e.g. Sam"></label>' +
        '<label>Title <span class="share-hint">for this link</span>' +
          '<input data-track="title" maxlength="80" placeholder="Projects" value="' + esc(share.title) + '"></label>' +
        '<label>Intro <span class="share-hint">for this link</span>' +
          '<input data-track="intro" maxlength="280" placeholder="A line for whoever you send it to" value="' + esc(share.intro) + '"></label>' +
        '<button type="button" class="btn small primary" data-share-act="track">Make tracked link</button>' +
      "</div>" +
      '<div id="shareTracked"></div>';
    renderTracked();
    document.getElementById("shareNote").textContent = picked.length + (picked.length === 1 ? " project" : " projects") + " on your showcase";
  }
  function saveShare() { save(KEY.share, share); }

  // Visits to tracked links: read from showcase_visits once you're signed in
  var visits = { status: "idle", by: {}, at: 0, msg: "" };
  function loadVisits(force) {
    if (!window.LaunchpadSync || LaunchpadSync.state.status !== "in") { visits.status = "signed-out"; renderTracked(); return; }
    if (visits.status === "loading" || (!force && visits.status === "ok" && Date.now() - visits.at < 60000)) return;
    visits.status = "loading";
    renderTracked();
    LaunchpadSync.visits().then(function (list) {
      var by = {};
      list.forEach(function (v) { var b = by[v.k] || (by[v.k] = { n: 0, last: 0 }); b.n++; if (v.at > b.last) b.last = v.at; });
      visits = { status: "ok", by: by, at: Date.now(), msg: "" };
      renderTracked();
    }, function (e) {
      var code = (e && e.code) || "";
      visits = { status: /permission/.test(code) ? "no-rule" : code === "signed-out" ? "signed-out" : "error", by: {}, at: 0, msg: (e && e.message) || "" };
      renderTracked();
    });
  }
  function visitRule() {
    var uid = (LaunchpadSync.state.user && LaunchpadSync.state.user.uid) || "YOUR-UID";
    return "match /showcase_visits/{visit} {\n" +
      "  allow create: if request.resource.data.keys().hasOnly(['k', 'at'])\n" +
      "    && request.resource.data.k is string && request.resource.data.k.size() <= 24\n" +
      "    && request.resource.data.at is timestamp\n" +
      "    && request.resource.data.at > request.time - duration.value(10, 'm')\n" +
      "    && request.resource.data.at < request.time + duration.value(10, 'm');\n" +
      "  allow read: if request.auth != null && request.auth.uid == \"" + uid + "\";\n" +
      "}";
  }
  function when(t) {
    if (!t) return "";
    var d = new Date(t), days = Math.floor((Date.now() - t) / 864e5);
    var day = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    var time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return days < 1 ? "today " + time : days < 2 ? "yesterday " + time : day;
  }
  function renderTracked() {
    var box = document.getElementById("shareTracked");
    if (!box) return;
    var rows = share.links.slice().sort(function (a, b) { return b.at - a.at; }).map(function (l) {
      var v = visits.by[l.id], seen;
      if (visits.status === "ok") seen = v ? "<b>" + v.n + (v.n === 1 ? " visit" : " visits") + "</b> · last " + when(v.last) : "Not opened yet";
      else seen = visits.status === "loading" ? "Checking…" : "";
      return '<li><div class="tl-main"><span class="tl-label">' + esc(l.label || "Untitled") + "</span>" +
        '<span class="tl-meta">' + (l.name ? "Greets " + esc(l.name) : "General welcome") +
          (l.title && l.title !== share.title ? " · “" + esc(l.title) + "”" : "") + " · made " + when(l.at) + "</span></div>" +
        '<span class="tl-seen">' + seen + "</span>" +
        '<button type="button" class="btn small" data-track-copy="' + esc(l.id) + '">Copy</button>' +
        '<a class="btn small ghost" href="' + esc(l.url) + '" target="_blank" rel="noopener">Open</a>' +
        '<button type="button" class="tl-del" data-track-del="' + esc(l.id) + '" aria-label="Forget the link for ' + esc(l.label) + '">' + SVG.close + "</button></li>";
    }).join("");
    var status = "";
    if (visits.status === "signed-out") status = "Sign in under Sync, above, to see visits.";
    else if (visits.status === "no-rule") status = "One step to see visits: in the Firebase console (project github-projects-5d4e4) open " +
      "Firestore → Rules, paste this next to the launchpad rule, and Publish.";
    else if (visits.status === "error") status = "Couldn't load visits: " + esc(visits.msg);
    box.innerHTML = (rows ? '<ul class="share-tracked">' + rows + "</ul>" : "") +
      (status ? '<p class="share-note">' + status + "</p>" : "") +
      (visits.status === "no-rule" ? '<pre class="share-rule">' + esc(visitRule()) + "</pre>" +
        '<div class="share-link"><button type="button" class="btn small" data-share-act="copyrule">Copy rule</button>' +
        '<button type="button" class="btn small ghost" data-share-act="refresh">I\'ve added it</button></div>' : "") +
      (rows && visits.status === "ok" ? '<button type="button" class="btn small ghost" data-share-act="refresh">Refresh visits</button>' : "");
  }
  function newCode() {
    var a = new Uint8Array(6);
    (window.crypto || window.msCrypto).getRandomValues(a);
    return Array.prototype.map.call(a, function (b) { return (b % 36).toString(36); }).join("");
  }
  function copyText(text, btn, label) {
    var done = function () { btn.textContent = "Copied"; setTimeout(function () { btn.textContent = label; }, 1600); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () {});
  }
  function shareChanged(focusSel) {
    saveShare();
    renderShare();
    var el = focusSel && shareBody.querySelector(focusSel);
    if (el && !el.disabled) el.focus();
  }
  function moveShare(repo, to) {
    ownShare();
    var from = share.repos.indexOf(repo);
    if (from < 0) return;
    share.repos.splice(from, 1);
    share.repos.splice(Math.max(0, Math.min(share.repos.length, to)), 0, repo);
  }
  shareBody.addEventListener("click", function (e) {
    var t;
    if ((t = e.target.closest("[data-share-view]"))) { share.view = t.dataset.shareView; shareChanged('[data-share-view="' + share.view + '"]'); return; }
    if ((t = e.target.closest("[data-share-welcome]"))) { share.welcome = t.dataset.shareWelcome === "1"; shareChanged('[data-share-welcome="' + t.dataset.shareWelcome + '"]'); return; }
    if ((t = e.target.closest("[data-share-move]"))) {
      var r = t.dataset.repo, dir = +t.dataset.shareMove;
      moveShare(r, pickedRepos().indexOf(r) + dir);
      shareChanged('[data-repo="' + r + '"][data-share-move="' + dir + '"]');
      return;
    }
    if ((t = e.target.closest("[data-share-remove]"))) {
      ownShare();
      share.repos = share.repos.filter(function (x) { return x !== t.dataset.shareRemove; });
      shareChanged("[data-share-remove]");
      return;
    }
    if ((t = e.target.closest("[data-share-add]"))) {
      ownShare();
      share.repos.push(t.dataset.shareAdd);
      shareChanged("[data-share-add]");
      return;
    }
    if ((t = e.target.closest("[data-track-copy]"))) {
      var link = share.links.filter(function (l) { return l.id === t.dataset.trackCopy; })[0];
      if (link) copyText(link.url, t, "Copy");
      return;
    }
    if ((t = e.target.closest("[data-track-del]"))) {
      var gone = share.links.filter(function (l) { return l.id === t.dataset.trackDel; })[0];
      if (gone && confirm("Forget the link for " + (gone.label || "this person") + "? It keeps working for them, but its visits won't be listed here.")) {
        share.links = share.links.filter(function (l) { return l !== gone; });
        saveShare();
        renderTracked();
      }
      return;
    }
    var act = e.target.closest("[data-share-act]");
    if (!act) return;
    if (act.dataset.shareAct === "track") {
      var f = function (k) { return shareBody.querySelector('[data-track="' + k + '"]'); };
      var lab = f("label"), nm = f("name");
      if (!lab.value.trim()) { lab.focus(); lab.placeholder = "Name it first, e.g. Acme, Sam"; return; }
      var id = newCode(), name = nm.value.trim().slice(0, 40);
      var own = { title: f("title").value.trim().slice(0, 80), intro: f("intro").value.trim().slice(0, 280) };
      share.links.push({ id: id, label: lab.value.trim().slice(0, 60), name: name, title: own.title, at: Date.now(),
        url: shareLink(own) + (share.welcome ? "" : "&w=1") + "&k=" + id + (name ? "&n=" + encodeURIComponent(name) : "") });
      saveShare();
      lab.value = ""; nm.value = ""; f("title").value = share.title; f("intro").value = share.intro;
      renderTracked();
      var first = shareBody.querySelector('[data-track-copy="' + id + '"]');
      if (first) { first.focus(); copyText(share.links[share.links.length - 1].url, first, "Copy"); }
      return;
    }
    if (act.dataset.shareAct === "refresh") { loadVisits(true); return; }
    if (act.dataset.shareAct === "copyrule") { copyText(visitRule(), act, "Copy rule"); return; }
    if (act.dataset.shareAct === "reset") { share.repos = null; shareChanged(); return; }
    if (act.dataset.shareAct === "copy") {
      var url = shareLink(), done = function () { act.textContent = "Copied"; setTimeout(function () { act.textContent = "Copy link"; }, 1600); };
      var field = document.getElementById("shareUrl");
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, function () { field.select(); });
      else { field.select(); try { document.execCommand("copy"); done(); } catch (err) {} }
    }
  });
  shareBody.addEventListener("input", function (e) {
    var f = e.target.closest("[data-share-field]");
    if (!f) return;
    share[f.dataset.shareField] = f.value;
    saveShare();
    // Typing only refreshes the link, so the field keeps its focus
    document.getElementById("shareUrl").value = shareLink();
    document.getElementById("shareOpen").setAttribute("href", shareLink());
  });
  // Dragging a row: drop on another to land before it (top half) or after it (bottom half)
  var shareDrag = null;
  function dropSpot(e) {
    var li = e.target.closest("[data-order]");
    if (!li || li.dataset.order === shareDrag) return null;
    var b = li.getBoundingClientRect();
    return { li: li, after: e.clientY > b.top + b.height / 2 };
  }
  function clearDropMarks() { shareBody.querySelectorAll(".drop-before, .drop-after, .dragging").forEach(function (el) { el.classList.remove("drop-before", "drop-after", "dragging"); }); }
  shareBody.addEventListener("dragstart", function (e) {
    var li = e.target.closest("[data-order]");
    if (!li) return;
    shareDrag = li.dataset.order;
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", shareDrag); } catch (err) {}
    li.classList.add("dragging");
  });
  shareBody.addEventListener("dragover", function (e) {
    if (!shareDrag) return;
    var spot = dropSpot(e);
    shareBody.querySelectorAll(".drop-before, .drop-after").forEach(function (el) { el.classList.remove("drop-before", "drop-after"); });
    if (!spot) return;
    e.preventDefault();
    spot.li.classList.add(spot.after ? "drop-after" : "drop-before");
  });
  shareBody.addEventListener("drop", function (e) {
    if (!shareDrag) return;
    var spot = dropSpot(e);
    if (spot) {
      e.preventDefault();
      var list = pickedRepos().filter(function (r) { return r !== shareDrag; });
      var at = list.indexOf(spot.li.dataset.order) + (spot.after ? 1 : 0);
      ownShare();
      share.repos = list.slice(0, at).concat([shareDrag], list.slice(at));
      shareChanged();
    }
    shareDrag = null;
    clearDropMarks();
  });
  shareBody.addEventListener("dragend", function () { shareDrag = null; clearDropMarks(); });

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
    return { hidden: hiddenIds(), look: look, skin: currentSkin(), layouts: layouts, share: share };
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
    if (Array.isArray(p.hidden)) save(KEY.hidden, p.hidden);
    if (p.look) { look = normalizeLook(p.look); save(KEY.look, look); }
    if (p.share) { share = normalizeShare(p.share); save(KEY.share, share); }
    if (p.skin && DEFAULT_LOOK[p.skin]) { root.dataset.skin = p.skin; save(KEY.skin, p.skin); }
    if (p.layouts || p.layout || p.order) {
      layouts = layoutsFrom(p.layouts, p.layout, p.order);
      save(KEY.layouts, layouts);
      if (editing && !findLayout(editId)) editId = deviceLayout().id;
      pickLayout();
      picked = null;
    }
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
  checkOverviews();
  LaunchpadSync.init({
    change: function () {
      renderAccount(); renderFoot();
      if (document.getElementById("sharePanel").open && LaunchpadSync.state.status !== "loading") loadVisits(true);
    },
    getLocal: recentOpens,
    setLocal: function (opens) { save(KEY.opens, opens); renderStats(); },
    getPrefs: function () { return { prefs: prefsSnapshot(), at: load(KEY.prefsAt, 0) || 0 }; },
    setPrefs: applyRemotePrefs
  });
})();
