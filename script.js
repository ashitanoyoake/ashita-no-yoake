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
 * CMS生成の記事詳細にも script.js だけが載るため、
 * 右カラムの案内文を記事カテゴリーボタンへ置き換える。
 */
function enhanceBlogPostSidebarCategoryWhenReady() {
  const article = document.querySelector(".blog-post");
  const categoryEl = article && article.querySelector(".blog-post-category");
  const widget = document.querySelector(".blog-widget-categories");

  if (!article || !categoryEl || !widget) {
    return;
  }

  const tryEnhance = () => {
    if (!window.BlogPostCategory) {
      return false;
    }

    return window.BlogPostCategory.enhanceBlogPostSidebarCategory();
  };

  const watchCategory = () => {
    if (tryEnhance()) {
      return;
    }

    const observer = new MutationObserver(() => {
      if (tryEnhance()) {
        observer.disconnect();
      }
    });

    observer.observe(categoryEl, { childList: true, characterData: true, subtree: true });
  };

  if (window.BlogPostCategory) {
    watchCategory();
    return;
  }

  const script = document.createElement("script");
  script.src = "/js/blog-post-category.js";
  script.onload = watchCategory;
  document.body.appendChild(script);
}

enhanceBlogPostSidebarCategoryWhenReady();

