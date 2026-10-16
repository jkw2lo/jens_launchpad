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
// size:  "desktop" (1440×900, the default), "phone" (390×844 at 2×, a touch phone), or [w, h]
// scale: pixel density, e.g. 2 for a sharp close-up crop
// steps: "click:<css>", "scroll:<css>", "wait:<ms>", "eval:<js>" (awaited), run in order
// clip:  a CSS selector to crop to (scrolled into view first); pad adds room around it
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
    for (let i = 0; i < 150 && (await evaluate(s, "document.readyState").catch(() => "")) !== "complete"; i++) await sleep(100);
    await evaluate(s, "document.fonts.ready.then(() => true)");
    await sleep(shot.settle ?? 800);

    for (const step of shot.steps || []) {
      const at = step.indexOf(":");
      const kind = step.slice(0, at), arg = step.slice(at + 1);
      const el = "document.querySelector(" + JSON.stringify(arg) + ")";
      const missing = "throw new Error(" + JSON.stringify("nothing matches " + arg) + ")";
      if (kind === "click") await evaluate(s, "{ const el = " + el + "; if (!el) " + missing + "; el.click(); }");
      else if (kind === "scroll") await evaluate(s, "{ const el = " + el + "; if (!el) " + missing + "; el.scrollIntoView({ block: 'center' }); }");
      else if (kind === "wait") await sleep(+arg);
      else if (kind === "eval") await evaluate(s, "(async () => { " + arg + " })()");
      else throw new Error("unknown step " + step);
      await sleep(shot.stepDelay ?? 400);
    }

    const opts = { format: "png", captureBeyondViewport: !!shot.clip };
    if (shot.clip) {
      const pad = shot.pad ?? 0;
      const r = await evaluate(s, "(() => { const el = document.querySelector(" + JSON.stringify(shot.clip) + ");" +
        "if (!el) throw new Error(" + JSON.stringify("nothing matches " + shot.clip) + ");" +
        "el.scrollIntoView({ block: 'start' }); const b = el.getBoundingClientRect();" +
        "return { x: b.left + scrollX, y: b.top + scrollY, w: b.width, h: Math.min(b.height, " + (shot.maxHeight || 1200) + ") }; })()");
      opts.clip = { x: Math.max(0, r.x - pad), y: Math.max(0, r.y - pad), width: r.w + pad * 2, height: r.h + pad * 2, scale: 1 };
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
