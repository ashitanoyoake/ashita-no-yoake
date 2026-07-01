/**
 * スマホ用ナビゲーションメニューの開閉
 */
const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");

if (navToggle && siteNav) {
  navToggle.addEventListener("click", () => {
    const isOpen = siteNav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
    navToggle.setAttribute(
      "aria-label",
      isOpen ? "メニューを閉じる" : "メニューを開く"
    );
  });
}

/**
 * ページトップへ戻るボタン
 */
const pageTopButton = document.querySelector(".page-top-button");
const SCROLL_THRESHOLD = 300;

if (pageTopButton) {
  const updatePageTopButton = () => {
    pageTopButton.classList.toggle("is-visible", window.scrollY > SCROLL_THRESHOLD);
  };

  window.addEventListener("scroll", updatePageTopButton, { passive: true });
  updatePageTopButton();

  pageTopButton.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}
