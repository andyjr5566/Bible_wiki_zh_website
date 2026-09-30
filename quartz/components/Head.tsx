import { i18n } from "../i18n"
import { FullSlug, getFileExtension, joinSegments, pathToRoot } from "../util/path"
import { CSSResourceToStyleElement, JSResourceToScriptElement } from "../util/resources"
import { googleFontHref, googleFontSubsetHref } from "../util/theme"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { unescapeHTML } from "../util/escape"

export default (() => {
  const Head: QuartzComponent = ({
    cfg,
    fileData,
    externalResources,
    ctx,
  }: QuartzComponentProps) => {
    const titleSuffix = cfg.pageTitleSuffix ?? ""
    const title =
      (fileData.frontmatter?.title ?? i18n(cfg.locale).propertyDefaults.title) + titleSuffix
    const description =
      fileData.frontmatter?.socialDescription ??
      fileData.frontmatter?.description ??
      unescapeHTML(fileData.description?.trim() ?? i18n(cfg.locale).propertyDefaults.description)

    const { css, js, additionalHead } = externalResources

    const url = new URL(`https://${cfg.baseUrl ?? "example.com"}`)
    const path = url.pathname as FullSlug
    const baseDir = fileData.slug === "404" ? path : pathToRoot(fileData.slug!)
    const iconPath = joinSegments(baseDir, "static/icon.png")

    // Url of current page
    const socialUrl =
      fileData.slug === "404" ? url.toString() : joinSegments(url.toString(), fileData.slug!)

    const usesCustomOgImage = ctx.cfg.plugins.emitters.some(
      (e) => e.name === "CustomOgImages",
    )
    const ogImageDefaultPath = `https://${cfg.baseUrl}/static/og-image.png`

    const coreStylesheet = css[0]?.content
    const coreScript = js.find(
      (r) => r.loadTime === "beforeDOMReady" && r.contentType === "external",
    )

    return (
      <head>
        <title>{title}</title>
        <meta charSet="utf-8" />
        {coreStylesheet && <link rel="preload" href={coreStylesheet} as="style" />}
        {coreScript && coreScript.contentType === "external" && (
          <link rel="preload" href={coreScript.src} as="script" />
        )}
        {cfg.theme.cdnCaching && cfg.theme.fontOrigin === "googleFonts" && (
          <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" />
            <link rel="stylesheet" href={googleFontHref(cfg.theme)} />
            {cfg.theme.typography.title && (
              <link rel="stylesheet" href={googleFontSubsetHref(cfg.theme, cfg.pageTitle)} />
            )}
          </>
        )}
        <link rel="preconnect" href="https://cdnjs.cloudflare.com" crossOrigin="anonymous" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />

        <meta name="og:site_name" content={cfg.pageTitle}></meta>
        <meta property="og:title" content={title} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta property="og:description" content={description} />
        <meta property="og:image:alt" content={description} />

        {!usesCustomOgImage && (
          <>
            <meta property="og:image" content={ogImageDefaultPath} />
            <meta property="og:image:url" content={ogImageDefaultPath} />
            <meta name="twitter:image" content={ogImageDefaultPath} />
            <meta
              property="og:image:type"
              content={`image/${getFileExtension(ogImageDefaultPath) ?? "png"}`}
            />
          </>
        )}

        {cfg.baseUrl && (
          <>
            <meta property="twitter:domain" content={cfg.baseUrl}></meta>
            <meta property="og:url" content={socialUrl}></meta>
            <meta property="twitter:url" content={socialUrl}></meta>
          </>
        )}

        <link rel="icon" href={iconPath} />
        <link rel="manifest" href={joinSegments(baseDir, "static/manifest.json")} />
        <link
          rel="apple-touch-icon"
          href={joinSegments(baseDir, "static/icons/apple-touch-icon.png")}
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="聖經知識庫" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="theme-color" content="#7A1C1C" />
        <meta name="description" content={description} />
        <meta name="generator" content="Quartz" />

        {css.map((resource) => CSSResourceToStyleElement(resource, true))}
        {js
          .filter((resource) => resource.loadTime === "beforeDOMReady")
          .map((res) => JSResourceToScriptElement(res, true))}
        {additionalHead.map((resource) => {
          if (typeof resource === "function") {
            return resource(fileData)
          } else {
            return resource
          }
        })}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ("serviceWorker" in navigator) {
                window.addEventListener("load", function () {
                  navigator.serviceWorker
                    .register("${joinSegments(baseDir, "static/sw.js")}", { scope: "${baseDir}" })
                    .catch(function (error) {
                      console.error("Bible Wiki Service Worker registration failed:", error);
                    });
                });
              }
            `,
          }}
        />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              .pwa-install-guide {
                position: fixed;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 9999;
                max-width: 30rem;
                margin: 0 auto;
                padding: 1rem 1.25rem calc(1rem + env(safe-area-inset-bottom));
                background: var(--light);
                border-top: 1px solid var(--lightgray);
                border-radius: 1rem 1rem 0 0;
                box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.15);
                font-family: inherit;
                color: var(--darkgray);
                animation: pwa-guide-slide-up 0.35s ease-out;
              }
              @keyframes pwa-guide-slide-up {
                from { transform: translateY(100%); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
              }
              .pwa-guide-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 0.75rem;
                margin-bottom: 0.75rem;
              }
              .pwa-guide-title {
                font-weight: 700;
                font-size: 1rem;
                color: var(--secondary);
              }
              .pwa-guide-close {
                flex-shrink: 0;
                border: none;
                background: transparent;
                color: var(--gray);
                font-size: 1.1rem;
                line-height: 1;
                cursor: pointer;
                padding: 0.25rem;
              }
              .pwa-guide-visual {
                display: flex;
                align-items: center;
                gap: 1rem;
                margin-bottom: 0.9rem;
                padding: 0.75rem;
                background: var(--lightgray);
                border-radius: 0.75rem;
              }
              .pwa-guide-visual svg {
                flex-shrink: 0;
              }
              .pwa-guide-visual-caption {
                font-size: 0.92rem;
                font-weight: 600;
                line-height: 1.4;
              }
              .pwa-guide-step-num {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 1.4rem;
                height: 1.4rem;
                border-radius: 50%;
                background: var(--secondary);
                color: var(--light);
                font-size: 0.78rem;
                margin-right: 0.4rem;
              }
              .pwa-guide-steps {
                list-style: none;
                margin: 0 0 1rem;
                padding: 0;
                display: flex;
                flex-direction: column;
                gap: 0.6rem;
              }
              .pwa-guide-steps li {
                display: flex;
                align-items: center;
                gap: 0.6rem;
                font-size: 0.92rem;
                line-height: 1.3;
              }
              .pwa-guide-icon {
                flex-shrink: 0;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 2rem;
                height: 2rem;
                border-radius: 0.5rem;
                background: var(--lightgray);
                color: var(--secondary);
              }
              .pwa-guide-ok,
              .pwa-guide-install-btn {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.4rem;
                width: 100%;
                border: none;
                border-radius: 0.6rem;
                padding: 0.7rem;
                font-size: 0.95rem;
                font-weight: 600;
                cursor: pointer;
                background: var(--secondary);
                color: var(--light);
              }
              .pwa-guide-install-btn {
                margin-bottom: 0.75rem;
              }
              .pwa-guide-install-btn[hidden] {
                display: none;
              }
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var isStandalone =
                    window.matchMedia("(display-mode: standalone)").matches ||
                    window.navigator.standalone === true;
                  if (isStandalone) return;

                  var ua = navigator.userAgent || "";
                  var isIOS = /iPhone|iPad|iPod/i.test(ua) && !window.MSStream;
                  var isAndroid = /Android/i.test(ua);
                  if (!isIOS && !isAndroid) return;

                  var DISMISS_KEY = "pwa_install_guide_dismissed_v1";
                  if (localStorage.getItem(DISMISS_KEY)) return;
                  if (document.getElementById("pwa-install-guide")) return;

                  var deferredPrompt = null;
                  window.addEventListener("beforeinstallprompt", function (e) {
                    e.preventDefault();
                    deferredPrompt = e;
                    var btn = document.getElementById("pwa-guide-native-install");
                    if (btn) btn.hidden = false;
                  });

                  function dismiss() {
                    try {
                      localStorage.setItem(DISMISS_KEY, "1");
                    } catch (e) {}
                    var el = document.getElementById("pwa-install-guide");
                    if (el) el.remove();
                  }

                  var shareIcon =
                    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';
                  var plusIcon =
                    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/></svg>';
                  var downloadIcon =
                    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M8 11l4 4 4-4"/><path d="M5 19h14"/></svg>';
                  var checkIcon =
                    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';

                  var phoneMockupIOS =
                    '<svg width="96" height="166" viewBox="0 0 96 166" xmlns="http://www.w3.org/2000/svg">' +
                    '<rect x="2" y="2" width="92" height="162" rx="16" fill="var(--light)" stroke="var(--gray)" stroke-width="2"/>' +
                    '<rect x="12" y="16" width="72" height="5" rx="2.5" fill="var(--lightgray)"/>' +
                    '<rect x="12" y="27" width="52" height="5" rx="2.5" fill="var(--lightgray)"/>' +
                    '<rect x="12" y="38" width="60" height="5" rx="2.5" fill="var(--lightgray)"/>' +
                    '<rect x="12" y="49" width="44" height="5" rx="2.5" fill="var(--lightgray)"/>' +
                    '<rect x="2" y="132" width="92" height="30" fill="var(--lightgray)"/>' +
                    '<path d="M14 147l-3-3 3-3" stroke="var(--gray)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
                    '<path d="M26 141l3 3-3 3" stroke="var(--gray)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
                    '<rect x="68" y="140" width="8" height="11" rx="1.5" stroke="var(--gray)" stroke-width="1.6" fill="none"/>' +
                    '<rect x="80" y="140" width="8" height="11" rx="1.5" stroke="var(--gray)" stroke-width="1.6" fill="none"/>' +
                    '<circle cx="48" cy="147" r="20" fill="none" stroke="var(--secondary)" stroke-width="1.5" opacity="0.55">' +
                    '<animate attributeName="r" values="12;20;12" dur="1.6s" repeatCount="indefinite"/>' +
                    '<animate attributeName="opacity" values="0.6;0;0.6" dur="1.6s" repeatCount="indefinite"/>' +
                    "</circle>" +
                    '<circle cx="48" cy="147" r="12" fill="none" stroke="var(--secondary)" stroke-width="2.2"/>' +
                    '<path d="M48 141v9M44 145l4-4 4 4" stroke="var(--secondary)" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
                    '<path d="M43 148v2.5a1.7 1.7 0 0 0 1.7 1.7h6.6a1.7 1.7 0 0 0 1.7-1.7V148" stroke="var(--secondary)" stroke-width="1.8" fill="none" stroke-linecap="round"/>' +
                    "</svg>";

                  var phoneMockupAndroid =
                    '<svg width="96" height="166" viewBox="0 0 96 166" xmlns="http://www.w3.org/2000/svg">' +
                    '<rect x="2" y="2" width="92" height="162" rx="16" fill="var(--light)" stroke="var(--gray)" stroke-width="2"/>' +
                    '<rect x="12" y="14" width="52" height="13" rx="6.5" fill="var(--lightgray)"/>' +
                    '<circle cx="80" cy="20.5" r="20" fill="none" stroke="var(--secondary)" stroke-width="1.5" opacity="0.55">' +
                    '<animate attributeName="r" values="12;20;12" dur="1.6s" repeatCount="indefinite"/>' +
                    '<animate attributeName="opacity" values="0.6;0;0.6" dur="1.6s" repeatCount="indefinite"/>' +
                    "</circle>" +
                    '<circle cx="80" cy="20.5" r="12" fill="none" stroke="var(--secondary)" stroke-width="2.2"/>' +
                    '<circle cx="80" cy="16" r="1.7" fill="var(--secondary)"/>' +
                    '<circle cx="80" cy="20.5" r="1.7" fill="var(--secondary)"/>' +
                    '<circle cx="80" cy="25" r="1.7" fill="var(--secondary)"/>' +
                    '<rect x="12" y="46" width="72" height="5" rx="2.5" fill="var(--lightgray)"/>' +
                    '<rect x="12" y="57" width="52" height="5" rx="2.5" fill="var(--lightgray)"/>' +
                    '<rect x="12" y="68" width="60" height="5" rx="2.5" fill="var(--lightgray)"/>' +
                    '<rect x="12" y="79" width="44" height="5" rx="2.5" fill="var(--lightgray)"/>' +
                    "</svg>";

                  function render() {
                    if (document.getElementById("pwa-install-guide")) return;

                    var wrapper = document.createElement("div");
                    wrapper.id = "pwa-install-guide";
                    wrapper.className = "pwa-install-guide";

                    if (isIOS) {
                      wrapper.innerHTML =
                        '<div class="pwa-guide-header">' +
                        '<span class="pwa-guide-title">📖 加入主畫面，像 App 一樣使用</span>' +
                        '<button id="pwa-guide-close" class="pwa-guide-close" aria-label="關閉">✕</button>' +
                        "</div>" +
                        '<div class="pwa-guide-visual">' +
                        phoneMockupIOS +
                        '<span class="pwa-guide-visual-caption"><span class="pwa-guide-step-num">1</span>點下方工具列的「分享」圖示</span>' +
                        "</div>" +
                        '<ol class="pwa-guide-steps" start="2">' +
                        '<li><span class="pwa-guide-icon">' + plusIcon + '</span>往下滑動，點選「加入主畫面」</li>' +
                        '<li><span class="pwa-guide-icon">' + checkIcon + '</span>點右上角「加入」即完成</li>' +
                        "</ol>" +
                        '<button id="pwa-guide-ok" class="pwa-guide-ok">知道了</button>';
                    } else {
                      wrapper.innerHTML =
                        '<div class="pwa-guide-header">' +
                        '<span class="pwa-guide-title">📖 安裝成 App，體驗更順暢</span>' +
                        '<button id="pwa-guide-close" class="pwa-guide-close" aria-label="關閉">✕</button>' +
                        "</div>" +
                        '<button id="pwa-guide-native-install" class="pwa-guide-install-btn" hidden>' + downloadIcon + ' 立即安裝</button>' +
                        '<div class="pwa-guide-visual">' +
                        phoneMockupAndroid +
                        '<span class="pwa-guide-visual-caption"><span class="pwa-guide-step-num">1</span>點右上角選單「⋮」</span>' +
                        "</div>" +
                        '<ol class="pwa-guide-steps" start="2">' +
                        '<li><span class="pwa-guide-icon">' + plusIcon + '</span>選擇「安裝應用程式」或「新增至主畫面」</li>' +
                        "</ol>" +
                        '<button id="pwa-guide-ok" class="pwa-guide-ok">知道了</button>';
                    }

                    document.body.appendChild(wrapper);

                    document.getElementById("pwa-guide-close").addEventListener("click", dismiss);
                    document.getElementById("pwa-guide-ok").addEventListener("click", dismiss);

                    var nativeBtn = document.getElementById("pwa-guide-native-install");
                    if (nativeBtn) {
                      nativeBtn.addEventListener("click", function () {
                        if (!deferredPrompt) return;
                        deferredPrompt.prompt();
                        deferredPrompt.userChoice.finally(function () {
                          deferredPrompt = null;
                          dismiss();
                        });
                      });
                    }
                  }

                  function schedule() {
                    setTimeout(render, 1800);
                  }

                  if (document.readyState === "complete" || document.readyState === "interactive") {
                    schedule();
                  } else {
                    document.addEventListener("DOMContentLoaded", schedule);
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
        {fileData.slug === "index" && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                (function() {
                  try {
                    var p = new URLSearchParams(window.location.search);
                    if (p.get('opening') === '1' || p.get('intro') === '1') {
                      sessionStorage.setItem('seen_opening', 'true');
                      window.location.replace('./InTheBeginning.html' + window.location.search);
                      return;
                    }
                    if (p.get('opening') === '0' || p.get('skip') === '1') {
                      sessionStorage.setItem('seen_opening', 'true');
                      return;
                    }
                    var seen = sessionStorage.getItem('seen_opening');
                    var lastSeen = localStorage.getItem('opening_last_seen');
                    var now = Date.now();
                    var windowMs = 24 * 60 * 60 * 1000;
                    var expired = (!lastSeen || (now - parseInt(lastSeen, 10)) > windowMs);
                    if (!seen || expired) {
                      sessionStorage.setItem('seen_opening', 'true');
                      localStorage.setItem('opening_last_seen', now.toString());
                      window.location.replace('./InTheBeginning.html');
                    }
                  } catch (e) {}
                })();
              `,
            }}
          />
        )}
      </head>
    )
  }

  return Head
}) satisfies QuartzComponentConstructor
