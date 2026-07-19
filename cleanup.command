#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# cleanup.command — one-click repo cleanup
# ─────────────────────────────────────────────────────────────────────────────
# Double-click this to:
#   1. reclaim ~753 MB — remove an orphaned temp pack left by an interrupted git op
#   2. remove stray __probe* ref files that break `git gc`
#   3. compact the repo (git gc)
#   4. remove the leftover nested brand_asset_generator/ copy from the Cadence repo
#   5. verify the repo is healthy
#   6. (optional) add a GitHub remote and push
#
# Everything here is safe and idempotent: run it twice and the second run just
# reports "nothing to do". It never touches your commits — only stray files and
# one orphaned pack that git already ignores. Your branch (main) is untouched.

set -u
cd "$(dirname "$0")" || exit 1
BAG="$(pwd)"
CADENCE="$(cd "$BAG/../cadence" 2>/dev/null && pwd || echo "")"

bold() { printf "\033[1m%s\033[0m\n" "$1"; }
ok()   { printf "  \033[32m✓\033[0m %s\n" "$1"; }
info() { printf "  \033[2m%s\033[0m\n" "$1"; }
warn() { printf "  \033[33m!\033[0m %s\n" "$1"; }

echo
bold "Brand generator · repo cleanup"
info "$BAG"
echo

# Show the before size so the reclaim is visible.
before=$(du -sh .git 2>/dev/null | cut -f1)
info ".git is currently $before"
echo

read -r -p "Proceed with cleanup? [y/N] " reply
case "$reply" in [yY]*) ;; *) echo "Cancelled."; exit 0;; esac
echo

# ── 1. Orphaned temp pack ────────────────────────────────────────────────────
bold "1 · Reclaiming disk from the orphaned temp pack"
found=0
for f in .git/objects/pack/tmp_pack_* .git/objects/pack/*.orphan; do
  [ -e "$f" ] || continue
  sz=$(du -h "$f" 2>/dev/null | cut -f1)
  rm -f "$f" && ok "removed $(basename "$f") ($sz)" && found=1
done
[ "$found" -eq 0 ] && info "no orphan pack — nothing to reclaim"
echo

# ── 2. Stray __probe ref files ───────────────────────────────────────────────
bold "2 · Removing stray __probe ref files"
if ls .git/refs/heads/__probe* >/dev/null 2>&1; then
  rm -f .git/refs/heads/__probe*
  ok "removed __probe leftovers"
else
  info "none present"
fi
# Belt and braces: strip __probe from packed-refs if it ever got packed.
if [ -f .git/packed-refs ] && grep -q "__probe" .git/packed-refs 2>/dev/null; then
  grep -v "__probe" .git/packed-refs > .git/packed-refs.tmp && mv .git/packed-refs.tmp .git/packed-refs
  ok "cleaned __probe from packed-refs"
fi
echo

# ── 3. Compact ───────────────────────────────────────────────────────────────
bold "3 · Compacting the repository"
if git gc --prune=now >/tmp/cleanup-gc.log 2>&1; then
  ok "git gc complete"
else
  warn "git gc reported an issue — see /tmp/cleanup-gc.log"
  tail -3 /tmp/cleanup-gc.log | sed 's/^/    /'
fi
echo

# ── 4. Cadence's leftover nested copy ────────────────────────────────────────
bold "4 · Removing the leftover nested copy from Cadence"
if [ -n "$CADENCE" ] && [ -d "$CADENCE/brand_asset_generator" ]; then
  # Only remove if it is NOT tracked by Cadence (it should be an untracked leftover).
  if git -C "$CADENCE" ls-files --error-unmatch brand_asset_generator >/dev/null 2>&1; then
    warn "Cadence TRACKS brand_asset_generator/ — leaving it alone (not a leftover)"
  else
    rm -rf "$CADENCE/brand_asset_generator"
    ok "removed the untracked nested copy from Cadence"
  fi
else
  info "no leftover copy in Cadence"
fi
echo

# ── 5. Health check ──────────────────────────────────────────────────────────
bold "5 · Verifying"
after=$(du -sh .git 2>/dev/null | cut -f1)
ok ".git is now $after (was $before)"
if git fsck --connectivity-only 2>&1 | grep -vE "dangling|^$" | grep -q .; then
  warn "git fsck still reports something:"
  git fsck --connectivity-only 2>&1 | grep -vE "dangling|^$" | sed 's/^/    /'
else
  ok "git fsck clean (dangling commits, if any, are harmless)"
fi
ok "HEAD is $(git rev-parse --short main 2>/dev/null) on main — untouched"
echo

# ── 6. Optional: add a remote and push ───────────────────────────────────────
bold "6 · Back up on GitHub (optional)"
if git remote get-url origin >/dev/null 2>&1; then
  info "remote already set: $(git remote get-url origin)"
  read -r -p "Push to it now? [y/N] " p
  case "$p" in [yY]*) git push -u origin main && ok "pushed";; *) info "skipped push";; esac
else
  info "This repo has no remote yet. Create an EMPTY repo on GitHub first"
  info "(no README, no .gitignore), then paste its URL below — or press Enter to skip."
  read -r -p "  GitHub URL: " url
  if [ -n "$url" ]; then
    git remote add origin "$url" && ok "remote added"
    git push -u origin main && ok "pushed to $url"
  else
    info "skipped — you can add a remote later with:"
    info "  git remote add origin <url> && git push -u origin main"
  fi
fi
echo
bold "Done."
echo
