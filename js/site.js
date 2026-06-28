/* =========================================================================
   Shared header + footer (single source of truth) and small interactions.
   Each page has <header id="site-header"></header> and
   <footer id="site-footer"></footer>; the body carries data-page="home"
   (etc.) so the matching nav item is highlighted.
   ========================================================================= */

const NAV_LINKS = [
  { key: "home",        label: "Home",                    href: "index.html" },
  { key: "about",       label: "About",                    href: "about.html" },
  { key: "5-pillars", label: "5 Pillars",          href: "5-pillars.html" },
  { key: "ecosystem",   label: "Ecosystem",                href: "ecosystem.html" },
  { key: "programs",    label: "Programs",                 href: "programs.html" },
  { key: "blog",        label: "Blog",                     href: "blog.html" },
  { key: "contact",     label: "Contact",                  href: "contact.html" },
];

const LOGO_SVG = `
<svg class="brand__mark" viewBox="0 0 48 48" fill="none" aria-hidden="true">
  <rect x="1.5" y="1.5" width="45" height="45" rx="12" stroke="#c9a05c" stroke-width="1.5"/>
  <path d="M17 13v13.5c0 3.6-1.8 5.5-4.6 5.5-1.6 0-2.9-.6-3.8-1.6" stroke="#f4efe4" stroke-width="2.4" stroke-linecap="round" fill="none"/>
  <path d="M25 13v22M25 24l9-11M27 24l9 11" stroke="#f4efe4" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <path d="M33 9c2.6.4 4.6 2.2 5 4.8-2.6-.4-4.6-2.2-5-4.8z" fill="#c9a05c"/>
</svg>`;

const ICON = {
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  menu:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  pin:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>',
  mail:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
  facebook:  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 9h3V6h-3c-2.2 0-3.5 1.4-3.5 3.6V11H8v3h2.5v7h3v-7H16l.5-3h-3V9.8c0-.6.3-.8 1-.8z"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none"/></svg>',
  youtube:   '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 8.2a3 3 0 0 0-2.1-2.1C18 5.5 12 5.5 12 5.5s-6 0-7.9.6A3 3 0 0 0 2 8.2 31 31 0 0 0 1.6 12 31 31 0 0 0 2 15.8a3 3 0 0 0 2.1 2.1c1.9.6 7.9.6 7.9.6s6 0 7.9-.6a3 3 0 0 0 2.1-2.1c.3-1.3.4-2.5.4-3.8s-.1-2.5-.4-3.8zM10 15V9l5.2 3z"/></svg>',
  linkedin:  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.5 8.5h-3V21h3V8.5zM5 3.5A1.8 1.8 0 1 0 5 7a1.8 1.8 0 0 0 0-3.5zM21 21h-3v-6.4c0-1.6-.6-2.6-2-2.6-1.1 0-1.7.7-2 1.5-.1.2-.1.6-.1.9V21h-3V8.5h3v1.7c.4-.7 1.2-1.7 3-1.7 2.2 0 3.8 1.4 3.8 4.5V21z"/></svg>',
};

const badge = (icon) => `<span class="badge">${icon}</span>`;

function buildHeader(active) {
  const links = NAV_LINKS
    .map((l) => `<a href="${l.href}"${l.key === active ? ' class="is-active"' : ""}>${l.label}</a>`)
    .join("");
  return `
  <div class="container header-inner">
    <a class="brand" href="index.html" aria-label="Dr. Jahangir Kabir — home">
      ${LOGO_SVG}
      <span>
        <span class="brand__name">Dr. Jahangir Kabir</span>
        <span class="brand__tag">Physician · Lifestyle Specialist · Founder of JK Lifestyle</span>
      </span>
    </a>
    <nav class="nav" id="primary-nav" aria-label="Primary">${links}<a class="btn btn--gold nav__cta" href="contact.html">Start Your Health Journey ${badge(ICON.arrow)}</a></nav>
    <div class="header-cta">
      <a class="btn btn--gold" href="contact.html">Start Your Health Journey ${badge(ICON.arrow)}</a>
      <button class="nav-toggle" id="nav-toggle" aria-label="Open menu" aria-expanded="false" aria-controls="primary-nav">${ICON.menu}</button>
    </div>
  </div>`;
}

function buildFooter() {
  const quick = [
    ["About Dr. Jahangir Kabir", "about.html"],
    ["The Five Pillars", "5-pillars.html"],
    ["Ecosystem", "ecosystem.html"],
    ["Programs", "programs.html"],
    ["Blog", "blog.html"],
    ["Contact", "contact.html"],
  ];
  const orgs = [
    ["Health Revolution", "https://www.healthrevolutionltd.com/"],
    ["Ultimate Organic Life", "https://ultimateorganiclife.com/"],
    ["JK Fitness Arena", "https://www.jkfitnessarena.com/"],
    ["JK Food Arena", "https://www.facebook.com/JkFoodArenaLtd/"],
    ["JK Prakritik Krishi", "https://www.facebook.com/JkPrakritikKrishi/"],
    ["JK Tech", "https://www.facebook.com/jktechltd"],
    ["Sinbad", "https://www.sinbadresort.com/"],
  ];
  const li = (rows) => rows.map(([t, h]) => `<li><a href="${h}">${t}</a></li>`).join("");
  const liExt = (rows) =>
    rows
      .map(([t, h]) =>
        h.startsWith("http")
          ? `<li><a href="${h}" target="_blank" rel="noopener">${t}</a></li>`
          : `<li><a href="${h}">${t}</a></li>`
      )
      .join("");
  return `
  <div class="container">
    <div class="footer-grid">
      <div class="footer-brand">
        <a class="brand" href="index.html" aria-label="Dr. Jahangir Kabir — home">
          ${LOGO_SVG}
          <span>
            <span class="brand__name">Dr. Jahangir Kabir</span>
            <span class="brand__tag">Physician · Lifestyle Specialist · Founder of JK Lifestyle</span>
          </span>
        </a>
        <p class="footer-about">Helping people heal naturally and live a disease-free, medicine-free life through balanced diet, fasting, exercise, sleep and mental peace.</p>
        <div class="social">
          <a href="https://www.facebook.com/DrJahangirkabircmc/" target="_blank" rel="noopener" aria-label="Facebook">${ICON.facebook}</a>
          <a href="https://www.youtube.com/@DrJahangirKabir" target="_blank" rel="noopener" aria-label="YouTube">${ICON.youtube}</a>
        </div>
      </div>

      <div class="footer-col">
        <h5>Quick Links</h5>
        <ul>${li(quick)}</ul>
      </div>

      <div class="footer-col">
        <h5>Our Organizations</h5>
        <ul>${liExt(orgs)}</ul>
      </div>

      <div class="footer-col contact">
        <h5>Contact Information</h5>
        <ul class="contact-list">
          <li>${ICON.pin}<span>House 29/31, Noor Tower (Block D),<br>Road 01, Sector 02, Jahurul Islam City,<br>Aftabnagar, Badda, Dhaka 1212</span></li>
          <li>${ICON.phone}<a href="tel:+8809678242404">+880 9678 242404</a></li>
          <li>${ICON.mail}<a href="mailto:info@ultimateorganiclife.com">info@ultimateorganiclife.com</a></li>
        </ul>
      </div>

      <div class="footer-col newsletter">
        <h5>Newsletter</h5>
        <p>Get practical health tips, updates, and inspiration.</p>
        <form onsubmit="return false;">
          <label class="sr-only" for="footer-email">Email address</label>
          <input id="footer-email" type="email" placeholder="Your Email Address" autocomplete="email">
          <button type="submit">Subscribe</button>
        </form>
      </div>
    </div>

    <div class="footer-bottom">
      <span>&copy; 2026 Dr. Jahangir Kabir. All Rights Reserved.</span>
      <span class="links">
        <a href="#">Privacy Policy</a>
        <a href="#">Terms &amp; Conditions</a>
      </span>
    </div>
  </div>`;
}

function buildActionBar() {
  return `
  <a class="mobile-bar__icon" href="tel:+8809678242404" aria-label="Call">${ICON.phone}</a>
  <a class="btn btn--gold mobile-bar__cta" href="contact.html">Get Started ${badge(ICON.arrow)}</a>`;
}

document.addEventListener("DOMContentLoaded", () => {
  const active = document.body.dataset.page || "home";

  const header = document.getElementById("site-header");
  if (header) {
    header.className = "site-header";
    header.innerHTML = buildHeader(active);
  }

  const footer = document.getElementById("site-footer");
  if (footer) {
    footer.className = "site-footer";
    footer.innerHTML = buildFooter();
  }

  // Mobile sticky action bar (thumb-reachable primary actions on phones)
  if (!document.querySelector(".mobile-bar")) {
    const bar = document.createElement("div");
    bar.className = "mobile-bar";
    bar.setAttribute("aria-label", "Quick actions");
    bar.innerHTML = buildActionBar();
    document.body.appendChild(bar);
  }

  // Mobile nav toggle
  const toggle = document.getElementById("nav-toggle");
  const nav = document.getElementById("primary-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      document.body.classList.toggle("nav-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      toggle.innerHTML = open ? ICON.close : ICON.menu;
    });
  }

  // ---- Dynamic images: resolve [data-img] / [data-bg] from images/manifest.json ----
  // Change any image by editing images/manifest.json (or replacing the file) — no code edits needed.
  const IMG_FALLBACK =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%23ece5d6'/%3E%3Cpath d='M150 205c18-66 86-104 156-116-18 66-86 104-156 116z' fill='%23c9a05c' opacity='.45'/%3E%3C/svg%3E";
  const wireFallback = (img) => {
    img.addEventListener("error", function onErr() {
      img.removeEventListener("error", onErr);
      if (img.getAttribute("src") !== IMG_FALLBACK) img.src = IMG_FALLBACK;
    });
  };
  const applyImages = (map) => {
    document.querySelectorAll("img[data-img]").forEach((img) => {
      const src = map && map[img.dataset.img];
      if (src) img.src = src;
      wireFallback(img);
    });
    document.querySelectorAll("[data-bg]").forEach((el) => {
      const src = map && map[el.dataset.bg];
      if (src) el.style.setProperty("--cms-bg", `url("${src}")`);
    });
  };
  fetch("images/manifest.json", { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : null))
    .then(applyImages)
    .catch(() => applyImages(null));

  // Expose icons for inline page use if needed
  window.SITE_ICON = ICON;
});
