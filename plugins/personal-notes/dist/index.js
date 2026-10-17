import { promises, existsSync, readFileSync } from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';

// src/index.ts

// src/components/scripts/boot.inline.ts
var boot_inline_default = 'var e=window;function p(){let t=document.querySelector("[data-bwz-notes]");if(t){if(!e.__bwzNotesApp){let o=document.body.dataset.basepath??"",n=t.dataset.bwzVersion??"0",s=`${o}/static/personal-notes/app.js?v=${encodeURIComponent(n)}`;e.__bwzNotesApp=import(s)}e.__bwzNotesApp.then(o=>o.mountAll()).catch(o=>{console.error("[personal-notes] \\u8F09\\u5165\\u5931\\u6557",o),t.textContent="\\u7B46\\u8A18\\u529F\\u80FD\\u8F09\\u5165\\u5931\\u6557\\uFF0C\\u8ACB\\u91CD\\u65B0\\u6574\\u7406\\u9801\\u9762\\u3002"})}}e.__bwzNotesBooted||(e.__bwzNotesBooted=!0,document.addEventListener("nav",p));\n';

// src/components/styles/notes.scss
var notes_default = ".bwz-notes,\n.bwz-notes-page {\n  margin-top: 2.5rem;\n  scroll-margin-top: 1rem;\n}\n\n.bwz-notes {\n  border-top: 1px solid var(--lightgray);\n  padding-top: 1rem;\n}\n\n.bwz-n-head {\n  display: flex;\n  align-items: baseline;\n  justify-content: space-between;\n  gap: 1rem;\n  flex-wrap: wrap;\n}\n.bwz-n-head h2 {\n  margin: 0;\n}\n\n.bwz-n-count {\n  font-size: 0.85em;\n  color: var(--gray);\n  margin-left: 0.25rem;\n}\n\n.bwz-n-link {\n  font-size: 0.9rem;\n}\n\n.bwz-n-status {\n  display: flex;\n  align-items: center;\n  flex-wrap: wrap;\n  gap: 0.5rem;\n  margin: 0.75rem 0;\n  padding: 0.5rem 0.75rem;\n  border-radius: 8px;\n  background: var(--highlight);\n  font-size: 0.9rem;\n}\n\n.bwz-n-status-text {\n  flex: 1 1 auto;\n}\n\n.bwz-n-status-actions {\n  display: inline-flex;\n  gap: 0.4rem;\n}\n\n.bwz-n-account {\n  color: var(--darkgray);\n  font-size: 0.85rem;\n}\n\n.bwz-n-dot {\n  width: 0.6rem;\n  height: 0.6rem;\n  border-radius: 50%;\n  background: var(--gray);\n  flex: none;\n}\n.bwz-n-dot.ok {\n  background: #16a34a;\n}\n.bwz-n-dot.busy {\n  background: var(--tertiary);\n}\n.bwz-n-dot.warn {\n  background: #d97706;\n}\n.bwz-n-dot.bad {\n  background: #dc2626;\n}\n\n.bwz-n-btn {\n  font: inherit;\n  font-size: 0.9rem;\n  padding: 0.4rem 0.9rem;\n  border-radius: 8px;\n  border: 1px solid var(--secondary);\n  background: transparent;\n  color: var(--secondary);\n  cursor: pointer;\n  line-height: 1.4;\n}\n.bwz-n-btn:hover {\n  background: var(--highlight);\n}\n.bwz-n-btn.primary {\n  background: var(--secondary);\n  color: var(--light);\n}\n.bwz-n-btn.danger {\n  border-color: #dc2626;\n  color: #dc2626;\n}\n.bwz-n-btn.small {\n  font-size: 0.82rem;\n  padding: 0.25rem 0.65rem;\n}\n.bwz-n-btn:disabled {\n  opacity: 0.5;\n  cursor: wait;\n}\n\n.bwz-n-toolbar {\n  margin: 0.5rem 0 1rem;\n}\n\n.bwz-n-list {\n  display: flex;\n  flex-direction: column;\n  gap: 0.75rem;\n}\n\n.bwz-n-card {\n  border: 1px solid var(--lightgray);\n  border-radius: 10px;\n  padding: 0.75rem 1rem;\n  background: var(--light);\n}\n.bwz-n-card.editing {\n  border-color: var(--secondary);\n  display: flex;\n  flex-direction: column;\n  gap: 0.5rem;\n  margin-bottom: 0.75rem;\n}\n.bwz-n-card.conflict {\n  border-color: #d97706;\n}\n\n.bwz-n-card-head {\n  display: flex;\n  align-items: baseline;\n  gap: 0.6rem;\n  flex-wrap: wrap;\n  margin-bottom: 0.35rem;\n}\n\n.bwz-n-verse {\n  font-size: 0.8rem;\n  color: var(--secondary);\n  border: 1px solid var(--lightgray);\n  border-radius: 999px;\n  padding: 0 0.5rem;\n}\n\n.bwz-n-time {\n  margin-left: auto;\n  font-size: 0.78rem;\n  color: var(--gray);\n}\n\n.bwz-n-body {\n  white-space: pre-wrap;\n  overflow-wrap: anywhere;\n  line-height: 1.7;\n}\n\n.bwz-n-tags {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 0.35rem;\n  margin-top: 0.4rem;\n}\n\n.bwz-n-tag {\n  font-size: 0.78rem;\n  color: var(--tertiary);\n}\n\n.bwz-n-card-actions {\n  display: flex;\n  align-items: center;\n  justify-content: flex-end;\n  gap: 0.5rem;\n  margin-top: 0.5rem;\n}\n.bwz-n-card-actions .bwz-n-muted {\n  margin-right: auto;\n}\n\n.bwz-n-versions {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));\n  gap: 0.75rem;\n  margin: 0.5rem 0;\n}\n\n.bwz-n-version {\n  border: 1px dashed var(--lightgray);\n  border-radius: 8px;\n  padding: 0.6rem;\n  display: flex;\n  flex-direction: column;\n  gap: 0.4rem;\n}\n\n.bwz-n-input,\n.bwz-n-textarea {\n  font: inherit;\n  width: 100%;\n  box-sizing: border-box;\n  padding: 0.45rem 0.6rem;\n  border: 1px solid var(--lightgray);\n  border-radius: 8px;\n  background: var(--light);\n  color: var(--dark);\n}\n.bwz-n-input.small,\n.bwz-n-textarea.small {\n  width: 4.5rem;\n}\n\n.bwz-n-textarea {\n  resize: vertical;\n  min-height: 8rem;\n  line-height: 1.7;\n}\n\n.bwz-n-row {\n  display: flex;\n  align-items: center;\n  flex-wrap: wrap;\n  gap: 0.5rem;\n}\n\n.bwz-n-label {\n  font-size: 0.85rem;\n  color: var(--darkgray);\n}\n\n.bwz-n-muted {\n  color: var(--gray);\n  font-size: 0.85rem;\n}\n\n.bwz-n-warn {\n  color: #b45309;\n  font-size: 0.9rem;\n}\n\n.bwz-n-tip {\n  font-size: 0.85rem;\n  color: var(--darkgray);\n  background: var(--highlight);\n  border-radius: 8px;\n  padding: 0.5rem 0.75rem;\n}\n\n.bwz-n-empty {\n  color: var(--gray);\n}\n\n.bwz-n-filters {\n  display: grid;\n  grid-template-columns: 1fr minmax(8rem, 14rem);\n  gap: 0.5rem;\n  margin: 1rem 0;\n}\n\n.bwz-n-group {\n  margin: 1.25rem 0 0.25rem;\n  font-size: 1.05rem;\n}\n\n.bwz-n-section {\n  margin-top: 2rem;\n  border-top: 1px solid var(--lightgray);\n  padding-top: 1rem;\n}\n\n.bwz-n-chip {\n  position: fixed;\n  left: 20px;\n  bottom: calc(20px + env(safe-area-inset-bottom, 0px));\n  z-index: 890;\n  font: inherit;\n  font-size: 0.85rem;\n  padding: 0.45rem 0.9rem;\n  border-radius: 999px;\n  border: 1px solid var(--lightgray);\n  background: var(--light);\n  color: var(--dark);\n  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);\n  cursor: pointer;\n}\n\n@media print {\n  .bwz-n-chip {\n    display: none;\n  }\n}\n.bwz-n-overlay {\n  position: fixed;\n  inset: 0;\n  z-index: 10500;\n  background: rgba(0, 0, 0, 0.45);\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  padding: 1rem;\n}\n\n.bwz-n-dialog {\n  background: var(--light);\n  color: var(--dark);\n  border-radius: 12px;\n  padding: 1.25rem;\n  max-width: 28rem;\n  width: 100%;\n  max-height: 85vh;\n  overflow: auto;\n  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);\n}\n.bwz-n-dialog h3 {\n  margin-top: 0;\n}\n.bwz-n-dialog p {\n  margin: 0.5rem 0;\n  line-height: 1.6;\n}\n\n.bwz-n-dialog-actions {\n  display: flex;\n  flex-wrap: wrap;\n  justify-content: flex-end;\n  gap: 0.5rem;\n  margin-top: 1rem;\n}\n\n.bwz-n-toast {\n  position: fixed;\n  left: 50%;\n  bottom: calc(80px + env(safe-area-inset-bottom, 0px));\n  transform: translateX(-50%) translateY(20px);\n  z-index: 10600;\n  background: var(--dark);\n  color: var(--light);\n  padding: 0.55rem 1rem;\n  border-radius: 999px;\n  font-size: 0.88rem;\n  opacity: 0;\n  pointer-events: none;\n  transition: opacity 0.2s, transform 0.2s;\n  max-width: calc(100vw - 2rem);\n}\n.bwz-n-toast.show {\n  opacity: 1;\n  transform: translateX(-50%) translateY(0);\n}";

// src/client/model/books.ts
var BOOKS = [
  { num: "01", name: "\u5275\u4E16\u8A18", code: "GEN", chapters: 50 },
  { num: "02", name: "\u51FA\u57C3\u53CA\u8A18", code: "EXO", chapters: 40 },
  { num: "03", name: "\u5229\u672A\u8A18", code: "LEV", chapters: 27 },
  { num: "04", name: "\u6C11\u6578\u8A18", code: "NUM", chapters: 36 },
  { num: "05", name: "\u7533\u547D\u8A18", code: "DEU", chapters: 34 },
  { num: "06", name: "\u7D04\u66F8\u4E9E\u8A18", code: "JOS", chapters: 24 },
  { num: "07", name: "\u58EB\u5E2B\u8A18", code: "JDG", chapters: 21 },
  { num: "08", name: "\u8DEF\u5F97\u8A18", code: "RUT", chapters: 4 },
  { num: "09", name: "\u6492\u6BCD\u8033\u8A18\u4E0A", code: "1SA", chapters: 31 },
  { num: "10", name: "\u6492\u6BCD\u8033\u8A18\u4E0B", code: "2SA", chapters: 24 },
  { num: "11", name: "\u5217\u738B\u7D00\u4E0A", code: "1KI", chapters: 22 },
  { num: "12", name: "\u5217\u738B\u7D00\u4E0B", code: "2KI", chapters: 25 },
  { num: "13", name: "\u6B77\u4EE3\u5FD7\u4E0A", code: "1CH", chapters: 29 },
  { num: "14", name: "\u6B77\u4EE3\u5FD7\u4E0B", code: "2CH", chapters: 36 },
  { num: "15", name: "\u4EE5\u65AF\u62C9\u8A18", code: "EZR", chapters: 10 },
  { num: "16", name: "\u5C3C\u5E0C\u7C73\u8A18", code: "NEH", chapters: 13 },
  { num: "17", name: "\u4EE5\u65AF\u5E16\u8A18", code: "EST", chapters: 10 },
  { num: "18", name: "\u7D04\u4F2F\u8A18", code: "JOB", chapters: 42 },
  { num: "19", name: "\u8A69\u7BC7", code: "PSA", chapters: 150 },
  { num: "20", name: "\u7BB4\u8A00", code: "PRO", chapters: 31 },
  { num: "21", name: "\u50B3\u9053\u66F8", code: "ECC", chapters: 12 },
  { num: "22", name: "\u96C5\u6B4C", code: "SNG", chapters: 8 },
  { num: "23", name: "\u4EE5\u8CFD\u4E9E\u66F8", code: "ISA", chapters: 66 },
  { num: "24", name: "\u8036\u5229\u7C73\u66F8", code: "JER", chapters: 52 },
  { num: "25", name: "\u8036\u5229\u7C73\u54C0\u6B4C", code: "LAM", chapters: 5 },
  { num: "26", name: "\u4EE5\u897F\u7D50\u66F8", code: "EZK", chapters: 48 },
  { num: "27", name: "\u4F46\u4EE5\u7406\u66F8", code: "DAN", chapters: 12 },
  { num: "28", name: "\u4F55\u897F\u963F\u66F8", code: "HOS", chapters: 14 },
  { num: "29", name: "\u7D04\u73E5\u66F8", code: "JOL", chapters: 3 },
  { num: "30", name: "\u963F\u6469\u53F8\u66F8", code: "AMO", chapters: 9 },
  { num: "31", name: "\u4FC4\u5DF4\u5E95\u4E9E\u66F8", code: "OBA", chapters: 1 },
  { num: "32", name: "\u7D04\u62FF\u66F8", code: "JON", chapters: 4 },
  { num: "33", name: "\u5F4C\u8FE6\u66F8", code: "MIC", chapters: 7 },
  { num: "34", name: "\u90A3\u9D3B\u66F8", code: "NAM", chapters: 3 },
  { num: "35", name: "\u54C8\u5DF4\u8C37\u66F8", code: "HAB", chapters: 3 },
  { num: "36", name: "\u897F\u756A\u96C5\u66F8", code: "ZEP", chapters: 3 },
  { num: "37", name: "\u54C8\u8A72\u66F8", code: "HAG", chapters: 2 },
  { num: "38", name: "\u6492\u8FE6\u5229\u4E9E\u66F8", code: "ZEC", chapters: 14 },
  { num: "39", name: "\u746A\u62C9\u57FA\u66F8", code: "MAL", chapters: 4 },
  { num: "40", name: "\u99AC\u592A\u798F\u97F3", code: "MAT", chapters: 28 },
  { num: "41", name: "\u99AC\u53EF\u798F\u97F3", code: "MRK", chapters: 16 },
  { num: "42", name: "\u8DEF\u52A0\u798F\u97F3", code: "LUK", chapters: 24 },
  { num: "43", name: "\u7D04\u7FF0\u798F\u97F3", code: "JHN", chapters: 21 },
  { num: "44", name: "\u4F7F\u5F92\u884C\u50B3", code: "ACT", chapters: 28 },
  { num: "45", name: "\u7F85\u99AC\u66F8", code: "ROM", chapters: 16 },
  { num: "46", name: "\u54E5\u6797\u591A\u524D\u66F8", code: "1CO", chapters: 16 },
  { num: "47", name: "\u54E5\u6797\u591A\u5F8C\u66F8", code: "2CO", chapters: 13 },
  { num: "48", name: "\u52A0\u62C9\u592A\u66F8", code: "GAL", chapters: 6 },
  { num: "49", name: "\u4EE5\u5F17\u6240\u66F8", code: "EPH", chapters: 6 },
  { num: "50", name: "\u8153\u7ACB\u6BD4\u66F8", code: "PHP", chapters: 4 },
  { num: "51", name: "\u6B4C\u7F85\u897F\u66F8", code: "COL", chapters: 4 },
  { num: "52", name: "\u5E16\u6492\u7F85\u5C3C\u8FE6\u524D\u66F8", code: "1TH", chapters: 5 },
  { num: "53", name: "\u5E16\u6492\u7F85\u5C3C\u8FE6\u5F8C\u66F8", code: "2TH", chapters: 3 },
  { num: "54", name: "\u63D0\u6469\u592A\u524D\u66F8", code: "1TI", chapters: 6 },
  { num: "55", name: "\u63D0\u6469\u592A\u5F8C\u66F8", code: "2TI", chapters: 4 },
  { num: "56", name: "\u63D0\u591A\u66F8", code: "TIT", chapters: 3 },
  { num: "57", name: "\u8153\u5229\u9580\u66F8", code: "PHM", chapters: 1 },
  { num: "58", name: "\u5E0C\u4F2F\u4F86\u66F8", code: "HEB", chapters: 13 },
  { num: "59", name: "\u96C5\u5404\u66F8", code: "JAS", chapters: 5 },
  { num: "60", name: "\u5F7C\u5F97\u524D\u66F8", code: "1PE", chapters: 5 },
  { num: "61", name: "\u5F7C\u5F97\u5F8C\u66F8", code: "2PE", chapters: 3 },
  { num: "62", name: "\u7D04\u7FF0\u4E00\u66F8", code: "1JN", chapters: 5 },
  { num: "63", name: "\u7D04\u7FF0\u4E8C\u66F8", code: "2JN", chapters: 1 },
  { num: "64", name: "\u7D04\u7FF0\u4E09\u66F8", code: "3JN", chapters: 1 },
  { num: "65", name: "\u7336\u5927\u66F8", code: "JUD", chapters: 1 },
  { num: "66", name: "\u555F\u793A\u9304", code: "REV", chapters: 22 }
];
var byNum = new Map(BOOKS.map((b2) => [b2.num, b2]));
var byCode = new Map(BOOKS.map((b2) => [b2.code, b2]));
function bookByNum(num) {
  return byNum.get(num);
}
function bookByCode(code) {
  return byCode.get(code);
}
var CHAPTER_SLUG = /^(\d{2})-[^/]+\/第(\d+)章$/;
function parseChapterSlug(slug) {
  let s2 = slug;
  try {
    s2 = decodeURIComponent(slug);
  } catch {
  }
  const m2 = CHAPTER_SLUG.exec(s2);
  if (!m2) return null;
  const book = bookByNum(m2[1]);
  const chapter = Number(m2[2]);
  if (!book || !Number.isInteger(chapter) || chapter < 1 || chapter > book.chapters) return null;
  return { book, chapter };
}
function chapterLabel(code, chapter) {
  const book = bookByCode(code);
  return book ? `${book.name} \u7B2C${chapter}\u7AE0` : `${code} ${chapter}`;
}
var cachedVersion = null;
function clientAppPath(fromModuleUrl) {
  for (const rel of ["./client/app.js", "../client/app.js"]) {
    const p2 = fileURLToPath(new URL(rel, fromModuleUrl));
    if (existsSync(p2)) return p2;
  }
  throw new Error("[personal-notes] \u627E\u4E0D\u5230 dist/client/app.js\uFF0C\u8ACB\u5148\u5728 plugins/personal-notes \u57F7\u884C npm run build");
}
function appVersion(fromModuleUrl) {
  if (cachedVersion) return cachedVersion;
  cachedVersion = createHash("sha256").update(readFileSync(clientAppPath(fromModuleUrl))).digest("hex").slice(0, 10);
  return cachedVersion;
}
var l;
l = { __e: function(n2, l2, u3, t2) {
  for (var i2, r2, o2; l2 = l2.__; ) if ((i2 = l2.__c) && !i2.__) try {
    if ((r2 = i2.constructor) && null != r2.getDerivedStateFromError && (i2.setState(r2.getDerivedStateFromError(n2)), o2 = i2.__d), null != i2.componentDidCatch && (i2.componentDidCatch(n2, t2 || {}), o2 = i2.__d), o2) return i2.__E = i2;
  } catch (l3) {
    n2 = l3;
  }
  throw n2;
} }, "function" == typeof Promise ? Promise.prototype.then.bind(Promise.resolve()) : setTimeout, Math.random().toString(8);

// node_modules/preact/jsx-runtime/dist/jsxRuntime.mjs
var f2 = 0;
function u2(e2, t2, n2, o2, i2, u3) {
  t2 || (t2 = {});
  var a2, c2, p2 = t2;
  if ("ref" in p2) for (c2 in p2 = {}, t2) "ref" == c2 ? a2 = t2[c2] : p2[c2] = t2[c2];
  var l2 = { type: e2, props: p2, key: n2, ref: a2, __k: null, __: null, __b: 0, __e: null, __c: null, constructor: void 0, __v: --f2, __i: -1, __u: 0, __source: i2, __self: u3 };
  if ("function" == typeof e2 && (a2 = e2.defaultProps)) for (c2 in a2) void 0 === p2[c2] && (p2[c2] = a2[c2]);
  return l.vnode && l.vnode(l2), l2;
}

// src/components/PersonalNotes.tsx
var version = () => appVersion(import.meta.url);
var PersonalNotes = () => {
  const Component = ({ fileData }) => {
    const ref = parseChapterSlug(String(fileData.slug ?? ""));
    if (!ref) return null;
    return /* @__PURE__ */ u2(
      "section",
      {
        class: "bwz-notes",
        "data-bwz-notes": "chapter",
        "data-book": ref.book.code,
        "data-chapter": String(ref.chapter),
        "data-bwz-version": version(),
        "aria-label": `${chapterLabel(ref.book.code, ref.chapter)} \u6211\u7684\u7B46\u8A18`,
        children: /* @__PURE__ */ u2("p", { class: "bwz-n-muted", children: "\u6211\u7684\u7B46\u8A18\u8F09\u5165\u4E2D\u2026" })
      }
    );
  };
  Component.afterDOMLoaded = boot_inline_default;
  Component.css = notes_default;
  return Component;
};
var PersonalNotes_default = PersonalNotes;
var MyNotesBody = () => {
  const Component = () => /* @__PURE__ */ u2("article", { class: "popover-hint bwz-notes-page", children: [
    /* @__PURE__ */ u2("div", { "data-bwz-notes": "mynotes", "data-bwz-version": version(), children: /* @__PURE__ */ u2("p", { class: "bwz-n-muted", children: "\u6211\u7684\u7B46\u8A18\u8F09\u5165\u4E2D\u2026" }) }),
    /* @__PURE__ */ u2("noscript", { children: "\u9700\u8981\u958B\u555F JavaScript \u624D\u80FD\u4F7F\u7528\u500B\u4EBA\u7B46\u8A18\u529F\u80FD\u3002" })
  ] });
  Component.afterDOMLoaded = boot_inline_default;
  Component.css = notes_default;
  return Component;
};

// src/index.ts
var MY_NOTES_SLUG = "my-notes";
var PersonalNotesEmitter = (opts) => ({
  name: "PersonalNotesEmitter",
  async emit(ctx) {
    const src = clientAppPath(import.meta.url);
    const outDir = path.join(ctx.argv.output, "static", "personal-notes");
    await promises.mkdir(outDir, { recursive: true });
    const appOut = path.join(outDir, "app.js");
    await promises.copyFile(src, appOut);
    const config = {
      clientId: opts?.clientId ?? "",
      syncEnabled: opts?.syncEnabled ?? true,
      minPollSeconds: opts?.minPollSeconds ?? 180,
      maxWritesPerMinute: opts?.maxWritesPerMinute ?? 6,
      notice: opts?.notice ?? "",
      appVersion: appVersion(import.meta.url)
    };
    const configOut = path.join(outDir, "config.json");
    await promises.writeFile(configOut, JSON.stringify(config, null, 2));
    return [appOut, configOut];
  },
  partialEmit() {
    return null;
  }
});
var PersonalNotesPage = () => ({
  name: "PersonalNotesPage",
  priority: 5,
  match: ({ slug }) => slug === MY_NOTES_SLUG,
  generate: () => [{ slug: MY_NOTES_SLUG, title: "\u6211\u7684\u7B46\u8A18", data: {} }],
  layout: "my-notes",
  body: MyNotesBody
});
var manifest = {
  name: "personal-notes",
  displayName: "Personal Notes",
  category: ["emitter", "pageType", "component"],
  version: "0.1.0",
  quartzVersion: ">=5.0.0",
  components: {
    PersonalNotes: { displayName: "Personal Notes", defaultPosition: "afterBody", defaultPriority: 20 }
  }
};

export { MyNotesBody, PersonalNotes_default as PersonalNotes, PersonalNotesEmitter, PersonalNotesPage, manifest };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map