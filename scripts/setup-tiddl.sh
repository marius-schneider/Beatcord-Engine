#!/usr/bin/env bash
# Rebuild the patched `tiddl` the TIDAL helper imports.
#
# vendor/ is gitignored, so the fork itself is not tracked — this script plus the
# tracked patch series in patches/tiddl/ is what makes it reproducible on another
# host. Re-run it after changing the pinned tag or adding a patch.
#
# To pull in a new upstream release:
#   git -C vendor/tiddl fetch upstream --tags
#   git -C vendor/tiddl rebase <new-tag> beatcord     # resolve conflicts if any
#   git -C vendor/tiddl format-patch -o ../../patches/tiddl <new-tag>..beatcord
#   ...then bump TIDDL_TAG below and commit both.
set -euo pipefail

TIDDL_TAG="${TIDDL_TAG:-v3.4.4}"
ENGINE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FORK_DIR="$ENGINE_DIR/vendor/tiddl"
VENV_PY="$ENGINE_DIR/vendor/tidal-venv/bin/python"
PATCH_DIR="$ENGINE_DIR/patches/tiddl"

if [ ! -x "$VENV_PY" ]; then
    echo "error: no venv at $VENV_PY — create it first (python3.13+ -m venv vendor/tidal-venv)" >&2
    exit 1
fi

if [ ! -d "$FORK_DIR/.git" ]; then
    git clone https://github.com/oskvr37/tiddl.git "$FORK_DIR"
    git -C "$FORK_DIR" remote rename origin upstream
fi

git -C "$FORK_DIR" fetch upstream --tags --quiet
# Rebuild the branch from scratch so a re-run is idempotent rather than additive.
git -C "$FORK_DIR" checkout --quiet --detach "$TIDDL_TAG"
git -C "$FORK_DIR" branch --quiet -D beatcord 2>/dev/null || true
git -C "$FORK_DIR" checkout --quiet -b beatcord

shopt -s nullglob
patches=("$PATCH_DIR"/*.patch)
if [ ${#patches[@]} -eq 0 ]; then
    echo "error: no patches found in $PATCH_DIR" >&2
    exit 1
fi
git -C "$FORK_DIR" am --quiet "${patches[@]}"

"$VENV_PY" -m pip install --quiet -e "$FORK_DIR"

echo "tiddl: $TIDDL_TAG + ${#patches[@]} patch(es) installed into vendor/tidal-venv"
"$VENV_PY" -c "import tiddl; print('  ->', tiddl.__file__)"
