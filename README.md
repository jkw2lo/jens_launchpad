# Jen's Launchpad

One page with a big button for each of my projects. Live at
**https://jkw2lo.github.io/jens_launchpad/**

Plain HTML/CSS/JS with no build step, so it deploys straight to GitHub Pages.

## Features

- **Big buttons**: tap one to open that project.
- **Arrange**: tap *Arrange*, then drag tiles (or use the ‹ › arrows) into the
  order you want. *Reset order* goes back to the default.
- **Open counts**: each tile shows how many times you opened it in the last
  30 days and when you last did. The header shows the total and your most-used app.
- **Four skins**, all with the same layout:
  - **Mist**: minimal, white/grey, soft shadows
  - **Prism**: colourful geometric shapes and wire icons
  - **Brutal**: neo-brutalist blues and purples with pink accents
  - **Bauhaus**: red and blue on cream

Order, open counts and the chosen skin are saved in this browser's
localStorage, so each device keeps its own. Keys are prefixed `jens_launchpad:`
because every project on `jkw2lo.github.io` shares the same storage.

You can link to a skin directly: `?skin=brutal`.

## Adding a project

Add one line to `js/projects.js`:

```js
{ id: "newthing", name: "New Thing", blurb: "What it does", url: "https://jkw2lo.github.io/new_thing/", icon: "blocks", c1: "#3a86ff", c2: "#ffbe0b", shape: "circle" },
```

`icon` is one of the keys in `ICONS` in the same file. You can also add a new icon
there as a 24×24 SVG line drawing. New projects appear at the end of your
saved order.

## Files

```
index.html        page skeleton
js/projects.js    the project list + icons
js/app.js         rendering, reordering, open counts, skin switching
css/styles.css    layout + the four skins
```
