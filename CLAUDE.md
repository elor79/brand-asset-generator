# Medartis Brand Asset Generator — project memory for AI-assisted development

Read this before exploring; it replaces a repo audit.

## What this is
A studio in the browser: React + Vite render every asset to a `<canvas>` and
re-render it as vector for PDF. Governing principle: **silent wrongness is
worse than a crash** — when the tool stops you, it is protecting the mark.
Port **5174** (strictPort; Cadence owns 5173). AI backend = ComfyUI on
**8188**, shared with the IBRA generator — adopt a running one, never kill it.

## Golden rules
1. **Verify every change**: `npm test` (whole check suite + docs figure
   linter) and `npx vite build`. Commit per logical step, as
   `git -c user.name="Eddie" -c user.email="info@elorenz.ch" commit`.
2. **No emojis**; typographic symbols only (§ · → ▲ ⚡ ◆ ⤢ ⟳).
3. **Honesty over checkboxes**: no fake options (no PDF/X switch on RGB
   files); run reports state what the server ACTUALLY did; the negative
   prompt's honesty line never implies it worked when the engine ignored it.
4. **Single sources of truth**: brand geometry lives in constants/functions
   used by BOTH renderers (canvas + PDF); `test_pdfpaths.mjs` catches drift.
   Gradients derive from sub-brand hexes — never invented colours.
5. **Comments explain WHY** — every brand rule cites its reason (clear space
   = 1.5 × the 'd', lanyard single line because 20 mm has no second line…).

6. **Documentation moves with the code — same commit, no exceptions.**
   User-visible changes update the generator chapter in the Cadence manual
   (`../cadence/public/manual/generator.html`) in the SAME commit; anything
   that makes a statement in this file untrue is fixed in the same commit.
   Docs drift is a failing review, exactly like a failing test.

## Architecture
One big component `src/MedartisBrandGenerator.jsx` (~11k lines — known debt,
documented; extract modules only when touching an area; the § GENERATE panel
is already out, in `src/GenerateSection.jsx`, with the shared primitives it
needs — BRAND, Section, imgToDataUrl — moved to `src/uiKit.jsx` so neither
file imports the other) + split modules
(`customFormats.js`, `brochure.js`, `gradient.js`, `groupBrands.js`,
`groupLockup.js`, `zip.js`, `templatePref.js`). Sidebar sections are numbered
from `SECTION_ORDER` (visible-only). Gen pipeline = `vite-plugin-genai.js`
middleware on `/api/gen/*` → ComfyUI: engines zimage (recommended; Apache-2.0)
/ flux (non-commercial) / sdxl (conditioning engine) / sdxl-turbo. Draft
ladder: half-res same-seed draft first → final ANCHORED on the draft (img2img,
skipped when batch>1) → optional latent refine (~2K, tiled VAE decode on MPS)
→ ESRGAN tail. Per-tile pipeline (ported from IBRA): `✦ refine`
(/api/gen/refine, zimage img2img), `⤢ 2X` upscale, `ⓘ` provenance panel
(copy prompt, per-tile download, save to library); variants up to ×6;
house-look strength slider. Both generators share the same feature set. Live previews stream as binary WS frames (needs
`--preview-method`, set by the launcher). Prompt = house_style.json parts; the
LoRA trigger word is stripped when the LoRA did not resolve.

## Key files
- `src/GenerateSection.jsx` — the § GENERATE panel (extracted from the monolith)
- `src/uiKit.jsx` — BRAND tokens + Section + imgToDataUrl, shared by both
- `vite-plugin-genai.js` — the whole gen backend (workflows patched by node id)
- `ai/workflows/*.api.json` — node graphs (ids: 6 prompt, 5 latent, 3/17
  sampler, 8 VAEDecode, 90/91/92 upscale tail, 9 save)
- `ai/prompt/house_style.json` — trigger/look/realism/negative + safety gate
- `Start Medartis Asset Generator.command` — boots app + ComfyUI (flags are
  version-proofed: probe `main.py --help`, pass only supported flags)
- `docs/` — self-contained docs site; `npm run docs` rebuilds docs.html
- `scripts/check-figures.mjs` — geometric figure linter

## Things that bite
- ComfyUI argparse exits on unknown flags — never hardcode tuning flags.
- MPS: no fp8 (weightDtype guards it); big VAE decodes need VAEDecodeTiled.
- Saved library + presets: library is IndexedDB (`medartis-bag`); presets are
  localStorage — do not move data between them casually.
- The mount/CI never needs ComfyUI: all checks run without it.

## Token-efficiency rules for agents
- Grep anchors; patch by string-replacement with assert-on-count.
- Never read MedartisBrandGenerator.jsx end-to-end; navigate by § names.
  Generation UI questions start in src/GenerateSection.jsx, not the monolith.
