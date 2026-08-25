/**
 * ブログ記事一覧
 * data/posts/posts-index.json を読み込んで表示する。
 */
(function () {
  const blogMain = document.querySelector("[data-blog-list-root]");
  if (!blogMain) return;

  const listEl = blogMain.querySelector(".blog-list");
  const messageEl = blogMain.querySelector(".blog-list-message");
  const recentListEl = document.querySelector(".blog-recent-list");
  const categoryListEl = document.querySelector(".blog-category-list");

  if (!listEl || !messageEl) return;

  const DATA_URL = new URL("data/posts/posts-index.json", window.location.href).href;
  const DEFAULT_THUMBNAIL = "images/guide/blog.jpg";
  const LOADING_MESSAGE = "読み込み中...";
  const EMPTY_MESSAGE = "現在公開中の記事はありません。";
  const ERROR_MESSAGE = "記事を読み込めませんでした。";
  const DEFAULT_CATEGORY = "未分類";

  /** @type {Array<{id: number, title: string, publishDate: string, category: string, tags: string[], thumbnail: string, slug: string, markdownPath: string}>} */
  let posts = [];

  function showMessage(text) {
    listEl.innerHTML = "";
    listEl.hidden = true;
    messageEl.textContent = text;
    messageEl.removeAttribute("hidden");
  }

  function showList() {
    messageEl.setAttribute("hidden", "");
    listEl.removeAttribute("hidden");
  }

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
   * @param {string} category
   * @returns {string}
   */
  function getCategoryLabel(category) {
    const trimmed = category.trim();
    return trimmed || DEFAULT_CATEGORY;
  }

  /**
   * @param {unknown} data
   * @returns {typeof posts | null}
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
        typeof entry.publishDate === "string"
      );
    });
  }

  /**
   * @param {typeof posts[number]} post
   * @returns {HTMLLIElement}
   */
  function createBlogItem(post) {
    const li = document.createElement("li");
    li.className = "blog-item";

    const categoryLabel = getCategoryLabel(post.category);
    li.dataset.category = categoryLabel;

    if (typeof post.slug === "string") {
      li.dataset.slug = post.slug;
    }

    if (typeof post.markdownPath === "string") {
      li.dataset.markdownPath = post.markdownPath;
    }

    if (typeof post.id === "number") {
      li.dataset.postId = String(post.id);
    }

    const link = document.createElement("a");
    link.href = "#";
    link.className = "blog-item-link";

    const thumb = document.createElement("img");
    thumb.className = "blog-item-thumb";
    thumb.src = resolveThumbnailUrl(typeof post.thumbnail === "string" ? post.thumbnail : "");
    thumb.alt = "";
    thumb.width = 80;
    thumb.height = 80;
    thumb.loading = "lazy";
    thumb.decoding = "async";

    const defaultThumbUrl = new URL(DEFAULT_THUMBNAIL, window.location.href).href;
    thumb.addEventListener(
      "error",
      () => {
        if (thumb.src !== defaultThumbUrl) {
          thumb.src = DEFAULT_THUMBNAIL;
        }
      },
      { once: true }
    );

    const body = document.createElement("div");
    body.className = "blog-item-body";

    const dateSpan = document.createElement("span");
    dateSpan.className = "blog-date";
    dateSpan.textContent = formatPublishDate(post.publishDate);

    const categorySpan = document.createElement("span");
    categorySpan.className = "blog-category";
    categorySpan.textContent = categoryLabel;

    const titleSpan = document.createElement("span");
    titleSpan.className = "blog-title";
    titleSpan.textContent = post.title;

    body.appendChild(dateSpan);
    body.appendChild(categorySpan);
    body.appendChild(titleSpan);

    const arrow = document.createElement("span");
    arrow.className = "blog-arrow";
    arrow.textContent = "→";
    arrow.setAttribute("aria-hidden", "true");

    link.appendChild(thumb);
    link.appendChild(body);
    link.appendChild(arrow);
    li.appendChild(link);

    return li;
  }

  /**
   * @param {typeof posts} items
   */
  function renderBlogList(items) {
    listEl.innerHTML = "";

    items.forEach((post) => {
      listEl.appendChild(createBlogItem(post));
    });

    showList();
  }

  /**
   * @param {typeof posts} items
   */
  function renderRecentPosts(items) {
    if (!recentListEl) return;

    recentListEl.innerHTML = "";
    const recentItems = items.slice(0, 3);

    if (recentItems.length === 0) {
      const li = document.createElement("li");
      li.className = "blog-recent-empty";
      li.textContent = "記事はありません。";
      recentListEl.appendChild(li);
      return;
    }

    recentItems.forEach((post) => {
      const li = document.createElement("li");

      const link = document.createElement("a");
      link.href = "#";
      link.className = "blog-recent-link";
      link.textContent = post.title;

      const time = document.createElement("time");
      time.className = "blog-recent-date";
      time.dateTime = post.publishDate.trim();
      time.textContent = formatPublishDate(post.publishDate);

      li.appendChild(link);
      li.appendChild(time);
      recentListEl.appendChild(li);
    });
  }

  /**
   * @param {typeof posts} items
   * @returns {string[]}
   */
  function getUniqueCategories(items) {
    const seen = new Set();
    /** @type {string[]} */
    const categories = [];

    items.forEach((post) => {
      const label = getCategoryLabel(post.category);

      if (!seen.has(label)) {
        seen.add(label);
        categories.push(label);
      }
    });

    return categories;
  }

  /**
   * @param {string} filter
   */
  function filterBlogItems(filter) {
    listEl.querySelectorAll(".blog-item").forEach((item) => {
      const category = item.dataset.category;
      const isVisible = filter === "all" || category === filter;
      item.classList.toggle("is-hidden", !isVisible);
    });
  }

  function bindCategoryFilter() {
    if (!categoryListEl) return;

    const buttons = categoryListEl.querySelectorAll(".blog-category-button");

    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        const filter = button.dataset.filter;
        if (!filter) return;

        buttons.forEach((btn) => {
          btn.classList.remove("is-active");
        });
        button.classList.add("is-active");
        filterBlogItems(filter);
      });
    });
  }

  /**
   * @param {string[]} categories
   */
  function renderCategoryButtons(categories) {
    if (!categoryListEl) return;

    categoryListEl.innerHTML = "";

    const allItem = document.createElement("li");
    const allButton = document.createElement("button");
    allButton.type = "button";
    allButton.className = "blog-category-button is-active";
    allButton.dataset.filter = "all";
    allButton.textContent = "すべて";
    allItem.appendChild(allButton);
    categoryListEl.appendChild(allItem);

    categories.forEach((category) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "blog-category-button";
      button.dataset.filter = category;
      button.textContent = category;
      item.appendChild(button);
      categoryListEl.appendChild(item);
    });

    bindCategoryFilter();
  }

  /**
   * @param {typeof posts} items
   */
  function renderPosts(items) {
    posts = items;
    renderBlogList(items);
    renderRecentPosts(items);
    renderCategoryButtons(getUniqueCategories(items));
  }

  function renderEmptyState() {
    posts = [];
    showMessage(EMPTY_MESSAGE);
    renderRecentPosts([]);
    renderCategoryButtons([]);
  }

  function renderErrorState() {
    posts = [];
    showMessage(ERROR_MESSAGE);
    renderRecentPosts([]);
    renderCategoryButtons([]);
  }

  async function init() {
    showMessage(LOADING_MESSAGE);
    renderRecentPosts([]);
    renderCategoryButtons([]);

    try {
      const response = await fetch(DATA_URL, { cache: "no-cache" });

      if (!response.ok) {
        renderErrorState();
        return;
      }

      const data = await response.json();
      const parsedPosts = parsePostsIndex(data);

      if (parsedPosts === null) {
        renderErrorState();
        return;
      }

      if (parsedPosts.length === 0) {
        renderEmptyState();
        return;
      }

      renderPosts(parsedPosts);
    } catch {
      renderErrorState();
    }
  }

  init();
})();
