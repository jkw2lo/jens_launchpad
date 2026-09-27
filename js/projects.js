// Whose GitHub Pages sites to look for. Any new repo with a Pages site shows up
// on the launchpad automatically, even if it isn't listed below.
window.GITHUB_USER = "jkw2lo";

// Project types. With colours set to "By type", each type gets one colour from the
// current style's palette (in this order); the palettes can be changed in Customize.
window.CATEGORIES = [
  { id: "languages", label: "Languages" },
  { id: "planning", label: "Planning" },
  { id: "home", label: "Home" },
  { id: "making", label: "Making" },
  { id: "more", label: "More" }
];

// The known projects. Listing a project here lets you give it a nicer name,
// blurb, icon and type than the automatic GitHub lookup can.
//   id     short unique key (remembers order, box and open counts; don't change it later)
//   repo   the GitHub repo name
//   name   button label
//   blurb  one short line under the name (keep it under ~25 characters)
//   icon   one of the keys in ICONS below
//   cat    one of the CATEGORIES ids (used when colours are set to "By type")
window.PROJECTS = [
  { id: "cantonese", repo: "learn_cantonese_quest", name: "Cantonese Quest", blurb: "Speak & read Cantonese", icon: "speech", cat: "languages" },
  { id: "hanzi", repo: "learn_chinese_hanzi_quest", name: "Hanzi Quest", blurb: "Read Chinese characters", icon: "grid", cat: "languages" },
  { id: "nihongo", repo: "learn_japanese_nihongo_quest", name: "Nihongo Quest", blurb: "Getting-by Japanese", icon: "torii", cat: "languages" },
  { id: "groundwork", repo: "groundwork_habits_tasks", name: "Groundwork", blurb: "Habits & focus timer", icon: "sprout", cat: "planning" },
  { id: "planner", repo: "planner", name: "Magnet Board", blurb: "Weekly planner", icon: "magnet", cat: "planning" },
  { id: "year", repo: "yearly_calendar", name: "Year Register", blurb: "Your year at a glance", icon: "calendar", cat: "planning" },
  { id: "trip", repo: "trip_planner", name: "Trip Board", blurb: "Plan trips day by day", icon: "pin", cat: "planning" },
  { id: "recipes", repo: "recipe_book", name: "Recipe Book", blurb: "Recipes without the fluff", icon: "pot", cat: "home" },
  { id: "shelf", repo: "skincare_shelf", name: "Shelf Life", blurb: "Skincare inventory", icon: "bottle", cat: "home" },
  { id: "writers", repo: "writers-blocks", name: "Writers Blocks", blurb: "Shape long-form writing", icon: "blocks", cat: "making" },
  { id: "awl", repo: "awl-gusset", name: "Awl & Gusset", blurb: "Leather bag patterns", icon: "bag", cat: "making" },
  { id: "notebook", repo: "notebook_portfolio", name: "Notebook Portfolio", blurb: "A digital junk journal", icon: "book", cat: "making" },
  { id: "garage", repo: "jens_side_projects", name: "Jen's Side Projects", blurb: "The garage portfolio", icon: "garage", cat: "more" }
];

// 24×24 line icons, drawn with the current text colour.
window.ICONS = {
  speech: '<path d="M4 5h16v11H10l-5 4v-4H4z"/><path d="M8 9.5h8M8 12.5h5"/>',
  grid: '<rect x="3.5" y="3.5" width="17" height="17" rx="1"/><path d="M12 3.5v17M3.5 12h17" stroke-dasharray="2 2"/><path d="M8 8.5h8M12 8.5v8M8.5 16.5c1-1 2.3-3 3.5-4.5 1.2 1.5 2.5 3.5 3.5 4.5"/>',
  torii: '<path d="M3 5.5c3 1.2 15 1.2 18 0"/><path d="M5 9.5h14"/><path d="M7 6.6V21M17 6.6V21M12 6.8v2.7"/>',
  sprout: '<path d="M12 21v-9"/><path d="M12 12c0-4-3-6.5-7-6.5 0 4 3 6.5 7 6.5z"/><path d="M12 10c0-3.5 2.5-5.5 6.5-5.5 0 3.5-2.5 5.5-6.5 5.5z"/><path d="M6 21h12"/>',
  magnet: '<path d="M6 4h4v8a2 2 0 0 0 4 0V4h4v8a6 6 0 0 1-12 0z"/><path d="M6 8h4M14 8h4"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="1.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="M7.5 13h2M11 13h2M14.5 13h2M7.5 16.5h2M11 16.5h2"/>',
  pin: '<path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.5"/>',
  pot: '<path d="M3 11h18"/><path d="M5 11v6a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-6"/><path d="M9 3.5c-.8 1 .8 2 0 3.5M12 3c-.8 1 .8 2 0 3.5M15 3.5c-.8 1 .8 2 0 3.5"/>',
  bottle: '<path d="M10 3.5h5M12.5 3.5V6"/><rect x="9.5" y="6" width="5" height="3" rx=".5"/><rect x="7" y="9" width="10" height="12" rx="1.5"/><path d="M7 14h10"/>',
  blocks: '<rect x="3.5" y="13" width="8" height="7"/><rect x="12.5" y="13" width="8" height="7"/><rect x="8" y="5" width="8" height="7"/>',
  bag: '<path d="M4.5 8.5h15L18 20.5H6z"/><path d="M9 8.5V6.5a3 3 0 0 1 6 0v2"/><path d="M7 12h10" stroke-dasharray="1 2"/>',
  book: '<path d="M12 6.5C10 5 7 4.5 3.5 4.5v14c3.5 0 6.5.5 8.5 2 2-1.5 5-2 8.5-2v-14c-3.5 0-6.5.5-8.5 2z"/><path d="M12 6.5v14"/>',
  garage: '<path d="M3 10l9-6 9 6v11H3z"/><path d="M6.5 21v-8h11v8"/><path d="M6.5 15.5h11M6.5 18.2h11"/>',
  spark: '<path d="M12 3v5M12 16v5M3 12h5M16 12h5"/><path d="M12 8l1.2 2.8L16 12l-2.8 1.2L12 16l-1.2-2.8L8 12l2.8-1.2z"/>'
};
