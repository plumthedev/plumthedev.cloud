# plumthedev.cloud

Personal site of Kacper Pruszyński, backend engineer and team lead. One page that is a business card and a CV at the same time.

## Look and feel

- Raw, minimal, 2000s/2010s web. One 600px column, Verdana 13px, tables for label/value rows, plain underlined links.
- Dark only. Colours are tokens on `:root` in `src/assets/styles/index.css`: `--bg #121110`, `--fg #E8E4DA`, `--muted #817D75`, `--accent #B57EDC` (plum).
- The accent is used sparingly: link and button hover, logo sparks, the Chuck message on the logo.
- No hero, cards, gradients, icons or marketing sections. New things should look like they always belonged to this page.

## Page structure (`src/index.html`)

- Sticky header: name, small LED logo "plumthedev" on the right (baseline aligned), italic grey motto under it.
- Bio (2 paragraphs), then links: cv (print this page), github, linkedin, e-mail.
- Sections: **path** (jobs as a timeline), **how I work** (short traits), **stack** (concepts and tools), **off the clock** (hobbies).
- Footer: last updated (build date, links to the commit), analytics on/off, copyright. Its tooltip hints the easter egg.
- JSON-LD `Person` at the bottom. Keep `knowsAbout` in sync with the stack section.

## Printing (the page is the CV)

There is no separate CV file. "print this page" calls `print()` and `@media print` in `index.css` turns the page into the CV:

- light colours (white background, black text), 16mm page margins, full width;
- hides the LED logo, the "cv / print this page" row and the footer;
- the header is static on paper (no sticky bar, no fade) so it never covers text;
- `h2` avoids a break after it and table rows never split.

Sections may break between pages, so each part that can land on a new page needs its own heading. That is why concepts and tools live in their own **stack** section. Check changes with Chrome headless:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --no-pdf-header-footer --print-to-pdf=out.pdf http://localhost:5173/
```

## Scripts (`src/assets/scripts/`)

- `led.ts`: canvas LED board in a 5×7 font. The logo glows at 0.6, random dots spark in the accent colour. `say(text)` scrolls a message through it. Respects `prefers-reduced-motion`.
- `chuck.ts`: easter egg, a roundhouse kick animation plus a Chuck Norris fact on the logo. Triggers: typing "chuck", clicking the logo, holding the copyright line on a phone.
- `analytics.ts`: Google Tag Manager, on by default, the footer switch stores the choice in `localStorage`.
- `index.ts`: boot, build date, print button, service worker.

## Build and deploy

- Vite, root `src`. `npm run dev`, `npm run build`, `npm run preview`.
- The `inlineAssets` plugin in `vite.config.js` inlines CSS and JS into `index.html` and adds a CSP `<meta>` with hashes of the inline code. A new external origin must be added to that CSP.
- `src/public/sw.js` is network first, the cache is only an offline fallback. `src/public/404.html` sends old links to the home page.
- Push to `master` deploys to GitHub Pages via `.github/workflows/deploy.yml` (actions pinned to SHAs).
- The Open Graph image is drawn with the LED font and lives twice: `src/assets/images/open-graph-preview.svg` (source) and `src/public/images/open-graph-preview.png` (served). Update both together.
