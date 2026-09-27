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
  - **Layout**: *Auto* fills rows left to right. Drag tiles to reorder (on a
    phone, drag the ⠿ handle), or use the arrows. *Custom grid* is a board of
    columns × rows, like Groundwork's. Drag a tile onto any square, or tap a tile
    and then a square. Dropping onto a taken square swaps the two. Empty squares
    stay empty on the page. Projects not on the board wait in the tray underneath,
    and new projects take the first free square. On a phone the board edits as a
    grid of small icon squares, like a home screen.
  - **Multiple layouts**, like Groundwork's: the tabs at the top of Layout
    switch which layout you're editing, and **+ New layout** copies the one on
    screen. Each layout has its own name, mode, order and board. Layouts are
    shared by every device, but **each device picks which one it shows**
    (**Use on this device**, remembered by that browser), so a phone can show a
    compact "Phone" grid while the desktop shows "Main". Up to 8 layouts.
  - **The box**: ✕ puts a project back in the box, where nothing is lost.
    While customizing, the box is docked beside the grid on wide screens, pinned
    so it follows you down the page, or along the bottom on phones and tablets,
    next to Done. Drag a tile onto it to put it away. With Auto, tap a boxed
    project to bring it back to its old spot. With Custom grid, tap it and then
    tap the square it should go in.
  - **Look**: pick a style, then choose how projects are coloured. The
    choice applies to every style:
    - **By type**: one colour per project type (Languages, Planning, Home, Making, More), with a colour key under the title (you can hide it).
    - **Same**: every project uses the same colour.
    - **Different**: projects take turns through the palette.

    Each style has its own editable five-colour palette. Mist tints the icons,
    Prism colours its shapes, Brutal fills the tiles, and Bauhaus colours a small
    square composition. Prism and Bauhaus also have patterns A, B and C.
  - **Sync**: sign in to share launch counts and settings across all your devices (see below).

Order, box and look are saved in this browser's localStorage, and also in your
account when you're signed in. Keys are prefixed `jens_launchpad:` because every project on
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

## Sync (launch counts and settings across devices)

Sign in under Customize → Sync with Google or GitHub. This uses the shared Firebase
project **`github-projects-5d4e4`**, the same one as Groundwork (config in
`js/sync.js`). Each account has one document, `launchpad/{uid}`:

- **Launch counts** merge by union, so nothing is overwritten. Launches made while
  signed out are added the next time you sign in.
- **Settings** (layouts, the box, style, colours and patterns; not which layout a device uses) follow the most
  recent change. Change something on one device and the others update live.
  When a device signs in for the first time, it takes the account's settings,
  unless it was customised more recently than the account.

**One-time setup:** add this rule in the Firebase console → Firestore Database →
Rules, next to the existing `groundwork` rule, then Publish:

```
match /launchpad/{uid} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}
```

Because Groundwork is on the same site and uses the same project, signing in to
one signs in to the other on that device, and the same goes for signing out.

## Releasing

GitHub Pages lets browsers cache files for 10 minutes, so a new `index.html`
could otherwise load with an old cached script. Before committing changes to
`css/` or `js/`, run `./bump-version.sh`. It stamps a fresh `?v=` on every
CSS/JS link so the browser always gets a matching set. If the app ever fails to
start anyway, a small fallback in `index.html` still lists every project as a plain link.

## Files

```
index.html        page skeleton
js/projects.js    the project list + icons
js/app.js         rendering, reordering, the box, open counts, look
js/sync.js        optional sign-in + launch-count sync (Firebase)
css/styles.css    layout + the four skins
```
