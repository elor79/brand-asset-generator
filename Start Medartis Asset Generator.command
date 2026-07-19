#!/bin/bash
# ──────────────────────────────────────────────────────────────
#  MEDARTIS Brand Asset Generator — launcher
#  Double-click. Starts ComfyUI (the AI backend) AND the app, together.
#
#      app      → http://localhost:5174     (pinned — Cadence owns 5173)
#      comfyui  → http://127.0.0.1:8188     (pinned — COMFY_URL in .env.local)
#
#  Ports are PINNED on purpose. Vite runs with strictPort, and the app talks to
#  ComfyUI over a URL it is told explicitly, so neither may drift to "the next
#  free port" — a drifting app is how you end up with two servers and a Generate
#  panel pointing at nothing.
#
#  ONE ComfyUI, SHARED. If something is already answering on 8188 we USE it — we
#  do not kill it and start our own. The IBRA generator boots the same backend,
#  and the weights are 100+ GB: two installs would be two copies of the same
#  thing fighting over the same GPU.
#
#  Flags:  --no-ai     app only
#          --ai-only   ComfyUI only
# ──────────────────────────────────────────────────────────────
set -e
cd "$(dirname "$0")"
APP_DIR="$(pwd)"

APP_PORT=5174
COMFY_PORT=8188

NO_AI=0; AI_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --no-ai)   NO_AI=1 ;;
    --ai-only) AI_ONLY=1 ;;
  esac
done

# .env.local may move the ComfyUI port. Read ONLY that one key — never `source`
# the file: it holds API secrets and sourcing it would execute arbitrary shell.
if [ -f .env.local ]; then
  ENV_PORT=$(grep -E '^COMFY_URL=' .env.local | tail -1 | sed -E 's#.*:([0-9]+).*#\1#')
  case "$ENV_PORT" in ''|*[!0-9]*) ;; *) COMFY_PORT="$ENV_PORT" ;; esac
fi

echo "──────────────────────────────────────────────"
echo "  MEDARTIS · Brand Asset Generator"
echo "  app      → http://localhost:$APP_PORT"
echo "  comfyui  → http://127.0.0.1:$COMFY_PORT"
echo "──────────────────────────────────────────────"

# ── Node ────────────────────────────────────────────────────
command -v node >/dev/null 2>&1 || export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  echo "✗ Node.js not found. Install the LTS from https://nodejs.org, or: brew install node"
  read -n 1 -s -r -p "Press any key to close…"
  exit 1
fi
echo "✓ Node $(node -v)"
[ -d node_modules ] || { echo "→ First run — installing dependencies…"; npm install; }

# ── Where is ComfyUI? ───────────────────────────────────────
# We do not ship our own. Look in the obvious places, newest-first, and say
# plainly what to do if none of them exist — an empty 8188 with no explanation
# is the single most confusing state this tool can be in.
find_comfy() {
  local candidates=(
    "${COMFY_HOME:-}"
    "$APP_DIR/ComfyUI"
    "$APP_DIR/../ibra_rebranding/ibra_asset_generator/ComfyUI"
    "$APP_DIR/../ibra_asset_generator/ComfyUI"
    "$HOME/ComfyUI"
    "$HOME/Documents/ComfyUI"
  )
  for c in "${candidates[@]}"; do
    [ -n "$c" ] && [ -f "$c/main.py" ] && { (cd "$c" && pwd); return 0; }
  done
  return 1
}

# ── Conditioning requirements ───────────────────────────────
# § 12's Conditioning panel needs an IP-Adapter node pack and ControlNet weights,
# neither of which ships with ComfyUI. Check the DISK before boot — custom nodes
# are only registered at startup, so discovering this afterwards means restarting
# anyway. Better to install first and boot once.
#
# The panel degrades honestly without these; this just means you never have to
# read the degradation message in the first place.
missing_conditioning() {   # missing_conditioning <comfy_dir> → prints what's absent
  local d="$1" missing=""
  [ -d "$d/custom_nodes/ComfyUI_IPAdapter_plus" ] || missing="$missing  · IP-Adapter node pack\n"
  compgen -G "$d/models/ipadapter/*.safetensors" >/dev/null 2>&1 || missing="$missing  · IP-Adapter weights\n"
  compgen -G "$d/models/clip_vision/*.safetensors" >/dev/null 2>&1 || missing="$missing  · CLIP-Vision encoder\n"
  # The server matches a ControlNet by the TYPE in its filename, so a folder with
  # some unrelated .safetensors in it is not the same as having depth or canny.
  compgen -G "$d/models/controlnet/*depth*" >/dev/null 2>&1 || missing="$missing  · ControlNet · depth\n"
  compgen -G "$d/models/controlnet/*canny*" >/dev/null 2>&1 || missing="$missing  · ControlNet · canny\n"
  printf "%b" "$missing"
}

ensure_conditioning() {   # ensure_conditioning <comfy_dir>
  local d="$1" missing
  missing="$(missing_conditioning "$d")"
  [ -z "$missing" ] && { echo "✓ Conditioning ready (IP-Adapter + ControlNet)"; return 0; }

  echo ""
  echo "⚠ § 12 · Conditioning is missing some pieces:"
  printf "%b" "$missing"
  echo "  (~5 GB. Without them, Generate still works — reference images and"
  echo "   layout control maps do not.)"
  echo ""

  local ans="${SETUP_CONDITIONING:-}"
  if [ -z "$ans" ]; then
    printf "  Install them now? [Y/n] "
    read -r -n 1 ans; echo ""
  fi
  case "$ans" in
    n|N|skip|0)
      echo "  Skipped. Install later with: npm run setup:conditioning -- \"$d\""
      return 1 ;;
  esac

  bash "$APP_DIR/ai/tools/setup_conditioning.sh" "$d" || {
    echo "  ⚠ Setup did not finish. The app still starts; § 12 will say what is missing."
    return 1
  }
  return 0
}

COMFY_PID=""
cleanup() {
  # Only ever stop a ComfyUI WE started. If we adopted a running one, leave it —
  # it may well be IBRA's, and killing another app's backend on exit is rude.
  if [ -n "$COMFY_PID" ] && kill -0 "$COMFY_PID" 2>/dev/null; then
    echo ""
    echo "→ Stopping ComfyUI (PID $COMFY_PID)…"
    kill "$COMFY_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

comfy_alive() { curl -sf "http://127.0.0.1:$COMFY_PORT/system_stats" >/dev/null 2>&1; }

start_comfy() {
  local dir
  dir="$(find_comfy || true)"

  if comfy_alive; then
    echo "✓ ComfyUI already running on 127.0.0.1:$COMFY_PORT — reusing it"
    # We can still see whether the pieces are on disk. But a running ComfyUI has
    # already registered its nodes: installing now would need a restart, and this
    # instance may be another app's to restart. So: install the files, say so,
    # and let the user decide when to bounce it.
    if [ -n "$dir" ] && [ -n "$(missing_conditioning "$dir")" ]; then
      ensure_conditioning "$dir" && {
        echo ""
        echo "⚠ Installed — but this ComfyUI was ALREADY RUNNING when we got here."
        echo "  Custom nodes are only registered at boot, so § 12 · Conditioning stays"
        echo "  greyed out until ComfyUI is restarted. Quit it and run npm start again."
      }
    fi
    return 0
  fi

  if [ -z "$dir" ]; then
    echo ""
    echo "⚠ ComfyUI is not installed anywhere I looked — that is why $COMFY_PORT is empty."
    echo "  Looked in: \$COMFY_HOME, ./ComfyUI, the IBRA generator's ComfyUI, ~/ComfyUI"
    echo ""
    echo "  If you already have one, just point me at it — no second install:"
    echo "      export COMFY_HOME=/path/to/ComfyUI   (add it to .env.local to make it stick)"
    echo ""
    echo "  If you don't:  git clone https://github.com/comfyanonymous/ComfyUI"
    echo ""
    read -n 1 -s -r -p "Press any key to start the app WITHOUT the AI backend…"
    echo ""
    return 1
  fi

  # Share the AUTOMATIC1111 model library rather than keeping a second copy of
  # every 6 GB checkpoint. Read at boot only, so it belongs here.
  bash "$APP_DIR/ai/tools/link_webui_models.sh" "$dir" >/dev/null 2>&1 || true

  # Install BEFORE booting: custom nodes are only registered at startup, so doing
  # it after would cost a restart. This is the whole reason the check lives here
  # and not in the app.
  ensure_conditioning "$dir" || true

  echo "→ Starting ComfyUI from $dir …"
  (
    cd "$dir"
    # Its own venv if it has one, so it can never fight another Python on the box.
    [ -f venv/bin/activate ] && . venv/bin/activate

    # ── Apple Silicon tuning ────────────────────────────────────────────────
    # --preview-method auto      → ComfyUI streams a preview image every step
    #                              over the websocket; the panel shows the
    #                              picture forming instead of a bare bar. This
    #                              one flag is the difference between "is it
    #                              doing anything?" and watching it paint.
    # --use-pytorch-cross-attention → 30–50% faster sampling on M3/M4 MPS.
    # --force-fp16               → never silently fall back to fp32 on MPS.
    # --mac-max-memory           → let PyTorch use ~70% of unified memory
    #                              instead of its conservative default.
    # PYTORCH_ENABLE_MPS_FALLBACK → preprocessor nodes with an unimplemented
    #                              MPS op fall back to CPU instead of crashing.
    EXTRA_FLAGS=""
    if [ "$(uname -s)" = "Darwin" ] && [ "$(uname -m)" = "arm64" ]; then
      export PYTORCH_ENABLE_MPS_FALLBACK=1
      MEM_BYTES=$(sysctl -n hw.memsize 2>/dev/null || echo 0)
      if [ "$MEM_BYTES" -gt 0 ]; then
        MEM_MB=$(( MEM_BYTES / 1024 / 1024 * 70 / 100 ))
        EXTRA_FLAGS="--use-pytorch-cross-attention --force-fp16 --mac-max-memory $MEM_MB"
      else
        EXTRA_FLAGS="--use-pytorch-cross-attention --force-fp16"
      fi
    fi
    # shellcheck disable=SC2086
    exec python main.py --listen 127.0.0.1 --port "$COMFY_PORT" --preview-method auto $EXTRA_FLAGS >"$APP_DIR/comfyui.log" 2>&1
  ) &
  COMFY_PID=$!

  # Wait until it ACTUALLY answers. The Generate panel probes /api/gen/status on
  # mount, and a half-booted ComfyUI reports identically to an absent one.
  printf "  waiting for ComfyUI"
  for _ in $(seq 1 60); do
    if comfy_alive; then
      echo ""
      echo "✓ ComfyUI up (PID $COMFY_PID) · log: comfyui.log"
      return 0
    fi
    if ! kill -0 "$COMFY_PID" 2>/dev/null; then
      echo ""
      echo "✗ ComfyUI exited during startup. Last lines of comfyui.log:"
      tail -n 15 "$APP_DIR/comfyui.log" 2>/dev/null | sed 's/^/    /'
      COMFY_PID=""
      return 1
    fi
    printf "."
    sleep 2
  done
  echo ""
  echo "⚠ ComfyUI did not answer within 2 minutes — starting the app anyway."
  echo "  (The first load is slow; the weights are large. See comfyui.log.)"
  return 0
}

if [ "$NO_AI" -eq 0 ]; then
  start_comfy || true
else
  echo "→ Skipping ComfyUI (--no-ai)"
fi

if [ "$AI_ONLY" -eq 1 ]; then
  echo ""
  echo "ComfyUI only — http://127.0.0.1:$COMFY_PORT · Ctrl+C to stop."
  [ -n "$COMFY_PID" ] && wait "$COMFY_PID"
  exit 0
fi

# ── App ─────────────────────────────────────────────────────
# Free OUR port only. Never touch ComfyUI's — see the note at the top.
PIDS=$(lsof -nP -iTCP:"$APP_PORT" -sTCP:LISTEN -t 2>/dev/null || true)
if [ -n "$PIDS" ]; then
  echo "⚠ Port $APP_PORT busy — stopping PID $PIDS"
  kill $PIDS 2>/dev/null || true
  sleep 1
fi

# If ComfyUI dies mid-session (an OOM on a big run is the usual reason), say so
# in THIS window rather than leaving the Generate panel to look broken.
if [ -n "$COMFY_PID" ]; then
  (
    while kill -0 "$COMFY_PID" 2>/dev/null; do sleep 5; done
    echo ""
    echo "⚠ ComfyUI stopped (PID $COMFY_PID). The Generate panel will show it as unavailable."
    tail -n 8 "$APP_DIR/comfyui.log" 2>/dev/null | sed 's/^/    /'
    echo "  Restart both with: npm start"
  ) &
fi

# Tell the app WHERE the models are. It reads each checkpoint's safetensors header
# to know its real architecture — filenames cannot be trusted, and an SD 1.5 file
# in an SDXL graph renders garbage instead of failing.
COMFY_DIR_FOUND="$(find_comfy || true)"
[ -n "$COMFY_DIR_FOUND" ] && export COMFY_HOME="$COMFY_DIR_FOUND"
export WEBUI_HOME="${WEBUI_HOME:-$HOME/Documents/my_apps/stable-diffusion-webui}"

echo "→ Starting the app → http://localhost:$APP_PORT"
echo "  (leave this window open · Ctrl+C stops both)"
echo ""
npm run dev:app
