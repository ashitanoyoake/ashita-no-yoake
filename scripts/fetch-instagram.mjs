/**
 * Instagram API with Instagram Login から最新投稿を取得し、
 * 既存 data/instagram.json へ Media ID 単位でマージして保持する。
 * GitHub Actions から実行する想定。取得失敗時は既存ファイルを上書きしない。
 *
 * - 毎時実行は最新9件のみ取得する（ページネーションしない）
 * - 過去投稿の初回取得は backfill-instagram-archive.mjs が担当する
 * - 既存投稿は最新9件から外れても削除しない
 * - 実質変更がない場合は JSON を書き換えない（不要 commit 防止）
 *
 * ホストは graph.instagram.com（Instagram User access token 用）。
 * Facebook Login 用の graph.facebook.com は使わない。
 * R2 / media proxy は導入しない。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const OUTPUT_PATH = path.join(__dirname, "..", "data", "instagram.json");
const TEMP_PATH = `${OUTPUT_PATH}.tmp`;
const API_HOST = "https://graph.instagram.com";
const API_VERSION = "v21.0";
export const POST_LIMIT = 9;
export const BACKFILL_PAGE_SIZE = 25;
export const BACKFILL_MAX_PAGES = 50;
const EXIT_FAILURE = 1;
const API_TIMEOUT_MS = 30_000;

const FIELDS = [
  "id",
  "media_type",
  "media_url",
  "permalink",
  "thumbnail_url",
  "timestamp",
  "children{media_type,media_url,thumbnail_url}",
].join(",");

/**
 * ログ用に安全なエラー要約を作る（token / URL / 生bodyは出さない）。
 * @param {number | null} status
 * @param {string} bodyText
 * @returns {string}
 */
export function formatSafeApiError(status, bodyText) {
  const parts = [];

  if (typeof status === "number") {
    parts.push(`HTTP ${status}`);
  }

  try {
    const parsed = JSON.parse(bodyText);
    const error = parsed && typeof parsed === "object" ? parsed.error : null;

    if (error && typeof error === "object") {
      if (typeof error.type === "string" && error.type) {
        parts.push(`type=${error.type}`);
      }
      if (typeof error.code === "number" || typeof error.code === "string") {
        parts.push(`code=${error.code}`);
      }
      if (
        typeof error.error_subcode === "number" ||
        typeof error.error_subcode === "string"
      ) {
        parts.push(`subcode=${error.error_subcode}`);
      }
    }
  } catch {
    // 生bodyはログしない
  }

  if (parts.length === 0) {
    return "Instagram API error (details omitted)";
  }

  return `Instagram API error (${parts.join(", ")})`;
}

/**
 * @param {unknown} paging
 * @returns {string | null}
 */
export function readAfterCursor(paging) {
  if (!paging || typeof paging !== "object") {
    return null;
  }

  const record = /** @type {{ cursors?: { after?: unknown }, next?: unknown }} */ (
    paging
  );
  const after =
    record.cursors && typeof record.cursors.after === "string"
      ? record.cursors.after
      : "";
  if (after) {
    return after;
  }

  if (typeof record.next === "string" && record.next) {
    try {
      return new URL(record.next).searchParams.get("after");
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * @param {Record<string, unknown>} item
 * @returns {unknown[]}
 */
function readChildrenList(item) {
  if (Array.isArray(item.children)) {
    return item.children;
  }

  if (item.children && typeof item.children === "object") {
    const data = /** @type {{ data?: unknown }} */ (item.children).data;
    if (Array.isArray(data)) {
      return data;
    }
  }

  return [];
}

/**
 * @param {Record<string, unknown>} item
 * @returns {Record<string, unknown>[]}
 */
export function normalizeChildren(item) {
  /** @type {Record<string, unknown>[]} */
  const children = [];

  readChildrenList(item).forEach((raw) => {
    if (!raw || typeof raw !== "object") {
      return;
    }

    const child = /** @type {Record<string, unknown>} */ (raw);
    const mediaUrl = typeof child.media_url === "string" ? child.media_url : null;
    const thumbnailUrl =
      typeof child.thumbnail_url === "string" ? child.thumbnail_url : null;

    if (!mediaUrl && !thumbnailUrl) {
      return;
    }

    children.push({
      media_type: typeof child.media_type === "string" ? child.media_type : null,
      media_url: mediaUrl,
      thumbnail_url: thumbnailUrl,
    });
  });

  return children;
}

/**
 * 一覧表示用の画像URLを決定する（カルーセルは1枚目、動画はサムネイル優先）。
 * @param {Record<string, unknown>} item
 * @param {Record<string, unknown>[]} children
 * @returns {string | null}
 */
function getDisplayMediaUrl(item, children) {
  if (children.length > 0) {
    const first = children[0];
    if (first.media_type === "VIDEO") {
      return (
        (typeof first.thumbnail_url === "string" && first.thumbnail_url) ||
        (typeof first.media_url === "string" && first.media_url) ||
        null
      );
    }
    return (typeof first.media_url === "string" && first.media_url) || null;
  }

  if (item.media_type === "VIDEO") {
    return (
      (typeof item.thumbnail_url === "string" && item.thumbnail_url) ||
      (typeof item.media_url === "string" && item.media_url) ||
      null
    );
  }

  return (typeof item.media_url === "string" && item.media_url) || null;
}

/**
 * APIレスポンスをサイト表示用に正規化する。
 * children がある場合のみ保存する（空配列は付けない）。
 * @param {Record<string, unknown>} item
 * @returns {Record<string, unknown> | null}
 */
export function normalizePost(item) {
  const children = normalizeChildren(item);
  const mediaUrl = getDisplayMediaUrl(item, children);
  if (!mediaUrl || typeof item.permalink !== "string" || !item.permalink) {
    return null;
  }

  /** @type {Record<string, unknown>} */
  const post = {
    id: item.id,
    media_url: mediaUrl,
    permalink: item.permalink,
    media_type: item.media_type,
    thumbnail_url: typeof item.thumbnail_url === "string" ? item.thumbnail_url : null,
    timestamp: item.timestamp,
  };

  if (children.length > 0) {
    post.children = children;
  }

  return post;
}

/**
 * @param {string} [outputPath]
 * @returns {{ updated_at?: string, posts: Record<string, unknown>[] }}
 */
export function readExistingArchive(outputPath = OUTPUT_PATH) {
  if (!fs.existsSync(outputPath)) {
    return { posts: [] };
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  } catch {
    throw new Error("既存の data/instagram.json が読み込めないため中断しました。");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("既存の data/instagram.json の形式が不正なため中断しました。");
  }

  const posts = Array.isArray(parsed.posts) ? parsed.posts : [];
  return {
    updated_at:
      typeof parsed.updated_at === "string" ? parsed.updated_at : undefined,
    posts: posts.filter((post) => post && typeof post === "object"),
  };
}

/**
 * @param {Record<string, unknown>[]} posts
 * @returns {Record<string, unknown>[]}
 */
export function dedupePostsById(posts) {
  const seen = new Set();
  /** @type {Record<string, unknown>[]} */
  const result = [];

  posts.forEach((post) => {
    const id = post && post.id != null ? String(post.id) : "";
    if (!id || seen.has(id)) {
      return;
    }
    seen.add(id);
    result.push(post);
  });

  return result;
}

/**
 * @param {Record<string, unknown>[]} posts
 * @returns {Record<string, unknown>[]}
 */
export function sortPostsByTimestampDesc(posts) {
  return [...posts].sort((a, b) => {
    const aTime = Date.parse(String(a.timestamp || ""));
    const bTime = Date.parse(String(b.timestamp || ""));
    const aValid = Number.isFinite(aTime);
    const bValid = Number.isFinite(bTime);
    if (aValid && bValid && bTime !== aTime) {
      return bTime - aTime;
    }
    if (aValid !== bValid) {
      return aValid ? -1 : 1;
    }
    return String(b.id || "").localeCompare(String(a.id || ""));
  });
}

/**
 * @param {unknown} item
 * @returns {Record<string, unknown>}
 */
function serializeChild(item) {
  const child =
    item && typeof item === "object"
      ? /** @type {Record<string, unknown>} */ (item)
      : {};
  return {
    media_type: child.media_type ?? null,
    media_url: child.media_url ?? null,
    thumbnail_url: child.thumbnail_url ?? null,
  };
}

/**
 * @param {unknown} item
 * @returns {Record<string, unknown>}
 */
function serializePost(item) {
  const post =
    item && typeof item === "object"
      ? /** @type {Record<string, unknown>} */ (item)
      : {};
  return {
    id: post.id ?? null,
    permalink: post.permalink ?? null,
    media_type: post.media_type ?? null,
    timestamp: post.timestamp ?? null,
    media_url: post.media_url ?? null,
    thumbnail_url: post.thumbnail_url ?? null,
    children: Array.isArray(post.children)
      ? post.children.map(serializeChild)
      : [],
  };
}

/**
 * @param {Record<string, unknown>[]} a
 * @param {Record<string, unknown>[]} b
 * @returns {boolean}
 */
export function postsAreEqual(a, b) {
  return JSON.stringify(a.map(serializePost)) === JSON.stringify(b.map(serializePost));
}

/**
 * @param {Record<string, unknown> | null | undefined} existing
 * @param {Record<string, unknown>} incoming
 * @returns {Record<string, unknown>}
 */
function mergeChildRecord(existing, incoming) {
  return {
    media_type: incoming.media_type || existing?.media_type || null,
    media_url: incoming.media_url || existing?.media_url || null,
    thumbnail_url: incoming.thumbnail_url ?? existing?.thumbnail_url ?? null,
  };
}

/**
 * @param {unknown[]} existingChildren
 * @param {unknown[]} incomingChildren
 * @returns {Record<string, unknown>[]}
 */
export function mergeChildren(existingChildren, incomingChildren) {
  const existingList = Array.isArray(existingChildren) ? existingChildren : [];
  const incomingList = Array.isArray(incomingChildren) ? incomingChildren : [];

  if (incomingList.length === 0) {
    return existingList
      .filter((raw) => raw && typeof raw === "object")
      .map((raw) => /** @type {Record<string, unknown>} */ (raw));
  }

  /** @type {Record<string, unknown>[]} */
  const merged = [];
  const max = Math.max(existingList.length, incomingList.length);

  for (let index = 0; index < max; index += 1) {
    const existingRaw = existingList[index];
    const incomingRaw = incomingList[index];
    const existing =
      existingRaw && typeof existingRaw === "object"
        ? /** @type {Record<string, unknown>} */ (existingRaw)
        : undefined;
    const incoming =
      incomingRaw && typeof incomingRaw === "object"
        ? /** @type {Record<string, unknown>} */ (incomingRaw)
        : undefined;

    if (incoming) {
      merged.push(mergeChildRecord(existing, incoming));
    } else if (existing) {
      merged.push(existing);
    }
  }

  return merged;
}

/**
 * @param {Record<string, unknown>} existing
 * @param {Record<string, unknown>} incoming
 * @returns {Record<string, unknown>}
 */
function mergePostRecord(existing, incoming) {
  const children = mergeChildren(
    Array.isArray(existing.children) ? existing.children : [],
    Array.isArray(incoming.children) ? incoming.children : [],
  );

  /** @type {Record<string, unknown>} */
  const merged = {
    id: incoming.id || existing.id,
    permalink: incoming.permalink || existing.permalink,
    media_type: incoming.media_type || existing.media_type,
    timestamp: incoming.timestamp || existing.timestamp,
    media_url: incoming.media_url || existing.media_url,
    thumbnail_url: incoming.thumbnail_url ?? existing.thumbnail_url ?? null,
  };

  if (children.length > 0) {
    merged.children = children;
  }

  return merged;
}

/**
 * 最新取得分を既存アーカイブへ Media ID でマージする。未取得の既存投稿は残す。
 * @param {Record<string, unknown>[]} existingPosts
 * @param {Record<string, unknown>[]} incomingPosts
 * @returns {{ posts: Record<string, unknown>[], added: number, updated: number, kept: number }}
 */
export function mergeArchives(existingPosts, incomingPosts) {
  const existingById = new Map();
  existingPosts.forEach((post) => {
    if (post && post.id != null && post.id !== "") {
      existingById.set(String(post.id), post);
    }
  });

  const seen = new Set();
  /** @type {Record<string, unknown>[]} */
  const merged = [];
  let added = 0;
  let updated = 0;

  incomingPosts.forEach((incoming) => {
    if (!incoming || incoming.id == null || incoming.id === "") {
      return;
    }
    const id = String(incoming.id);
    seen.add(id);
    const existing = existingById.get(id);
    if (existing) {
      merged.push(mergePostRecord(existing, incoming));
      updated += 1;
    } else {
      merged.push(incoming);
      added += 1;
    }
  });

  let kept = 0;
  existingPosts.forEach((existing) => {
    if (!existing || existing.id == null || existing.id === "") {
      return;
    }
    const id = String(existing.id);
    if (seen.has(id)) {
      return;
    }
    merged.push(existing);
    kept += 1;
  });

  return {
    posts: sortPostsByTimestampDesc(dedupePostsById(merged)),
    added,
    updated,
    kept,
  };
}

/**
 * @param {string} outputPath
 * @param {{ updated_at?: string, posts: Record<string, unknown>[] }} existing
 * @param {Record<string, unknown>[]} posts
 * @returns {boolean} wrote
 */
export function writeArchiveIfChanged(outputPath, existing, posts) {
  if (postsAreEqual(existing.posts, posts)) {
    return false;
  }

  const output = {
    updated_at: new Date().toISOString(),
    posts,
  };
  const tempPath = `${outputPath}.tmp`;

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(tempPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  fs.renameSync(tempPath, outputPath);
  return true;
}

/**
 * Instagram API with Instagram Login から最新投稿を取得する（1ページ・limit件）。
 * @param {string} accessToken
 * @param {string} userId
 * @param {{ fetchImpl?: typeof fetch }} [options]
 * @returns {Promise<Record<string, unknown>[]>}
 */
export async function fetchInstagramPosts(accessToken, userId, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const params = new URLSearchParams({
    fields: FIELDS,
    limit: String(POST_LIMIT),
    access_token: accessToken,
  });

  const url = `${API_HOST}/${API_VERSION}/${userId}/media?${params}`;
  const response = await fetchImpl(url, {
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
    headers: { Accept: "application/json" },
  });
  const bodyText = await response.text();

  let data;

  try {
    data = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    throw new Error(formatSafeApiError(response.status, ""));
  }

  if (!response.ok) {
    throw new Error(formatSafeApiError(response.status, bodyText));
  }

  if (data && typeof data === "object" && data.error) {
    throw new Error(formatSafeApiError(response.status, bodyText));
  }

  const items = data && Array.isArray(data.data) ? data.data : [];
  return items.map(normalizePost).filter(Boolean).slice(0, POST_LIMIT);
}

/**
 * paging.cursors.after で API 終端まで取得する。
 * paging.next はトークンを含むため使わず、after だけを組み立て直す。
 *
 * @param {string} accessToken
 * @param {string} userId
 * @param {{
 *   fetchImpl?: typeof fetch,
 *   pageSize?: number,
 *   maxPages?: number,
 *   log?: (message: string) => void,
 * }} [options]
 * @returns {Promise<{
 *   posts: Record<string, unknown>[],
 *   pagesFetched: number,
 *   stoppedReason: "end" | "max_pages" | "repeat_cursor",
 * }>}
 */
export async function fetchInstagramPostsPaged(accessToken, userId, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const pageSize = options.pageSize || BACKFILL_PAGE_SIZE;
  const maxPages = options.maxPages || BACKFILL_MAX_PAGES;
  const log = options.log || (() => {});
  const seenIds = new Set();
  const seenCursors = new Set();
  /** @type {Record<string, unknown>[]} */
  const posts = [];
  let pagesFetched = 0;
  let stoppedReason = /** @type {"end" | "max_pages" | "repeat_cursor"} */ ("end");
  let after = /** @type {string | null} */ (null);

  while (true) {
    if (pagesFetched >= maxPages) {
      stoppedReason = "max_pages";
      break;
    }

    const params = new URLSearchParams({
      fields: FIELDS,
      limit: String(pageSize),
      access_token: accessToken,
    });
    if (after) {
      params.set("after", after);
    }

    const url = `${API_HOST}/${API_VERSION}/${userId}/media?${params}`;
    const response = await fetchImpl(url, {
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
      headers: { Accept: "application/json" },
    });
    const bodyText = await response.text();
    let data;

    try {
      data = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      throw new Error(formatSafeApiError(response.status, ""));
    }

    if (!response.ok || (data && typeof data === "object" && data.error)) {
      throw new Error(formatSafeApiError(response.status, bodyText));
    }

    const pageItems = data && Array.isArray(data.data) ? data.data : [];
    const paging = data && typeof data === "object" ? data.paging : null;
    const pageNumber = pagesFetched + 1;
    let accepted = 0;

    pageItems.forEach((raw) => {
      const normalized = normalizePost(
        /** @type {Record<string, unknown>} */ (raw),
      );
      if (!normalized || normalized.id == null || normalized.id === "") {
        return;
      }
      const id = String(normalized.id);
      if (seenIds.has(id)) {
        return;
      }
      seenIds.add(id);
      posts.push(normalized);
      accepted += 1;
    });

    pagesFetched += 1;
    const nextAfter = readAfterCursor(paging);
    log(
      `page=${pageNumber} count=${pageItems.length} unique=${accepted} total=${posts.length} has_next=${
        nextAfter ? "yes" : "no"
      }`,
    );

    if (pageItems.length === 0) {
      stoppedReason = "end";
      break;
    }

    if (!nextAfter) {
      stoppedReason = "end";
      break;
    }

    if (seenCursors.has(nextAfter)) {
      stoppedReason = "repeat_cursor";
      break;
    }

    seenCursors.add(nextAfter);
    after = nextAfter;
  }

  return {
    posts,
    pagesFetched,
    stoppedReason,
  };
}

async function main() {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const userId = process.env.INSTAGRAM_USER_ID;

  if (!accessToken || !userId) {
    console.error("INSTAGRAM_ACCESS_TOKEN または INSTAGRAM_USER_ID が未設定です。");
    process.exit(EXIT_FAILURE);
  }

  try {
    const incoming = await fetchInstagramPosts(accessToken, userId);
    const existing = readExistingArchive(OUTPUT_PATH);
    const merged = mergeArchives(existing.posts, incoming);
    const wroteJson = writeArchiveIfChanged(OUTPUT_PATH, existing, merged.posts);

    console.log(
      `Instagramアーカイブ: 取得${incoming.length}件 / 追加${merged.added} / 更新${merged.updated} / 保持${merged.kept} / 合計${merged.posts.length}件`,
    );
    console.log(
      wroteJson
        ? "data/instagram.json を更新しました。"
        : "投稿データに実質変更がないため JSON は更新しません。",
    );
  } catch (error) {
    if (fs.existsSync(TEMP_PATH)) {
      fs.unlinkSync(TEMP_PATH);
    }

    const message =
      error instanceof Error ? error.message : "Instagram API error (unknown)";
    console.error("Instagram投稿の取得に失敗しました:", message);
    console.error("既存の data/instagram.json は保持されます。");
    process.exit(EXIT_FAILURE);
  }
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  main();
}
