# Word Hunter website

Official website and privacy policy for
[Word Hunter](https://github.com/Ironship/WordHunter), published at
<https://ironship.github.io/WordHunter-site/>.

The site is plain HTML, CSS and JavaScript with no build step. It is deployed
to GitHub Pages from the `main` branch by the `Deploy GitHub Pages` workflow.

## Keeping it current

The download page follows new releases on its own: `site.js` asks the GitHub
API for the latest stable release and updates the version numbers and the
versioned file names (DMG, AppImage, DEB). The Windows, Android and Flatpak
buttons use `releases/latest/download/…` links. The static HTML carries the
last release by hand, so the page stays correct when the API is unavailable.

For each new release:

1. Replace `1.1.1` in `index.html` with the new version (fallback links and
   `data-version` text).
2. Add a card for it at the top of **What's new** and keep the previous one.
3. If the interface changed, refresh the screenshots (below).

## Screenshots

`tools/capture-screenshots.mjs` renders the current Word Hunter interface in
Chromium with a seeded German demo profile and writes the WebP screenshots to
`docs/screenshots/` and the link preview to `docs/og-image.png`:

```sh
# in a Word Hunter checkout
npm ci && npm run build:frontend

# in this repository (needs Playwright with Chromium)
node tools/capture-screenshots.mjs ../WordHunter
```

## Local preview

Serve this directory with any static HTTP server, for example:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>.
