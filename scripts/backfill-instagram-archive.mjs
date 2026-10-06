/**
 * Instagram 過去投稿の初回バックフィル（手動実行専用）。
 * 毎時の fetch-instagram.mjs とは分離し、paging.cursors.after で API 終端まで取得する。
 *
 * - 既存 data/instagram.json は Media ID でマージし、削除しない
 * - R2 / media proxy は使わない
 * - Secret / access_token / paging.next はログに出さない
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BACKFILL_MAX_PAGES,
  BACKFILL_PAGE_SIZE,
  OUTPUT_PATH,
  fetchInstagramPostsPaged,
  mergeArchives,
  readExistingArchive,
  writeArchiveIfChanged,
} from "./fetch-instagram.mjs";

const EXIT_FAILURE = 1;

/**
 * @param {{
 *   accessToken: string,
 *   userId: string,
 *   outputPath?: string,
 *   fetchImpl?: typeof fetch,
 *   pageSize?: number,
 *   maxPages?: number,
 *   log?: (message: string) => void,
 * }} options
 */
export async function runInstagramBackfill(options) {
  const log = options.log || console.log;
  const outputPath = options.outputPath || OUTPUT_PATH;
  const existing = readExistingArchive(outputPath);
  const fetched = await fetchInstagramPostsPaged(options.accessToken, options.userId, {
    fetchImpl: options.fetchImpl,
    pageSize: options.pageSize || BACKFILL_PAGE_SIZE,
    maxPages: options.maxPages || BACKFILL_MAX_PAGES,
    log,
  });
  const merged = mergeArchives(existing.posts, fetched.posts);
  const wroteJson = writeArchiveIfChanged(outputPath, existing, merged.posts);

  return {
    fetched,
    merged,
    wroteJson,
    complete: fetched.stoppedReason === "end",
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
    const result = await runInstagramBackfill({
      accessToken,
      userId,
    });

    console.log(
      `Instagramバックフィル: 取得${result.fetched.posts.length}件 / 追加${result.merged.added} / 更新${result.merged.updated} / 保持${result.merged.kept} / 合計${result.merged.posts.length}件 / 停止=${result.fetched.stoppedReason} / ページ=${result.fetched.pagesFetched}`,
    );
    console.log(
      result.wroteJson
        ? "data/instagram.json を更新しました。"
        : "投稿データに実質変更がないため JSON は更新しません。",
    );

    if (result.complete) {
      console.log("バックフィル完了: API終端まで取得しました。");
      return;
    }

    console.log(
      "バックフィル未完了: max_pages 等で停止した可能性があります。必要なら再実行してください。",
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Instagram API error (unknown)";
    console.error("Instagramバックフィルに失敗しました:", message);
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
