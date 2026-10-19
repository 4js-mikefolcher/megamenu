#!/usr/bin/env bash
# Local one-shot run for the fjs-megamenu demo:
#   stage widget + example  ->  compile  ->  install a GAS app config  ->
#   start GAS (if needed)  ->  print the URL.
#
# Needs FGL + GAS on PATH (FGLDIR / FGLASDIR set). On this machine they come
# from the Genero Studio bundle; `direnv`/your shell profile usually export them.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
WC="$ROOT/webcomponents/fjs-megamenu"   # the web component (package layout)
EX="$ROOT/examples"                     # demo host (.4gl/.per)
PKG="$ROOT/com/fourjs/megamenu"         # the BDL package module
APP="$HERE/app"                         # staged, disposable app dir (gitignored)

: "${FGLDIR:?set FGLDIR (point it at your Genero fgl dir)}"
: "${FGLASDIR:?set FGLASDIR (point it at your Genero gas dir)}"
export PATH="$FGLDIR/bin:$FGLASDIR/bin:$PATH"
APPDATA="$FGLASDIR/appdata"
PORT="${GAS_PORT:-6394}"

echo "▶ staging widget + package + example → $APP"
rm -rf "$APP"
mkdir -p "$APP/webcomponents/fjs-megamenu" "$APP/com/fourjs/megamenu"
cp "$WC"/fjs-megamenu.html "$WC"/fjs-megamenu.css "$WC"/fjs-megamenu.js \
   "$APP/webcomponents/fjs-megamenu/"
cp "$EX"/example.4gl "$EX"/ex_megamenu.per "$APP/"
cp "$PKG"/MegaMenu.4gl "$APP/com/fourjs/megamenu/"

echo "▶ compiling package module + form + program"
export FGLLDPATH="$APP:${FGLLDPATH:-}"
( cd "$APP/com/fourjs/megamenu" && fglcomp -M MegaMenu.4gl )   # -> .42m beside the source
( cd "$APP" && fglform ex_megamenu.per && fglcomp -M example.4gl )

echo "▶ installing GAS app config → $APPDATA/app/megamenu.xcf"
cat > "$APPDATA/app/megamenu.xcf" <<EOF
<APPLICATION Parent="defaultwa"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:noNamespaceSchemaLocation="http://www.4js.com/ns/gas/6.00/cfextwa.xsd">
  <DESCRIPTION>
    <SHORT>Genero MegaMenu Demo</SHORT>
    <LONG>fjs-megamenu web component: searchable grouped menu, keyboard nav, cookie recents.</LONG>
  </DESCRIPTION>
  <EXECUTION>
    <ENVIRONMENT_VARIABLE Id="FGLRESOURCEPATH">$APP</ENVIRONMENT_VARIABLE>
    <!-- UTF-8 session so multi-byte (emoji) menu icons survive the DVM round-trip -->
    <ENVIRONMENT_VARIABLE Id="LANG">en_US.UTF-8</ENVIRONMENT_VARIABLE>
    <ENVIRONMENT_VARIABLE Id="LC_ALL">en_US.UTF-8</ENVIRONMENT_VARIABLE>
    <ENVIRONMENT_VARIABLE Id="FGL_LENGTH_SEMANTICS">CHAR</ENVIRONMENT_VARIABLE>
    <!-- resolve IMPORT FGL com.fourjs.megamenu.MegaMenu at runtime -->
    <ENVIRONMENT_VARIABLE Id="FGLLDPATH">$APP</ENVIRONMENT_VARIABLE>
    <PATH>$APP</PATH>
    <MODULE>example.42m</MODULE>
  </EXECUTION>
</APPLICATION>
EOF

echo "▶ ensuring GAS dispatcher is up on :$PORT"
if ! curl -s -o /dev/null --max-time 2 "http://127.0.0.1:$PORT/"; then
  # shellcheck disable=SC1090
  [ -f "$FGLASDIR/envas" ] && { set +u; source "$FGLASDIR/envas"; set -u; export PATH="$FGLDIR/bin:$FGLASDIR/bin:$PATH"; }
  nohup httpdispatch > /tmp/gas-megamenu.log 2>&1 &
  # wait without foreground sleep — curl retries on connection-refused
  curl -s -o /dev/null --retry-connrefused --retry 20 --retry-delay 1 --max-time 3 \
       "http://127.0.0.1:$PORT/" || true
fi

echo
echo "▶ Open:  http://localhost:$PORT/ua/r/megamenu"
echo "  (GAS log: /tmp/gas-megamenu.log — re-run this script after editing the widget or .4gl)"
