# Jen's Launchpad

One page with a big button for each of my projects. Live at
**https://jkw2lo.github.io/jens_launchpad/**

Plain HTML/CSS/JS with no build step, so it deploys straight to GitHub Pages.

## Features

- **Big buttons**: tap one to open that project. On a phone they become a
  full-width list so most projects fit on one screen.
- **Open counts**: each tile shows how many times you opened it in the last
  30 days and when you last did.
- **Customize** (the sliders button) contains everything else:
  - **Reorder**: drag tiles (on a phone, drag the ⠿ handle) or use the arrows.
  - **The box**: ✕ puts a project back in the box, where nothing is lost.
    Tap it in the box to bring it back to the spot it came from.
  - **Look**: pick a style and change its colours.
    - **Mist**: minimal white/grey. Change the background, tile and accent colours.
    - **Prism**: colourful shapes. Pattern A/B/C, with each project's own colours or one colour pair for all.
    - **Brutal**: neo-brutalist. Tiles are coloured by project type (Languages, Planning, Home, Making, More).
    - **Bauhaus**: two colours on cream. Pattern A/B/C, alternating or same colours.

Everything is saved in this browser's localStorage, so each device keeps its
own setup. Keys are prefixed `jens_launchpad:` because every project on
`jkw2lo.github.io` shares the same storage. You can link to a style directly with `?skin=brutal`.

## New projects

**Any new repo with a GitHub Pages site shows up automatically.** The page
checks GitHub (at most every 6 hours) and adds a tile using the repo's name and
description.

To give a project a nicer name, blurb, icon or type, add it to
`js/projects.js`:

```js
{ id: "newthing", repo: "new_thing", name: "New Thing", blurb: "What it does", icon: "blocks", cat: "making", c1: "#3a86ff", c2: "#ffbe0b" },
```

`icon` is one of the keys in `ICONS` in the same file, and `cat` is one of the
`CATEGORIES`. Keep blurbs under about 25 characters so they fit on one line.

## Files

```
index.html        page skeleton
js/projects.js    the project list + icons
js/app.js         rendering, reordering, open counts, skin switching
css/styles.css    layout + the four skins
```
