const fs = require("fs");
const path = require("path");
const {
  ALL_CATEGORY_FILTER,
  ARCHIVE_PAGE_SIZE,
  parseClassifications,
  isClassifiedPost,
  selectClassifiedPosts,
  visibleCategories,
  selectPostsForCategory,
  resolveDirectPost,
  normalizePage,
  pageCount,
  clampPage,
  slicePage,
  shouldShowPagination,
  pageOfPost,
  paginationItems,
  parseArchiveSearch,
  buildArchiveSearch,
} = require("./instagram-classifications.js");

function assert(condition, name) {
  if (!condition) {
    throw new Error(`FAIL ${name}`);
  }

  console.log(`PASS ${name}`);
}

function makePosts(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `p${index + 1}`,
    permalink: `https://www.instagram.com/p/${index + 1}/`,
    media_url: `https://cdn.example/${index + 1}.jpg`,
    media_type: "IMAGE",
    timestamp: "2026-07-01T12:00:00+0000",
  }));
}

function runAshitaInstagramGalleryCases() {
  const repoRoot = path.join(__dirname, "..");
  const archive = JSON.parse(fs.readFileSync(path.join(repoRoot, "data", "instagram.json"), "utf8"));
  const existingPosts = archive.posts;
  const firstId = String(existingPosts[0].id);
  const secondId = String(existingPosts[1].id);
  const thirdId = String(existingPosts[2].id);

  const parsed = parseClassifications({
    schemaVersion: 1,
    categories: [
      { id: "c1", name: "日常" },
      { id: "c2", name: "風景" },
      { id: "c3", name: "未使用" },
      { id: "c9", name: "未分類" },
    ],
    assignments: {
      [firstId]: "c1",
      [secondId]: "missing-category",
      [thirdId]: "c2",
    },
  });

  assert(parsed !== null, "A valid classifications parse");
  const classified = selectClassifiedPosts(existingPosts, parsed);
  assert(classified.length === 2, "A only classified posts are public");
  assert(String(classified[0].id) === firstId && String(classified[1].id) === thirdId, "A classified keep archive order");
  assert(classified.every((post) => String(post.id) !== secondId), "B unclassified posts stay off the public list");
  assert(isClassifiedPost(existingPosts[1], parsed) === false, "B missing category id is unclassified");
  assert(isClassifiedPost({ id: firstId }, null) === false, "B missing canonical is unclassified");

  const nav = visibleCategories(parsed);
  assert(nav[0] && nav[0].id !== ALL_CATEGORY_FILTER, "C すべて is added by the page, not stored as a category");
  assert(nav.map((item) => item.id).join("/") === "c1/c2/c3", "E canonical category order is kept");
  assert(nav.every((item) => item.name !== "未分類"), "C 未分類 is not a public category");
  assert(nav.some((item) => item.id === "c3"), "F unused canonical categories still appear, matching otsumami");

  assert(selectPostsForCategory(classified, parsed, "all").length === 2, "D すべて is classified posts");
  assert(
    selectPostsForCategory(classified, parsed, "c1").map((post) => String(post.id)).join(",") === firstId,
    "D category filter keeps matching posts",
  );
  assert(selectPostsForCategory(classified, parsed, "c3").length === 0, "F unused category has 0 public posts");

  assert(ALL_CATEGORY_FILTER === "all", "C すべて internal id is all");
  const searchAll = parseArchiveSearch("", { validCategoryIds: nav.map((item) => item.id) });
  assert(searchAll.category === "all" && searchAll.page === 1 && searchAll.post === null, "G missing query is すべて page 1");
  const searchCategory = parseArchiveSearch("?category=c2", { validCategoryIds: ["c1", "c2"] });
  assert(searchCategory.category === "c2", "G ?category= selects the category id");
  const searchPage = parseArchiveSearch("?page=3", { validCategoryIds: ["c1"] });
  assert(searchPage.page === 3, "H ?page= is read");
  const searchPost = parseArchiveSearch("?post=abc", { validCategoryIds: ["c1"] });
  assert(searchPost.post === "abc", "I ?post= is read");
  assert(
    buildArchiveSearch({ category: "c2", page: 2, post: firstId }) === `?category=c2&page=2&post=${firstId}`,
    "J category page and post share one query",
  );
  assert(buildArchiveSearch({ category: "all", page: 1, post: null }) === "", "J すべて page 1 is omitted from the URL");
  assert(buildArchiveSearch({ category: "all", page: 2 }) === "?page=2", "H すべて page 2 keeps page only");

  const unknownCategory = parseArchiveSearch("?category=missing&page=nope", { validCategoryIds: ["c1"] });
  assert(unknownCategory.category === "all" && unknownCategory.page === 1, "M unknown category falls back to すべて");

  assert(ARCHIVE_PAGE_SIZE === 12, "K page size is 12");
  const thirteen = makePosts(13);
  assert(slicePage(thirteen, 1).length === 12, "K page 1 shows 12 posts");
  assert(slicePage(thirteen, 2).length === 1, "K page 2 shows the remainder");
  assert(shouldShowPagination(13) === true, "K 13 posts show pagination");
  assert(shouldShowPagination(12) === false, "K 12 posts hide pagination");
  assert(clampPage(99, 13) === 2, "L out-of-range page clamps to last page");
  assert(clampPage("abc", 13) === 1, "L invalid page clamps to 1");
  assert(pageOfPost(thirteen, "p13") === 2, "I post on page 2 resolves to page 2");

  const listed = slicePage(classified, 1);
  const classifiedDirect = resolveDirectPost(firstId, listed, existingPosts);
  assert(classifiedDirect.listedIndex === 0, "I classified ?post= opens from the list");
  const unclassifiedDirect = resolveDirectPost(secondId, listed, existingPosts);
  assert(unclassifiedDirect.listedIndex === -1, "B unclassified ?post= is not listed");
  assert(String(unclassifiedDirect.directPost && unclassifiedDirect.directPost.id) === secondId, "I unclassified ?post= can still open the modal");

  assert(parseClassifications(null) === null, "N missing canonical parses as null");
  assert(parseClassifications({ categories: [] }) === null, "O invalid canonical without assignments is null");
  assert(parseClassifications({ categories: [], assignments: [] }) === null, "O array assignments are invalid");
  assert(selectClassifiedPosts(existingPosts, null).length === 0, "N missing canonical publishes 0 posts");
  const emptyCanonical = parseClassifications({ categories: [], assignments: {} });
  assert(emptyCanonical !== null && emptyCanonical.categories.length === 0, "R empty canonical is valid");
  assert(selectClassifiedPosts(existingPosts, emptyCanonical).length === 0, "R empty canonical publishes 0 posts");
  assert(visibleCategories(emptyCanonical).length === 0, "C empty canonical has no extra category buttons");

  const pagination = paginationItems(7, 13);
  assert(pagination[0] === 1 && pagination.includes("ellipsis"), "H pagination uses ellipsis for long ranges");

  const galleryJs = fs.readFileSync(path.join(__dirname, "instagram-gallery.js"), "utf8");
  const instagramHtml = fs.readFileSync(path.join(repoRoot, "instagram.html"), "utf8");
  const illustrationHtml = fs.readFileSync(path.join(repoRoot, "illustration.html"), "utf8");
  const indexHtml = fs.readFileSync(path.join(repoRoot, "index.html"), "utf8");
  const styleCss = fs.readFileSync(path.join(repoRoot, "style.css"), "utf8");
  const blogHtml = fs.readFileSync(path.join(repoRoot, "blog.html"), "utf8");
  const worksHtml = fs.readFileSync(path.join(repoRoot, "works.html"), "utf8");
  const blogCategoriesJson = fs.readFileSync(path.join(repoRoot, "data", "blog-categories.json"), "utf8");

  assert(galleryJs.includes('DATA_URL'), "A gallery reads instagram.json");
  assert(galleryJs.includes("CLASSIFICATIONS_URL"), "A gallery reads instagram-classifications.json");
  assert(galleryJs.includes("data/instagram.json"), "A default archive path is ashita data/instagram.json");
  assert(galleryJs.includes("data/instagram-classifications.json"), "A default classifications path is ashita data/instagram-classifications.json");
  assert(!galleryJs.includes("otsumaminikki.com"), "A gallery does not read otsumami data");
  assert(!galleryJs.includes("instagram-media.otsumaminikki.com"), "R2/media proxy is not used");
  assert(galleryJs.includes("selectClassifiedPosts"), "A classified posts only");
  assert(galleryJs.includes("ARCHIVE_EMPTY_MESSAGE"), "R 0 public posts has its own message");
  assert(galleryJs.includes("EMPTY_MESSAGE"), "Q archive fetch failure has an error message");
  assert(galleryJs.includes("hideCategoryNav"), "N missing canonical does not crash the page");
  assert(galleryJs.includes("parseClassifications"), "O invalid canonical is parsed safely");
  assert(galleryJs.includes("appendLink(ALL_CATEGORY_FILTER, \"すべて\")"), "C すべて is always prepended");
  assert(galleryJs.includes("popstate"), "J browser back / forward");
  assert(galleryJs.includes("buildArchiveSearch"), "G H I query sync");
  assert(galleryJs.includes("closeModal"), "S modal close");
  assert(galleryJs.includes("post.permalink"), "T Instagram permalink");
  assert(galleryJs.includes("getPostSlides"), "carousel uses archive children when present");
  assert(galleryJs.includes("post.children"), "carousel does not invent children");
  assert(!galleryJs.includes("instagram-media"), "media proxy host is not introduced");

  assert(instagramHtml.includes("instagram-classifications.js"), "instagram.html loads classifications helper");
  assert(instagramHtml.includes("instagram-categories"), "instagram.html has category nav");
  assert(instagramHtml.includes("instagram-pagination"), "instagram.html has pagination");
  assert(instagramHtml.includes("<h1 class=\"page-title\">ギャラリー</h1>"), "F instagram.html h1 is ギャラリー");
  assert(instagramHtml.includes("aria-current=\"page\">ギャラリー</a>"), "E header nav on the gallery page is ギャラリー");
  assert(instagramHtml.includes("Instagramの投稿を見る") || instagramHtml.includes("Instagramで投稿を見る"), "T Instagram CTA");
  assert(!instagramHtml.includes(">イラスト<"), "L instagram.html no longer shows イラスト as the page name");
  assert(styleCss.includes("flex-wrap"), "U category / pagination can wrap");
  assert(styleCss.includes(".instagram-category-list"), "U category pills are styled");
  assert(
    illustrationHtml.includes('content="0; url=instagram.html"') && illustrationHtml.includes('window.location.replace("instagram.html")'),
    "V illustration.html redirect is kept",
  );
  assert(illustrationHtml.includes("ギャラリーページへ移動"), "H illustration.html fallback still names the gallery");
  assert(!fs.existsSync(path.join(repoRoot, "data", "instagram-classifications.json")), "canonical file is not created");
  assert(indexHtml.includes("instagram.html"), "G home still links to instagram.html");
  assert(indexHtml.includes("<h3 class=\"guide-card-title\">ギャラリー</h3>"), "E home guide card is ギャラリー");
  assert(indexHtml.includes("href=\"instagram.html\">ギャラリー</a>"), "E home nav is ギャラリー");
  assert(indexHtml.includes("映画・フィギュア・写真・イラスト・日常の記録"), "L JSON-LD content-type イラスト is unchanged");
  assert(blogCategoriesJson.includes('"name": "イラスト"'), "L blog category イラスト is unchanged");
  assert(blogHtml.includes("映画やイラスト、ガンプラ"), "L blog profile イラスト is unchanged");
  assert(worksHtml.includes("href=\"instagram.html\">ギャラリー</a>"), "E works nav is ギャラリー");
  assert(worksHtml.includes("aria-current=\"page\">制作紹介</a>"), "Works nav label stays 制作紹介");
  assert(!galleryJs.includes("static-site-cms-publish-worker"), "Worker media proxy is not wired");

  console.log("ashita instagram gallery cases: all passed");
}

runAshitaInstagramGalleryCases();
