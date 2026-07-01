/**
 * Instagram ギャラリー表示・モーダル（ライトボックス）
 * data/instagram.json を読み込んで表示する。
 */
(function () {
  const galleryRoot = document.querySelector("[data-instagram-gallery]");
  if (!galleryRoot) return;

  const gridEl = galleryRoot.querySelector(".instagram-gallery");
  const messageEl = galleryRoot.querySelector(".instagram-gallery-message");
  const modalEl = document.querySelector(".instagram-modal");

  if (!gridEl || !messageEl) return;

  const DATA_URL = new URL("data/instagram.json", window.location.href).href;
  const LOADING_MESSAGE = "読み込み中...";
  const EMPTY_MESSAGE = "現在投稿を読み込めません。";

  /** @type {Array<{id: string, media_url: string, permalink: string, media_type: string, thumbnail_url: string | null, timestamp: string}>} */
  let posts = [];
  let currentIndex = 0;
  /** @type {HTMLElement | null} */
  let lastFocusedElement = null;

  const modalParts = modalEl
    ? {
        closeBtn: modalEl.querySelector(".instagram-modal-close"),
        prevBtn: modalEl.querySelector(".instagram-modal-prev"),
        nextBtn: modalEl.querySelector(".instagram-modal-next"),
        image: modalEl.querySelector(".instagram-modal-image"),
        link: modalEl.querySelector(".instagram-modal-link"),
        focusable: () =>
          /** @type {HTMLElement[]} */ (
            Array.from(
              modalEl.querySelectorAll(
                'button, a[href], [tabindex]:not([tabindex="-1"])'
              )
            )
          ),
      }
    : null;

  /**
   * @param {string} timestamp
   * @returns {string}
   */
  function formatDateForAlt(timestamp) {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      return "Instagram投稿";
    }
    return `Instagram投稿（${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日）`;
  }

  function showMessage(text) {
    gridEl.innerHTML = "";
    gridEl.setAttribute("hidden", "");
    messageEl.textContent = text || EMPTY_MESSAGE;
    messageEl.removeAttribute("hidden");
  }

  function showGallery() {
    messageEl.setAttribute("hidden", "");
    gridEl.removeAttribute("hidden");
  }

  /**
   * @param {typeof posts} items
   */
  function renderGallery(items) {
    gridEl.innerHTML = "";

    items.forEach((post, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "instagram-gallery-item";
      button.dataset.index = String(index);
      button.setAttribute("aria-label", `${formatDateForAlt(post.timestamp)}を拡大表示`);

      const img = document.createElement("img");
      img.src = post.media_url;
      img.alt = formatDateForAlt(post.timestamp);
      img.loading = "lazy";
      img.referrerPolicy = "no-referrer";
      img.width = 400;
      img.height = 400;

      button.appendChild(img);
      gridEl.appendChild(button);
    });

    showGallery();
  }

  /**
   * @param {number} index
   */
  function updateModal(index) {
    if (!modalParts || !posts[index]) return;

    currentIndex = index;
    const post = posts[index];

    modalParts.image.src = post.media_url;
    modalParts.image.alt = formatDateForAlt(post.timestamp);
    modalParts.link.href = post.permalink;

    const hasPrev = index > 0;
    const hasNext = index < posts.length - 1;

    modalParts.prevBtn.disabled = !hasPrev;
    modalParts.nextBtn.disabled = !hasNext;
    modalParts.prevBtn.hidden = posts.length <= 1;
    modalParts.nextBtn.hidden = posts.length <= 1;
  }

  function openModal(index) {
    if (!modalEl || !modalParts || !posts[index]) return;

    lastFocusedElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    updateModal(index);
    modalEl.hidden = false;
    modalEl.classList.add("is-open");
    document.body.classList.add("instagram-modal-open");

    modalParts.closeBtn.focus();
  }

  function closeModal() {
    if (!modalEl) return;

    modalEl.hidden = true;
    modalEl.classList.remove("is-open");
    document.body.classList.remove("instagram-modal-open");

    if (lastFocusedElement) {
      lastFocusedElement.focus();
      lastFocusedElement = null;
    }
  }

  /**
   * @param {number} delta
   */
  function moveModal(delta) {
    const nextIndex = currentIndex + delta;
    if (nextIndex < 0 || nextIndex >= posts.length) return;
    updateModal(nextIndex);
  }

  function trapFocus(event) {
    if (!modalEl || modalEl.hidden || !modalParts) return;

    const focusable = modalParts.focusable();
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.key === "Tab") {
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  function bindModalEvents() {
    if (!modalEl || !modalParts) return;

    modalEl.addEventListener("click", (event) => {
      if (event.target === modalEl) {
        closeModal();
      }
    });

    modalParts.closeBtn.addEventListener("click", closeModal);
    modalParts.prevBtn.addEventListener("click", () => moveModal(-1));
    modalParts.nextBtn.addEventListener("click", () => moveModal(1));

    document.addEventListener("keydown", (event) => {
      if (modalEl.hidden) return;

      if (event.key === "Escape") {
        event.preventDefault();
        closeModal();
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveModal(-1);
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        moveModal(1);
        return;
      }

      trapFocus(event);
    });
  }

  function bindGalleryEvents() {
    gridEl.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const button = target.closest(".instagram-gallery-item");
      if (!button || !button.dataset.index) return;

      openModal(Number(button.dataset.index));
    });
  }

  async function init() {
    bindGalleryEvents();
    bindModalEvents();
    showMessage(LOADING_MESSAGE);

    try {
      const response = await fetch(DATA_URL, { cache: "no-cache" });
      if (!response.ok) {
        showMessage(EMPTY_MESSAGE);
        return;
      }

      const data = await response.json();
      if (!Array.isArray(data.posts) || data.posts.length === 0) {
        showMessage(EMPTY_MESSAGE);
        return;
      }

      posts = data.posts.filter(
        (post) => post && post.media_url && post.permalink
      );

      if (posts.length === 0) {
        showMessage(EMPTY_MESSAGE);
        return;
      }

      renderGallery(posts.slice(0, 9));
    } catch {
      showMessage(EMPTY_MESSAGE);
    }
  }

  init();
})();
