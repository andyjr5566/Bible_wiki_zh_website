const STORAGE_KEY = "wikiTourCompleted";
const TOUR_TEXT = [
  {
    title: "開始閱讀",
    text: "先選一卷書，從一章經文開始。左側的探索欄可以快速找到各卷與各章目錄。",
    target: "body",
  },
  {
    title: "搜尋主題",
    text: "按 Ctrl/⌘ + K 開啟搜尋面板，輸入關鍵字（例如「摩西」「逾越節」「神的榮耀」），支援全文、標籤與語意搜尋。",
    target: ".search-button",
  },
  {
    title: "追蹤連結與反向脈絡",
    text: "點擊內文的藍色 wiki-link 可以無縫跳轉，右側 Backlinks 能看見哪些章節連到當前條目，串起完整的知識網絡。",
    target: ".backlinks",
  },
  {
    title: "深入研究與來源依據",
    text: "每個章節與條目底部都有嚴謹的「來源依據」（CT/GT/KC/BH/STEP），可點擊原始連結回溯查證或研讀原文。",
    target: ".content-meta",
  },
];

function shouldStartTour(): boolean {
  const completed = localStorage.getItem(STORAGE_KEY);
  return completed !== "1";
}

function markComplete(): void {
  localStorage.setItem(STORAGE_KEY, "1");
}

function clearHighlight(): void {
  document.querySelectorAll(".wiki-tour-highlight").forEach((el) => {
    el.classList.remove("wiki-tour-highlight");
  });
}

function highlightTarget(selector: string): void {
  clearHighlight();
  if (selector === "body") return;

  const el = document.querySelector(selector);
  if (el) {
    el.classList.add("wiki-tour-highlight");
    el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }
}

function buildOverlay() {
  const existing = document.querySelector(".wiki-tour-overlay");
  if (existing) existing.remove();

  const root = document.createElement("div");
  root.className = "wiki-tour-overlay";
  root.innerHTML = `
    <div class="wiki-tour-backdrop"></div>
    <div class="wiki-tour-card" role="dialog" aria-modal="true">
      <div class="wiki-tour-card-header">
        <span>🚀 快速入門導覽</span>
        <button type="button" class="wiki-tour-close" aria-label="關閉">✕</button>
      </div>
      <h3 class="wiki-tour-title"></h3>
      <p class="wiki-tour-text"></p>
      <div class="wiki-tour-actions">
        <button type="button" class="wiki-tour-prev">上一步</button>
        <button type="button" class="wiki-tour-next">下一步</button>
      </div>
    </div>
  `;

  const closeButton = root.querySelector(".wiki-tour-close") as HTMLButtonElement;
  const prevButton = root.querySelector(".wiki-tour-prev") as HTMLButtonElement;
  const nextButton = root.querySelector(".wiki-tour-next") as HTMLButtonElement;
  const titleEl = root.querySelector(".wiki-tour-title") as HTMLElement;
  const textEl = root.querySelector(".wiki-tour-text") as HTMLElement;
  const card = root.querySelector(".wiki-tour-card") as HTMLElement;

  card.style.position = "fixed";
  card.style.left = "50%";
  card.style.top = "50%";
  card.style.transform = "translate(-50%, -50%)";

  let step = 0;

  const closeTour = () => {
    clearHighlight();
    markComplete();
    root.remove();
  };

  const render = () => {
    const item = TOUR_TEXT[step];
    titleEl.textContent = item.title;
    textEl.textContent = item.text;

    prevButton.disabled = step === 0;
    nextButton.textContent = step === TOUR_TEXT.length - 1 ? "開始使用" : "下一步";

    highlightTarget(item.target);
  };

  prevButton.addEventListener("click", () => {
    if (step > 0) {
      step -= 1;
      render();
    }
  });

  nextButton.addEventListener("click", () => {
    if (step < TOUR_TEXT.length - 1) {
      step += 1;
      render();
      return;
    }

    closeTour();
  });

  closeButton.addEventListener("click", closeTour);

  const keydownHandler = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      document.removeEventListener("keydown", keydownHandler);
      closeTour();
    }
  };
  document.addEventListener("keydown", keydownHandler);

  render();
  document.body.appendChild(root);
}

function bindOpenButton() {
  const buttons = document.querySelectorAll("[data-tour-open='true']");
  buttons.forEach((btn) => {
    btn.removeEventListener("click", onOpenClick);
    btn.addEventListener("click", onOpenClick);
  });
}

function onOpenClick() {
  localStorage.removeItem(STORAGE_KEY);
  buildOverlay();
}

function bindHelpHotkey() {
  document.addEventListener("keydown", (event) => {
    // Focus guard: do not trigger when user is typing in form inputs
    const target = event.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable)
    ) {
      return;
    }

    // On standard keyboards '?' requires Shift, so event.shiftKey is true.
    // Disallow Ctrl, Alt, and Meta to prevent interfering with OS/browser shortcuts.
    if (event.key === "?" && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const overlay = document.querySelector(".wiki-tour-overlay");
      if (!overlay) {
        buildOverlay();
      }
    }
  });
}

function findBannerTarget(): HTMLElement {
  return (
    (document.querySelector(".center .page-header") as HTMLElement | null) ??
    (document.querySelector("article") as HTMLElement | null) ??
    (document.querySelector("main") as HTMLElement | null) ??
    (document.querySelector(".center") as HTMLElement | null) ??
    document.body
  );
}

function initTour() {
  if (!shouldStartTour()) return;
  if (document.querySelector(".wiki-tour-banner")) return;

  const banner = document.createElement("div");
  banner.className = "wiki-tour-banner";
  banner.innerHTML = `
    <div class="wiki-tour-banner-content">
      <strong>🚀 第一次來嗎？</strong>
      <span>先看 30 秒快速導覽，了解如何搜尋、跳轉與追蹤主題。</span>
    </div>
    <div class="wiki-tour-banner-actions">
      <button type="button" class="wiki-tour-banner-button">開始導覽</button>
      <button type="button" class="wiki-tour-banner-close" aria-label="關閉提示">✕</button>
    </div>
  `;

  const target = findBannerTarget();
  target.prepend(banner);

  banner.querySelector(".wiki-tour-banner-button")?.addEventListener("click", () => {
    banner.remove();
    buildOverlay();
  });

  banner.querySelector(".wiki-tour-banner-close")?.addEventListener("click", () => {
    markComplete();
    banner.remove();
  });
}

let hotkeyBound = false;

function setup() {
  bindOpenButton();
  if (!hotkeyBound) {
    bindHelpHotkey();
    hotkeyBound = true;
  }
  initTour();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setup);
} else {
  setup();
}

// Quartz SPA navigation support
document.addEventListener("nav", () => {
  bindOpenButton();
  initTour();
});
