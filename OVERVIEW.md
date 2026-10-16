# Project overviews

Each project can have a one-page overview: an introduction for someone who has never seen it.
Everything around the key features is one line long, so a visitor gets the idea at a glance;
the key features carry the detail, with a screenshot for the ones that matter most. The launchpad adds an **About**
link to a project's tile when it finds one.

- **Words and pictures** live in the project's own repo, in `overview/`.
- **Layout** lives here, in `overview.html`. Every overview has the same sections in the same
  order. Changing the look means editing one file, not every repo.

```
<project repo>/
  overview/
    overview.json     the content (schema below)
    shots.json        how to take the screenshots (see Screenshots)
    desktop.png       screenshots, referenced from overview.json
    timing.png …
```

The page is `https://jkw2lo.github.io/jens_launchpad/overview.html?p=<repo>`. It reads
`https://jkw2lo.github.io/<repo>/overview/overview.json`, so `overview/` must be in whatever the
repo publishes to GitHub Pages. For a repo that deploys from `main` / root, that's automatic.
For one that builds into `docs/` or `dist/`, put `overview/` there, or have the build copy it.

The launchpad checks every project for the file each time it loads, so a new overview gets its
About link on the next visit (allow a few minutes for GitHub Pages to publish it).

## Making one (instructions for Claude)

When asked to "make the overview for <project>":

1. **Read the project.** README first, then the main source, then open the live site and use it
   for a few minutes. Get the facts from the code, not from guesses. If the README and the
   code disagree, the code wins.
2. **Find the problem.** What annoyed Jen enough to build this? The README's "why" section, if it
   has one, is the best source. Name that problem in one plain sentence.
3. **Find three real numbers.** Count them from the repo or the live app (recipes, words,
   characters, levels, templates). One of them should show something the project does
   better: a before and after, or something other tools don't do. Never invent a number. If
   three honest ones don't exist, use fewer.
4. **Pick the key features.** Three or four: what defines the project, not every feature. For
   each, one sentence on what it does and up to three details that make it concrete (what you
   can do with it, what it handles that others don't). Give the one or two most defining
   features a screenshot of that feature in use. Leave the rest for visitors to find in the app.
5. **Write `overview.json`** using the schema below, within its limits. Then cut it again:
   if a word can go without losing meaning, it goes.
6. **Take screenshots** (commands below) and check every one of them by looking at it.
7. **Preview** it (below), on desktop and phone width, in light and dark.
8. Commit `overview/` to the **project's** repo. Nothing in the launchpad changes.

### Voice

- Write for a visitor, not for Jen. "You", not "I". Present tense.
- Plain words. No hype ("revolutionary", "seamless", "powerful", "effortless"), no emoji,
  no exclamation marks.
- Short beats complete. Every line should be readable in one glance; no line needs a second
  sentence. Details are fragments, not sentences, and each one says something the feature's
  sentence doesn't.
- Concrete beats clever. "Each step lists the ingredients that go in at that point" beats
  "ingredients, reimagined".
- Every claim must be true of the shipped app today. No roadmap items.
- Sentence case for every title. Each feature title is 2–4 words.

## Schema

All fields are optional except `name`. A section with no content is left out. Stay under the
limits so the text fits the layout; anything far over them is cut off.

| field | limit | what it's for |
|---|---|---|
| `version` | `2` | schema version |
| `name` | 60 chars | the project's name, as on the tile |
| `tagline` | 40 chars | one line under the name; can match the tile's blurb |
| `pitch` | 120 chars | one sentence: what it is and what makes it different |
| `accent` | `#rrggbb` | the project's own main colour, taken from its UI. Used for buttons, highlights and the coloured band. Text colour on top of it is picked automatically. |
| `status` | 30 chars | `Live`, `In progress` or `Experiment` |
| `problem` | 70 chars | the problem it solves, as one sentence |
| `stats[]` | 3 items | `{ "value": "34", "label": "recipes, from 20+ sites" }`. `value` ≤ 8 chars so it fits big; `label` ≤ 45 chars |
| `features[]` | 3–4 | the key features, in order of importance. Each is `{ "title", "text", "details", "screen" }`: `title` ≤ 25 chars; `text` ≤ 80 chars, one sentence; `details` up to 3 strings of ≤ 70 chars; `screen` optional, one screenshot like those in `screens`. A feature with a `screen` gets a full-width row (sides alternate); the others sit side by side as cards |
| `screens[]` | 1–3 | `{ "src": "desktop.png", "alt": "...", "caption": "...", "frame": "browser", "phone" or "plain" }`. The first is the main picture; the rest go in a row below the key features. `src` is relative to `overview.json`. Feature screenshots default to `plain`, the others to `browser` |
| `facts.worksOn` | 30 chars | e.g. "Phone and desktop, offline too" |
| `facts.data` | 30 chars | where the user's data lives, e.g. "Saved in your browser" or "Synced when you sign in" |
| `facts.builtWith` | 30 chars | e.g. "One HTML file" or "Plain HTML, CSS and JS" |
| `facts.started` | 12 chars | month and year of the first commit (`git log --reverse`), e.g. "Sep 2026". Shown as "Since Sep 2026" |

The name, icon and type pill come from `js/projects.js` here, so they always match the tile.
The **Open** button goes to the project's Pages site, and **Source** to its GitHub repo.

### The sections, in order

1. **Top**: icon, type, status, name, tagline, pitch, Open and Source buttons, the `facts` as
   small chips, and the first screenshot
2. **Coloured band**: the `problem`, with the three `stats` beside it
3. **Key features**: rows for features with a screenshot, cards for the rest
4. More screenshots, if any
5. Open and All projects buttons

## Screenshots

`tools/shoot.mjs` takes them. It drives headless Chrome, so it can click through the app first,
act as a phone, and crop to one part of the page. Each shot starts from a first visit (empty
storage). Describe the shots in `overview/shots.json` and run:

```sh
node tools/shoot.mjs ../<repo>/overview/shots.json
```

```json
{
  "url": "https://jkw2lo.github.io/recipe_book/",
  "shots": [
    { "file": "desktop.png" },
    { "file": "steps.png", "size": [1100, 800], "scale": 2,
      "steps": ["click:.card[data-id=tonkatsu-justonecookbook]", "click:#mode [data-m=eff]"],
      "clip": "#view-eff", "pad": 12, "maxHeight": 450 }
  ]
}
```

- `size`: `"desktop"` (1440×900, the default), `"phone"` (390×844, a touch phone), or `[w, h]`
- `scale`: pixel density. Use 2 for feature close-ups so they stay sharp
- `steps`: run in order: `click:<css>`, `scroll:<css>`, `wait:<ms>`, `eval:<js>` (e.g. to hide a
  close button, or to load sample data into localStorage and reload)
- `clip`: a CSS selector to crop to; `pad` adds room around it, `maxHeight` cuts it short

Find selectors in the project's source. The main picture is the whole app at desktop size; feature
screenshots are crops of that one feature, with real-looking content, never an empty first-run
state. Look at every image before using it. Keep each under about 400 KB (`sips -Z 1600 x.png`
shrinks one on a Mac). Commit `shots.json` with the images so they can be retaken after the
app changes.

## Previewing a draft

Serve the folder that holds both repos and open the page with `p`:

```sh
cd ~/Projects          # with jens_launchpad/ and <repo>/ side by side
python3 -m http.server 8000
# http://localhost:8000/jens_launchpad/overview.html?p=<repo>
```

The folder has to be named after the repo, since `p` looks for `../<repo>/`. Otherwise point
straight at the file with `?src=`, e.g.
`overview.html?p=<repo>&src=http://localhost:8000/somewhere/overview/overview.json`
(keep `p` so the name, icon and links still match the project).

## Example

`recipe_book/overview/overview.json`:

```json
{
  "version": 3,
  "name": "Recipe Book",
  "tagline": "Recipes without the fluff",
  "pitch": "Recipes from any site, without the ads and life stories, and with cooking times that count the waiting.",
  "accent": "#b9532c",
  "status": "Live",
  "problem": "Recipe sites bury the recipe, then get the time wrong.",
  "stats": [
    {
      "value": "34",
      "label": "recipes, from 20+ sites"
    },
    {
      "value": "30 → 68",
      "label": "minutes for tonkatsu: claimed vs. real"
    },
    {
      "value": "3",
      "label": "times per recipe: hands-on, waiting, cooking"
    }
  ],
  "features": [
    {
      "title": "Honest timing",
      "text": "Every recipe splits its time into hands-on, waiting and cooking.",
      "details": [
        "A note flags when the source's total leaves time out",
        "Sort the book by real total time",
        "Waiting steps are marked, so you know when you're free"
      ],
      "screen": {
        "src": "timing.png",
        "alt": "Tonkatsu's time chips: 25 min hands-on, 23 min waiting, 20 min cooking, and a note that the source's 30 minutes is really 1 hr 8 min"
      }
    },
    {
      "title": "Ingredients at each step",
      "text": "Efficient view gives one short line per step, with its amounts right beside it.",
      "details": [
        "No scrolling back up to check how much flour",
        "Split into parts (sauce, breading, frying), in the order you make them",
        "Full view keeps the source's complete instructions"
      ],
      "screen": {
        "src": "steps.png",
        "alt": "Tonkatsu in Efficient view: numbered steps grouped by part, each with its ingredient amounts and a timer badge"
      }
    },
    {
      "title": "Fits your kitchen",
      "text": "Change the servings or pan size and every amount recalculates.",
      "details": [
        "Amounts shown as kitchen fractions, like 1/2 cup, not 0.5",
        "US or metric, one at a time"
      ]
    },
    {
      "title": "Step timers",
      "text": "Tap a step's time to start a countdown.",
      "details": [
        "Run several at once",
        "They survive a reload and chime when done",
        "Cook mode keeps the screen awake"
      ]
    }
  ],
  "screens": [
    {
      "src": "desktop.png",
      "alt": "Recipe Book's recipe list next to the What's cooking today? picker",
      "caption": "The book, with today's suggestions"
    }
  ],
  "facts": {
    "worksOn": "Phone and desktop, offline too",
    "data": "Saved in your browser",
    "builtWith": "One HTML file",
    "started": "Sep 2026"
  }
}
```
