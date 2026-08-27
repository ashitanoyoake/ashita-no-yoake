/**
 * ブログ個別記事ページ
 * posts-index.json で post parameter を検証してから Markdown を表示する。
 */
(function () {
  const root = document.querySelector("[data-blog-post-root]");
  if (!root || !window.BlogCommon) return;

  const {
    DEFAULT_CATEGORY,
    formatPublishDate,
    resolvePostDetailThumbnailUrl,
    resolveContentImageUrl,
    getCategoryLabel,
    parsePostsIndex,
    resolvePostHref,
    getPostsIndexUrl,
    getPostMarkdownUrl,
    isAllowedPostParameter,
  } = window.BlogCommon;

  const articleEl = root.querySelector(".blog-post");
  const messageEl = root.querySelector(".blog-post-message");
  const backLinkEl = root.querySelector(".blog-post-back-link");
  const dateEl = root.querySelector(".blog-post-date");
  const categoryEl = root.querySelector(".blog-post-category");
  const titleEl = root.querySelector(".blog-post-title");
  const tagsEl = root.querySelector(".blog-post-tags");
  const thumbEl = root.querySelector(".blog-post-thumb");
  const bodyEl = root.querySelector(".blog-post-body");
  const recentListEl = document.querySelector(".blog-recent-list");
  const metaDescriptionEl = document.querySelector('meta[name="description"]');

  if (!articleEl || !messageEl || !bodyEl) return;

  const LOADING_MESSAGE = "読み込み中...";
  const NOT_FOUND_MESSAGE = "記事が見つかりませんでした。";
  const ERROR_MESSAGE = "記事を表示できませんでした。";
  const SITE_TITLE_SUFFIX = " | ブログ | あしたの夜明け.com";

  /**
   * @param {string} text
   */
  function showMessage(text) {
    articleEl.hidden = true;
    messageEl.textContent = text;
    messageEl.removeAttribute("hidden");
  }

  function showArticle() {
    messageEl.setAttribute("hidden", "");
    articleEl.removeAttribute("hidden");
  }

  /**
   * @param {string} markdown
   * @returns {{ frontmatter: Record<string, unknown>, body: string } | null}
   */
  function parseFrontmatter(markdown) {
    if (!markdown.startsWith("---")) {
      return null;
    }

    const endIndex = markdown.indexOf("\n---", 3);

    if (endIndex === -1) {
      return null;
    }

    const frontmatterText = markdown.slice(3, endIndex).trim();
    const body = markdown.slice(endIndex + 4).replace(/^\n/, "");
    const frontmatter = parseFrontmatterFields(frontmatterText);

    if (!frontmatter) {
      return null;
    }

    return { frontmatter, body };
  }

  /**
   * @param {string} text
   * @returns {Record<string, unknown> | null}
   */
  function parseFrontmatterFields(text) {
    /** @type {Record<string, unknown>} */
    const result = { tags: [] };
    let inTags = false;

    for (const rawLine of text.split("\n")) {
      const line = rawLine.trimEnd();

      if (line === "tags: []") {
        result.tags = [];
        inTags = false;
        continue;
      }

      if (line === "tags:") {
        inTags = true;
        result.tags = [];
        continue;
      }

      if (inTags) {
        const tagMatch = /^\s*-\s*(.+)$/.exec(rawLine);

        if (tagMatch) {
          try {
            result.tags.push(JSON.parse(tagMatch[1].trim()));
          } catch {
            return null;
          }
          continue;
        }

        inTags = false;
      }

      const keyValueMatch = /^([a-zA-Z]+):\s*(.+)$/.exec(line);

      if (!keyValueMatch) {
        return null;
      }

      inTags = false;

      try {
        result[keyValueMatch[1]] = JSON.parse(keyValueMatch[2].trim());
      } catch {
        return null;
      }
    }

    return result;
  }

  /**
   * @param {string} value
   * @returns {string}
   */
  function unescapeMarkdownAlt(value) {
    return value.replace(/\\([\\[\]])/g, "$1");
  }

  /**
   * @param {string} value
   * @returns {string}
   */
  function unescapeMarkdownLinkDestination(value) {
    return value.replace(/\\([\\()])/g, "$1");
  }

  /**
   * @param {string} body
   * @returns {Array<{ type: string, text?: string, lines?: string[], alt?: string, url?: string }>}
   */
  function parseBodyBlocks(body) {
    const trimmed = body.trim();

    if (!trimmed) {
      return [];
    }

    return trimmed.split(/\n\n+/).map((chunk) => {
      if (chunk.startsWith("## ")) {
        return { type: "heading", text: chunk.slice(3) };
      }

      if (chunk.startsWith(">")) {
        const lines = chunk
          .split("\n")
          .map((line) => line.replace(/^>\s?/, ""));
        return { type: "quote", lines };
      }

      const imageMatch = /^!\[(.*)\]\((.*)\)$/s.exec(chunk);

      if (imageMatch) {
        return {
          type: "image",
          alt: unescapeMarkdownAlt(imageMatch[1]),
          url: unescapeMarkdownLinkDestination(imageMatch[2]),
        };
      }

      return { type: "paragraph", text: chunk };
    });
  }

  /**
   * @param {string} body
   * @param {HTMLElement} container
   */
  function renderMarkdownBody(body, container) {
    container.replaceChildren();
    const blocks = parseBodyBlocks(body);

    blocks.forEach((block) => {
      if (block.type === "heading" && block.text !== undefined) {
        const heading = document.createElement("h2");
        heading.textContent = block.text;
        container.appendChild(heading);
        return;
      }

      if (block.type === "quote" && block.lines) {
        const quote = document.createElement("blockquote");

        block.lines.forEach((line) => {
          const paragraph = document.createElement("p");
          paragraph.textContent = line;
          quote.appendChild(paragraph);
        });

        container.appendChild(quote);
        return;
      }

      if (block.type === "image" && block.url !== undefined) {
        const resolvedUrl = resolveContentImageUrl(block.url);

        if (!resolvedUrl) {
          return;
        }

        const figure = document.createElement("figure");
        figure.className = "blog-post-figure";
        const image = document.createElement("img");
        image.src = resolvedUrl;
        image.alt = block.alt || "";
        image.loading = "lazy";
        image.decoding = "async";
        figure.appendChild(image);
        container.appendChild(figure);
        return;
      }

      if (block.type === "paragraph" && block.text !== undefined) {
        const paragraph = document.createElement("p");
        paragraph.textContent = block.text;
        container.appendChild(paragraph);
      }
    });
  }

  /**
   * @param {string[]} tags
   * @param {HTMLElement} container
   */
  function renderTags(tags, container) {
    container.replaceChildren();

    if (!Array.isArray(tags) || tags.length === 0) {
      container.hidden = true;
      return;
    }

    tags.forEach((tag) => {
      if (typeof tag !== "string" || !tag.trim()) {
        return;
      }

      const item = document.createElement("li");
      item.className = "blog-post-tag";
      item.textContent = tag;
      container.appendChild(item);
    });

    container.hidden = container.children.length === 0;
  }

  /**
   * @param {string} title
   * @param {string} bodyText
   */
  function updateSeo(title, bodyText) {
    document.title = `${title}${SITE_TITLE_SUFFIX}`;

    if (!metaDescriptionEl) {
      return;
    }

    const excerpt = bodyText.replace(/\s+/g, " ").trim().slice(0, 120);
    metaDescriptionEl.setAttribute(
      "content",
      excerpt ? `${title} — ${excerpt}` : `${title} — あしたの夜明け.com`
    );
  }

  /**
   * @param {Array<{ title: string, publishDate: string, markdownPath: string }>} items
   * @param {string} currentMarkdownPath
   */
  function renderRecentPosts(items, currentMarkdownPath) {
    if (!recentListEl) return;

    recentListEl.replaceChildren();
    const recentItems = items
      .filter((post) => post.markdownPath !== currentMarkdownPath)
      .slice(0, 3);

    if (recentItems.length === 0) {
      const item = document.createElement("li");
      item.className = "blog-recent-empty";
      item.textContent = "他の記事はありません。";
      recentListEl.appendChild(item);
      return;
    }

    recentItems.forEach((post) => {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = resolvePostHref(post);
      link.className = "blog-recent-link";
      link.textContent = post.title;

      const time = document.createElement("time");
      time.className = "blog-recent-date";
      time.dateTime = post.publishDate.trim();
      time.textContent = formatPublishDate(post.publishDate);

      item.appendChild(link);
      item.appendChild(time);
      recentListEl.appendChild(item);
    });
  }

  /**
   * @param {ReturnType<typeof parsePostsIndex>[number]} indexEntry
   * @param {Record<string, unknown>} frontmatter
   * @param {string} body
   */
  function renderArticle(indexEntry, frontmatter, body) {
    const title =
      typeof frontmatter.title === "string" && frontmatter.title.trim()
        ? frontmatter.title
        : indexEntry.title;
    const publishDate =
      typeof frontmatter.publishDate === "string" && frontmatter.publishDate.trim()
        ? frontmatter.publishDate
        : indexEntry.publishDate;
    const category =
      typeof frontmatter.category === "string"
        ? getCategoryLabel(frontmatter.category)
        : getCategoryLabel(indexEntry.category);
    const tags = Array.isArray(frontmatter.tags)
      ? frontmatter.tags.filter((tag) => typeof tag === "string")
      : Array.isArray(indexEntry.tags)
        ? indexEntry.tags
        : [];
    const thumbnail =
      typeof frontmatter.thumbnail === "string" && frontmatter.thumbnail.trim()
        ? frontmatter.thumbnail.trim()
        : typeof indexEntry.thumbnail === "string" && indexEntry.thumbnail.trim()
          ? indexEntry.thumbnail.trim()
          : "";
    const thumbnailUrl = resolvePostDetailThumbnailUrl(thumbnail);

    if (backLinkEl) {
      backLinkEl.href = "blog.html";
      backLinkEl.textContent = "← ブログ一覧へ戻る";
    }

    if (dateEl) {
      dateEl.dateTime = publishDate.trim();
      dateEl.textContent = formatPublishDate(publishDate);
    }

    if (categoryEl) {
      categoryEl.textContent = category;
    }

    if (titleEl) {
      titleEl.textContent = title;
    }

    if (tagsEl) {
      renderTags(tags, tagsEl);
    }

    if (thumbEl) {
      if (thumbnailUrl) {
        thumbEl.src = thumbnailUrl;
        thumbEl.alt = "";
        thumbEl.removeAttribute("hidden");
      } else {
        thumbEl.removeAttribute("src");
        thumbEl.alt = "";
        thumbEl.hidden = true;
      }
    }

    renderMarkdownBody(body, bodyEl);
    updateSeo(title, body);
    showArticle();
  }

  async function init() {
    showMessage(LOADING_MESSAGE);

    const postParam = new URLSearchParams(window.location.search).get("post");

    if (!postParam || !isAllowedPostParameter(postParam)) {
      showMessage(NOT_FOUND_MESSAGE);
      return;
    }

    try {
      const indexResponse = await fetch(getPostsIndexUrl(), { cache: "no-cache" });

      if (!indexResponse.ok) {
        showMessage(ERROR_MESSAGE);
        return;
      }

      const indexData = await indexResponse.json();
      const posts = parsePostsIndex(indexData);

      if (posts === null) {
        showMessage(ERROR_MESSAGE);
        return;
      }

      const indexEntry = posts.find((post) => post.markdownPath === postParam);

      if (!indexEntry) {
        showMessage(NOT_FOUND_MESSAGE);
        return;
      }

      renderRecentPosts(posts, indexEntry.markdownPath);

      const markdownResponse = await fetch(getPostMarkdownUrl(indexEntry.markdownPath), {
        cache: "no-cache",
      });

      if (!markdownResponse.ok) {
        showMessage(ERROR_MESSAGE);
        return;
      }

      const markdown = await markdownResponse.text();
      const parsed = parseFrontmatter(markdown);

      if (!parsed) {
        showMessage(ERROR_MESSAGE);
        return;
      }

      renderArticle(indexEntry, parsed.frontmatter, parsed.body);
    } catch {
      showMessage(ERROR_MESSAGE);
    }
  }

  init();
})();
