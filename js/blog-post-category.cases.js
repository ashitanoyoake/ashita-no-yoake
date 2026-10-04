const {
  DEFAULT_CATEGORY,
  getPostCategoryLabel,
  buildBlogListCategoryHref,
  readBlogListCategoryFilter,
  resolveActiveBlogListFilter,
} = require("./blog-post-category.js");

function assert(condition, name) {
  if (!condition) {
    throw new Error(`FAIL ${name}`);
  }

  console.log(`PASS ${name}`);
}

function runBlogPostCategoryCases() {
  assert(DEFAULT_CATEGORY === "未分類", "F default category is 未分類");
  assert(getPostCategoryLabel("お知らせ") === "お知らせ", "A category name comes from the article");
  assert(getPostCategoryLabel("映画") === "映画", "A movie category stays 映画");
  assert(getPostCategoryLabel("") === "未分類", "F empty category becomes 未分類");
  assert(getPostCategoryLabel("   ") === "未分類", "F blank category becomes 未分類");
  assert(getPostCategoryLabel(null) === "未分類", "F missing category becomes 未分類");

  assert(
    buildBlogListCategoryHref("お知らせ") === "/blog.html?category=" + encodeURIComponent("お知らせ"),
    "E notice category uses a query parameter",
  );
  assert(
    buildBlogListCategoryHref("") === "/blog.html?category=" + encodeURIComponent("未分類"),
    "F empty category link uses 未分類",
  );
  assert(
    buildBlogListCategoryHref("映画").startsWith("/blog.html?"),
    "D category link stays on the blog list path",
  );

  assert(readBlogListCategoryFilter("?category=お知らせ") === "お知らせ", "E query filter reads お知らせ");
  assert(readBlogListCategoryFilter("category=映画") === "映画", "E query filter accepts a search string");
  assert(readBlogListCategoryFilter("?category=") === null, "E empty query does not force a filter");
  assert(readBlogListCategoryFilter("") === null, "E missing query stays unfiltered");

  const buttons = [
    { dataset: { filter: "all" }, classList: { add() {}, remove() {} } },
    { dataset: { filter: "お知らせ" }, classList: { add() {}, remove() {} } },
    { dataset: { filter: "未分類" }, classList: { add() {}, remove() {} } },
  ];
  assert(resolveActiveBlogListFilter(buttons, "お知らせ") === "お知らせ", "E known category is selected");
  assert(resolveActiveBlogListFilter(buttons, "未分類") === "未分類", "F 未分類 can be selected");
  assert(resolveActiveBlogListFilter(buttons, "存在しない") === "all", "L unknown query keeps すべて");
  assert(resolveActiveBlogListFilter(buttons, null) === "all", "L missing query keeps すべて");

  console.log("ashita blog post category cases: all passed");
}

runBlogPostCategoryCases();
