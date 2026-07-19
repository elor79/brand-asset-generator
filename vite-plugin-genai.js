// Vite dev-server plugin: generative image/video backends
// Mirrors vite-plugin-canto.js so the whole tool still runs from `npm run dev`.
//
// Providers
//   local       — ComfyUI on this machine (Flux.1 [dev] + the IBRA house LoRA)
//   higgsfield  — cloud; used for still → motion (Reels/Stories) and as a
//                 fallback when the local box isn't running
//
// Env (.env.local):
//   COMFY_URL             default http://127.0.0.1:8188
//   COMFY_LORA_NAME       default medartis_house_flux.safetensors
//   HIGGSFIELD_API_KEY    optional — enables the cloud provider
//   HIGGSFIELD_API_URL    default https://platform.higgsfield.ai/v1
//
// Routes
//   GET  /api/gen/status                  → { providers, ready, missing[], lora }
//   POST /api/gen/image    {prompt, w, h, surface, program, seed, strength}
//   POST /api/gen/expand   {image(dataURL), w, h, prompt}     ← format-aware outpaint
//   POST /api/gen/video    {image(dataURL), prompt, ratio, duration}
//   GET  /api/gen/job/:id                 → { status, progress, images[], video }
//
// LICENCE: FLUX.1 [dev] is NON-COMMERCIAL. Generated assets are flagged
// ai_generated + non_commercial all the way through to the UI badge.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const COMFY = () => (process.env.COMFY_URL || 'http://127.0.0.1:8188').replace(/\/$/, '');
const LORA  = () => process.env.COMFY_LORA_NAME || 'medartis_house_flux.safetensors';
// A Flux LoRA cannot load on SDXL and vice versa — different architectures, so
// they are different files with different names.
const SDXL_LORA = () => process.env.COMFY_SDXL_LORA_NAME || 'medartis_house_sdxl.safetensors';
const HF_KEY = () => process.env.HIGGSFIELD_API_KEY || '';
const HF_URL = () => (process.env.HIGGSFIELD_API_URL || 'https://platform.higgsfield.ai/v1').replace(/\/$/, '');

const readJson = (p) => JSON.parse(fs.readFileSync(path.join(__dirname, p), 'utf8'));

// Load a workflow and drop every "_comment"/"_licence"/"_upscale"-style doc key.
// ComfyUI treats EVERY top-level key as a node, so a string value there crashes
// its validator with a 500 rather than a readable validation error.
function loadWorkflow(file) {
  const wf = readJson(file);
  for (const k of Object.keys(wf)) if (k.startsWith('_')) delete wf[k];
  return wf;
}
const STYLE = () => readJson('ai/prompt/house_style.json');
const writeStyle = (s) => fs.writeFileSync(path.join(__dirname, 'ai/prompt/house_style.json'), JSON.stringify(s, null, 2) + '\n');

// Flip the prompt gate as a DECISION, not a buried flag: enabling moves the
// archived terms back into force; disabling archives them again. Either way the
// current state is visible in the UI (§ GENERATE) and in this file's history.
function setSafetyGate(enabled) {
  const s = STYLE();
  if (enabled) {
    const active = (s.blocklist || []).length ? s.blocklist : (s.blocklist_archived || []);
    s.blocklist = active;
    s.blocklist_enabled = true;
    if (!s.blocklist_message) {
      s.blocklist_message = 'The Medartis safety gate stopped this prompt. People presented as clinicians stay real photography — generate the place, not the person.';
    }
  } else {
    s.blocklist_archived = [...new Set([...(s.blocklist_archived || []), ...(s.blocklist || [])])];
    s.blocklist = [];
    s.blocklist_enabled = false;
  }
  writeStyle(s);
  return { enabled: s.blocklist_enabled === true, terms: (enabled ? s.blocklist : s.blocklist_archived).length };
}

// ── jobs ───────────────────────────────────────────────────────────────
// In-memory; a dev tool doesn't need a queue. { status, progress, images, error }
const JOBS = new Map();
const newJob = () => {
  const id = Math.random().toString(36).slice(2, 10);
  JOBS.set(id, { status: 'queued', progress: 0, images: [] });
  return id;
};
const patchJob = (id, p) => JOBS.set(id, { ...(JOBS.get(id) || {}), ...p });

// ── prompt compiler ────────────────────────────────────────────────────
// The user never reaches the model directly. We compile:
//   [trigger] + [subject] + [house look] + [realism] + [surface/program context]
// and attach the negative. This is what keeps generated frames sitting next to
// the library instead of next to generic AI stock.
//
// REALISM — READ THIS BEFORE "JUST ADDING NEGATIVES":
// FLUX.1 [dev] is guidance-distilled. At CFG 1 it does not read a negative
// prompt AT ALL — handing it a beautiful list of things to avoid changes
// precisely nothing. So realism is asserted POSITIVELY (camera, optics, light
// transport, skin texture, sensor grain) and only *additionally* defended with
// the negative on engines that actually consume one (SDXL / Turbo, or Flux with
// strict negatives, which raises CFG above 1 at the cost of speed).
// `negativeHonoured` is reported back so the UI can never lie about it.
function compilePrompt({ prompt, surface, program, realism = true, extraNegative = '' }) {
  const s = STYLE();
  const parts = [s.trigger, (prompt || '').trim()];
  parts.push(...s.look);
  if (realism && Array.isArray(s.realism)) parts.push(...s.realism);
  if (surface && s.surfaces[surface]) parts.push(s.surfaces[surface]);
  if (program && s.programs[program]) parts.push(s.programs[program]);
  const negative = [...(s.negative || []), (extraNegative || '').trim()]
    .filter(Boolean).join(', ');
  return {
    positive: parts.filter(Boolean).join(', '),
    negative,
  };
}

// The prompt gate. OFF by default — removed at the brand owner's instruction.
// The mechanism stays because a switch is worth more than a deletion: flip
// blocklist_enabled in ai/prompt/house_style.json and put terms back in
// `blocklist`, and it refuses again. The archived list is in the same file.
function safetyCheck(prompt) {
  const s = STYLE();
  const list = s.blocklist_enabled === true ? (s.blocklist || []) : [];
  if (!list.length) return { ok: true };
  const text = ` ${(prompt || '').toLowerCase()} `;
  const hit = list.find((w) => text.includes(` ${w} `) || text.includes(` ${w},`) || text.includes(` ${w}.`));
  return hit ? { ok: false, term: hit, message: s.blocklist_message } : { ok: true };
}

// ── ComfyUI ────────────────────────────────────────────────────────────
// Flux likes multiples of 16; also cap the pixel budget so a 3508px A4 canvas
// doesn't try to generate at print resolution (generate at screen res, then the
// canvas upsamples — or run an upscaler pass separately).
const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || lo)));
const clampNum = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || lo));

// EVERY diffusion model has a native training resolution, and pushing past it is
// what produces duplicated subjects and giants — the model tiles what it knows.
//   SDXL Turbo : trained at 512²   → generate at 512², never 1024²
//   Flux.1 dev : trained around 1MP → 1024² is the sweet spot
// So: generate NATIVE at the canvas's aspect ratio, then upscale to the canvas.
const NATIVE_PX = {
  'sdxl-turbo': 512 * 512,
  flux: 1024 * 1024,
  zimage: 1024 * 1024,   // Z-Image Turbo (S3-DiT, 6B) — 1MP native like Flux
};

function latentSize(w, h, engine = 'flux', budgetScale = 1) {
  const budget = (NATIVE_PX[engine] || NATIVE_PX.flux) * budgetScale;
  const ratio = (w || 1024) / (h || 1024);
  let lw = Math.sqrt(budget * ratio);
  let lh = lw / ratio;
  // SD/Flux latents want multiples of 64; clamp the short side so extreme canvas
  // ratios (a 4:1 banner, a lanyard) don't collapse into a sliver the model
  // cannot compose in.
  const round64 = (v) => Math.max(320, Math.round(v / 64) * 64);
  return { width: round64(lw), height: round64(lh) };
}

// Target size on the canvas — what we upscale TO. Capped so a 3508 px A4 doesn't
// ask for a 4×-of-4× monster.
function targetSize(w, h, maxEdge = 2560) {
  const MAX_EDGE = maxEdge;
  const scale = Math.min(1, MAX_EDGE / Math.max(w || 1, h || 1));
  const even = (v) => Math.max(64, Math.round(v * scale / 8) * 8);
  return { width: even(w || 1024), height: even(h || 1024) };
}

// Apple's MPSGraph refuses single tensors past INT_MAX elements — which is what
// a one-shot VAEDecode of a ~2048px latent builds ("MPSGraph does not support
// tensor dims larger than INT_MAX"). Tiled decoding produces the identical
// image in 512px tiles and never allocates the monster. Applied automatically
// on MPS whenever the decode is big enough to matter.
function useTiledVaeDecode(wf) {
  if (wf['8']?.class_type === 'VAEDecode') {
    wf['8'] = {
      class_type: 'VAEDecodeTiled',
      inputs: { ...wf['8'].inputs, tile_size: 512, overlap: 64, temporal_size: 64, temporal_overlap: 8 },
    };
  }
  return wf;
}

// The upscale tail (nodes 90/91/92) is part of the workflow FILES, so the graph
// in ComfyUI's sidebar is the graph we run. Here we only bind it to reality:
// the real model name, the real canvas size — or bypass it entirely when no
// upscale model is installed (then SaveImage goes straight off the VAEDecode).
function configureUpscale(wf, target, upscaleModel) {
  if (!wf['92']) return wf;
  if (!upscaleModel) {
    wf['92'].inputs.image = ['8', 0];   // skip ESRGAN, keep the exact-size resize
    delete wf['90'];
    delete wf['91'];
  } else {
    wf['90'].inputs.model_name = upscaleModel;
  }
  wf['92'].inputs.width = target.width;
  wf['92'].inputs.height = target.height;
  return wf;
}

async function comfyFetch(path, ms = 20000) {
  const r = await fetch(`${COMFY()}${path}`, { signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(`ComfyUI ${r.status} on ${path}`);
  return r.json();
}

// /object_info is several MB and slow to serialise once custom node packs are
// installed. Cache it — the status route is polled every few seconds.
let OBJ_CACHE = { at: 0, data: null };
async function comfyObjectInfo() {
  if (OBJ_CACHE.data && Date.now() - OBJ_CACHE.at < 30000) return OBJ_CACHE.data;
  const data = await comfyFetch('/object_info', 20000);
  OBJ_CACHE = { at: Date.now(), data };
  return data;
}

// Is ComfyUI there at all? Cheap call — never gate this on /object_info.
async function comfyAlive() {
  try { await comfyFetch('/system_stats', 3000); return true; } catch { return false; }
}

// What hardware is ComfyUI on? fp8 weights are a CUDA memory trick and do not
// exist on Apple's MPS backend ("Undefined type Float8_e4m3fn"), so the dtype is
// chosen from the device rather than hard-coded in the workflow.
async function comfyDevice() {
  try {
    const j = await comfyFetch('/system_stats', 3000);
    const d = (j.devices || [])[0] || {};
    const type = (d.type || '').toLowerCase();     // 'cuda' | 'mps' | 'cpu'
    return {
      type,
      name: d.name || type,
      vramGb: d.vram_total ? Math.round(d.vram_total / 1e9) : null,
    };
  } catch {
    return { type: '', name: 'unknown', vramGb: null };
  }
}

async function weightDtype(device) {
  if (process.env.COMFY_WEIGHT_DTYPE) return process.env.COMFY_WEIGHT_DTYPE;
  const dev = device || await comfyDevice();
  return dev.type === 'cuda' ? 'fp8_e4m3fn' : 'default';
}

// ComfyUI reports a combo input in TWO shapes depending on version:
//   old:  [ ["a.safetensors", "b.safetensors"], {...} ]
//   new:  [ "COMBO", { options: ["a.safetensors", ...] } ]
// Reading [0] blindly on the new shape yields the STRING "COMBO", and then
// list[0] is the character "C" — which is exactly how we ended up asking for an
// upscale model called 'C'. Handle both.
function comboOptions(spec) {
  if (!Array.isArray(spec)) return [];
  const [first, second] = spec;
  if (Array.isArray(first)) return first;                       // old shape
  if (second && Array.isArray(second.options)) return second.options; // new shape
  return [];
}


// ═══ WHAT ARCHITECTURE IS THAT CHECKPOINT, REALLY? ═══════════════════════════
// Filenames lie. "epicrealism_naturalSinRC1VAE" is an SD 1.5 model; load it into
// an SDXL graph and you get 1024px latents, an SDXL VAE and an SDXL LoRA applied
// to a 1.5 UNet — which comes back as a rainbow-fried face, not as an error.
// ComfyUI will not stop you: every checkpoint is just a file to CheckpointLoader.
//
// So we read the file. A .safetensors begins with an 8-byte little-endian length,
// then that many bytes of JSON listing every tensor. The tensor NAMES tell you the
// architecture with certainty:
//
//   SDXL      two text encoders → conditioner.embedders.1 (OpenCLIP-G)
//   SD 1.x/2  one              → cond_stage_model / conditioner.embedders.0 only
//   no CLIP   neither          → UNet-only export, Flux, SD3, video models
//
// Reading ~1 MB per file, cached. Cheap, and it is the difference between a
// picker that lists what works and one that lists what happens to be on disk.
const CKPT_CACHE = new Map();

const MODEL_DIRS = () => {
  const dirs = [];
  const add = (d) => { try { if (d && fs.statSync(d).isDirectory()) dirs.push(d); } catch {} };
  if (process.env.COMFY_HOME) add(path.join(process.env.COMFY_HOME, 'models', 'checkpoints'));
  if (process.env.WEBUI_HOME) add(path.join(process.env.WEBUI_HOME, 'models', 'Stable-diffusion'));
  add(path.join(process.env.HOME || '', 'Documents/my_apps/stable-diffusion-webui/models/Stable-diffusion'));
  return dirs;
};

function findCkptFile(name) {
  for (const dir of MODEL_DIRS()) {
    const direct = path.join(dir, name);
    if (fs.existsSync(direct)) return direct;
    // ComfyUI reports "subfolder/name.safetensors" — and A1111 nests too.
    try {
      for (const sub of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!sub.isDirectory()) continue;
        const p2 = path.join(dir, sub.name, path.basename(name));
        if (fs.existsSync(p2)) return p2;
      }
    } catch {}
  }
  return null;
}

/** 'sdxl' | 'sd15' | 'no-clip' | 'unknown' — read from the tensor index itself. */
function checkpointArch(name) {
  if (CKPT_CACHE.has(name)) return CKPT_CACHE.get(name);
  let arch = 'unknown';
  const file = findCkptFile(name);
  if (file && /\.safetensors$/i.test(file)) {
    try {
      const fd = fs.openSync(file, 'r');
      const lenBuf = Buffer.alloc(8);
      fs.readSync(fd, lenBuf, 0, 8, 0);
      const headerLen = Number(lenBuf.readBigUInt64LE(0));
      if (headerLen > 0 && headerLen < 100e6) {
        const hdr = Buffer.alloc(headerLen);
        fs.readSync(fd, hdr, 0, headerLen, 8);
        const keys = Object.keys(JSON.parse(hdr.toString('utf8')));
        const hasClipG = keys.some((k) => k.includes('conditioner.embedders.1'));
        const hasClipL = keys.some((k) => k.includes('conditioner.embedders.0') || k.startsWith('cond_stage_model.'));
        arch = hasClipG ? 'sdxl' : hasClipL ? 'sd15' : 'no-clip';
      }
      fs.closeSync(fd);
    } catch { /* unreadable → stay 'unknown' and let the name-based guess stand */ }
  }
  CKPT_CACHE.set(name, arch);
  return arch;
}

async function comfyModels() {
  const info = await comfyObjectInfo();
  const pick = (node, input) => comboOptions(info?.[node]?.input?.required?.[input]);
  return {
    unets: pick('UNETLoader', 'unet_name'),
    loras: pick('LoraLoaderModelOnly', 'lora_name'),
    vaes:  pick('VAELoader', 'vae_name'),
    clips: pick('DualCLIPLoader', 'clip_name1'),
    textEncoders: pick('CLIPLoader', 'clip_name'),
    ckpts: pick('CheckpointLoaderSimple', 'ckpt_name'),
    upscalers: pick('UpscaleModelLoader', 'model_name'),
  };
}

// Resolve the workflow against what ComfyUI ACTUALLY has. Two reasons:
//   · the weights may be named slightly differently on disk
//   · the house LoRA does not exist until it has been trained — so before then
//     we generate with BASE Flux rather than failing with a validation error
async function resolveWorkflow(wf) {
  const m = await comfyModels();
  const pick = (list, ...cands) => cands.find((c) => list.includes(c))
    || list.find((f) => cands.some((c) => f.toLowerCase().includes(c.split('.')[0].toLowerCase())));

  // Rewire every consumer of `from` to `to`, then drop it. `remap` translates the
  // output index, because slots differ between node types: a LoraLoader is
  // (MODEL 0, CLIP 1) — the same as a checkpoint — but a VAELoader is (VAE 0),
  // whereas the checkpoint's VAE is slot 2. Rewiring a VAE naively would hand
  // VAEDecode the MODEL and blow up deep inside ComfyUI.
  const bypassNode = (graph, from, to, remap = (i) => i) => {
    for (const node of Object.values(graph)) {
      for (const [k, v] of Object.entries(node.inputs || {})) {
        if (Array.isArray(v) && v[0] === from) node.inputs[k] = [to, remap(v[1])];
      }
    }
    delete graph[from];
  };

  // BOTH SDXL graphs (base+LoRA and Turbo) start with a CheckpointLoaderSimple.
  // They are told apart by the LoraLoader, not by the checkpoint — getting this
  // wrong is what sent an untrained house-LoRA name to ComfyUI and produced a
  // "Value not in list" validation error instead of quietly running base SDXL.
  if (wf['4']?.class_type === 'CheckpointLoaderSimple') {
    const isBase = wf['10']?.class_type === 'LoraLoader';
    const want = wf['4'].inputs.ckpt_name;
    const ckpt = pick(m.ckpts, want, isBase ? 'sd_xl_base' : 'sd_xl_turbo');
    if (!ckpt) {
      throw new Error(`ComfyUI has no ${want} in models/checkpoints. ` +
        `Install it, or pick another engine in the Generate panel.`);
    }
    wf['4'].inputs.ckpt_name = ckpt;

    let usedLora = null;
    if (isBase) {
      // The house LoRA does not exist until it has been trained. Generate with
      // BASE SDXL rather than failing: bypass the LoraLoader (its MODEL/CLIP
      // outputs share indices 0/1 with the checkpoint, so the rewire is exact).
      const lora = wf['10'].inputs.lora_name;
      if (lora && m.loras.includes(lora)) usedLora = lora;
      else bypassNode(wf, '10', '4');
    }

    // The SDXL VAE is a separate file; fall back to the checkpoint's baked VAE.
    if (wf['14']?.class_type === 'VAELoader') {
      const vae = pick(m.vaes, wf['14'].inputs.vae_name, 'sdxl_vae');
      if (vae) wf['14'].inputs.vae_name = vae;
      else bypassNode(wf, '14', '4', () => 2); // VAEDecode.vae → ['4', 2] = checkpoint VAE
    }

    return { wf, usedLora, ckpt, engine: isBase ? 'sdxl' : 'sdxl-turbo' };
  }

  // Z-IMAGE TURBO graph: UNETLoader(28) + single CLIPLoader(30, lumina2) + VAELoader(29).
  if (wf['28']?.class_type === 'UNETLoader' && wf['30']?.class_type === 'CLIPLoader') {
    const unet = pick(m.unets, wf['28'].inputs.unet_name, 'z_image_turbo');
    const enc = pick(m.textEncoders || [], 'qwen_3_4b.safetensors', 'qwen_3_4b');
    if (!unet || !enc) {
      throw new Error('Z-Image Turbo is not installed (needs z_image_turbo_bf16.safetensors in models/diffusion_models ' +
        'and qwen_3_4b.safetensors in models/text_encoders). Run: bash ai/tools/setup_zimage.sh');
    }
    wf['28'].inputs.unet_name = unet;
    wf['30'].inputs.clip_name = enc;
    const zvae = pick(m.vaes, 'ae.safetensors', 'ae');
    if (zvae) wf['29'].inputs.vae_name = zvae;
    return { wf, usedLora: null, engine: 'zimage' };
  }

  const unetWanted = wf['12'].inputs.unet_name;
  const unet = pick(m.unets, unetWanted);
  if (!unet) {
    throw new Error(`ComfyUI has no ${unetWanted} in models/diffusion_models. ` +
      `Run: bash ai/tools/setup_comfyui.sh`);
  }
  wf['12'].inputs.unet_name = unet;
  wf['12'].inputs.weight_dtype = await weightDtype();

  const t5 = pick(m.clips, 't5xxl_fp16.safetensors', 't5xxl');
  const cl = pick(m.clips, 'clip_l.safetensors', 'clip_l');
  const vae = pick(m.vaes, 'ae.safetensors', 'ae');
  if (t5) wf['11'].inputs.clip_name1 = t5;
  if (cl) wf['11'].inputs.clip_name2 = cl;
  if (vae) wf['13'].inputs.vae_name = vae;

  const lora = wf['10']?.inputs?.lora_name;
  const haveLora = lora && m.loras.includes(lora);
  if (wf['10'] && !haveLora) {
    // Bypass the LoRA: rewire every consumer of node 10 straight to the UNET.
    for (const node of Object.values(wf)) {
      for (const [k, v] of Object.entries(node.inputs || {})) {
        if (Array.isArray(v) && v[0] === '10') node.inputs[k] = ['12', v[1]];
      }
    }
    delete wf['10'];
  }
  return { wf, usedLora: haveLora ? lora : null, engine: 'flux' };
}

// ═══ CONDITIONING ═══════════════════════════════════════════════════════════
// Text alone cannot hold a house style, and it certainly cannot hold a LAYOUT.
// Two different problems, two different mechanisms:
//
//   1 · IP-ADAPTER — "look like THIS". A reference image from the real Medartis
//       library steers colour, light and material without any trained LoRA. It
//       conditions the MODEL branch.
//
//   2 · CONTROLNET — "compose like THIS". A control map fixes where things sit.
//       It conditions the CONDITIONING branch (positive AND negative), which is
//       why it can hold a composition that the prompt would otherwise wander from.
//       The layout canvas emits its own map (see buildLayoutControlMap in the
//       client): the model then composes AROUND the type and the mark, instead of
//       us cropping a photo afterwards and hoping.
//
// Both are OPTIONAL and both DEGRADE HONESTLY: if the custom nodes or the model
// files are not installed, we run the plain graph and tell the client exactly
// what was skipped and why. The panel must never imply conditioning it did not get.
const CONTROL_HINTS = {
  depth:    ['depth'],
  canny:    ['canny'],
  scribble: ['scribble', 'sketch', 'lineart'],
  pose:     ['openpose', 'pose', 'dwpose'],
};
// Preferred preprocessor per type, best first. Only used when the client sends a
// PHOTO to derive a map from; a synthesized layout map is already a control map
// and must be passed through untouched.
const PREPROCESSORS = {
  depth:    ['DepthAnythingV2Preprocessor', 'DepthAnythingPreprocessor', 'MiDaS-DepthMapPreprocessor', 'Zoe-DepthMapPreprocessor'],
  canny:    ['CannyEdgePreprocessor', 'Canny'],
  scribble: ['ScribblePreprocessor', 'Scribble_XDoG_Preprocessor', 'CannyEdgePreprocessor', 'Canny'],
  pose:     ['DWPreprocessor', 'OpenposePreprocessor'],
};

async function conditioningCapabilities() {
  const info = await comfyObjectInfo();
  const has = (n) => !!info?.[n];
  const opts = (node, input) => comboOptions(info?.[node]?.input?.required?.[input]);
  const controlnets = opts('ControlNetLoader', 'control_net_name');
  const ipFiles     = opts('IPAdapterModelLoader', 'ipadapter_file');
  return {
    // Core ships ControlNetApplyAdvanced; the MODELS are the thing people miss.
    controlNode: has('ControlNetLoader') && has('ControlNetApplyAdvanced'),
    controlnets,
    // ComfyUI_IPAdapter_plus. UnifiedLoader resolves the ipadapter + clip_vision
    // pair itself, which is far more robust than us guessing two filenames.
    ipNode: has('IPAdapterUnifiedLoader') && has('IPAdapterAdvanced'),
    ipFiles,
    preprocessors: Object.fromEntries(
      Object.entries(PREPROCESSORS).map(([k, list]) => [k, list.find(has) || null])
    ),
    controlFor: (type) => {
      const hints = CONTROL_HINTS[type] || [];
      return controlnets.find((f) => hints.some((h) => f.toLowerCase().includes(h))) || null;
    },
  };
}

/**
 * Inject IP-Adapter and/or ControlNet into a resolved SDXL graph.
 * SDXL only — Flux ControlNets are per-checkpoint and the union models are not
 * interchangeable, so pretending it works there would just move the failure to
 * ComfyUI's validator. Returns what was ACTUALLY applied.
 */
async function applyConditioning(wf, b, engine) {
  const out = { ip: false, control: false, controlType: null, controlModel: null, preprocessor: null, notes: [] };
  const wantIp = !!b.refImage;
  const wantControl = !!b.controlImage;
  if (!wantIp && !wantControl) return out;

  if (engine === 'flux') {
    out.notes.push('Conditioning is SDXL-only — Flux ControlNet/IP-Adapter weights are checkpoint-specific. Switch the engine to SDXL.');
    return out;
  }
  const ks = wf['3'];
  if (!ks || ks.class_type !== 'KSampler') {
    out.notes.push('This workflow has no KSampler to condition.');
    return out;
  }

  const caps = await conditioningCapabilities();

  // 1 · IP-ADAPTER — conditions the MODEL branch.
  if (wantIp) {
    if (!caps.ipNode) {
      out.notes.push('IP-Adapter skipped: ComfyUI_IPAdapter_plus is not installed (custom_nodes).');
    } else if (!caps.ipFiles.length) {
      out.notes.push('IP-Adapter skipped: no IP-Adapter weights in models/ipadapter.');
    } else {
      const name = await comfyUploadImage(b.refImage);
      wf['200'] = { class_type: 'LoadImage', inputs: { image: name, upload: 'image' } };
      wf['201'] = { class_type: 'IPAdapterUnifiedLoader', inputs: { model: ks.inputs.model, preset: 'STANDARD (medium strength)' } };
      wf['202'] = {
        class_type: 'IPAdapterAdvanced',
        inputs: {
          model: ['201', 0], ipadapter: ['201', 1], image: ['200', 0],
          weight: clampNum(b.refStrength ?? 0.65, 0, 1.5),
          weight_type: 'style transfer',   // steer look, not subject — that is the point
          combine_embeds: 'concat',
          start_at: 0.0, end_at: clampNum(b.refEndAt ?? 0.85, 0.1, 1.0),
          embeds_scaling: 'V only',
        },
      };
      ks.inputs.model = ['202', 0];
      out.ip = true;
    }
  }

  // 2 · CONTROLNET — conditions the CONDITIONING branch (positive AND negative).
  if (wantControl) {
    const type = ['depth', 'canny', 'scribble', 'pose'].includes(b.controlType) ? b.controlType : 'depth';
    const model = caps.controlFor(type);
    if (!caps.controlNode) {
      out.notes.push('ControlNet skipped: this ComfyUI has no ControlNetLoader.');
    } else if (!model) {
      out.notes.push(`ControlNet skipped: no ${type} model in models/controlnet.`);
    } else {
      const name = await comfyUploadImage(b.controlImage);
      wf['210'] = { class_type: 'LoadImage', inputs: { image: name, upload: 'image' } };
      let imgRef = ['210', 0];

      // A map the LAYOUT synthesized is already a control map — running a depth
      // estimator over it would just estimate the depth OF THE DIAGRAM. Only a
      // photographic source gets preprocessed.
      const pre = b.controlPreprocess ? caps.preprocessors[type] : null;
      if (b.controlPreprocess && !pre) {
        out.notes.push(`No ${type} preprocessor installed — feeding the source image straight to ControlNet.`);
      } else if (pre) {
        wf['211'] = pre === 'Canny'
          ? { class_type: 'Canny', inputs: { image: imgRef, low_threshold: 0.15, high_threshold: 0.4 } }
          : { class_type: pre, inputs: { image: imgRef, resolution: 1024 } };
        imgRef = ['211', 0];
        out.preprocessor = pre;
      }

      wf['212'] = { class_type: 'ControlNetLoader', inputs: { control_net_name: model } };
      wf['213'] = {
        class_type: 'ControlNetApplyAdvanced',
        inputs: {
          positive: ks.inputs.positive,
          negative: ks.inputs.negative,
          control_net: ['212', 0],
          image: imgRef,
          strength: clampNum(b.controlStrength ?? 0.75, 0, 2),
          start_percent: 0.0,
          end_percent: clampNum(b.controlEndAt ?? 0.85, 0.1, 1.0),
        },
      };
      ks.inputs.positive = ['213', 0];
      ks.inputs.negative = ['213', 1];
      out.control = true;
      out.controlType = type;
      out.controlModel = model;
    }
  }
  return out;
}

async function comfyUploadImage(dataUrl) {
  const [, b64] = dataUrl.split(',');
  const buf = Buffer.from(b64, 'base64');
  const form = new FormData();
  form.append('image', new Blob([buf], { type: 'image/png' }), `medartis-src-${Date.now()}.png`);
  form.append('overwrite', 'true');
  const r = await fetch(`${COMFY()}/upload/image`, { method: 'POST', body: form });
  if (!r.ok) throw new Error(`ComfyUI upload failed (${r.status})`);
  return (await r.json()).name;
}

// ComfyUI streams progress over a websocket: {type:'progress', data:{value,max}}
// and {type:'executing', data:{node}}. Polling /history alone tells you nothing
// until the image lands — which is why the panel just sat there.
function attachProgress(jobId, clientId) {
  if (typeof WebSocket === 'undefined') return () => {};   // older Node: no live steps
  const wsUrl = COMFY().replace(/^http/, 'ws') + `/ws?clientId=${encodeURIComponent(clientId)}`;
  let ws;
  try { ws = new WebSocket(wsUrl); ws.binaryType = 'arraybuffer'; } catch { return () => {}; }
  ws.onmessage = (ev) => {
    // BINARY frames are live preview images (sent only when ComfyUI runs with
    // --preview-method): 8-byte header = two big-endian uint32s (event type 1 =
    // preview image, then format 1=JPEG 2=PNG), rest is the image itself. This
    // is what makes something VISIBLE within a second or two of pressing
    // Generate, instead of a bar crawling for the whole render.
    if (ev.data instanceof ArrayBuffer) {
      try {
        const dv = new DataView(ev.data);
        if (dv.byteLength > 8 && dv.getUint32(0) === 1) {
          const mime = dv.getUint32(4) === 2 ? 'image/png' : 'image/jpeg';
          const b64 = Buffer.from(new Uint8Array(ev.data, 8)).toString('base64');
          const job = JOBS.get(jobId);
          if (job && job.status !== 'done' && job.status !== 'error') {
            patchJob(jobId, { preview: `data:${mime};base64,${b64}` });
          }
        }
      } catch { /* a malformed frame is not worth failing a render over */ }
      return;
    }
    let msg;
    try { msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ''); } catch { return; }
    if (!msg?.type) return;
    const job = JOBS.get(jobId);
    if (!job || job.status === 'done' || job.status === 'error') return;
    if (msg.type === 'progress' && msg.data?.max) {
      patchJob(jobId, {
        status: 'running',
        step: msg.data.value,
        steps: msg.data.max,
        // Sampling is the bulk of the wall time, but not all of it — leave room
        // for VAE decode so the bar doesn't sit at 100% looking broken.
        progress: 0.08 + 0.85 * (msg.data.value / msg.data.max),
      });
    } else if (msg.type === 'executing' && msg.data?.node) {
      const cls = job.workflow?.[msg.data.node]?.class_type;
      patchJob(jobId, { status: 'running', node: cls || msg.data.node });
    }
  };
  ws.onerror = () => {};
  return () => { try { ws.close(); } catch { /* already gone */ } };
}

// Belt and braces: every value in a ComfyUI prompt must be a node object with a
// class_type. Catch a stray key here, with a message that names it, rather than
// letting ComfyUI 500 with an AttributeError.
function assertNodes(wf) {
  for (const [k, v] of Object.entries(wf)) {
    if (!v || typeof v !== 'object' || !v.class_type) {
      throw new Error(`Workflow key "${k}" is not a node (no class_type) — ComfyUI would reject the whole prompt.`);
    }
  }
  return wf;
}

async function comfyRun(jobId, workflow, opts = {}) {
  assertNodes(workflow);
  const clientId = `medartis-${jobId}`;
  patchJob(jobId, { workflow, phase: opts.draft ? 'draft' : 'final', ...(opts.draft ? {} : { startedAt: Date.now() }) });
  if (opts.draft && !JOBS.get(jobId)?.startedAt) patchJob(jobId, { startedAt: Date.now() });
  const detach = attachProgress(jobId, clientId);
  const r = await fetch(`${COMFY()}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow, client_id: clientId }),
  });
  if (!r.ok) {
    // ComfyUI answers 400 with {error, node_errors} — say WHICH node and why,
    // otherwise the panel just shows "it didn't work".
    let detail = '';
    try {
      const j = JSON.parse(await r.text());
      const parts = [];
      if (j.error?.message) parts.push(j.error.message);
      if (j.error?.details) parts.push(j.error.details);
      for (const [nodeId, ne] of Object.entries(j.node_errors || {})) {
        const cls = ne.class_type || workflow[nodeId]?.class_type || nodeId;
        for (const e of ne.errors || []) parts.push(`${cls}: ${e.message}${e.details ? ` (${e.details})` : ''}`);
      }
      detail = parts.join(' · ');
    } catch { /* not JSON — fall through */ }

    // TRANSLATE THE ONE ERROR THAT LOOKS LIKE A BUG BUT IS A MODEL CHOICE.
    // "CLIPTextEncode: clip input is invalid: None" means the checkpoint that
    // loaded has NO TEXT ENCODER. That is not a broken graph — it is a file that
    // is not a full SDXL checkpoint: a UNet-only/"diffusion only" export, or a
    // Flux / SD3 / video-model file, all of which keep their text encoders in
    // separate files. ComfyUI's wording sends people hunting through their graph;
    // the fix is always "load a different checkpoint".
    if (/INT_MAX/i.test(detail)) {
      detail = 'Apple MPS refused a single tensor this large during VAE decode. ' +
        'The refine pass now decodes in tiles automatically on Macs — if you still see this, ' +
        'update ComfyUI (VAEDecodeTiled) or turn off Refine for this run.';
    }
    if (/clip input is invalid/i.test(detail)) {
      const ck = workflow['4']?.inputs?.ckpt_name || '(unknown)';
      detail = `The checkpoint “${ck}” contains no text encoder (CLIP), so the prompt cannot be encoded. ` +
        `That file is not a complete SDXL checkpoint — it is most likely a UNet-only / "diffusion only" export, ` +
        `or a Flux / SD3 / video model, which keep their text encoders in separate files. ` +
        `Pick a full SDXL checkpoint in § 12 (Juggernaut XL, RealVisXL, SDXL base 1.0). ` +
        `Nothing is wrong with the workflow.`;
    }
    detach();
    if (!detail && r.status >= 500) {
      detail = 'ComfyUI threw a server error (500) — see comfyui.log for the traceback. ' +
        'This usually means the prompt was malformed, not that the model failed.';
    }
    throw new Error(detail || `ComfyUI rejected the workflow (HTTP ${r.status}).`);
  }
  const { prompt_id: promptId } = await r.json();
  patchJob(jobId, { status: 'running', progress: 0.05 });

  // Poll /history. (A websocket would give live progress; polling keeps this
  // dependency-free and a Flux image lands in ~20–40 s anyway.)
  for (let i = 0; i < 600; i++) {
    await new Promise((res) => setTimeout(res, 1000));
    const h = await fetch(`${COMFY()}/history/${promptId}`).then((x) => x.json()).catch(() => ({}));
    const entry = h?.[promptId];
    if (!entry) {
      // No live socket (older Node)? Then creep the bar so it isn't frozen.
      const j = JOBS.get(jobId);
      if (j && !j.steps) patchJob(jobId, { progress: Math.min(0.9, 0.05 + i * 0.02) });
      continue;
    }
    const status = entry.status?.status_str;
    if (status === 'error') {
      const msg = (entry.status?.messages || [])
        .filter(([kind]) => kind === 'execution_error')
        .map(([, d]) => `${d.node_type || d.node_id}: ${d.exception_message || 'failed'}`)
        .join(' · ');
      detach();
      let friendly = msg;
      if (/INT_MAX/i.test(friendly)) {
        friendly = 'Apple MPS refused a single tensor this large during VAE decode. ' +
          'The refine pass now decodes in tiles automatically on Macs — retry the run; ' +
          'if it persists, update ComfyUI (VAEDecodeTiled) or turn off Refine.';
      }
      patchJob(jobId, { status: 'error', error: friendly || 'ComfyUI execution error — see comfyui.log.' });
      return;
    }
    const images = [];
    for (const out of Object.values(entry.outputs || {})) {
      for (const im of out.images || []) {
        const q = new URLSearchParams({ filename: im.filename, subfolder: im.subfolder || '', type: im.type || 'output' });
        const bytes = await fetch(`${COMFY()}/view?${q}`).then((x) => x.arrayBuffer());
        images.push(`data:image/png;base64,${Buffer.from(bytes).toString('base64')}`);
      }
    }
    if (images.length) {
      detach();
      if (opts.draft) {
        // The draft IS the first visible result: same models, same seed, half
        // resolution, fewer steps. It lands in seconds and stands in as the
        // preview while the full-quality pass renders behind it.
        patchJob(jobId, {
          status: 'running', phase: 'final', progress: 0.12,
          draftImages: images, preview: images[0],
          draftMs: Date.now() - (JOBS.get(jobId)?.startedAt || Date.now()),
        });
      } else {
        patchJob(jobId, {
          status: 'done', progress: 1, images, provider: 'local',
          aiGenerated: true, nonCommercial: true, workflow: null,
          tookMs: Date.now() - (JOBS.get(jobId)?.startedAt || Date.now()),
        });
      }
      return;
    }
  }
  detach();
  patchJob(jobId, { status: 'error', error: 'Timed out waiting for ComfyUI.' });
}

// ── Higgsfield (cloud) ─────────────────────────────────────────────────
// Bearer auth; submit → generation_id + status_url → poll. Used for still →
// motion, which maps straight onto the Story / Reel / TikTok formats the
// generator already produces.
async function higgsfieldVideo(jobId, { image, prompt, ratio = '9:16', duration = 5 }) {
  const r = await fetch(`${HF_URL()}/image2video`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${HF_KEY()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ image, prompt, aspect_ratio: ratio, duration, resolution: '1080p' }),
  });
  if (!r.ok) {
    patchJob(jobId, { status: 'error', error: `Higgsfield ${r.status}: ${await r.text()}` });
    return;
  }
  const sub = await r.json();
  const statusUrl = sub.status_url || `${HF_URL()}/generations/${sub.generation_id}`;
  patchJob(jobId, { status: 'running', progress: 0.1, provider: 'higgsfield' });

  for (let i = 0; i < 300; i++) {
    await new Promise((res) => setTimeout(res, 2000));
    const s = await fetch(statusUrl, { headers: { Authorization: `Bearer ${HF_KEY()}` } })
      .then((x) => x.json()).catch(() => null);
    if (!s) continue;
    const st = (s.status || '').toLowerCase();
    if (st === 'completed' || st === 'succeeded') {
      patchJob(jobId, {
        status: 'done', progress: 1, provider: 'higgsfield', aiGenerated: true,
        video: s.result?.url || s.output?.url || s.url || null,
      });
      return;
    }
    if (st === 'failed' || st === 'error') {
      patchJob(jobId, { status: 'error', error: s.error || 'Higgsfield generation failed.' });
      return;
    }
    patchJob(jobId, { progress: Math.min(0.95, 0.1 + i * 0.03) });
  }
  patchJob(jobId, { status: 'error', error: 'Timed out waiting for Higgsfield.' });
}

// ── plugin ─────────────────────────────────────────────────────────────
export default function genai() {
  const body = (req) => new Promise((resolve, reject) => {
    let d = '';
    req.on('data', (c) => { d += c; if (d.length > 40e6) reject(new Error('payload too large')); });
    req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch (e) { reject(e); } });
  });
  const send = (res, code, obj) => {
    res.statusCode = code;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(obj));
  };

  return {
    name: 'medartis-genai',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/gen/')) return next();
        const url = new URL(req.url, 'http://localhost');

        try {
          // ── safety gate (read/flip) ───────────────────────────────
          if (url.pathname === '/api/gen/safety') {
            if (req.method === 'POST') {
              const b = await body(req);
              return send(res, 200, setSafetyGate(b?.enabled === true));
            }
            const s = STYLE();
            const enabled = s.blocklist_enabled === true;
            return send(res, 200, { enabled, terms: (enabled ? s.blocklist : s.blocklist_archived || []).length });
          }

          // ── status ────────────────────────────────────────────────
          if (url.pathname === '/api/gen/status') {
            const out = {
              providers: [], lora: LORA(), missing: [],
              nonCommercial: true,
              blocklistMessage: STYLE().blocklist_message,
              safetyEnabled: STYLE().blocklist_enabled === true,
            };
            if (!(await comfyAlive())) {
              out.comfyError = `No ComfyUI at ${COMFY()} — start it (npm start), or set COMFY_URL.`;
              if (HF_KEY()) out.providers.push('higgsfield');
              return send(res, 200, out);
            }
            try {
              const m = await comfyModels();
              out.providers.push('local');
              out.models = m;
              out.device = await comfyDevice();
              out.weightDtype = await weightDtype(out.device);
              if (!m.unets.includes('flux1-dev.safetensors')) out.missing.push('flux1-dev.safetensors (UNETLoader)');
              out.engines = [];
              // Z-Image Turbo first when installed: Apache-2.0 (shippable), Flux-level
              // photorealism, and by far the best quality-per-second on Apple Silicon.
              const hasZimage = m.unets.some((f) => /z[-_]?image/i.test(f)) && (m.textEncoders || []).some((f) => /qwen_3_4b/i.test(f));
              if (hasZimage) out.engines.push('zimage');
              out.zimage = hasZimage;
              if (!hasZimage) out.missing.push('Z-Image Turbo — the recommended Mac engine (bash ai/tools/setup_zimage.sh)');
              // SDXL base: the conditioning engine (IP-Adapter / ControlNet run here).
              if (m.ckpts.some((f) => f.toLowerCase().includes('sd_xl_base'))) out.engines.push('sdxl');
              if (m.unets.some((f) => f.toLowerCase().includes('flux1-dev'))) out.engines.push('flux');
              if (m.ckpts.some((f) => f.toLowerCase().includes('sd_xl_turbo'))) out.engines.push('sdxl-turbo');
              out.hasSdxlBase = out.engines.includes('sdxl');
              // Every SDXL-architecture checkpoint the box has — base and any
              // fine-tune. They are interchangeable: same LoRA, same ControlNet,
              // same IP-Adapter. Which one you load is the single biggest lever
              // on realism, so let the panel offer them all rather than hard-wiring
              // sd_xl_base and quietly ignoring a better model sitting right there.
              // Classify by READING THE FILE, not by guessing from its name. An SD
              // 1.5 checkpoint in an SDXL graph does not error — it silently
              // produces garbage, which is far worse.
              const NOT_BASE = /refiner|inpaint/i;      // wrong ROLE, not wrong family
              out.ckptArch = Object.fromEntries(m.ckpts.map((f) => [f, checkpointArch(f)]));
              out.sdxlCkpts = m.ckpts.filter((f) => out.ckptArch[f] === 'sdxl' && !NOT_BASE.test(f));
              out.excludedCkpts = m.ckpts
                .filter((f) => !out.sdxlCkpts.includes(f))
                .map((f) => ({ file: f, why: out.ckptArch[f] === 'sd15' ? 'SD 1.5 — wrong architecture for this pipeline'
                  : out.ckptArch[f] === 'no-clip' ? 'no text encoder (UNet-only / Flux / SD3 / video)'
                  : NOT_BASE.test(f) ? 'refiner or inpaint model — not a base checkpoint'
                  : 'could not read the file' }));

              // SPEED LORAS. This is how you actually get Lightning/LCM: as a
              // LoRA ON TOP of a full checkpoint — so the checkpoint still brings
              // the text encoder, and the look still comes from Juggernaut rather
              // than from a stripped-down speed model.
              out.fastLoras = m.loras.filter((f) => /lightning|lcm|hyper|turbo/i.test(f));
              out.photorealCkpts = out.sdxlCkpts.filter((f) => /juggernaut|realvis|zavychroma|photon|dreamshaper|copax/i.test(f));
              out.hasSdxlLora = m.loras.includes(SDXL_LORA());
              if (!out.hasSdxlBase) out.missing.push('sd_xl_base_1.0.safetensors — the commercially licensable engine · npm run models');
              out.upscalers = m.upscalers;
              out.hasUpscaler = m.upscalers.length > 0;
              if (!out.hasUpscaler) out.missing.push('an upscale model (models/upscale_models) — re-run ai/tools/setup_comfyui.sh');
              out.hasLora = m.loras.includes(LORA());
              if (!out.hasLora) out.missing.push(`${LORA()} — not trained yet · generating with BASE Flux (no house look)`);
              if (!m.unets.includes('flux1-fill-dev.safetensors')) out.missing.push('flux1-fill-dev.safetensors (needed for Expand)');
              out.canExpand = m.unets.includes('flux1-fill-dev.safetensors');

              // What can this ComfyUI actually CONDITION on? The panel offers only
              // what the box can honour, and names what is missing — a greyed-out
              // control with a reason beats a control that silently does nothing.
              try {
                const caps = await conditioningCapabilities();
                out.conditioning = {
                  ip: caps.ipNode && caps.ipFiles.length > 0,
                  control: caps.controlNode && caps.controlnets.length > 0,
                  controlTypes: Object.keys(CONTROL_HINTS).filter((t) => !!caps.controlFor(t)),
                  preprocessors: caps.preprocessors,
                  controlnets: caps.controlnets,
                };
                if (!caps.ipNode) out.conditioning.ipMissing = 'ComfyUI_IPAdapter_plus (custom_nodes)';
                else if (!caps.ipFiles.length) out.conditioning.ipMissing = 'IP-Adapter weights (models/ipadapter)';
                if (!out.conditioning.controlTypes.length) out.conditioning.controlMissing = 'ControlNet models (models/controlnet)';
              } catch { /* conditioning is optional — never break /status over it */ }
            } catch (e) {
              // It IS running — we just couldn't read its node list. Say that.
              out.providers.push('local');
              out.comfyError = `ComfyUI is up but /object_info failed: ${e.message}`;
            }
            if (HF_KEY()) out.providers.push('higgsfield');
            return send(res, 200, out);
          }

          // ── text → image (local) ──────────────────────────────────
          if (url.pathname === '/api/gen/image' && req.method === 'POST') {
            const b = await body(req);
            const gate = safetyCheck(b.prompt);
            if (!gate.ok) return send(res, 422, { error: gate.message, term: gate.term });

            const { positive, negative } = compilePrompt(b);
            const seed = Number.isFinite(b.seed) ? b.seed : Math.floor(Math.random() * 2 ** 31);
            const turbo = b.engine === 'sdxl-turbo';
            const sdxl  = b.engine === 'sdxl';          // SDXL base 1.0 — the licensable engine
            const zimage = b.engine === 'zimage';        // Z-Image Turbo — best quality/second on a Mac
            const engineKey = zimage ? 'zimage' : turbo ? 'sdxl-turbo' : sdxl ? 'sdxl' : 'flux';

            // Generate at the model's NATIVE resolution (in the canvas's aspect),
            // then upscale to the canvas. Asking SDXL Turbo for 941px was what
            // produced duplicated people and a giant.
            const { width, height } = latentSize(b.w, b.h, engineKey);
            const target = targetSize(b.w, b.h);
            const models = await comfyModels();
            const upscaler = b.upscale === false ? null : (
              ['4x-UltraSharp.pth', 'RealESRGAN_x4plus.pth', '4x_foolhardy_Remacri.pth']
                .find((n) => models.upscalers.includes(n)) || models.upscalers[0] || null
            );

            let wf;
            // Does the engine ACTUALLY consume the negative? SDXL/Turbo always do;
            // Flux only when we swap in a CFGGuider below. Reported to the client so
            // the panel can state the truth rather than imply the negative worked.
            let fluxNegativeHonoured = false;
            let usedFast = null;
            if (zimage) {
              // Z-IMAGE TURBO — Tongyi's 6B S3-DiT, Apache-2.0. Flux-level
              // photorealism in 8 steps at CFG 1; on Apple Silicon roughly 3×
              // faster than Flux. CFG 1 means the negative is structurally
              // zeroed (like Flux) — realism lives in the positive block, and
              // the run report says the negative was not consumed.
              wf = loadWorkflow('ai/workflows/zimage_turbo_txt2img.api.json');
              wf['6'].inputs.text = positive;
              wf['5'].inputs.width = width;
              wf['5'].inputs.height = height;
              wf['3'].inputs.seed = seed;
              wf['3'].inputs.steps = clampInt(b.steps ?? 8, 4, 16);
            } else if (sdxl) {
              // SDXL base 1.0 + house LoRA — the commercially licensable path.
              wf = loadWorkflow('ai/workflows/sdxl_txt2img_lora.api.json');
              // An explicit checkpoint wins. resolveWorkflow() below looks for
              // whatever name sits here, so a photoreal fine-tune (Juggernaut XL,
              // RealVisXL) is a drop-in: same architecture, same LoRA, same
              // ControlNet/IP-Adapter — a very different picture.
              if (b.ckpt) {
                // A wrong-architecture checkpoint does not fail — it renders a
                // rainbow-fried mess. Refuse it here, where we can say why.
                const arch = checkpointArch(b.ckpt);
                if (arch === 'sd15') {
                  return send(res, 422, { error:
                    `“${b.ckpt}” is an SD 1.5 checkpoint, not SDXL. In this pipeline it would be given ` +
                    `1024px latents, an SDXL VAE and SDXL LoRAs — the result is the melted, rainbow-coloured ` +
                    `output you have already seen, not an error. Pick an SDXL checkpoint (Juggernaut XL, RealVisXL).` });
                }
                if (arch === 'no-clip') {
                  return send(res, 422, { error:
                    `“${b.ckpt}” has no built-in text encoder (UNet-only, Flux, SD3 or a video model), ` +
                    `so the prompt cannot be encoded. Pick a full SDXL checkpoint.` });
                }
                wf['4'].inputs.ckpt_name = b.ckpt;
              }

              // Base recipe FIRST — then FAST may override it. (The old order set
              // the Lightning recipe and then unconditionally reset steps to 28
              // and swapped the house LoRA back in: ⚡ Fast never actually ran.)
              wf['6'].inputs.text = positive;
              wf['7'].inputs.text = negative;
              wf['5'].inputs.width = width;
              wf['5'].inputs.height = height;
              wf['3'].inputs.seed = seed;
              wf['3'].inputs.steps = clampInt(b.steps ?? 28, 8, 50);
              wf['10'].inputs.lora_name = SDXL_LORA();
              wf['10'].inputs.strength_model = b.strength ?? 0.85;
              wf['10'].inputs.strength_clip = b.strength ?? 0.85;

              // ── FAST (Lightning / LCM) ──────────────────────────────────
              // A distilled few-step LoRA. It is NOT just "fewer steps": these
              // models are trained to work at CFG ~1, and leaving CFG at 6 with 4
              // steps produces the burnt, oversaturated mess people blame on the
              // LoRA. Sampler and scheduler matter too. So the whole recipe moves
              // together, or not at all. The fast LoRA STACKS on the house LoRA
              // (a chained loader) — speed must not cost the house look.
              const fastLora = b.fast
                ? models.loras.find((f) => /lightning/i.test(f))
                  || models.loras.find((f) => /hyper/i.test(f))
                  || models.loras.find((f) => /lcm/i.test(f))
                : null;
              if (fastLora) {
                const lightning = /lightning|hyper/i.test(fastLora);
                wf['10fast'] = {
                  class_type: 'LoraLoader',
                  inputs: { model: ['10', 0], clip: ['10', 1], lora_name: fastLora, strength_model: 1.0, strength_clip: 1.0 },
                };
                for (const [nid, node] of Object.entries(wf)) {
                  if (nid === '10fast') continue;
                  for (const [k, v] of Object.entries(node.inputs || {})) {
                    if (Array.isArray(v) && v[0] === '10') node.inputs[k] = ['10fast', v[1]];
                  }
                }
                wf['3'].inputs.steps = clampInt(b.steps ?? (lightning ? 6 : 8), 2, 12);
                wf['3'].inputs.cfg = lightning ? 1.2 : 1.8;
                wf['3'].inputs.sampler_name = 'euler';
                wf['3'].inputs.scheduler = 'sgm_uniform';
                usedFast = fastLora;
              }
            } else if (turbo) {
              wf = loadWorkflow('ai/workflows/sdxl_turbo_txt2img.api.json');
              wf['6'].inputs.text = positive;
              wf['7'].inputs.text = negative;          // Turbo takes a real negative
              wf['5'].inputs.width = width;
              wf['5'].inputs.height = height;
              wf['3'].inputs.seed = seed;
              wf['3'].inputs.steps = clampInt(b.steps ?? 4, 1, 8);
            } else {
              wf = loadWorkflow('ai/workflows/flux_txt2img_lora.api.json');
              wf['6'].inputs.text = positive;
              // FLUX + REAL NEGATIVES.
              // Stock Flux runs a BasicGuider, which has no negative input at all —
              // that is *why* a negative prompt silently does nothing here, not some
              // quirk of the wording. Swapping in a CFGGuider gives the sampler a
              // genuine negative branch (cfg > 1), so the negative is actually
              // consumed. It costs roughly 2× the time (two passes per step), so it
              // is opt-in via `strictNegative` and we report what really happened.
              if (b.strictNegative && wf['22']?.class_type === 'BasicGuider') {
                wf['7'] = { class_type: 'CLIPTextEncode', inputs: { text: negative, clip: wf['6'].inputs.clip } };
                wf['22'] = {
                  class_type: 'CFGGuider',
                  inputs: {
                    model: wf['22'].inputs.model,
                    positive: wf['22'].inputs.conditioning, // FluxGuidance-wrapped positive
                    negative: ['7', 0],
                    // Guidance-distilled models degrade fast under real CFG —
                    // 3.0 was visibly softening the image. 2.0 keeps the
                    // negative branch active without cooking the distillation.
                    cfg: clampNum(b.cfg ?? 2.0, 1.1, 8),
                  },
                };
                fluxNegativeHonoured = true;
              }
              wf['5'].inputs.width = width;
              wf['5'].inputs.height = height;
              wf['25'].inputs.noise_seed = seed;
              wf['10'].inputs.lora_name = LORA();
              wf['10'].inputs.strength_model = b.strength ?? 0.85;
              if (b.steps) wf['17'].inputs.steps = clampInt(b.steps, 4, 50);
            }

            // How many variants in one run. Cost is linear; the queue is one
            // ComfyUI, so 4 is the honest ceiling before the panel feels stuck.
            const batch = clampInt(b.batch ?? 1, 1, 4);
            if (wf['5']?.inputs) wf['5'].inputs.batch_size = batch;

            configureUpscale(wf, target, upscaler);

            const { wf: ready, usedLora, ckpt: usedCkpt, engine } = await resolveWorkflow(wf);

            // THE TRIGGER WORD IS FOR THE LORA, NOT THE PICTURE. Without the
            // house LoRA loaded, "medartishouse" is just a made-up word in the
            // prompt — and Flux/Z-Image render typography well enough to PAINT
            // it as a wordmark across the image. Strip it whenever the LoRA
            // did not resolve; with the LoRA loaded it stays (that is what the
            // model was trained on).
            let cleanPositive = positive;
            if (!usedLora && ready['6']?.inputs?.text) {
              const trig = (STYLE().trigger || '').trim();
              if (trig) {
                cleanPositive = positive.split(trig).join('').replace(/^[,\s]+/, '').replace(/,\s*,/g, ',').trim();
                ready['6'].inputs.text = cleanPositive;
              }
            }

            // CONDITIONING — reference look (IP-Adapter) and/or composition
            // (ControlNet, incl. the map the layout canvas emits). Applied AFTER
            // resolveWorkflow so it sees the real model/positive/negative wiring.
            let conditioning = { ip: false, control: false, notes: [] };
            try {
              conditioning = await applyConditioning(ready, b, engine);
            } catch (e) {
              conditioning = { ip: false, control: false, notes: [`Conditioning failed: ${e.message}`] };
            }

            // ── DRAFT LADDER — the fastest visible result ─────────────────
            // A half-resolution, reduced-step clone of the FINAL workflow: same
            // resolved models (nothing reloads), same seed (the draft *is* the
            // final, softer), same conditioning. It lands in a few seconds and
            // fills the preview while the real render runs. Turbo needs no
            // draft — it is one.
            let draftWf = null;
            if (b.draft !== false && engine !== 'sdxl-turbo') {
              draftWf = JSON.parse(JSON.stringify(ready));
              const d = latentSize(b.w, b.h, engineKey, 0.25); // half the edge
              if (draftWf['5']?.inputs) { draftWf['5'].inputs.width = d.width; draftWf['5'].inputs.height = d.height; draftWf['5'].inputs.batch_size = 1; }
              if (draftWf['3']?.class_type === 'KSampler') {
                draftWf['3'].inputs.steps = Math.max(4, Math.round(draftWf['3'].inputs.steps * 0.6));
              } else if (draftWf['17']?.class_type === 'BasicScheduler') {
                draftWf['17'].inputs.steps = Math.max(8, Math.min(12, draftWf['17'].inputs.steps));
              }
              // No ESRGAN on a draft — exact-size resize only.
              if (draftWf['92']) {
                draftWf['92'].inputs.image = ['8', 0];
                delete draftWf['90']; delete draftWf['91'];
                draftWf['92'].inputs.width = d.width; draftWf['92'].inputs.height = d.height;
              }
            }

            // ── HI-RES REFINE — the maximal-quality path for print ────────
            // A true latent second pass (not just ESRGAN): upscale the latent
            // ~2× and re-sample at low denoise, so the model itself paints the
            // extra resolution. KSampler engines only (Z-Image, SDXL); Flux
            // keeps its ESRGAN tail and the report says so.
            let refineInfo = null;
            if (b.refine === true) {
              if (ready['3']?.class_type === 'KSampler' && ready['8']) {
                const r = latentSize(b.w, b.h, engineKey, 4); // 2× the edge, capped below
                const rw = Math.min(2048, r.width), rh = Math.min(2048, r.height);
                ready['40'] = { class_type: 'LatentUpscale', inputs: { samples: ['3', 0], upscale_method: 'bislerp', width: rw, height: rh, crop: 'disabled' } };
                ready['41'] = {
                  class_type: 'KSampler',
                  inputs: {
                    model: ready['3'].inputs.model, positive: ready['3'].inputs.positive, negative: ready['3'].inputs.negative,
                    latent_image: ['40', 0], seed,
                    steps: engine === 'sdxl' ? 18 : 8, cfg: ready['3'].inputs.cfg,
                    sampler_name: ready['3'].inputs.sampler_name, scheduler: ready['3'].inputs.scheduler,
                    denoise: 0.45,
                  },
                };
                ready['8'].inputs.samples = ['41', 0];
                // The refined latent is the one decode big enough to hit the
                // MPS INT_MAX ceiling — decode it tiled on Apple hardware.
                if ((await comfyDevice().catch(() => 'unknown')) === 'mps') useTiledVaeDecode(ready);
                const printTarget = targetSize(b.w, b.h, 3072);
                if (ready['92']) { ready['92'].inputs.width = printTarget.width; ready['92'].inputs.height = printTarget.height; }
                refineInfo = { width: rw, height: rh, denoise: 0.45 };
              } else {
                conditioning.notes = [...(conditioning.notes || []), 'Refine runs on Z-Image/SDXL (KSampler graphs) — Flux keeps its ESRGAN tail.'];
              }
            }

            const id = newJob();
            // negativeHonoured: whether the negative prompt was genuinely consumed.
            // Flux and Z-Image at CFG 1 ignore it entirely — say so rather than pretend.
            const negativeHonoured = engine === 'flux' ? fluxNegativeHonoured : engine !== 'zimage';
            const meta = {
              prompt: cleanPositive, width, height, target, upscaler, lora: usedLora, ckpt: usedCkpt || null, engine,
              fast: usedFast, seed, draft: !!draftWf, refine: refineInfo, batch,
              negative, negativeHonoured, realism: b.realism !== false,
              conditioning,
            };
            patchJob(id, meta);
            (async () => {
              if (draftWf) {
                await comfyRun(id, draftWf, { draft: true });
                const j = JOBS.get(id);
                if (!j || j.status === 'error' || j.status === 'done') return; // cancelled or failed during the draft
                // ANCHOR THE FINAL ON THE DRAFT. Same seed at a different
                // resolution still composes differently — which is exactly the
                // "the draft looked great, the final is something else" problem.
                // So the final is img2img FROM the draft: upscale the draft to
                // the final latent size, encode it, and re-sample at moderate
                // denoise. The composition you approved is the composition you
                // get; the final pass adds resolution and detail, not a new
                // picture. KSampler graphs only (Z-Image, SDXL) — Flux drafts
                // stay independent and the report says so.
                try {
                  const draftImg = j.draftImages?.[0];
                  // With batch > 1 the POINT is variety — anchoring every variant
                  // on one draft would collapse them into near-copies. The draft
                  // then serves as preview only, and the report says so.
                  if (batch === 1 && draftImg && ready['3']?.class_type === 'KSampler' && ready['8']?.inputs?.vae) {
                    const name = await comfyUploadImage(draftImg);
                    ready['50'] = { class_type: 'LoadImage', inputs: { image: name } };
                    ready['51'] = { class_type: 'ImageScale', inputs: { image: ['50', 0], upscale_method: 'lanczos', width, height, crop: 'disabled' } };
                    ready['52'] = { class_type: 'VAEEncode', inputs: { pixels: ['51', 0], vae: ready['8'].inputs.vae } };
                    ready['3'].inputs.latent_image = ['52', 0];
                    ready['3'].inputs.denoise = 0.58;
                    patchJob(id, { anchored: true });
                  }
                } catch { /* anchoring is an upgrade, never a blocker */ }
              }
              await comfyRun(id, ready);
            })().catch((e) => patchJob(id, { status: 'error', error: e.message }));
            return send(res, 202, { jobId: id, ...meta });
          }

          // ── manual upscale: ESRGAN + lanczos on any produced image ─
          if (url.pathname === '/api/gen/upscale' && req.method === 'POST') {
            const b = await body(req);
            if (!b.image) return send(res, 400, { error: 'No source image.' });
            const models = await comfyModels();
            const upscaler = ['4x-UltraSharp.pth', 'RealESRGAN_x4plus.pth', '4x_foolhardy_Remacri.pth']
              .find((n) => models.upscalers.includes(n)) || models.upscalers[0];
            if (!upscaler) return send(res, 400, { error: 'No upscale model installed in ComfyUI (models/upscale_models).' });
            const name = await comfyUploadImage(b.image);
            const t = targetSize(b.w || 2048, b.h || 2048, 3072);
            const wf = {
              '20': { class_type: 'LoadImage', inputs: { image: name } },
              '90': { class_type: 'UpscaleModelLoader', inputs: { model_name: upscaler } },
              '91': { class_type: 'ImageUpscaleWithModel', inputs: { upscale_model: ['90', 0], image: ['20', 0] } },
              '92': { class_type: 'ImageScale', inputs: { image: ['91', 0], upscale_method: 'lanczos', width: t.width, height: t.height, crop: 'disabled' } },
              '9': { class_type: 'SaveImage', inputs: { images: ['92', 0], filename_prefix: 'medartis_upscale' } },
            };
            const id = newJob();
            patchJob(id, { kind: 'upscale', upscaler, target: t });
            comfyRun(id, wf).catch((e) => patchJob(id, { status: 'error', error: e.message }));
            return send(res, 202, { jobId: id, upscaler, target: t });
          }

          // ── generative expand: one hero → every format ────────────
          if (url.pathname === '/api/gen/expand' && req.method === 'POST') {
            const b = await body(req);
            if (!b.image) return send(res, 400, { error: 'No source image.' });
            const name = await comfyUploadImage(b.image);

            // Pad the SOURCE out to the TARGET aspect. We only ever grow the
            // canvas — the original pixels are never cropped away.
            const sw = b.sw || 1024, sh = b.sh || 1024;
            const target = (b.w || 1024) / (b.h || 1024);
            const cur = sw / sh;
            let padX = 0, padY = 0;
            if (target > cur) padX = Math.round((sh * target - sw) / 2);
            else               padY = Math.round((sw / target - sh) / 2);

            const wf = loadWorkflow('ai/workflows/flux_expand_outpaint.api.json');
            wf['20'].inputs.image = name;
            wf['21'].inputs.left = padX; wf['21'].inputs.right = padX;
            wf['21'].inputs.top = padY;  wf['21'].inputs.bottom = padY;
            wf['6'].inputs.text = compilePrompt({
              prompt: b.prompt || 'continue the scene naturally, same room, same light, same depth of field',
              surface: b.surface,
            }).positive;
            wf['25'].inputs.noise_seed = Math.floor(Math.random() * 2 ** 31);
            wf['10'].inputs.lora_name = LORA();

            const { wf: ready } = await resolveWorkflow(wf);
            const id = newJob();
            patchJob(id, { kind: 'expand' });
            comfyRun(id, ready).catch((e) => patchJob(id, { status: 'error', error: e.message }));
            return send(res, 202, { jobId: id, padX, padY });
          }

          // ── still → motion (Higgsfield) ───────────────────────────
          if (url.pathname === '/api/gen/video' && req.method === 'POST') {
            if (!HF_KEY()) return send(res, 400, { error: 'No HIGGSFIELD_API_KEY in .env.local.' });
            const b = await body(req);
            const gate = safetyCheck(b.prompt);
            if (!gate.ok) return send(res, 422, { error: gate.message, term: gate.term });
            const id = newJob();
            higgsfieldVideo(id, b).catch((e) => patchJob(id, { status: 'error', error: e.message }));
            return send(res, 202, { jobId: id });
          }

          // ── cancel ────────────────────────────────────────────────
          if (url.pathname.startsWith('/api/gen/cancel/') && req.method === 'POST') {
            const id = url.pathname.split('/').pop();
            await fetch(`${COMFY()}/interrupt`, { method: 'POST' }).catch(() => {});
            patchJob(id, { status: 'error', error: 'Cancelled.' });
            return send(res, 200, { ok: true });
          }

          // ── job poll ──────────────────────────────────────────────
          if (url.pathname.startsWith('/api/gen/job/')) {
            const id = url.pathname.split('/').pop();
            const job = JOBS.get(id);
            if (!job) return send(res, 404, { error: 'Unknown job.' });
            const { workflow: _wf, ...safe } = job;   // the graph isn't the browser's business
            return send(res, 200, safe);
          }

          return send(res, 404, { error: 'Unknown /api/gen route.' });
        } catch (e) {
          return send(res, 500, { error: e.message });
        }
      });
    },
  };
}
