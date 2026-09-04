/**
 * 制作実績一覧
 * data/works/works-index.json を読み込んで表示する。
 */
(function () {
  const root = document.querySelector("[data-works-list-root]");
  if (!root) return;

  const listEl = root.querySelector(".works-list");
  const messageEl = root.querySelector(".works-list-message");

  if (!listEl || !messageEl) return;

  const LOADING_MESSAGE = "読み込み中...";
  const EMPTY_MESSAGE = "制作実績はまだありません";
  const ERROR_MESSAGE = "制作実績を読み込めませんでした";
  const DETAIL_CUE = "詳細を見る";
  const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

  /**
   * @returns {string}
   */
  function getWorksIndexUrl() {
    return new URL("data/works/works-index.json", window.location.href).href;
  }

  /**
   * @param {string} text
   */
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
   * @param {string} slug
   * @returns {boolean}
   */
  function isSafeWorkSlug(slug) {
    const trimmed = slug.trim();

    if (!trimmed) {
      return false;
    }

    if (
      trimmed.includes("..") ||
      trimmed.includes("/") ||
      trimmed.includes("\\") ||
      trimmed.includes(":") ||
      trimmed.includes("?") ||
      trimmed.includes("#") ||
      trimmed.startsWith(".")
    ) {
      return false;
    }

    return true;
  }

  /**
   * @param {string} slug
   * @returns {string | null}
   */
  function buildWorkHrefFromSlug(slug) {
    if (!isSafeWorkSlug(slug)) {
      return null;
    }

    return `/works/${encodeURIComponent(slug.trim())}.html`;
  }

  /**
   * @param {string} pathValue
   * @returns {string | null}
   */
  function resolveWorkHrefFromPath(pathValue) {
    const trimmed = pathValue.trim();

    if (!trimmed) {
      return null;
    }

    const lower = trimmed.toLowerCase();

    if (
      lower.startsWith("javascript:") ||
      lower.startsWith("data:") ||
      lower.startsWith("blob:") ||
      lower.startsWith("http:") ||
      lower.startsWith("https:") ||
      lower.startsWith("//")
    ) {
      return null;
    }

    if (trimmed.includes("..") || trimmed.includes("\\") || trimmed.includes(":")) {
      return null;
    }

    const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    const match = /^\/works\/([^/]+)\.html$/.exec(withLeadingSlash);

    if (!match) {
      return null;
    }

    let slug;

    try {
      slug = decodeURIComponent(match[1]);
    } catch {
      return null;
    }

    return buildWorkHrefFromSlug(slug);
  }

  /**
   * @param {{ path?: unknown, slug?: unknown }} entry
   * @returns {string | null}
   */
  function resolveWorkHref(entry) {
    if (typeof entry.path === "string") {
      const fromPath = resolveWorkHrefFromPath(entry.path);

      if (fromPath) {
        return fromPath;
      }
    }

    if (typeof entry.slug === "string") {
      return buildWorkHrefFromSlug(entry.slug);
    }

    return null;
  }

  /**
   * @param {unknown} imageValue
   * @returns {string | null}
   */
  function resolveFeaturedImageSrc(imageValue) {
    if (typeof imageValue !== "string") {
      return null;
    }

    const trimmed = imageValue.trim();

    if (!trimmed) {
      return null;
    }

    const lower = trimmed.toLowerCase();

    if (
      lower.startsWith("data:") ||
      lower.startsWith("blob:") ||
      lower.startsWith("javascript:") ||
      lower.startsWith("http:") ||
      lower.startsWith("https:") ||
      lower.startsWith("//")
    ) {
      return null;
    }

    if (trimmed.includes("..") || trimmed.includes("\\") || trimmed.includes(":")) {
      return null;
    }

    if (trimmed.startsWith("/images/") || trimmed.startsWith("images/")) {
      return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    }

    return null;
  }

  /**
   * @param {unknown} producedAt
   * @returns {{ datetime: string, label: string } | null}
   */
  function resolveProducedAt(producedAt) {
    if (typeof producedAt !== "string") {
      return null;
    }

    const trimmed = producedAt.trim();
    const match = DATE_PATTERN.exec(trimmed);

    if (!match) {
      return null;
    }

    return {
      datetime: trimmed,
      label: `${match[1]}.${match[2]}.${match[3]}`,
    };
  }

  /**
   * @param {unknown} entry
   * @returns {{
   *   title: string,
   *   href: string,
   *   category: string,
   *   summary: string,
   *   imageSrc: string | null,
   *   producedAt: { datetime: string, label: string } | null
   * } | null}
   */
  function normalizeWorkEntry(entry) {
    if (!entry || typeof entry !== "object") {
      return null;
    }

    const raw = /** @type {Record<string, unknown>} */ (entry);
    const title = typeof raw.title === "string" ? raw.title.trim() : "";

    if (!title) {
      return null;
    }

    const href = resolveWorkHref(raw);

    if (!href) {
      return null;
    }

    const category = typeof raw.category === "string" ? raw.category.trim() : "";
    const summary = typeof raw.summary === "string" ? raw.summary.trim() : "";

    return {
      title,
      href,
      category,
      summary,
      imageSrc: resolveFeaturedImageSrc(raw.featuredImage),
      producedAt: resolveProducedAt(raw.producedAt),
    };
  }

  /**
   * @param {ReturnType<typeof normalizeWorkEntry>} work
   * @returns {HTMLLIElement | null}
   */
  function createWorkItem(work) {
    if (!work) {
      return null;
    }

    const li = document.createElement("li");
    li.className = "works-list-item";

    const link = document.createElement("a");
    link.className = "works-list-card";
    link.href = work.href;

    if (work.imageSrc) {
      const visual = document.createElement("div");
      visual.className = "works-list-visual";

      const img = document.createElement("img");
      img.className = "works-list-image";
      img.src = work.imageSrc;
      img.alt = `${work.title}の制作実績画像`;
      img.loading = "lazy";
      img.decoding = "async";

      visual.appendChild(img);
      link.appendChild(visual);
    }

    const body = document.createElement("div");
    body.className = "works-list-body";

    if (work.category || work.producedAt) {
      const meta = document.createElement("div");
      meta.className = "works-list-meta";

      if (work.category) {
        const categoryEl = document.createElement("span");
        categoryEl.className = "works-list-category";
        categoryEl.textContent = work.category;
        meta.appendChild(categoryEl);
      }

      if (work.producedAt) {
        const timeEl = document.createElement("time");
        timeEl.className = "works-list-date";
        timeEl.dateTime = work.producedAt.datetime;
        timeEl.textContent = work.producedAt.label;
        meta.appendChild(timeEl);
      }

      body.appendChild(meta);
    }

    const titleEl = document.createElement("h2");
    titleEl.className = "works-list-title";
    titleEl.textContent = work.title;
    body.appendChild(titleEl);

    if (work.summary) {
      const summaryEl = document.createElement("p");
      summaryEl.className = "works-list-summary";
      summaryEl.textContent = work.summary;
      body.appendChild(summaryEl);
    }

    const cue = document.createElement("span");
    cue.className = "works-list-cue";
    cue.textContent = DETAIL_CUE;
    body.appendChild(cue);

    link.appendChild(body);
    li.appendChild(link);

    return li;
  }

  /**
   * @param {unknown} data
   * @returns {{ ok: true, rawCount: number, works: NonNullable<ReturnType<typeof normalizeWorkEntry>>[] } | { ok: false }}
   */
  function parseWorksIndex(data) {
    if (!Array.isArray(data)) {
      return { ok: false };
    }

    /** @type {NonNullable<ReturnType<typeof normalizeWorkEntry>>[]} */
    const works = [];

    data.forEach((entry, index) => {
      const normalized = normalizeWorkEntry(entry);

      if (normalized) {
        works.push(normalized);
        return;
      }

      console.warn("[works-list] skipped invalid works-index entry", index, entry);
    });

    return {
      ok: true,
      rawCount: data.length,
      works,
    };
  }

  /**
   * @param {NonNullable<ReturnType<typeof normalizeWorkEntry>>[]} works
   */
  function renderWorks(works) {
    listEl.innerHTML = "";

    works.forEach((work) => {
      const item = createWorkItem(work);

      if (item) {
        listEl.appendChild(item);
      }
    });

    showList();
  }

  async function init() {
    showMessage(LOADING_MESSAGE);

    try {
      const response = await fetch(getWorksIndexUrl(), { cache: "no-cache" });

      if (!response.ok) {
        showMessage(ERROR_MESSAGE);
        return;
      }

      let data;

      try {
        data = await response.json();
      } catch (error) {
        console.error("[works-list] failed to parse works-index.json", error);
        showMessage(ERROR_MESSAGE);
        return;
      }

      const parsed = parseWorksIndex(data);

      if (!parsed.ok) {
        showMessage(ERROR_MESSAGE);
        return;
      }

      if (parsed.rawCount === 0) {
        showMessage(EMPTY_MESSAGE);
        return;
      }

      if (parsed.works.length === 0) {
        showMessage(ERROR_MESSAGE);
        return;
      }

      renderWorks(parsed.works);
    } catch (error) {
      console.error("[works-list] failed to load works-index.json", error);
      showMessage(ERROR_MESSAGE);
    }
  }

  init();
})();
