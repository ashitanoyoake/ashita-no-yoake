/**
 * Instagram archive merge / normalize のローカル検証。
 * 本番 data/instagram.json は書き換えず、API へもアクセスしない。
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

function assert(condition, name) {
  if (!condition) {
    throw new Error(`FAIL ${name}`);
  }
  console.log(`PASS ${name}`);
}

async function runAshitaInstagramArchiveCases() {
  const {
    mergeArchives,
    normalizePost,
    postsAreEqual,
    sortPostsByTimestampDesc,
    writeArchiveIfChanged,
    readAfterCursor,
  } = await import("../scripts/fetch-instagram.mjs");

  const older = {
    id: "old1",
    media_url: "https://cdn.example/old.jpg",
    permalink: "https://www.instagram.com/p/old1/",
    media_type: "IMAGE",
    thumbnail_url: null,
    timestamp: "2026-01-01T00:00:00+0000",
  };
  const newer = {
    id: "new1",
    media_url: "https://cdn.example/new.jpg",
    permalink: "https://www.instagram.com/p/new1/",
    media_type: "IMAGE",
    thumbnail_url: null,
    timestamp: "2026-06-01T00:00:00+0000",
  };
  const updatedNewer = {
    ...newer,
    media_url: "https://cdn.example/new-refreshed.jpg",
  };

  const mergedAdd = mergeArchives([older], [newer]);
  assert(mergedAdd.posts.length === 2, "merge keeps existing and adds new");
  assert(
    mergedAdd.added === 1 && mergedAdd.updated === 0 && mergedAdd.kept === 1,
    "merge counts added/kept for new id",
  );
  assert(
    new Set(mergedAdd.posts.map((post) => String(post.id))).size === mergedAdd.posts.length,
    "merge has no duplicate ids",
  );
  assert(String(mergedAdd.posts[0].id) === "new1", "merge sorts newer timestamp first");
  assert(String(mergedAdd.posts[1].id) === "old1", "merge keeps older post after newer");
  assert(
    String(mergedAdd.posts.find((post) => post.id === "old1").media_url).includes("old.jpg"),
    "merge does not delete older post outside latest fetch",
  );

  const mergedUpdate = mergeArchives([older, newer], [updatedNewer]);
  assert(
    mergedUpdate.added === 0 && mergedUpdate.updated === 1 && mergedUpdate.kept === 1,
    "merge counts updated/kept for existing id",
  );
  assert(
    String(mergedUpdate.posts.find((post) => post.id === "new1").media_url).includes(
      "new-refreshed",
    ),
    "merge updates matching id from incoming",
  );
  assert(mergedUpdate.posts.length === 2, "update merge keeps both posts");

  const sorted = sortPostsByTimestampDesc([older, newer]);
  assert(
    String(sorted[0].id) === "new1" && String(sorted[1].id) === "old1",
    "timestamp sort is newest first",
  );

  const carouselRaw = {
    id: "car1",
    media_type: "CAROUSEL_ALBUM",
    media_url: "https://cdn.example/cover.jpg",
    permalink: "https://www.instagram.com/p/car1/",
    thumbnail_url: null,
    timestamp: "2026-07-01T00:00:00+0000",
    children: {
      data: [
        {
          media_type: "IMAGE",
          media_url: "https://cdn.example/c1.jpg",
          thumbnail_url: null,
        },
        {
          media_type: "VIDEO",
          media_url: "https://cdn.example/c2.mp4",
          thumbnail_url: "https://cdn.example/c2.jpg",
        },
      ],
    },
  };
  const carousel = normalizePost(carouselRaw);
  assert(carousel !== null, "carousel normalizes");
  assert(Array.isArray(carousel.children) && carousel.children.length === 2, "children are kept");
  assert(
    carousel.children[0].media_url === "https://cdn.example/c1.jpg",
    "first child media_url is kept",
  );
  assert(
    carousel.children[1].thumbnail_url === "https://cdn.example/c2.jpg",
    "video child thumbnail is kept",
  );

  const plain = normalizePost({
    id: "plain1",
    media_type: "IMAGE",
    media_url: "https://cdn.example/plain.jpg",
    permalink: "https://www.instagram.com/p/plain1/",
    thumbnail_url: null,
    timestamp: "2026-07-02T00:00:00+0000",
  });
  assert(plain !== null && plain.children === undefined, "plain posts omit empty children");

  const withChildren = mergeArchives([], [carousel]);
  assert(
    Array.isArray(withChildren.posts[0].children) && withChildren.posts[0].children.length === 2,
    "merge preserves children",
  );

  assert(
    postsAreEqual([older, newer], [older, newer]) === true,
    "equal posts compare equal",
  );
  assert(
    postsAreEqual([older], [newer]) === false,
    "different posts compare unequal",
  );

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ig-archive-cases-"));
  const archivePath = path.join(tmpDir, "instagram.json");
  const existing = {
    updated_at: "2026-01-01T00:00:00.000Z",
    posts: [older, newer],
  };
  fs.writeFileSync(
    archivePath,
    `${JSON.stringify(existing, null, 2)}\n`,
    "utf8",
  );
  const before = fs.readFileSync(archivePath, "utf8");
  const wroteSame = writeArchiveIfChanged(archivePath, existing, [older, newer]);
  const afterSame = fs.readFileSync(archivePath, "utf8");
  assert(wroteSame === false, "identical content skips write");
  assert(before === afterSame, "identical content leaves file bytes unchanged");

  const wroteChanged = writeArchiveIfChanged(archivePath, existing, [updatedNewer, older]);
  assert(wroteChanged === true, "changed content writes archive");
  const afterChanged = JSON.parse(fs.readFileSync(archivePath, "utf8"));
  assert(Array.isArray(afterChanged.posts) && afterChanged.posts.length === 2, "changed write keeps posts");
  assert(typeof afterChanged.updated_at === "string", "changed write sets updated_at");

  assert(
    readAfterCursor({ cursors: { after: "CURSOR_A" } }) === "CURSOR_A",
    "after cursor is read from cursors.after",
  );
  assert(
    readAfterCursor({ next: "https://graph.instagram.com/media?after=CURSOR_B" }) ===
      "CURSOR_B",
    "after cursor can be parsed from next without logging it",
  );

  fs.rmSync(tmpDir, { recursive: true, force: true });

  const repoRoot = path.join(__dirname, "..");
  const classificationsPath = path.join(
    repoRoot,
    "data",
    "instagram-classifications.json",
  );
  const classificationsBefore = fs.readFileSync(classificationsPath, "utf8");
  assert(
    classificationsBefore.includes('"name": "イラスト"'),
    "classifications still has イラスト",
  );
  assert(
    fs.readFileSync(classificationsPath, "utf8") === classificationsBefore,
    "archive cases do not modify classifications",
  );

  console.log("ashita instagram archive cases: all passed");
}

runAshitaInstagramArchiveCases().catch((error) => {
  console.error(error);
  process.exit(1);
});
