/**
 * Instagram Login の長期アクセストークンを refresh し、
 * 成功時のみ GitHub Repository Secret INSTAGRAM_ACCESS_TOKEN を更新する。
 *
 * GitHub Actions から実行する想定。
 * refresh 失敗時は既存 Secret を変更しない。
 * token / Secret / 完全URL / 生 response body はログに出さない。
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const REFRESH_ENDPOINT = "https://graph.instagram.com/refresh_access_token";
const SECRET_NAME = "INSTAGRAM_ACCESS_TOKEN";
const EXIT_FAILURE = 1;

/**
 * ログ用に安全なエラー要約を作る（token / URL / 生bodyは出さない）。
 * @param {number | null} status
 * @param {string} bodyText
 * @returns {string}
 */
function formatSafeApiError(status, bodyText) {
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
 * Meta の refresh_access_token で長期トークンを更新する。
 * @param {string} accessToken
 * @returns {Promise<{ accessToken: string, expiresIn: number }>}
 */
async function refreshAccessToken(accessToken) {
  const params = new URLSearchParams({
    grant_type: "ig_refresh_token",
    access_token: accessToken,
  });

  const response = await fetch(`${REFRESH_ENDPOINT}?${params}`);
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

  const newToken =
    data && typeof data === "object" && typeof data.access_token === "string"
      ? data.access_token
      : "";
  const expiresIn =
    data && typeof data === "object" && typeof data.expires_in === "number"
      ? data.expires_in
      : null;

  if (!newToken) {
    throw new Error("Instagram API error (missing access_token in response)");
  }

  if (expiresIn === null) {
    throw new Error("Instagram API error (missing expires_in in response)");
  }

  return { accessToken: newToken, expiresIn };
}

/**
 * GitHub CLI で Repository Secret を更新する。
 * token は一時ファイル経由で渡し、終了時に必ず削除する。
 * @param {string} newToken
 */
function updateRepositorySecret(newToken) {
  if (!process.env.GH_TOKEN) {
    throw new Error("GH_TOKEN is not set (expected GH_SECRETS_WRITE_TOKEN).");
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ig-refresh-"));
  const tmpFile = path.join(tmpDir, "token");

  try {
    // argv に token を載せず、一時ファイル→stdin で渡す（gh は値が未指定なら stdin を読む）
    fs.writeFileSync(tmpFile, newToken, { encoding: "utf8", mode: 0o600 });

    const args = ["secret", "set", SECRET_NAME];
    const repo = process.env.GITHUB_REPOSITORY;
    if (repo) {
      args.push("--repo", repo);
    }

    const result = spawnSync("gh", args, {
      encoding: "utf8",
      env: process.env,
      input: fs.readFileSync(tmpFile, "utf8"),
      stdio: ["pipe", "pipe", "pipe"],
    });

    if (result.error) {
      throw new Error(`gh secret set failed to start: ${result.error.message}`);
    }

    if (result.status !== 0) {
      // stderr に token が含まれる想定はないが、生出力は出さない
      throw new Error(
        `gh secret set failed (exit ${result.status === null ? "null" : result.status})`,
      );
    }
  } finally {
    try {
      if (fs.existsSync(tmpFile)) {
        fs.unlinkSync(tmpFile);
      }
    } catch {
      // ignore cleanup errors
    }
    try {
      if (fs.existsSync(tmpDir)) {
        fs.rmdirSync(tmpDir);
      }
    } catch {
      // ignore cleanup errors
    }
  }
}

async function main() {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;

  if (!accessToken) {
    console.error("INSTAGRAM_ACCESS_TOKEN が未設定です。");
    process.exit(EXIT_FAILURE);
  }

  let refreshed;

  try {
    refreshed = await refreshAccessToken(accessToken);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Instagram API error (unknown)";
    console.error("Instagram token の refresh に失敗しました:", message);
    console.error("既存の INSTAGRAM_ACCESS_TOKEN Secret は変更していません。");
    process.exit(EXIT_FAILURE);
  }

  // refresh 成功後のみ Secret 更新へ進む
  try {
    updateRepositorySecret(refreshed.accessToken);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "GitHub secret update failed";
    console.error("Repository Secret の更新に失敗しました:", message);
    console.error("既存の INSTAGRAM_ACCESS_TOKEN Secret は変更していません。");
    process.exit(EXIT_FAILURE);
  }

  console.log(
    `Instagram token refresh に成功しました。expires_in=${refreshed.expiresIn}`,
  );
}

main();
