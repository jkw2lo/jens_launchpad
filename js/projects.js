// The launchpad's project list. To add a project, add one line here.
//   id     short unique key (used to remember order and open counts; don't change it later)
//   name   button label
//   blurb  one short line under the name
//   url    where the button goes
//   icon   one of the keys in ICONS below
//   c1/c2  two accent colours (used by the Prism skin)
//   shape  circle | square | triangle | half (used by the Prism skin)
window.PROJECTS = [
  { id: "cantonese", name: "Cantonese Quest", blurb: "Speak & read Cantonese", url: "https://jkw2lo.github.io/learn_cantonese_quest/", icon: "speech", c1: "#ff7a59", c2: "#ffd166", shape: "circle" },
  { id: "hanzi", name: "Hanzi Quest", blurb: "Read Chinese characters", url: "https://jkw2lo.github.io/learn_chinese_hanzi_quest/", icon: "grid", c1: "#ef476f", c2: "#ffb3c6", shape: "square" },
  { id: "nihongo", name: "Nihongo Quest", blurb: "Getting-by Japanese", url: "https://jkw2lo.github.io/learn_japanese_nihongo_quest/", icon: "torii", c1: "#f94144", c2: "#90e0ef", shape: "half" },
  { id: "groundwork", name: "Groundwork", blurb: "Habits & focus timer", url: "https://jkw2lo.github.io/groundwork_habits_tasks/", icon: "sprout", c1: "#06d6a0", c2: "#b8f2e6", shape: "triangle" },
  { id: "planner", name: "Magnet Board", blurb: "Weekly planner", url: "https://jkw2lo.github.io/planner/", icon: "magnet", c1: "#4361ee", c2: "#f72585", shape: "square" },
  { id: "year", name: "Year Register", blurb: "A year of plans on one page", url: "https://jkw2lo.github.io/yearly_calendar/", icon: "calendar", c1: "#7209b7", c2: "#ffd166", shape: "circle" },
  { id: "trip", name: "Trip Board", blurb: "Trips without the spreadsheet", url: "https://jkw2lo.github.io/trip_planner/", icon: "pin", c1: "#00b4d8", c2: "#ffb703", shape: "triangle" },
  { id: "recipes", name: "Recipe Book", blurb: "Recipes, minus the life story", url: "https://jkw2lo.github.io/recipe_book/", icon: "pot", c1: "#fb8500", c2: "#8ecae6", shape: "half" },
  { id: "shelf", name: "Shelf Life", blurb: "Skincare inventory", url: "https://jkw2lo.github.io/skincare_shelf/", icon: "bottle", c1: "#ff8fab", c2: "#a0c4ff", shape: "circle" },
  { id: "writers", name: "Writers Blocks", blurb: "Structure long-form writing", url: "https://jkw2lo.github.io/writers-blocks/", icon: "blocks", c1: "#3a86ff", c2: "#ffbe0b", shape: "square" },
  { id: "awl", name: "Awl & Gusset", blurb: "Leather bag pattern drafter", url: "https://jkw2lo.github.io/awl-gusset/", icon: "bag", c1: "#bc6c25", c2: "#dda15e", shape: "triangle" },
  { id: "notebook", name: "Notebook Portfolio", blurb: "A junk journal on facing pages", url: "https://jkw2lo.github.io/notebook_portfolio/", icon: "book", c1: "#8338ec", c2: "#ff006e", shape: "half" },
  { id: "garage", name: "Jen's Side Projects", blurb: "The garage portfolio", url: "https://jkw2lo.github.io/jens_side_projects/", icon: "garage", c1: "#2a9d8f", c2: "#e9c46a", shape: "square" }
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
  garage: '<path d="M3 10l9-6 9 6v11H3z"/><path d="M6.5 21v-8h11v8"/><path d="M6.5 15.5h11M6.5 18.2h11"/>'
};
