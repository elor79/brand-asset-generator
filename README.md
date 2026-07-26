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
npm start          # boots ComfyUI *and* the app
```

The app opens automatically at http://localhost:5174 (Cadence owns 5173), and the AI backend on
http://127.0.0.1:8188.

## Requirements & models

For hardware requirements, disk footprints, the local image models and their
licences (Z-Image, SDXL/Juggernaut, FLUX, the ESRGAN upscale tail), and measured
generation times, see the cross-app technical overview:
[`../cadence/docs/TECH-OVERVIEW.md`](../cadence/docs/TECH-OVERVIEW.md). It covers
all three apps in one page; this generator is the Medartis entry.

`npm start` (or double-clicking **Start Medartis Asset Generator.command**) is
the normal way in. It does not ship its own ComfyUI: if one is already answering
on 8188 it **reuses** it, otherwise it looks in `$COMFY_HOME`, `./ComfyUI`, the
IBRA generator's ComfyUI, and `~/ComfyUI`. One backend, shared — the weights are
100+ GB and two installs would just fight over the same GPU.

| command | what it does |
| --- | --- |
| `npm start` | ComfyUI + the app (this is the one you want) |
| `npm run dev` | the app only — § 12 GENERATE will report no backend |
| `npm run comfy` | ComfyUI only |
| `npm run setup:conditioning` | one-time: IP-Adapter + ControlNet, for § 12 |
| `npm test` | the whole check suite: artwork, layouts, Group derivation, PDF parity, docs figures |
| `npm run setup:zimage` | one-time: Z-Image Turbo — the recommended Mac engine (~20 GB) |

Ports are pinned (`strictPort`). If 5174 is taken, the app says so rather than
quietly moving to another port and leaving your saved work stranded in a
different browser-storage bucket (storage is per port).

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
