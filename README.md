# Dr. Jahangir Kabir — Landing Page

A pixel-faithful, premium recreation of the Dr. Jahangir Kabir homepage
(deep forest green + gold + cream — luxury editorial wellness style).

## Open it

Just double-click **`index.html`** — no build step, no server required.
Everything is plain HTML/CSS with a tiny bit of vanilla JS.

## Structure

```
jk-lifestyle-website/
├── index.html        ← the homepage (the full clone)
├── about.html        ┐
├── six-pillars.html  │  inner pages — same header/footer, branded content
├── ecosystem.html    │
├── programs.html     │
├── blog.html         │
├── contact.html      ┘
├── css/styles.css    ← the entire design system & all section styles
├── js/site.js        ← the shared header + footer (single source of truth)
└── images/           ← drop real photos here (see below)
```

## Header & footer — edit once, applied everywhere

The header and footer are defined **one time** in [`js/site.js`](js/site.js)
and injected into every page (each page just has
`<header id="site-header"></header>` and `<footer id="site-footer"></footer>`).
Change the nav, logo, contact details, or footer links there and the update
appears on **all** pages automatically — they always stay identical.

## Adding the real photos

The page ships with tasteful styled placeholders so it looks complete out of
the box. To use real images, drop files in `images/` and swap the placeholder.

For example, in `index.html` the hero portrait is:

```html
<div class="photo-fallback" role="img" aria-label="Portrait of Dr. Jahangir Kabir">
  <svg ...></svg>
</div>
```

Replace it with:

```html
<img class="photo" src="images/dr-hero.jpg" alt="Portrait of Dr. Jahangir Kabir">
```

The same `.photo-fallback` pattern is used for the About portrait and the
Final-message avatar. The seminar, products, stones and phone visuals are pure
CSS — replace those `<div class="media">…</div>` blocks with `<img>` tags the
same way if you have real imagery.

## Fonts

Loaded from Google Fonts: **Playfair Display** (headings), **Inter** (body),
**Great Vibes** (the signature). Requires an internet connection on first load;
otherwise the system fallbacks defined in the CSS apply.

## Colors (the exact palette)

| Token            | Value     | Use                          |
|------------------|-----------|------------------------------|
| Deep green       | `#122319` | hero / header / dark bands   |
| Panel green      | `#1a3725` | cards on dark                |
| Gold             | `#c9a05c` | primary accent / buttons     |
| Soft gold        | `#ddbd83` | highlights / signature       |
| Cream            | `#f4efe4` | light section background     |
| Ink              | `#16301f` | headings on light            |

All tokens live at the top of [`css/styles.css`](css/styles.css) as CSS
variables, so the whole theme can be retuned in one place.
