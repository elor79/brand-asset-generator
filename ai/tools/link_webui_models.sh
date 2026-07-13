#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# POINT COMFYUI AT AN EXISTING AUTOMATIC1111 / FORGE MODEL LIBRARY
# ─────────────────────────────────────────────────────────────────────────────
#   bash ai/tools/link_webui_models.sh /path/to/ComfyUI [/path/to/stable-diffusion-webui]
#
# Checkpoints are 6–7 GB each. Copying them into ComfyUI's own models/ folder
# means a second copy of every file, and a library that drifts out of sync the
# first time you download something in the other tool.
#
# ComfyUI reads `extra_model_paths.yaml`: a list of EXTRA places to look. So we
# point it at the A1111 tree and both tools share one library, in place. Nothing
# is copied, nothing is moved, and A1111 keeps working exactly as it did.
set -euo pipefail

COMFY="${1:-${COMFY_HOME:-}}"
WEBUI="${2:-${WEBUI_HOME:-$HOME/Documents/my_apps/stable-diffusion-webui}}"

[[ -d "${COMFY:-}/models" ]] || { echo "Usage: bash ai/tools/link_webui_models.sh /path/to/ComfyUI [/path/to/stable-diffusion-webui]" >&2; exit 1; }
if [[ ! -d "$WEBUI/models/Stable-diffusion" ]]; then
  echo "· No A1111 install at $WEBUI — nothing to share. (Set WEBUI_HOME to point elsewhere.)"
  exit 0
fi

YAML="$COMFY/extra_model_paths.yaml"

# Idempotent: if our block is already in there, leave it alone. Never clobber a
# yaml the user may have edited by hand.
if [[ -f "$YAML" ]] && grep -q "^a1111:" "$YAML"; then
  echo "✓ ComfyUI already reads the A1111 library ($YAML)"
else
  cat >> "$YAML" <<YML
# Added by the Medartis Brand Asset Generator — share one model library with
# AUTOMATIC1111 instead of keeping a second copy of every 6 GB checkpoint.
a1111:
    base_path: ${WEBUI}
    checkpoints: models/Stable-diffusion
    vae: models/VAE
    loras: |
        models/Lora
        models/LyCORIS
    upscale_models: |
        models/ESRGAN
        models/RealESRGAN
        models/SwinIR
    embeddings: embeddings
    controlnet: models/ControlNet
YML
  echo "✓ Wrote $YAML — ComfyUI now also reads $WEBUI"
fi

echo ""
echo "Checkpoints it will now see:"
ls -1 "$WEBUI/models/Stable-diffusion" 2>/dev/null | grep -Ei '\.(safetensors|ckpt)$' | sed 's/^/  · /' || echo "  (none)"
echo ""
echo "RESTART ComfyUI — extra_model_paths.yaml is only read at boot."
