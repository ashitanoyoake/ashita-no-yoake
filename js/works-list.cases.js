const {
  parseWorksCategoriesDocument,
  collectUsedWorkCategoryNames,
  resolveVisibleWorksCategories,
  readWorksListCategoryFilter,
  resolveActiveWorksListFilter,
  buildWorksListUrl,
  worksCategoryNavLabels,
  shouldShowWorksCategoryNav,
  filterWorksForCategory,
  ALL_WORKS_FILTER,
} = require("./works-categories.js");

function assert(condition, name) {
  if (!condition) {
    throw new Error(`FAIL ${name}`);
  }

  console.log(`PASS ${name}`);
}

function cardShowsCategoryBadge(category) {
  return Boolean(category);
}

function runAshitaWorksListCases() {
  const canonical = parseWorksCategoriesDocument({
    schemaVersion: 1,
    categories: [
      { id: 1, name: "個人サイト" },
      { id: 2, name: "未使用" },
    ],
  });
  const works = [
    { title: "a", category: "個人サイト" },
    { title: "b", category: "旧カテゴリー" },
    { title: "c", category: "旧先見" },
    { title: "d", category: "" },
  ];
  const used = collectUsedWorkCategoryNames(works);
  const visible = resolveVisibleWorksCategories(canonical, used);
  const labels = worksCategoryNavLabels(visible);

  assert(visible.join("/") === "個人サイト/旧カテゴリー/旧先見", "A buttons follow canonical then unknown");
  assert(labels[0] === "すべて", "B すべて is first");

  const productionCanonical = parseWorksCategoriesDocument({
    schemaVersion: 1,
    categories: [{ id: 1, name: "個人サイト" }],
  });
  const productionWorks = [{ title: "site", category: "個人サイト" }];
  const productionVisible = resolveVisibleWorksCategories(
    productionCanonical,
    collectUsedWorkCategoryNames(productionWorks),
  );
  assert(
    worksCategoryNavLabels(productionVisible).join("/") === "すべて/個人サイト",
    "C current production buttons are すべて / 個人サイト",
  );

  assert(visible.includes("未使用") === false, "D unused canonical category is hidden");
  assert(visible[visible.length - 1] === "旧先見", "E unknown is last");
  assert(
    resolveVisibleWorksCategories(canonical, ["旧B", "旧A", "個人サイト"]).join("/") === "個人サイト/旧B/旧A",
    "F unknown keeps first-seen order",
  );

  assert(labels.includes("未分類") === false && labels.includes("カテゴリーなし") === false, "G no empty-category button");
  assert(filterWorksForCategory(works, ALL_WORKS_FILTER).some((work) => work.title === "d"), "H uncategorized work stays in すべて");

  assert(resolveActiveWorksListFilter(visible, readWorksListCategoryFilter("")) === "all", "I missing query is すべて");
  assert(
    resolveActiveWorksListFilter(visible, readWorksListCategoryFilter("?category=" + encodeURIComponent("個人サイト"))) ===
      "個人サイト",
    "J valid query selects the category",
  );

  const invalidFilter = resolveActiveWorksListFilter(
    visible,
    readWorksListCategoryFilter("?category=" + encodeURIComponent("存在しない")),
  );
  assert(invalidFilter === "all", "K unused/invalid query falls back to すべて");
  assert(buildWorksListUrl("/works.html", invalidFilter) === "/works.html", "L invalid query is stripped from the URL");

  assert(filterWorksForCategory(works, "個人サイト").every((work) => work.category === "個人サイト"), "M button filter shows the selected category");
  assert(
    decodeURIComponent(buildWorksListUrl("/works.html", "個人サイト")) === "/works.html?category=個人サイト",
    "N button selection updates the URL",
  );
  assert(buildWorksListUrl("/works.html", "all") === "/works.html", "O すべて removes the category query");

  assert(
    resolveActiveWorksListFilter(visible, readWorksListCategoryFilter("?category=" + encodeURIComponent("個人サイト"))) ===
      "個人サイト",
    "P popstate can restore a filter from the URL",
  );
  assert(
    resolveActiveWorksListFilter(visible, readWorksListCategoryFilter("")) === "all",
    "P popstate without query returns すべて",
  );

  const emptyVisible = resolveVisibleWorksCategories(
    parseWorksCategoriesDocument({ schemaVersion: 1, categories: [] }),
    [],
  );
  assert(shouldShowWorksCategoryNav(emptyVisible) === false, "Q empty categories hide the nav");

  const fallback = resolveVisibleWorksCategories(null, ["旧カテゴリー", "個人サイト"]);
  assert(fallback.join("/") === "旧カテゴリー/個人サイト", "R missing canonical falls back to first-seen");

  assert(cardShowsCategoryBadge("") === false, "S empty category keeps no badge");
  assert(cardShowsCategoryBadge("個人サイト") === true, "S named category still shows a badge");

  console.log("ashita works list cases: all passed");
}

runAshitaWorksListCases();
