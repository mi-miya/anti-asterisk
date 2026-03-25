// Anti-Asterisk: ページ上のアスタリスク(*)を徹底的に削除する
(() => {
  // 重複実行時は再スキャンだけ行う
  if (window.__antiAsteriskLoaded) {
    window.__antiAsteriskRun();
    return;
  }
  window.__antiAsteriskLoaded = true;

  const ASTERISK_CHARS = "[\\*\\uFF0A\\u2217\\u204E\\u2055\\u2062\\u2731\\u2732\\u2733\\u273A\\u273B\\u273C\\u273D\\u2742\\u2743\\u2749\\u274A\\u274B\\u2605\\u2606\\u272F]";
  const ASTERISK_TEST = new RegExp(ASTERISK_CHARS);
  const ASTERISK_REPLACE = new RegExp(ASTERISK_CHARS, "g");

  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "SELECT", "CODE", "PRE"]);

  function removeAsterisksFromTextNode(node) {
    if (!node.nodeValue) return;
    const original = node.nodeValue;
    const replaced = original.replace(ASTERISK_REPLACE, "");
    if (replaced !== original) {
      node.nodeValue = replaced;
    }
  }

  function removeAsterisksFromAttributes(el, opts) {
    if (!opts.cleanAlt) return;
    const val = el.getAttribute("alt");
    if (!val) return;
    const cleaned = val.replace(ASTERISK_REPLACE, "");
    if (cleaned !== val) {
      el.setAttribute("alt", cleaned);
    }
  }

  function removeSourcesCarousel(root) {
    const elements = root.querySelectorAll ? root.querySelectorAll("sources-carousel-inline") : [];
    for (const el of elements) {
      el.remove();
    }
  }

  function removeAsterisksFromElement(el, opts) {
    if (SKIP_TAGS.has(el.tagName)) return;

    removeAsterisksFromAttributes(el, opts);

    // CSS contentプロパティでアスタリスクが挿入される::before/::afterを非表示にする
    if (el.dataset.antiAsterisk) return;
    for (const pseudo of ["::before", "::after"]) {
      try {
        const style = window.getComputedStyle(el, pseudo);
        const content = style.getPropertyValue("content");
        if (!content || content === "none" || content === "normal") continue;
        const cleaned = content.replace(ASTERISK_REPLACE, "");
        if (cleaned !== content) {
          el.dataset.antiAsterisk = "1";
          const sheet = getOrCreateStyleSheet(el);
          const selector = generateUniqueSelector(el);
          if (selector) {
            sheet.insertRule(
              `${selector}${pseudo} { content: ${cleaned} !important; }`,
              sheet.cssRules.length
            );
          }
        }
      } catch (e) {
        // cross-origin styleへのアクセスエラーを無視
      }
    }
  }

  function processShadowRoot(el) {
    if (el.shadowRoot) {
      walkAndClean(el.shadowRoot);
      observeRoot(el.shadowRoot);
    }
  }

  function walkAndClean(root) {
    if (!root) return;
    const opts = window.__antiAsteriskOptions || {};

    // テキストノードを処理
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (parent && (SKIP_TAGS.has(parent.tagName) || parent.isContentEditable)) {
        continue;
      }
      removeAsterisksFromTextNode(node);
    }

    // root自体がElementなら先に処理
    if (root.nodeType === Node.ELEMENT_NODE) {
      removeAsterisksFromElement(root, opts);
      processShadowRoot(root);
    }

    // sources-carousel-inline タグを削除
    if (opts.removeSources) {
      removeSourcesCarousel(root);
    }

    // 子孫要素を処理（属性 + CSS疑似要素 + Shadow DOM）
    const elements = root.querySelectorAll ? root.querySelectorAll("*") : [];
    for (const el of elements) {
      removeAsterisksFromElement(el, opts);
      processShadowRoot(el);
    }
  }

  function walkAndCleanIframes() {
    const iframes = document.querySelectorAll("iframe");
    for (const iframe of iframes) {
      try {
        const doc = iframe.contentDocument;
        if (doc && doc.body) {
          walkAndClean(doc.body);
          observeRoot(doc.body);
        }
      } catch (e) {
        // cross-origin iframeは無視
      }
    }
  }

  function getOrCreateStyleSheet(el) {
    const root = el.getRootNode();
    if (root.__antiAsteriskSheet) return root.__antiAsteriskSheet;

    const style = document.createElement("style");
    style.id = "anti-asterisk-style";
    if (root === document) {
      document.head.appendChild(style);
    } else {
      root.appendChild(style);
    }
    root.__antiAsteriskSheet = style.sheet;
    return style.sheet;
  }

  function generateUniqueSelector(el) {
    if (el.id) return `#${CSS.escape(el.id)}`;
    const path = [];
    let current = el;
    const boundary = current.getRootNode();
    while (current && current !== boundary && current.tagName) {
      let selector = current.tagName.toLowerCase();
      if (current.id) {
        path.unshift(`#${CSS.escape(current.id)}`);
        break;
      }
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          (c) => c.tagName === current.tagName
        );
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-of-type(${index})`;
        }
      }
      path.unshift(selector);
      current = current.parentElement;
    }
    return path.length ? path.join(" > ") : null;
  }

  // 監視済みrootの追跡
  const observedRoots = new WeakSet();
  let observerPaused = false;

  function observeRoot(root) {
    if (!root || observedRoots.has(root)) return;
    observedRoots.add(root);

    const observer = new MutationObserver((mutations) => {
      if (observerPaused) return;
      observerPaused = true;
      try {
        for (const mutation of mutations) {
          if (mutation.type === "childList") {
            for (const node of mutation.addedNodes) {
              if (node.nodeType === Node.TEXT_NODE) {
                removeAsterisksFromTextNode(node);
              } else if (node.nodeType === Node.ELEMENT_NODE) {
                walkAndClean(node);
              }
            }
          } else if (mutation.type === "characterData") {
            removeAsterisksFromTextNode(mutation.target);
          }
        }
      } finally {
        observerPaused = false;
      }
    });

    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  // open shadowRootを探すためにattachShadowをフック
  const origAttachShadow = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function (init) {
    const shadow = origAttachShadow.call(this, init);
    setTimeout(() => {
      walkAndClean(shadow);
      observeRoot(shadow);
    }, 100);
    return shadow;
  };

  // 全体実行関数（再実行時にも呼べるようにグローバルに公開）
  window.__antiAsteriskRun = function () {
    walkAndClean(document.body);
    walkAndCleanIframes();
  };

  // 初回実行
  window.__antiAsteriskRun();
  observeRoot(document.body);
})();
