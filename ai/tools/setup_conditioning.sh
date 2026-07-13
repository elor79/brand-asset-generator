#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# CONDITIONING SETUP — IP-Adapter + ControlNet for the SDXL engine
# ─────────────────────────────────────────────────────────────────────────────
# The Generate panel can condition on two things:
#
#   1 · A REFERENCE IMAGE  ("look like THIS")     → IP-Adapter
#   2 · A CONTROL MAP      ("compose like THIS")  → ControlNet
#                                                   (the layout canvas emits one)
#
# Neither is part of a stock ComfyUI install: IP-Adapter is a custom node pack,
# and the ControlNets are separate weight files. Until they are present the panel
# says so and the run falls back to a plain text2img — it never pretends.
#
# This installs both, ONCE. SDXL only: Flux ControlNet/IP-Adapter weights are
# tied to a specific checkpoint and are not interchangeable.
#
#   bash ai/tools/setup_conditioning.sh /path/to/ComfyUI
#
# Then restart ComfyUI and reopen § 08 — the controls light up on their own.
set -euo pipefail

COMFY="${1:-${COMFYUI_DIR:-}}"
if [[ -z "$COMFY" || ! -d "$COMFY/models" ]]; then
  echo "Usage: bash ai/tools/setup_conditioning.sh /path/to/ComfyUI" >&2
  echo "  (the folder containing models/ and custom_nodes/)" >&2
  exit 1
fi

say() { printf '\n\033[1m· %s\033[0m\n' "$1"; }

# curl -C - resumes a half-finished download instead of starting over, and skips
# the file entirely when it is already complete.
fetch() {
  local url="$1" dest="$2"
  mkdir -p "$(dirname "$dest")"
  if [[ -s "$dest" ]]; then
    echo "  ✓ $(basename "$dest") — already there"
    return
  fi
  echo "  ↓ $(basename "$dest")"
  curl -fL --progress-bar -C - -o "$dest" "$url"
}

# ── 1 · IP-ADAPTER ──────────────────────────────────────────────────────────
say "IP-Adapter (custom node + weights)"
NODE="$COMFY/custom_nodes/ComfyUI_IPAdapter_plus"
if [[ -d "$NODE/.git" ]]; then
  echo "  ✓ ComfyUI_IPAdapter_plus — already cloned"
else
  git clone --depth 1 https://github.com/cubiq/ComfyUI_IPAdapter_plus "$NODE"
fi

# IPAdapterUnifiedLoader resolves the ipadapter/clip_vision PAIR itself — but it
# can only resolve files that exist, and it expects these exact names.
fetch "https://huggingface.co/h94/IP-Adapter/resolve/main/sdxl_models/ip-adapter_sdxl_vit-h.safetensors" \
      "$COMFY/models/ipadapter/ip-adapter_sdxl_vit-h.safetensors"
fetch "https://huggingface.co/h94/IP-Adapter/resolve/main/sdxl_models/ip-adapter-plus_sdxl_vit-h.safetensors" \
      "$COMFY/models/ipadapter/ip-adapter-plus_sdxl_vit-h.safetensors"
fetch "https://huggingface.co/h94/IP-Adapter/resolve/main/models/image_encoder/model.safetensors" \
      "$COMFY/models/clip_vision/CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors"

# ── 2 · CONTROLNET ──────────────────────────────────────────────────────────
# Filenames matter: the server picks a model by matching 'depth' / 'canny' /
# 'scribble' / 'openpose' in the FILENAME against the control type you chose.
say "ControlNet (SDXL)"
fetch "https://huggingface.co/diffusers/controlnet-depth-sdxl-1.0/resolve/main/diffusion_pytorch_model.fp16.safetensors" \
      "$COMFY/models/controlnet/controlnet-depth-sdxl-1.0.fp16.safetensors"
fetch "https://huggingface.co/diffusers/controlnet-canny-sdxl-1.0/resolve/main/diffusion_pytorch_model.fp16.safetensors" \
      "$COMFY/models/controlnet/controlnet-canny-sdxl-1.0.fp16.safetensors"

# ── 3 · PREPROCESSORS (optional) ────────────────────────────────────────────
# Only needed for "From a photo" — a map built FROM THE LAYOUT is already a
# control map, and running a depth estimator over it would just estimate the
# depth of a diagram. Without this pack, layout maps still work; photo sources
# get passed through raw and the panel says so.
say "Preprocessors (optional — only for 'From a photo')"
AUX="$COMFY/custom_nodes/comfyui_controlnet_aux"
if [[ -d "$AUX/.git" ]]; then
  echo "  ✓ comfyui_controlnet_aux — already cloned"
else
  git clone --depth 1 https://github.com/Fannovel16/comfyui_controlnet_aux "$AUX"
fi

# ── 4 · PYTHON DEPS ─────────────────────────────────────────────────────────
# Into ComfyUI's OWN venv. A custom node whose imports fail doesn't announce
# itself — ComfyUI just quietly skips registering it, and the panel then reports
# the node as missing, which is true but unhelpfully so.
say "Python dependencies (into ComfyUI's venv)"
if [[ -f "$COMFY/venv/bin/activate" ]]; then
  # shellcheck disable=SC1091
  source "$COMFY/venv/bin/activate"
  for req in "$NODE/requirements.txt" "$AUX/requirements.txt"; do
    [[ -f "$req" ]] && { echo "  · $(basename "$(dirname "$req")")"; python -m pip install --quiet -r "$req" || true; }
  done
  deactivate
else
  echo "  ⚠ No venv at $COMFY/venv — install the requirements with whatever Python runs ComfyUI:"
  for req in "$NODE/requirements.txt" "$AUX/requirements.txt"; do
    [[ -f "$req" ]] && echo "      pip install -r $req"
  done
fi

cat <<'DONE'

─────────────────────────────────────────────────────────────
✓ Done.

RESTART ComfyUI — custom nodes are only registered at boot. `npm start` does
this for you; it re-checks before every launch.

Then § 08 GENERATE enables the Conditioning controls on its own: the panel
re-probes /object_info every few seconds, and everything it reports about what
is installed is read from ComfyUI, never guessed.
─────────────────────────────────────────────────────────────
DONE
