#!/bin/bash
# setup_zimage.sh — install Z-Image Turbo into an existing ComfyUI.
#
# Z-Image Turbo (Tongyi-MAI, Apache-2.0) is the 2026 sweet spot for local
# generation on Apple Silicon: Flux-level photorealism from a 6B model in
# 8 steps at CFG 1 — roughly 3× faster than Flux on a Mac, and commercially
# usable (unlike FLUX.1 [dev]).
#
# Three files, ~20 GB total, resumable (curl -C -):
#   models/diffusion_models/z_image_turbo_bf16.safetensors
#   models/text_encoders/qwen_3_4b.safetensors
#   models/vae/ae.safetensors            (shared with Flux — skipped if present)
#
# Usage: bash ai/tools/setup_zimage.sh [/path/to/ComfyUI]
set -u

DIR="${1:-${COMFY_HOME:-$HOME/ComfyUI}}"
if [ ! -f "$DIR/main.py" ]; then
  echo "✗ No ComfyUI at $DIR — pass the path: bash ai/tools/setup_zimage.sh /path/to/ComfyUI"
  exit 1
fi

BASE="https://huggingface.co/Comfy-Org/z_image_turbo/resolve/main/split_files"
fetch() { # fetch <url> <dest>
  if [ -f "$2" ]; then echo "✓ $(basename "$2") already present"; return 0; fi
  mkdir -p "$(dirname "$2")"
  echo "↓ $(basename "$2")"
  curl -L -C - --fail --progress-bar "$1" -o "$2.part" && mv "$2.part" "$2"
}

fetch "$BASE/diffusion_models/z_image_turbo_bf16.safetensors" "$DIR/models/diffusion_models/z_image_turbo_bf16.safetensors" || exit 1
fetch "$BASE/text_encoders/qwen_3_4b.safetensors"             "$DIR/models/text_encoders/qwen_3_4b.safetensors" || exit 1
fetch "$BASE/vae/ae.safetensors"                              "$DIR/models/vae/ae.safetensors" || exit 1

echo ""
echo "✓ Z-Image Turbo installed. Restart ComfyUI (npm start) and the Z-IMAGE"
echo "  engine appears in § GENERATE — it becomes the recommended default."
echo "  Note: needs a reasonably current ComfyUI (v0.6+). If the engine errors"
echo "  with unknown node types, update ComfyUI first."
