#!/usr/bin/env bash
# Compile + run the fglunit tests for the MegaMenu package.
#   FGLUNIT_DIR overrides where the fglunit package lives (default: the dev
#   checkout; in CI use `fglpkg install` then point at .fglpkg/packages/fglunit).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
FGLUNIT="${FGLUNIT_DIR:-/Volumes/SandiskSD/fglunit}"

: "${FGLDIR:?set FGLDIR}"
export PATH="$FGLDIR/bin:$PATH"
export FGLLDPATH="$FGLUNIT:$ROOT:${FGLLDPATH:-}"
export FGLGUI=0   # terminal mode — no GUI

echo "▶ compiling package module"
( cd "$ROOT/com/fourjs/megamenu" && fglcomp -M MegaMenu.4gl )

echo "▶ compiling tests"
( cd "$HERE" && fglcomp -M test_MegaMenu.4gl )

echo "▶ running tests"
( cd "$HERE" && fglrun test_MegaMenu.42m "$@" )
