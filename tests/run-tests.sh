#!/usr/bin/env bash
# Compile + run the fglunit tests for the MegaMenu package.
#   fglunit comes from the devDependency: run `fglpkg install` in the repo
#   root once, and this script picks it up through `fglpkg env`. Set
#   FGLUNIT_DIR to use another fglunit checkout instead.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"

: "${FGLDIR:?set FGLDIR}"
export PATH="$FGLDIR/bin:$PATH"
if [ -n "${FGLUNIT_DIR:-}" ]; then
  export FGLLDPATH="$FGLUNIT_DIR:$ROOT:${FGLLDPATH:-}"
else
  command -v fglpkg >/dev/null && [ -d "$ROOT/.fglpkg/packages/fglunit" ] ||
    { echo "fglunit not found: run 'fglpkg install' in $ROOT, or set FGLUNIT_DIR" >&2; exit 1; }
  eval "$(cd "$ROOT" && fglpkg env)"
  export FGLLDPATH="$ROOT:${FGLLDPATH:-}"   # this checkout's module wins over an installed one
fi
export FGLGUI=0   # terminal mode — no GUI

echo "▶ compiling package module"
( cd "$ROOT/com/fourjs/megamenu" && fglcomp -M MegaMenu.4gl )

echo "▶ compiling tests"
( cd "$HERE" && fglcomp -M test_MegaMenu.4gl )

echo "▶ running tests"
( cd "$HERE" && fglrun test_MegaMenu.42m "$@" )
