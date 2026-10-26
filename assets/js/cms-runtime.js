(function () {
  'use strict';

  function getCurrentPageFile() {
    var pathName = window.location.pathname || '/';
    var seg = pathName.split('/').pop() || 'index.html';
    if (seg === '' || seg === '/') return 'index.html';
    if (!/\.html$/i.test(seg)) return seg + '.html';
    return seg;
  }

  function getMergedState() {
    var base = window.JK_CMS_PUBLIC || {};
    try {
      var localRaw = localStorage.getItem('jk_cms_live_db_v3');
      if (localRaw) {
        var localDb = JSON.parse(localRaw);
        return {
          meta: localDb.meta || base.meta,
          design: localDb.design || base.design,
          menus: localDb.menus || base.menus,
          pages: localDb.pages || base.pages,
          isLocalOverride: true
        };
      }
    } catch (e) {}
    return base;
  }

  function applyDesignSystem(design) {
    if (!design) return;
    var root = document.documentElement;
    var c = design.colors || {};
    var t = design.typography || {};
    var l = design.layout || {};

    if (c.primary) root.style.setProperty('--cms-primary', c.primary);
    if (c.navyDark) root.style.setProperty('--cms-navy-dark', c.navyDark);
    if (c.secondary) root.style.setProperty('--cms-secondary', c.secondary);
    if (c.emerald) root.style.setProperty('--cms-emerald', c.emerald);
    if (c.mintAccent) root.style.setProperty('--cms-mint', c.mintAccent);
    if (c.surface) root.style.setProperty('--cms-surface', c.surface);
    if (c.cardBg) root.style.setProperty('--cms-card-bg', c.cardBg);
    if (c.textMain) root.style.setProperty('--cms-text-main', c.textMain);
    if (c.textMuted) root.style.setProperty('--cms-text-muted', c.textMuted);

    var styleEl = document.getElementById('jk-cms-dynamic-style');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'jk-cms-dynamic-style';
      document.head.appendChild(styleEl);
    }

    var css = '';
    if (c.surface || c.textMain || t.bodyFont || t.baseFontSizePx || t.lineHeight) {
      css += 'body { ';
      if (c.surface) css += 'background-color: ' + c.surface + ' !important; ';
      if (c.textMain) css += 'color: ' + c.textMain + ' !important; ';
      if (t.bodyFont) css += 'font-family: ' + t.bodyFont + ' !important; ';
      if (t.baseFontSizePx) css += 'font-size: ' + t.baseFontSizePx + 'px !important; ';
      if (t.lineHeight) css += 'line-height: ' + t.lineHeight + ' !important; ';
      css += '}\n';
    }
    if (t.headingFont) {
      css += 'h1, h2, h3, h4, h5, h6 { font-family: ' + t.headingFont + ' !important; }\n';
    }
    if (t.serifFont) {
      css += '.font-cormorant { font-family: ' + t.serifFont + ' !important; }\n';
    }
    if (l.maxWidthPx && Number(l.maxWidthPx) !== 1280) {
      css += '.max-w-7xl { max-width: ' + Number(l.maxWidthPx) + 'px !important; }\n';
    }
    if (c.emerald && c.emerald.toLowerCase() !== '#10b981') {
      css += '.bg-\\[\\#10b981\\] { background-color: ' + c.emerald + ' !important; }\n';
      css += '.text-\\[\\#10b981\\] { color: ' + c.emerald + ' !important; }\n';
    }
    if (c.primary && c.primary.toLowerCase() !== '#004b80') {
      css += '.bg-\\[\\#004b80\\], .bg-primary { background-color: ' + c.primary + ' !important; }\n';
      css += '.text-\\[\\#004b80\\], .text-primary { color: ' + c.primary + ' !important; }\n';
    }
    if (c.navyDark && c.navyDark.toLowerCase() !== '#0a2540') {
      css += '.bg-\\[\\#0a2540\\], .bg-\\[\\#061729\\] { background-color: ' + c.navyDark + ' !important; }\n';
    }
    if (design.customCss) {
      css += '\n/* Custom Admin CSS */\n' + design.customCss + '\n';
    }
    styleEl.textContent = css;

    // Sticky Header toggle
    var header = document.querySelector('header');
    if (header && typeof l.stickyHeader === 'boolean') {
      if (l.stickyHeader) {
        header.classList.add('sticky', 'top-0');
      } else {
        header.classList.remove('sticky', 'top-0');
      }
    }

    // Scroll-to-top button visibility
    var scrollBtn = document.querySelector('button[aria-label="উপরে যান"]');
    if (scrollBtn && typeof l.showScrollTopButton === 'boolean') {
      scrollBtn.style.display = l.showScrollTopButton ? '' : 'none';
    }

    // Top Announcement Bar
    var existingBar = document.getElementById('jk-cms-announcement-bar');
    if (l.showAnnouncementBar && l.announcementText) {
      if (!existingBar && header && header.parentNode) {
        existingBar = document.createElement('div');
        existingBar.id = 'jk-cms-announcement-bar';
        existingBar.className = 'bg-[#0a2540] text-white text-xs sm:text-sm py-2.5 px-4 text-center border-b border-white/10 no-print';
        header.parentNode.insertBefore(existingBar, header);
      }
      if (existingBar) {
        var ctaHtml = l.announcementCtaText
          ? '<a href="' + (l.announcementCtaUrl || 'https://jklifestyleltd.com/appointment/') + '" class="ml-3 inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-[#10b981] text-white font-bold text-xs hover:bg-[#059669] transition-colors">' + l.announcementCtaText + '</a>'
          : '';
        existingBar.innerHTML = '<div class="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-2"><span class="material-symbols-outlined text-[#6ffbbe] text-base">campaign</span><span class="font-medium">' + l.announcementText + '</span>' + ctaHtml + '</div>';
      }
    } else if (existingBar) {
      existingBar.remove();
    }
  }

  function applyMenusAndHeader(menus, meta) {
    if (!menus) return;
    var header = document.querySelector('header');
    if (header) {
      // Brand title & subtitle
      var brandSpans = header.querySelectorAll('a[aria-label*="ডা. জাহাঙ্গীর কবির"] div.flex-col span');
      if (brandSpans.length >= 2) {
        if (menus.headerBrandTitle) brandSpans[0].textContent = menus.headerBrandTitle;
        if (menus.headerBrandSubtitle) brandSpans[1].textContent = menus.headerBrandSubtitle;
      }

      // Desktop Nav Items
      var desktopNav = header.querySelector('nav[aria-label="প্রধান নেভিগেশন মেনু"]');
      var currentFile = getCurrentPageFile();
      if (desktopNav && Array.isArray(menus.headerItems) && menus.headerItems.length > 0) {
        var isFileProto = window.location.protocol === 'file:';
        desktopNav.innerHTML = menus.headerItems
          .filter(function (item) { return item.visible !== false; })
          .map(function (item) {
            var isActive = item.file === currentFile || (item.url === '/' && currentFile === 'index.html');
            var cls = isActive
              ? 'whitespace-nowrap px-3.5 py-2 text-sm font-bold text-[#006c49] bg-[#eff4ff] rounded-lg relative after:content-[\'\'] after:absolute after:bottom-0.5 after:left-3 after:right-3 after:h-0.5 after:bg-[#10b981] after:rounded-full transition-colors'
              : 'whitespace-nowrap px-3.5 py-2 text-sm font-medium text-[#414750] hover:text-[#004b80] hover:bg-[#eff4ff]/60 rounded-lg transition-colors';
            var href = isFileProto && item.file ? item.file : item.url;
            return '<a class="' + cls + '" href="' + href + '" target="' + (item.target || '_self') + '">' + item.label + '</a>';
          })
          .join('');
      }

      // Header Primary CTA button
      if (menus.headerCta) {
        var ctaBtn = header.querySelector('div.shrink-0 > a.rounded-full');
        if (ctaBtn) {
          if (menus.headerCta.url) ctaBtn.setAttribute('href', menus.headerCta.url);
          var spans = ctaBtn.querySelectorAll('span');
          if (spans.length >= 1 && menus.headerCta.label) spans[0].textContent = menus.headerCta.label;
          if (spans.length >= 2 && menus.headerCta.icon) spans[1].textContent = menus.headerCta.icon;
        }
      }
    }

    // Update global appointment URLs or hotline if changed in meta
    if (meta && meta.primaryAppointmentUrl && meta.primaryAppointmentUrl !== 'https://jklifestyleltd.com/appointment/') {
      document.querySelectorAll('a[href="https://jklifestyleltd.com/appointment/"]').forEach(function (a) {
        a.setAttribute('href', meta.primaryAppointmentUrl);
      });
    }
  }

  function applyPageContentOverrides(pages) {
    if (!pages) return;
    var currentFile = getCurrentPageFile();
    var pageObj = pages[currentFile];
    if (!pageObj) return;

    if (pageObj.title) document.title = pageObj.title;
    if (pageObj.description) {
      var metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) metaDesc.setAttribute('content', pageObj.description);
    }

    // If mainHtml was overridden in localStorage or live DB, update <main>
    if (pageObj.mainHtml && pageObj._clientModified) {
      var mainEl = document.querySelector('main');
      if (mainEl) {
        mainEl.innerHTML = pageObj.mainHtml;
      }
    }
  }

  // Interactive Visual Editor Bridge (activated when ?cms_visual_editor=1 is present)
  function initVisualEditorBridge() {
    var params = new URLSearchParams(window.location.search);
    if (params.get('cms_visual_editor') !== '1') return;

    document.body.classList.add('cms-visual-editor-active');
    var selectedEl = null;

    function markEditableElements() {
      var main = document.querySelector('main') || document.body;
      var selectors = 'h1, h2, h3, h4, p, li, blockquote, a, button, img, span.font-bold, div.aeo-key-takeaways';
      var idx = 0;
      main.querySelectorAll(selectors).forEach(function (el) {
        if (el.closest('#jk-cms-visual-toolbar')) return;
        idx++;
        el.setAttribute('data-cms-editable', 'true');
        if (!el.getAttribute('data-cms-id')) {
          el.setAttribute('data-cms-id', 'cms-el-' + idx);
        }
      });
    }

    markEditableElements();

    // Prevent navigation when clicking links inside Visual Editor
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-cms-editable]');
      if (!target) return;
      e.preventDefault();
      e.stopPropagation();

      if (selectedEl) selectedEl.removeAttribute('data-cms-selected');
      selectedEl = target;
      selectedEl.setAttribute('data-cms-selected', 'true');

      var tag = selectedEl.tagName.toLowerCase();
      var payload = {
        type: 'CMS_ELEMENT_SELECTED',
        cmsId: selectedEl.getAttribute('data-cms-id'),
        tagName: tag,
        text: selectedEl.innerText || '',
        html: selectedEl.innerHTML || '',
        href: selectedEl.getAttribute('href') || '',
        src: selectedEl.getAttribute('src') || '',
        alt: selectedEl.getAttribute('alt') || '',
        className: selectedEl.className || ''
      };
      var targetOrigin = window.location.protocol === 'file:' ? '*' : window.location.origin;
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(payload, targetOrigin);
      }
    }, true);

    window.addEventListener('message', function (event) {
      if (window.location.protocol !== 'file:' && event.origin !== window.location.origin) return;
      var data = event.data;
      if (!data || !data.type) return;

      if (data.type === 'CMS_UPDATE_SELECTED_ELEMENT') {
        var el = data.cmsId ? document.querySelector('[data-cms-id="' + data.cmsId + '"]') : selectedEl;
        if (!el) return;
        var tag = el.tagName.toLowerCase();
        if (tag === 'img') {
          if (typeof data.src === 'string') el.setAttribute('src', data.src);
          if (typeof data.alt === 'string') el.setAttribute('alt', data.alt);
        } else {
          if (typeof data.html === 'string' && data.useHtml) {
            el.innerHTML = data.html;
          } else if (typeof data.text === 'string') {
            el.innerText = data.text;
          }
          if (typeof data.href === 'string' && (tag === 'a' || el.hasAttribute('href'))) {
            el.setAttribute('href', data.href);
          }
        }
        sendUpdatedMainHtml();
      } else if (data.type === 'CMS_APPLY_MAIN_HTML') {
        var mainEl = document.querySelector('main');
        if (mainEl && typeof data.mainHtml === 'string') {
          mainEl.innerHTML = data.mainHtml;
          markEditableElements();
        }
      } else if (data.type === 'CMS_APPLY_DESIGN_PREVIEW') {
        applyDesignSystem(data.design);
        if (data.menus) applyMenusAndHeader(data.menus, data.meta);
      } else if (data.type === 'CMS_REQUEST_PAGE_STRUCTURE') {
        sendPageStructure();
      }
    });

    function sendUpdatedMainHtml() {
      var mainEl = document.querySelector('main');
      var h1El = document.querySelector('h1');
      var targetOrigin = window.location.protocol === 'file:' ? '*' : window.location.origin;
      if (window.parent && window.parent !== window && mainEl) {
        window.parent.postMessage({
          type: 'CMS_MAIN_HTML_UPDATED',
          mainHtml: mainEl.innerHTML,
          h1: h1El ? h1El.innerText.trim() : ''
        }, targetOrigin);
      }
    }

    function sendPageStructure() {
      markEditableElements();
      var mainEl = document.querySelector('main') || document.body;
      var headings = [];
      mainEl.querySelectorAll('h1, h2, h3').forEach(function (h) {
        headings.push({
          cmsId: h.getAttribute('data-cms-id'),
          tag: h.tagName.toLowerCase(),
          text: h.innerText.trim()
        });
      });
      var buttons = [];
      mainEl.querySelectorAll('a, button').forEach(function (b) {
        var txt = (b.innerText || '').trim();
        if (txt) {
          buttons.push({
            cmsId: b.getAttribute('data-cms-id'),
            tag: b.tagName.toLowerCase(),
            text: txt,
            href: b.getAttribute('href') || ''
          });
        }
      });
      var images = [];
      mainEl.querySelectorAll('img').forEach(function (img) {
        images.push({
          cmsId: img.getAttribute('data-cms-id'),
          src: img.getAttribute('src') || '',
          alt: img.getAttribute('alt') || ''
        });
      });
      var targetOrigin = window.location.protocol === 'file:' ? '*' : window.location.origin;
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          type: 'CMS_PAGE_STRUCTURE_DATA',
          headings: headings,
          buttons: buttons,
          images: images,
          mainHtml: mainEl.innerHTML
        }, targetOrigin);
      }
    }

    setTimeout(sendPageStructure, 250);
  }

  function bootCmsRuntime() {
    var state = getMergedState();
    if (state) {
      applyDesignSystem(state.design);
      applyMenusAndHeader(state.menus, state.meta);
      applyPageContentOverrides(state.pages);
    }
    initVisualEditorBridge();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootCmsRuntime);
  } else {
    bootCmsRuntime();
  }
})();
