#!/usr/bin/env node
// Screenshots for a project overview. Drives headless Chrome over the DevTools
// protocol, so it can click through an app before capturing, emulate a phone,
// and crop to one element. Every shot starts with empty storage (a first visit).
//
//   node tools/shoot.mjs path/to/shots.json
//
// shots.json (images are written next to it, or into "out"):
//   {
//     "url": "https://jkw2lo.github.io/recipe_book/",
//     "shots": [
//       { "file": "desktop.png" },
//       { "file": "steps.png", "steps": ["click:.card[data-id=tonkatsu]", "click:#mode [data-m=eff]"],
//         "clip": "#view-eff", "pad": 16 },
//       { "file": "phone.png", "size": "phone" }
//     ]
//   }
//
// file:  the image to write; name it .jpg for a photo-like scene (much smaller than .png)
// size:  "desktop" (1440×900, the default), "phone" (390×844 at 2×, a touch phone), or [w, h]
// scale: pixel density, e.g. 2 for a sharp close-up crop
// steps: "click:<css>", "scroll:<css>", "wait:<ms>", "eval:<js>" (awaited), "reload",
//        "key:<key>[:<ms held>]", "tap:<x>,<y>" and "hover:<x>,<y>" (real key presses and
//        mouse events, for apps you have to walk or point around), run in order.
//        Load sample data with eval (e.g. into localStorage), then reload.
// region: [x, y, w, h] of the window to crop to, where there is no element to name
// clip:  a CSS selector to crop to. If it matches several elements,
//        the crop covers them all. pad adds room around it, maxHeight cuts it short
// url:   per shot, to override the top-level one

import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const SIZES = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false },
  phone: { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }
};

const cfgPath = process.argv[2];
if (!cfgPath) {
  console.error("usage: node tools/shoot.mjs path/to/shots.json");
  process.exit(1);
}
const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
const outDir = resolve(dirname(cfgPath), cfg.out || ".");
mkdirSync(outDir, { recursive: true });

const profile = mkdtempSync(join(tmpdir(), "shoot-"));
const chrome = spawn(CHROME, [
  "--headless=new", "--remote-debugging-port=0", "--user-data-dir=" + profile,
  "--hide-scrollbars", "--no-first-run", "--no-default-browser-check", "about:blank"
], { stdio: ["ignore", "ignore", "pipe"] });

function cleanup() {
  try { chrome.kill(); } catch (e) {}
  try { rmSync(profile, { recursive: true, force: true }); } catch (e) {}
}

const wsUrl = await new Promise((res, rej) => {
  let buf = "";
  chrome.stderr.on("data", (d) => {
    buf += d;
    const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
    if (m) res(m[1]);
  });
  chrome.on("exit", () => rej(new Error("Chrome exited before it was ready")));
  setTimeout(() => rej(new Error("Chrome didn't start in 15s")), 15000);
});

const ws = new WebSocket(wsUrl);
await new Promise((res) => ws.addEventListener("open", res, { once: true }));
let nextId = 0;
const pending = new Map();
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (!m.id || !pending.has(m.id)) return;
  const p = pending.get(m.id);
  pending.delete(m.id);
  m.error ? p.rej(new Error(m.error.message)) : p.res(m.result);
});
function send(method, params = {}, sessionId) {
  return new Promise((res, rej) => {
    const id = ++nextId;
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function evaluate(session, expression) {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, session);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}

// "w", "Escape", "ArrowUp"… as a DevTools key event
const KEYS = { Enter: 13, Escape: 27, " ": 32, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Shift: 16 };
function keyEvent(name) {
  if (name.length === 1 && /[a-z]/i.test(name)) return { key: name.toLowerCase(), code: "Key" + name.toUpperCase(), windowsVirtualKeyCode: name.toUpperCase().charCodeAt(0) };
  if (!(name in KEYS)) throw new Error("unknown key " + name);
  return { key: name, code: name === " " ? "Space" : name, windowsVirtualKeyCode: KEYS[name] };
}

async function settle(s, shot) {
  for (let i = 0; i < 150 && (await evaluate(s, "document.readyState").catch(() => "")) !== "complete"; i++) await sleep(100);
  await evaluate(s, "document.fonts.ready.then(() => true)");
  await sleep(shot.settle ?? 800);
}

async function shoot(shot) {
  const { browserContextId } = await send("Target.createBrowserContext");
  const { targetId } = await send("Target.createTarget", { url: "about:blank", browserContextId });
  const { sessionId: s } = await send("Target.attachToTarget", { targetId, flatten: true });
  try {
    const size = Array.isArray(shot.size)
      ? { width: shot.size[0], height: shot.size[1], deviceScaleFactor: 1, mobile: false }
      : SIZES[shot.size || "desktop"] && { ...SIZES[shot.size || "desktop"] };
    if (!size) throw new Error("unknown size " + shot.size);
    if (shot.scale) size.deviceScaleFactor = shot.scale;
    await send("Emulation.setDeviceMetricsOverride", size, s);
    if (size.mobile) {
      await send("Emulation.setUserAgentOverride", { userAgent: PHONE_UA }, s);
      await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 }, s);
    }
    await send("Page.navigate", { url: shot.url || cfg.url }, s);
    await settle(s, shot);

    for (const step of shot.steps || []) {
      const at = step.indexOf(":");
      const kind = step.slice(0, at), arg = step.slice(at + 1);
      const el = "document.querySelector(" + JSON.stringify(arg) + ")";
      const missing = "throw new Error(" + JSON.stringify("nothing matches " + arg) + ")";
      if (kind === "key") {          // key:w:1500 holds w for 1.5 s
        const [name, ms] = arg.split(":");
        const k = keyEvent(name);
        await send("Input.dispatchKeyEvent", { type: "keyDown", ...k }, s);
        await sleep(+ms || 60);
        await send("Input.dispatchKeyEvent", { type: "keyUp", ...k }, s);
        await sleep(shot.stepDelay ?? 400);
        continue;
      }
      if (kind === "hover") {        // hover:720,450 moves the mouse there (for tooltips)
        const [x, y] = arg.split(",").map(Number);
        await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y }, s);
        await sleep(shot.stepDelay ?? 400);
        continue;
      }
      if (kind === "tap") {          // tap:720,450 clicks at that point in the window
        const [x, y] = arg.split(",").map(Number);
        for (const type of ["mouseMoved", "mousePressed", "mouseReleased"])
          await send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 }, s);
        await sleep(shot.stepDelay ?? 400);
        continue;
      }
      if (step === "reload") { await send("Page.reload", {}, s); await sleep(300); await settle(s, shot); continue; }
      if (kind === "click") await evaluate(s, "{ const el = " + el + "; if (!el) " + missing + "; el.click(); }");
      else if (kind === "scroll") await evaluate(s, "{ const el = " + el + "; if (!el) " + missing + "; el.scrollIntoView({ block: 'center' }); }");
      else if (kind === "wait") await sleep(+arg);
      else if (kind === "eval") await evaluate(s, "(async () => { " + arg + " })()");
      else throw new Error("unknown step " + step);
      await sleep(shot.stepDelay ?? 400);
    }

    // Stop animations, so a fade that restarts when the page is resized for a crop
    // can't leave the picture half-faded.
    await evaluate(s, "{ const st = document.createElement('style'); st.textContent = '*, *::before, *::after { animation: none !important; transition: none !important; }'; document.head.appendChild(st); }");
    await sleep(100);
    // A .jpg file is saved as JPEG: far smaller for photos, textures and 3D scenes
    const jpeg = /\.jpe?g$/i.test(shot.file);
    const opts = { format: jpeg ? "jpeg" : "png", captureBeyondViewport: !!shot.clip };
    if (jpeg) opts.quality = shot.quality ?? 82;
    if (shot.clip) {
      const pad = shot.pad ?? 0;
      // Every element the selector matches, joined into one box (e.g. both pages of a spread)
      const r = await evaluate(s, "(() => { const els = [...document.querySelectorAll(" + JSON.stringify(shot.clip) + ")]" +
        ".filter((e) => e.getBoundingClientRect().width > 0);" +
        "if (!els.length) throw new Error(" + JSON.stringify("nothing visible matches " + shot.clip) + ");" +
        // Captured from the top of the page (the crop reaches below the window), so a sticky
        // header sits up at the top rather than over the crop.
        "scrollTo(0, 0);" +
        "const bs = els.map((e) => e.getBoundingClientRect());" +
        "const x = Math.min(...bs.map((b) => b.left)), y = Math.min(...bs.map((b) => b.top));" +
        "const w = Math.max(...bs.map((b) => b.right)) - x, h = Math.max(...bs.map((b) => b.bottom)) - y;" +
        "return { x: x + scrollX, y: y + scrollY, w, h: Math.min(h, " + (shot.maxHeight || 1200) + ") }; })()");
      opts.clip = { x: Math.max(0, r.x - pad), y: Math.max(0, r.y - pad), width: r.w + pad * 2, height: r.h + pad * 2, scale: 1 };
    } else if (shot.region) {
      // [x, y, w, h] of the window, for a canvas or a 3D scene with no element to crop to
      const [x, y, width, height] = shot.region;
      opts.clip = { x, y, width, height, scale: 1 };
    }
    const { data } = await send("Page.captureScreenshot", opts, s);
    writeFileSync(join(outDir, shot.file), Buffer.from(data, "base64"));
    console.log("wrote " + join(outDir, shot.file));
  } finally {
    await send("Target.disposeBrowserContext", { browserContextId }).catch(() => {});
  }
}

let failed = false;
try {
  for (const shot of cfg.shots || []) {
    try { await shoot(shot); } catch (e) { failed = true; console.error(shot.file + ": " + e.message); }
  }
} finally {
  ws.close();
  cleanup();
}
process.exit(failed ? 1 : 0);
