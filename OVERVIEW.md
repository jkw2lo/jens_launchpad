# Project overviews

Each project can have a one-page overview: an introduction for someone who has never seen it.
The launchpad adds an **About** link to a project's tile when it finds one.

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
   has one, is the best source. The headline should name that problem in plain words.
3. **Find three real numbers.** Count them from the repo or the live app (recipes, words,
   characters, levels, templates, tests). One of them should show something the project does
   better: a before and after, or something other tools don't do. Never invent a number. If
   three honest ones don't exist, use fewer.
4. **Write `overview.json`** using the schema below, within its limits.
5. **Take screenshots** (commands below) and check every one of them by looking at it.
6. **Preview** it (below), on desktop and phone width, in light and dark.
7. Commit `overview/` to the **project's** repo. Nothing in the launchpad changes.

### Voice

- Write for a visitor, not for Jen. "You", not "I". Present tense.
- Plain words. No hype ("revolutionary", "seamless", "powerful", "effortless"), no emoji,
  no exclamation marks.
- Concrete beats clever. "Each step lists the ingredients that go in at that point" beats
  "ingredients, reimagined".
- Every claim must be true of the shipped app today. No roadmap items.
- Sentence case for every title. Each feature title is 2–4 words.

## Schema

All fields are optional except `name`. A section with no content is left out. Stay under the
limits so the text fits the layout; anything far over them is cut off.

| field | limit | what it's for |
|---|---|---|
| `version` | `1` | schema version |
| `name` | 60 chars | the project's name, as on the tile |
| `tagline` | 40 chars | one line under the name; can match the tile's blurb |
| `pitch` | 200 chars | one or two sentences: what it is and what makes it different |
| `accent` | `#rrggbb` | the project's own main colour, taken from its UI. Used for buttons, highlights and the numbers panel. Text colour on top of it is picked automatically. |
| `status` | 30 chars | `Live`, `In progress` or `Experiment` |
| `problem.headline` | 100 chars | the problem, as one sentence |
| `problem.text` | 360 chars | the frustration in more detail, then one line on how this fixes it |
| `stats[]` | 3 items | `{ "value": "34", "label": "recipes in the book" }`. `value` ≤ 10 chars so it fits big; `label` ≤ 80 chars |
| `stepsHeadline` | 70 chars | heading over the steps. Defaults to "Three steps, start to finish" |
| `steps[]` | exactly 3 | `{ "title": ≤ 30 chars, "text": ≤ 140 chars }`: the path from opening the app to getting what you came for |
| `featuresHeadline` | 70 chars | heading over the highlights. Defaults to "What it does well" |
| `features[]` | 3 or 6 | `{ "title": ≤ 30 chars, "text": ≤ 130 chars }`. 3 or 6 fill the grid evenly |
| `screens[]` | 1–4 | `{ "src": "desktop.png", "alt": "...", "caption": "...", "frame": "browser" or "phone" }`. The first is the hero picture; the rest go in "A closer look". `src` is relative to `overview.json`. |
| `facts.worksOn` | 50 chars | e.g. "Phone and desktop, even offline" |
| `facts.data` | 50 chars | where the user's data lives, e.g. "Stays in your browser" or "Synced when you sign in" |
| `facts.builtWith` | 50 chars | e.g. "Plain HTML, CSS and JS" |
| `facts.started` | 30 chars | month and year of the first commit (`git log --reverse`) |
| `ctaHeadline` | 60 chars | the closing line. Defaults to "Try <name>" |
| `ctaText` | 100 chars | defaults to "Free, in your browser. Nothing to install." |

The name, icon and type pill come from `js/projects.js` here, so they always match the tile.
The **Open** button goes to the project's Pages site, and **Source** to its GitHub repo.

### The sections, in order

1. **Hero**: icon, type, status, name, tagline, pitch, Open and Source buttons, first screenshot
2. **Why it exists** (`problem`) beside **By the numbers** (`stats`)
3. **How it works**: the three `steps`
4. **Highlights**: the `features`
5. **A closer look**: screenshots 2–4, if any
6. **Quick facts**: the four `facts`
7. **Closing call to action**

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
  "version": 1,
  "name": "Recipe Book",
  "tagline": "Recipes without the fluff",
  "pitch": "Recipes from any site, cleaned up the same way: no ads or life stories, each ingredient shown at the step that uses it, and cooking times that count the waiting.",
  "accent": "#b9532c",
  "status": "Live",
  "problem": {
    "headline": "Recipe sites bury the recipe, then get the time wrong.",
    "text": "You scroll past a life story to find the ingredients, scroll back up mid-step to check how much flour, and find out an hour in that \"30 minutes\" left out the chilling. Recipe Book rewrites every recipe so none of that happens."
  },
  "stats": [
    { "value": "34", "label": "recipes in the book, from 20+ sites" },
    { "value": "3", "label": "times per recipe: hands-on, waiting and cooking" },
    { "value": "30 → 68", "label": "minutes for tonkatsu: what the source says vs. how long it really takes" }
  ],
  "stepsHeadline": "From \"what should I make?\" to dinner",
  "steps": [
    { "title": "Pick a recipe", "text": "Search by name, ingredient or cuisine, or let \"What's cooking today?\" suggest a few." },
    { "title": "Fit it to your kitchen", "text": "Change the servings or pan size and every amount recalculates. Switch between US and metric." },
    { "title": "Cook from the steps", "text": "Each step lists the ingredients that go in at that point. Tap its time to start a timer." }
  ],
  "featuresHeadline": "Built for cooking, not scrolling",
  "features": [
    { "title": "Honest timing", "text": "Hands-on, waiting and cooking time listed separately, with a note when the source's total comes up short." },
    { "title": "Two views", "text": "Full has the complete instructions. Efficient has one short line per step, for recipes you already know." },
    { "title": "Scaling and pan sizes", "text": "Quantities rescale as real fractions, for any number of servings and the pan you own." },
    { "title": "Step timers", "text": "Run several at once. They survive a reload and chime when they're done." },
    { "title": "Cook mode", "text": "Keeps the screen awake while your hands are covered in flour." },
    { "title": "Add any recipe with AI", "text": "Paste a link, copy the prompt into any AI tool, and paste the result back." }
  ],
  "screens": [
    { "src": "desktop.png", "alt": "Recipe Book's recipe list next to the What's cooking today? picker", "caption": "The book, with today's suggestions" }
  ],
  "facts": {
    "worksOn": "Phone and desktop, even offline",
    "data": "Stays in your browser; back it up to a file",
    "builtWith": "One HTML file, no framework",
    "started": "September 2026"
  },
  "ctaHeadline": "Cook something tonight",
  "ctaText": "Free, in your browser. Nothing to install."
}
```
