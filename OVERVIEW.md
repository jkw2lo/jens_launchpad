# Project overviews

Each project can have a one-page overview: an introduction for someone who has never seen it,
short enough to take in at a glance (about 110 words in all). The launchpad adds an **About**
link to a project's tile when it finds one.

- **Words and pictures** live in the project's own repo, in `overview/`.
- **Layout** lives here, in `overview.html`. Every overview has the same sections in the same
  order. Changing the look means editing one file, not every repo.

```
<project repo>/
  overview/
    overview.json     the content (schema below)
    desktop.png       screenshots, referenced from overview.json
    phone.png
```

The page is `https://jkw2lo.github.io/jens_launchpad/overview.html?p=<repo>`. It reads
`https://jkw2lo.github.io/<repo>/overview/overview.json`, so `overview/` must be in whatever the
repo publishes to GitHub Pages. For a repo that deploys from `main` / root, that's automatic.
For one that builds into `docs/` or `dist/`, put `overview/` there, or have the build copy it.

The launchpad checks every project for the file at most every 6 hours, so a new overview
can take that long to get its About link. To see it sooner on your own browser, clear
`jens_launchpad:overviews` from localStorage.

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
4. **Pick four highlights.** The four things a visitor would care about most, not every
   feature. Leave the rest for them to find in the app.
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
  sentence.
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
| `features[]` | exactly 4 | `{ "title": ≤ 25 chars, "text": ≤ 60 chars }`. One short line each |
| `screens[]` | 1–3 | `{ "src": "desktop.png", "alt": "...", "caption": "...", "frame": "browser" or "phone" }`. The first is the main picture; the rest go in a row below the highlights. `src` is relative to `overview.json`. |
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
3. **Highlights**: the four `features`
4. More screenshots, if any
5. Open and All projects buttons

## Screenshots

Desktop, 1440×900, from the live site:

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars \
  --window-size=1440,900 --virtual-time-budget=4000 \
  --screenshot=overview/desktop.png https://jkw2lo.github.io/<repo>/
```

For a phone shot, or a screen you have to click through to get to (a recipe, a lesson, a
filled-in board), drive the app in a real browser at 390×844 and save the screenshot from
there. Headless Chrome's `--window-size` doesn't act as a phone, so phone layouts come out wrong.
Use `"frame": "phone"` for phone shots.

Show the app with real-looking content, never an empty first-run state. Keep each PNG under
about 400 KB (`sips -Z 1600 desktop.png` shrinks one on a Mac).

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
  "version": 2,
  "name": "Recipe Book",
  "tagline": "Recipes without the fluff",
  "pitch": "Recipes from any site, without the ads and life stories, and with cooking times that count the waiting.",
  "accent": "#b9532c",
  "status": "Live",

  "problem": "Recipe sites bury the recipe, then get the time wrong.",
  "stats": [
    { "value": "34", "label": "recipes, from 20+ sites" },
    { "value": "30 → 68", "label": "minutes for tonkatsu: claimed vs. real" },
    { "value": "3", "label": "times per recipe: hands-on, waiting, cooking" }
  ],

  "features": [
    { "title": "Honest timing", "text": "Hands-on, waiting and cooking time, listed separately." },
    { "title": "Ingredients at each step", "text": "No scrolling back up to check how much flour." },
    { "title": "Fits your kitchen", "text": "Any servings, any pan size, US or metric." },
    { "title": "Step timers", "text": "Tap a step's time to start one. Run several at once." }
  ],

  "screens": [
    { "src": "desktop.png", "alt": "Recipe Book's recipe list next to the What's cooking today? picker", "caption": "The book, with today's suggestions" }
  ],

  "facts": {
    "worksOn": "Phone and desktop, offline too",
    "data": "Saved in your browser",
    "builtWith": "One HTML file",
    "started": "Sep 2026"
  }
}
```
