# Medartis Brand Asset Generator

Local development version of the brand asset generator.

## Setup

You need **Node.js 18 or newer**. Check with:

```bash
node -v
```

If you don't have Node, install it from https://nodejs.org (LTS version) or via Homebrew on Mac:

```bash
brew install node
```

## Run

From this folder:

```bash
npm install
npm run dev
```

The app opens automatically at http://localhost:5173

## Build for production

```bash
npm run build
```

Output goes to `dist/`. Serve it with any static host (Vercel, Netlify, Nginx, or `npm run preview` to test locally).

## Structure

```
medartis-app/
├── index.html              ← entry HTML, loads Inter font
├── package.json            ← dependencies
├── vite.config.js          ← dev server config
└── src/
    ├── main.jsx            ← React mount point
    └── MedartisBrandGenerator.jsx   ← the whole app
```

The whole tool is one component in `MedartisBrandGenerator.jsx`. When you're ready to grow it, split it into modules:

- `src/brand.js` — BRAND config (colors, claim, fonts)
- `src/formats.js` — FORMATS dimensions
- `src/templates.js` — content TEMPLATES
- `src/layouts/` — one file per draw function
- `src/library/` — starter assets (eventually real Medartis photography)
- `src/components/` — UI atoms (Slider, Section, etc.)

## Next steps toward a server app

When you're ready to move from local-only:

1. **Real photography library** — drop Medartis JPEGs into `public/library/` and replace `STARTER_ASSETS` with manifest references.
2. **Logo upload slot** — add an SVG logo input that replaces the wordmark text in `drawBrandBar`.
3. **Preset save/load** — serialize the full state (format, layout, content, palette) to JSON for recall.
4. **Server rendering** — when you want server-side PNG generation, swap `<canvas>` for [node-canvas](https://www.npmjs.com/package/canvas) or [Satori](https://github.com/vercel/satori). The layout functions take `(ctx, frame, content, image, opts)` and are framework-agnostic.
5. **Multi-tenant brands** — the `BRAND` object becomes a per-tenant config loaded by route or subdomain.
