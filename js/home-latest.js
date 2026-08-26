/**
 * ホーム：最新ブログ記事
 * posts-index.json から新しい順に最大3件を表示する。
 */
(function () {
  const root = document.querySelector("[data-home-latest-root]");
  if (!root || !window.BlogCommon) return;

  const listEl = root.querySelector(".home-latest-list");
  if (!listEl) return;

  const {
    DEFAULT_THUMBNAIL,
    formatPublishDate,
    resolveThumbnailUrl,
    getCategoryLabel,
    parsePostsIndex,
    sortPostsByNewest,
    buildPostUrl,
    getPostsIndexUrl,
  } = window.BlogCommon;

  const LATEST_COUNT = 3;

  /**
   * @param {{ title: string, publishDate: string, category?: string, thumbnail?: string, markdownPath: string, id?: number }} post
   * @returns {HTMLLIElement}
   */
  function createLatestCard(post) {
    const item = document.createElement("li");
    item.className = "home-latest-item";

    const link = document.createElement("a");
    link.className = "home-latest-card";
    link.href = buildPostUrl(post.markdownPath);

    const thumb = document.createElement("img");
    thumb.className = "home-latest-thumb";
    thumb.src = resolveThumbnailUrl(typeof post.thumbnail === "string" ? post.thumbnail : "");
    thumb.alt = "";
    thumb.width = 480;
    thumb.height = 270;
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
    body.className = "home-latest-body";

    const dateEl = document.createElement("time");
    dateEl.className = "blog-date";
    dateEl.dateTime = post.publishDate.trim();
    dateEl.textContent = formatPublishDate(post.publishDate);

    const categoryEl = document.createElement("span");
    categoryEl.className = "blog-category";
    categoryEl.textContent = getCategoryLabel(
      typeof post.category === "string" ? post.category : ""
    );

    const titleEl = document.createElement("span");
    titleEl.className = "home-latest-title";
    titleEl.textContent = post.title;

    body.appendChild(dateEl);
    body.appendChild(categoryEl);
    body.appendChild(titleEl);

    link.appendChild(thumb);
    link.appendChild(body);
    item.appendChild(link);

    return item;
  }

  /**
   * @param {Array<{ title: string, publishDate: string, category?: string, thumbnail?: string, markdownPath: string, id?: number }>} posts
   */
  function renderLatestPosts(posts) {
    listEl.replaceChildren();

    posts.forEach((post) => {
      listEl.appendChild(createLatestCard(post));
    });

    root.hidden = false;
  }

  async function init() {
    try {
      const response = await fetch(getPostsIndexUrl(), { cache: "no-cache" });

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      const parsedPosts = parsePostsIndex(data);

      if (parsedPosts === null || parsedPosts.length === 0) {
        return;
      }

      renderLatestPosts(sortPostsByNewest(parsedPosts).slice(0, LATEST_COUNT));
    } catch {
      // ホーム全体は維持し、このセクションだけ出さない
    }
  }

  init();
})();
