#!/usr/bin/env node
// Checks an overview.json against the limits in OVERVIEW.md, and that every
// screenshot it names exists next to it.
//
//   node tools/check-overview.mjs path/to/overview/overview.json

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const path = process.argv[2];
if (!path) {
  console.error("usage: node tools/check-overview.mjs path/to/overview.json");
  process.exit(1);
}
const d = JSON.parse(readFileSync(path, "utf8"));
const problems = [];
const len = (where, v, max) => {
  if (v == null) return;
  if (typeof v !== "string") problems.push(where + " should be text");
  else if (v.length > max) problems.push(where + " is " + v.length + " chars, over " + max + ': "' + v + '"');
};
const count = (where, v, min, max) => {
  if (v == null) return;
  if (!Array.isArray(v)) problems.push(where + " should be a list");
  else if (v.length < min || v.length > max) problems.push(where + " has " + v.length + ", wants " + (min === max ? min : min + "–" + max));
};
const screen = (where, s) => {
  if (!s) return;
  if (!s.src) problems.push(where + " has no src");
  else if (!/^https?:/.test(s.src) && !existsSync(join(dirname(path), s.src))) problems.push(where + ": " + s.src + " not found");
  if (!s.alt) problems.push(where + " has no alt text");
  if (s.frame && !["browser", "phone", "plain"].includes(s.frame)) problems.push(where + ".frame should be browser, phone or plain");
};

if (!d.name) problems.push("name is missing");
len("name", d.name, 60);
len("tagline", d.tagline, 40);
len("pitch", d.pitch, 120);
if (d.accent != null && !/^#[0-9a-f]{6}$/i.test(d.accent)) problems.push("accent should be #rrggbb");
len("status", d.status, 30);
len("problem", d.problem, 70);
count("stats", d.stats, 1, 3);
(d.stats || []).forEach((s, i) => { len("stats[" + i + "].value", s.value, 8); len("stats[" + i + "].label", s.label, 45); });
count("features", d.features, 3, 4);
(d.features || []).forEach((f, i) => {
  const w = "features[" + i + "]";
  if (!f.title) problems.push(w + " has no title");
  len(w + ".title", f.title, 25);
  len(w + ".text", f.text, 80);
  count(w + ".details", f.details, 0, 3);
  (f.details || []).forEach((t, j) => len(w + ".details[" + j + "]", t, 70));
  screen(w + ".screen", f.screen);
});
count("screens", d.screens, 1, 3);
(d.screens || []).forEach((s, i) => screen("screens[" + i + "]", s));
const facts = d.facts || {};
len("facts.worksOn", facts.worksOn, 30);
len("facts.data", facts.data, 30);
len("facts.builtWith", facts.builtWith, 30);
len("facts.started", facts.started, 12);

if (problems.length) {
  console.error(problems.map((p) => "✗ " + p).join("\n"));
  process.exit(1);
}
console.log("✓ " + path);
