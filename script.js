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

/**
 * ブログ：カテゴリ絞り込み
 */
const blogList = document.querySelector(".blog-list");
const blogCategoryButtons = document.querySelectorAll(".blog-category-button");

if (blogList && blogCategoryButtons.length > 0) {
  const blogItems = blogList.querySelectorAll(".blog-item");

  const filterBlogItems = (filter) => {
    blogItems.forEach((item) => {
      const category = item.dataset.category;
      const isVisible = filter === "all" || category === filter;
      item.classList.toggle("is-hidden", !isVisible);
    });
  };

  blogCategoryButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const filter = button.dataset.filter;
      if (!filter) return;

      blogCategoryButtons.forEach((btn) => {
        btn.classList.remove("is-active");
      });
      button.classList.add("is-active");
      filterBlogItems(filter);
    });
  });
}
