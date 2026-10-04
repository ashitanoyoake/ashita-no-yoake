/**
 * ブログ詳細サイドバーのカテゴリー表示と、
 * 一覧ページへのカテゴリー指定リンク。
 */
(function (global) {
  const DEFAULT_CATEGORY = "未分類";
  const BLOG_LIST_PATH = "/blog.html";

  /**
   * @param {unknown} category
   * @returns {string}
   */
  function getPostCategoryLabel(category) {
    const trimmed = typeof category === "string" ? category.trim() : "";
    return trimmed || DEFAULT_CATEGORY;
  }

  /**
   * @param {unknown} category
   * @returns {string}
   */
  function buildBlogListCategoryHref(category) {
    return `${BLOG_LIST_PATH}?category=${encodeURIComponent(getPostCategoryLabel(category))}`;
  }

  /**
   * @param {string} search
   * @returns {string | null}
   */
  function readBlogListCategoryFilter(search) {
    const query = search.startsWith("?") ? search.slice(1) : search;
    const value = new URLSearchParams(query).get("category");

    if (!value || !value.trim()) {
      return null;
    }

    return value.trim();
  }

  /**
   * @param {ArrayLike<{ dataset: { filter?: string }, classList: { add: Function, remove: Function } }>} buttons
   * @param {string | null} filter
   * @returns {string}
   */
  function resolveActiveBlogListFilter(buttons, filter) {
    if (!filter) {
      return "all";
    }

    const match = Array.from(buttons).find((button) => button.dataset.filter === filter);
    return match ? filter : "all";
  }

  /**
   * @param {HTMLElement} widget
   * @param {string} category
   */
  function renderPostSidebarCategory(widget, category) {
    const label = getPostCategoryLabel(category);
    const list = document.createElement("ul");
    list.className = "blog-category-list";
    list.setAttribute("data-post-category", label);

    const item = document.createElement("li");
    const link = document.createElement("a");
    link.className = "blog-category-button";
    link.href = buildBlogListCategoryHref(label);
    link.textContent = label;
    item.appendChild(link);
    list.appendChild(item);

    const note = widget.querySelector(".blog-post-sidebar-note");
    const currentList = widget.querySelector(".blog-category-list");

    if (note) {
      note.replaceWith(list);
      return;
    }

    if (currentList) {
      currentList.replaceWith(list);
      return;
    }

    widget.appendChild(list);
  }

  /**
   * @param {ParentNode} [root]
   * @returns {boolean}
   */
  function enhanceBlogPostSidebarCategory(root) {
    const scope = root || document;
    const article = scope.querySelector(".blog-post");
    const categoryEl = article && article.querySelector(".blog-post-category");
    const widget = scope.querySelector(".blog-widget-categories");

    if (!article || !categoryEl || !widget) {
      return false;
    }

    if (!categoryEl.textContent) {
      return false;
    }

    renderPostSidebarCategory(widget, categoryEl.textContent);
    return true;
  }

  const api = {
    DEFAULT_CATEGORY,
    BLOG_LIST_PATH,
    getPostCategoryLabel,
    buildBlogListCategoryHref,
    readBlogListCategoryFilter,
    resolveActiveBlogListFilter,
    renderPostSidebarCategory,
    enhanceBlogPostSidebarCategory,
  };

  global.BlogPostCategory = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
