/**
 * ブログ共通ユーティリティ
 */
(function (global) {
  const DEFAULT_THUMBNAIL = "images/guide/blog.jpg";
  const DEFAULT_CATEGORY = "未分類";

  /**
   * @param {string} publishDate
   * @returns {string}
   */
  function formatPublishDate(publishDate) {
    const trimmed = publishDate.trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);

    if (!match) {
      return trimmed;
    }

    return `${match[1]}.${match[2]}.${match[3]}`;
  }

  /**
   * @param {string} thumbnail
   * @returns {string}
   */
  function resolveThumbnailUrl(thumbnail) {
    const trimmed = thumbnail.trim();

    if (!trimmed) {
      return DEFAULT_THUMBNAIL;
    }

    if (trimmed.startsWith("/") || trimmed.startsWith("images/")) {
      return trimmed;
    }

    return DEFAULT_THUMBNAIL;
  }

  /**
   * @param {string} imageUrl
   * @returns {string | null}
   */
  function resolveContentImageUrl(imageUrl) {
    const trimmed = imageUrl.trim();

    if (!trimmed) {
      return null;
    }

    if (trimmed.startsWith("/") || trimmed.startsWith("images/")) {
      return trimmed;
    }

    return null;
  }

  /**
   * 詳細ページ用。空文字とデフォルト画像 path は null を返す。
   * @param {string} thumbnail
   * @returns {string | null}
   */
  function resolvePostDetailThumbnailUrl(thumbnail) {
    const trimmed = thumbnail.trim();

    if (!trimmed) {
      return null;
    }

    const normalized = trimmed.replace(/^\//, "");

    if (normalized === DEFAULT_THUMBNAIL) {
      return null;
    }

    return resolveContentImageUrl(trimmed);
  }

  /**
   * @param {string} category
   * @returns {string}
   */
  function getCategoryLabel(category) {
    const trimmed = category.trim();
    return trimmed || DEFAULT_CATEGORY;
  }

  /**
   * @param {unknown} data
   * @returns {Array<{id: number, title: string, publishDate: string, category: string, tags: string[], thumbnail: string, slug: string, markdownPath: string}> | null}
   */
  function parsePostsIndex(data) {
    if (!Array.isArray(data)) {
      return null;
    }

    return data.filter((entry) => {
      return (
        entry &&
        typeof entry === "object" &&
        typeof entry.title === "string" &&
        typeof entry.publishDate === "string" &&
        typeof entry.markdownPath === "string"
      );
    });
  }

  /**
   * @param {{ publishDate?: string, id?: number }} left
   * @param {{ publishDate?: string, id?: number }} right
   * @returns {number}
   */
  function comparePostsByNewest(left, right) {
    const dateLeft = typeof left.publishDate === "string" ? left.publishDate.trim() : "";
    const dateRight = typeof right.publishDate === "string" ? right.publishDate.trim() : "";
    const dateCompare = dateRight.localeCompare(dateLeft);

    if (dateCompare !== 0) {
      return dateCompare;
    }

    const idLeft = typeof left.id === "number" ? left.id : 0;
    const idRight = typeof right.id === "number" ? right.id : 0;

    return idRight - idLeft;
  }

  /**
   * @template {{ publishDate?: string, id?: number }} T
   * @param {T[]} posts
   * @returns {T[]}
   */
  function sortPostsByNewest(posts) {
    return [...posts].sort(comparePostsByNewest);
  }

  /**
   * @param {string} markdownPath
   * @returns {string}
   */
  function buildPostUrl(markdownPath) {
    return `blog-post.html?post=${encodeURIComponent(markdownPath)}`;
  }

  /**
   * @returns {string}
   */
  function getPostsIndexUrl() {
    return new URL("data/posts/posts-index.json", global.location.href).href;
  }

  /**
   * @param {string} markdownPath
   * @returns {string}
   */
  function getPostMarkdownUrl(markdownPath) {
    return new URL(`data/posts/${markdownPath}`, global.location.href).href;
  }

  /**
   * @param {string | null | undefined} value
   * @returns {boolean}
   */
  function isAllowedPostParameter(value) {
    if (!value || typeof value !== "string") {
      return false;
    }

    if (
      value.includes("..") ||
      value.includes("/") ||
      value.includes("\\") ||
      value.includes(":") ||
      value.startsWith(".")
    ) {
      return false;
    }

    return /^[^\0/\\]+\.md$/.test(value);
  }

  global.BlogCommon = {
    DEFAULT_THUMBNAIL,
    DEFAULT_CATEGORY,
    formatPublishDate,
    resolveThumbnailUrl,
    resolveContentImageUrl,
    resolvePostDetailThumbnailUrl,
    getCategoryLabel,
    parsePostsIndex,
    sortPostsByNewest,
    buildPostUrl,
    getPostsIndexUrl,
    getPostMarkdownUrl,
    isAllowedPostParameter,
  };
})(window);
