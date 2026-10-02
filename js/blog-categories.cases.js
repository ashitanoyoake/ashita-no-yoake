const {
  parseBlogCategoriesDocument,
  resolveVisibleBlogCategories,
  loadCanonicalCategoryNames,
} = require("./blog-categories.js");

function assert(condition, name) {
  if (!condition) {
    throw new Error(`FAIL ${name}`);
  }

  console.log(`PASS ${name}`);
}

const DEFAULT_CATEGORY = "未分類";

function getCategoryLabel(category) {
  const trimmed = typeof category === "string" ? category.trim() : "";
  return trimmed || DEFAULT_CATEGORY;
}

function namesFrom(document) {
  return parseBlogCategoriesDocument(document);
}

function filterPosts(posts, filter) {
  if (filter === "all") {
    return posts;
  }

  return posts.filter((post) => getCategoryLabel(post.category) === filter);
}

async function runAshitaBlogCategoryCases() {
  const parsed = namesFrom({
    schemaVersion: 1,
    categories: [
      { id: 1, name: "日々のこと" },
      { id: 3, name: "お仕事" },
      { id: 2, name: "イラスト" },
    ],
  });

  const used = ["日々のこと", "お仕事", "イラスト"].map(getCategoryLabel);
  assert(resolveVisibleBlogCategories(parsed, used).join("/") === "日々のこと/お仕事/イラスト", "A JSON order");
  assert(
    resolveVisibleBlogCategories(parsed, ["日々のこと", "イラスト"]).join("/") === "日々のこと/イラスト",
    "B unused お仕事 is hidden",
  );
  assert(
    resolveVisibleBlogCategories(parsed, ["旧カテゴリー", "イラスト", "日々のこと"]).join("/") ===
      "日々のこと/イラスト/旧カテゴリー",
    "C unknown category is appended",
  );
  assert(
    resolveVisibleBlogCategories(null, ["旧カテゴリー", "イラスト", "日々のこと"]).join("/") ===
      "旧カテゴリー/イラスト/日々のこと",
    "D 404 keeps first-seen fallback",
  );
  assert(parseBlogCategoriesDocument({ categories: [{ id: 1, name: "日々のこと" }] }) === null, "E missing schema falls back");
  assert(
    resolveVisibleBlogCategories(parseBlogCategoriesDocument("nope"), ["映画"]).join("/") === "映画",
    "E invalid JSON falls back",
  );

  const emptyUsed = ["", "  "].map(getCategoryLabel);
  assert(emptyUsed.every((name) => name === "未分類"), "J empty category stays 未分類");
  assert(
    resolveVisibleBlogCategories(parsed, ["日々のこと", "", "イラスト"].map(getCategoryLabel)).join("/") ===
      "日々のこと/イラスト/未分類",
    "J 未分類 is kept after canonical names and is not stored in JSON",
  );
  assert(
    resolveVisibleBlogCategories(null, ["", "映画"].map(getCategoryLabel)).join("/") === "未分類/映画",
    "J fallback still shows 未分類 in first-seen order",
  );

  const posts = [
    { title: "a", category: "日々のこと" },
    { title: "b", category: "" },
    { title: "c", category: "イラスト" },
  ];
  assert(filterPosts(posts, "未分類").map((post) => post.title).join("/") === "b", "G/J filter uses 未分類 label");
  assert(filterPosts(posts, "all").length === 3, "H すべて shows every post");

  const reordered = namesFrom({
    schemaVersion: 1,
    categories: [
      { id: 2, name: "イラスト" },
      { id: 1, name: "日々のこと" },
    ],
  });
  assert(
    resolveVisibleBlogCategories(reordered, ["日々のこと", "イラスト"]).join("/") === "イラスト/日々のこと",
    "K reordered JSON changes the public nav order",
  );

  const missing = await loadCanonicalCategoryNames(async (_url, init) => {
    assert(init.cache === "no-cache", "loader uses cache: no-cache");
    return { ok: false, status: 404, json: async () => ({}) };
  }, "https://ashitanoyoake.com/blog.html");
  assert(missing === null, "D ashita loader treats 404 as missing");

  console.log("ashita blog category cases: all passed");
}

runAshitaBlogCategoryCases().catch((error) => {
  console.error(error);
  process.exit(1);
});
