(function () {
  "use strict";

  // Every project lives on the same origin (jkw2lo.github.io), so localStorage
  // is shared with them. Prefix every key to stay out of their way.
  var KEY = {
    order: "jens_launchpad:order",
    opens: "jens_launchpad:opens",
    skin: "jens_launchpad:skin"
  };
  var WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
  var SKINS = ["mist", "prism", "brutal", "bauhaus"];
  var THEME_COLORS = { mist: "#f3f4f6", prism: "#fbf7f0", brutal: "#e9e6ff", bauhaus: "#efe8d8" };

  var projects = window.PROJECTS || [];
  var byId = {};
  // tone = a colour slot (0–3) that stays with the project when it's reordered.
  projects.forEach(function (p, i) { byId[p.id] = p; p.tone = i % 4; });

  var grid = document.getElementById("grid");
  var summary = document.getElementById("summary");
  var arrangeBtn = document.getElementById("arrange");
  var arrangeBar = document.getElementById("arrangeBar");
  var root = document.documentElement;
  var arranging = false;

  // ---------- storage ----------
  function load(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      return v == null ? fallback : JSON.parse(v);
    } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  // ---------- order ----------
  function currentOrder() {
    var saved = load(KEY.order, []);
    if (!Array.isArray(saved)) saved = [];
    var ids = saved.filter(function (id) { return byId[id]; });
    projects.forEach(function (p) { if (ids.indexOf(p.id) < 0) ids.push(p.id); });
    return ids;
  }
  function saveOrderFromDom() {
    save(KEY.order, tiles().map(function (t) { return t.dataset.id; }));
  }
  function tiles() { return Array.prototype.slice.call(grid.children); }

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
    var all = recentOpens();
    (all[id] = all[id] || []).push(Date.now());
    save(KEY.opens, all);
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

  // ---------- render ----------
  function icon(name) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (window.ICONS[name] || window.ICONS.blocks) + "</svg>";
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function render() {
    grid.innerHTML = currentOrder().map(function (id) {
      var p = byId[id];
      return (
        '<li class="tile" data-id="' + esc(p.id) + '" data-tone="' + p.tone + '" data-shape="' + esc(p.shape || "circle") + '"' +
        ' style="--c1:' + esc(p.c1 || "#4f6bff") + ";--c2:" + esc(p.c2 || "#ff5fa2") + '">' +
          '<a class="tile-link" href="' + esc(p.url) + '" draggable="false">' +
            '<span class="deco" aria-hidden="true"><i class="d1"></i><i class="d2"></i></span>' +
            '<span class="icon">' + icon(p.icon) + "</span>" +
            '<span class="text"><span class="name">' + esc(p.name) + "</span>" +
            '<span class="blurb">' + esc(p.blurb || "") + "</span></span>" +
            '<span class="stat"></span>' +
          "</a>" +
          '<span class="move">' +
            '<button type="button" data-move="-1" aria-label="Move ' + esc(p.name) + ' earlier">' +
              '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>' +
            '<button type="button" data-move="1" aria-label="Move ' + esc(p.name) + ' later">' +
              '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>' +
          "</span>" +
        "</li>"
      );
    }).join("");
    renderStats();
  }

  function renderStats() {
    var all = recentOpens();
    var total = 0, top = null, topN = 0;
    tiles().forEach(function (t) {
      var list = all[t.dataset.id] || [];
      var n = list.length;
      total += n;
      if (n > topN) { topN = n; top = byId[t.dataset.id]; }
      var stat = t.querySelector(".stat");
      stat.innerHTML = n
        ? '<b>' + n + "</b> " + (n === 1 ? "open" : "opens") + '<span class="sep"> · </span><span class="last">' + ago(list[list.length - 1]) + "</span>"
        : '<span class="none">Not opened this month</span>';
      t.classList.toggle("is-cold", !n);
    });
    summary.textContent = total
      ? total + (total === 1 ? " launch" : " launches") + " in the last 30 days · most used: " + top.name
      : projects.length + " projects. Tap one to open it.";
  }

  // ---------- skins ----------
  var skinButtons = Array.prototype.slice.call(document.querySelectorAll("#skins [data-skin]"));
  function setSkin(skin, persist) {
    if (SKINS.indexOf(skin) < 0) skin = "mist";
    root.dataset.skin = skin;
    skinButtons.forEach(function (b) {
      var on = b.dataset.skin === skin;
      b.setAttribute("aria-checked", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
    });
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = THEME_COLORS[skin];
    if (persist) save(KEY.skin, skin);
  }
  skinButtons.forEach(function (b, i) {
    b.addEventListener("click", function () { setSkin(b.dataset.skin, true); });
    b.addEventListener("keydown", function (e) {
      var d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      var next = skinButtons[(i + d + skinButtons.length) % skinButtons.length];
      setSkin(next.dataset.skin, true);
      next.focus();
    });
  });

  // ---------- launching ----------
  grid.addEventListener("click", function (e) {
    var moveBtn = e.target.closest("[data-move]");
    if (moveBtn) {
      moveBy(moveBtn.closest(".tile"), +moveBtn.dataset.move, moveBtn);
      return;
    }
    var link = e.target.closest(".tile-link");
    if (!link) return;
    if (arranging) { e.preventDefault(); return; }
    recordOpen(link.parentNode.dataset.id);
  });
  // Middle-click / new-tab opens count too.
  grid.addEventListener("auxclick", function (e) {
    var link = e.target.closest(".tile-link");
    if (link && e.button === 1 && !arranging) { recordOpen(link.parentNode.dataset.id); renderStats(); }
  });
  // Coming back with the Back button restores the page from cache; refresh the numbers.
  window.addEventListener("pageshow", renderStats);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) renderStats(); });

  // ---------- arrange mode ----------
  function setArranging(on) {
    arranging = on;
    document.body.classList.toggle("arranging", on);
    arrangeBtn.setAttribute("aria-pressed", on ? "true" : "false");
    arrangeBtn.querySelector("span").textContent = on ? "Done" : "Arrange";
    arrangeBar.hidden = !on;
    tiles().forEach(function (t) { t.querySelector(".tile-link").tabIndex = on ? -1 : 0; });
  }
  arrangeBtn.addEventListener("click", function () { setArranging(!arranging); });
  document.getElementById("resetOrder").addEventListener("click", function () {
    save(KEY.order, []);
    flip(function () {
      var map = {};
      tiles().forEach(function (t) { map[t.dataset.id] = t; });
      projects.forEach(function (p) { grid.appendChild(map[p.id]); });
    });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && arranging && !drag) setArranging(false);
  });

  // Animate tiles from their old spot to their new one after a DOM change.
  function naturalPos(el) { return { x: el.offsetLeft, y: el.offsetTop }; }
  function flip(mutate, skip) {
    var before = new Map();
    tiles().forEach(function (t) { if (t !== skip) before.set(t, naturalPos(t)); });
    mutate();
    before.forEach(function (b, t) {
      var a = naturalPos(t);
      var dx = b.x - a.x, dy = b.y - a.y;
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

  // Pointer-based drag (works for mouse, pen and touch).
  var drag = null;

  grid.addEventListener("pointerdown", function (e) {
    if (!arranging || e.button !== 0 || e.target.closest(".move")) return;
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
  }
  window.addEventListener("pointermove", onMove, { passive: false });
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);

  // ---------- go ----------
  var urlSkin = null;
  try { urlSkin = new URLSearchParams(location.search).get("skin"); } catch (e) {}
  setSkin(urlSkin || load(KEY.skin, "mist"), false);
  render();
})();
