/**
 * Instagram Graph API から最新投稿を取得し data/instagram.json に保存する。
 * GitHub Actions から実行する想定。取得失敗時は既存ファイルを上書きしない。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, "..", "data", "instagram.json");
const TEMP_PATH = `${OUTPUT_PATH}.tmp`;
const API_VERSION = "v21.0";
const POST_LIMIT = 9;

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
 * 一覧表示用の画像URLを決定する（カルーセルは1枚目、動画はサムネイル優先）。
 * @param {Record<string, unknown>} item
 * @returns {string | null}
 */
function getDisplayMediaUrl(item) {
  const mediaType = item.media_type;

  if (mediaType === "VIDEO") {
    return item.thumbnail_url || item.media_url || null;
  }

  if (mediaType === "CAROUSEL_ALBUM") {
    const children = item.children?.data;
    if (Array.isArray(children) && children.length > 0) {
      const first = children[0];
      if (first.media_type === "VIDEO") {
        return first.thumbnail_url || first.media_url || null;
      }
      return first.media_url || null;
    }
    return item.media_url || null;
  }

  return item.media_url || null;
}

/**
 * APIレスポンスをサイト表示用に正規化する。
 * @param {Record<string, unknown>} item
 * @returns {Record<string, unknown> | null}
 */
function normalizePost(item) {
  const mediaUrl = getDisplayMediaUrl(item);
  if (!mediaUrl || !item.permalink) {
    return null;
  }

  return {
    id: item.id,
    media_url: mediaUrl,
    permalink: item.permalink,
    media_type: item.media_type,
    thumbnail_url: item.thumbnail_url || null,
    timestamp: item.timestamp,
  };
}

/**
 * Instagram Graph API から投稿一覧を取得する。
 * @param {string} accessToken
 * @param {string} userId
 * @returns {Promise<Record<string, unknown>[]>}
 */
async function fetchInstagramPosts(accessToken, userId) {
  const params = new URLSearchParams({
    fields: FIELDS,
    limit: String(POST_LIMIT),
    access_token: accessToken,
  });

  const url = `https://graph.facebook.com/${API_VERSION}/${userId}/media?${params}`;
  const response = await fetch(url);

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Instagram API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(`Instagram API error: ${JSON.stringify(data.error)}`);
  }

  const items = Array.isArray(data.data) ? data.data : [];
  return items.map(normalizePost).filter(Boolean).slice(0, POST_LIMIT);
}

async function main() {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const userId = process.env.INSTAGRAM_USER_ID;

  if (!accessToken || !userId) {
    console.error("INSTAGRAM_ACCESS_TOKEN または INSTAGRAM_USER_ID が未設定です。");
    process.exit(0);
  }

  try {
    const posts = await fetchInstagramPosts(accessToken, userId);
    const output = {
      updated_at: new Date().toISOString(),
      posts,
    };

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(TEMP_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
    fs.renameSync(TEMP_PATH, OUTPUT_PATH);

    console.log(`Instagram投稿を ${posts.length} 件保存しました。`);
  } catch (error) {
    if (fs.existsSync(TEMP_PATH)) {
      fs.unlinkSync(TEMP_PATH);
    }
    console.error("Instagram投稿の取得に失敗しました:", error.message);
    console.error("既存の data/instagram.json は保持されます。");
    process.exit(0);
  }
}

main();
