# `sandbox/` — run the fjs-megamenu demo locally

`./run.sh` turns the human-friendly repo layout into something GAS can serve and
launches it:

```
webcomponents/fjs-megamenu/{*.html,*.css,*.js}  →  sandbox/app/webcomponents/fjs-megamenu/
com/fourjs/megamenu/MegaMenu.4gl                →  sandbox/app/com/fourjs/megamenu/
examples/*.{4gl,per}                            →  sandbox/app/
```

then compiles the package module, the form and the program (`fglcomp`/`fglform`),
writes a GAS app config (`$FGLASDIR/appdata/app/megamenu.xcf`) with `PATH` and
`FGLLDPATH` pointing at `sandbox/app/` (so `IMPORT FGL com.fourjs.megamenu.MegaMenu`
resolves) plus `LANG=en_US.UTF-8` + `FGL_LENGTH_SEMANTICS=CHAR` (emoji icons), and
starts the GAS dispatcher if it isn't already up.

`sandbox/app/` is disposable and gitignored — regenerated on every run. Never
hand-edit it.

## Run it

```bash
./run.sh
#   → http://localhost:6394/ua/r/megamenu
```

Prereqs: `FGLDIR` and `FGLASDIR` exported (on this machine they come from the
Genero Studio bundle), and `fglform`/`fglcomp`/`httpdispatch` on `PATH`.
Override the port with `GAS_PORT=...`.

Re-run `./run.sh` after editing the widget or the `.4gl`/`.per` — it restages,
recompiles and the GAS dispatcher picks up the changes.

## Stop GAS

```bash
pkill -f httpdispatch        # stops the dispatcher started by run.sh
```

## Test the widget with no Genero stack

The component runs standalone in a browser — open it with `?demo` for a
representative menu (cookies and keyboard work; selections are logged in the
status bar instead of hitting a backend):

```
open webcomponents/fjs-megamenu/fjs-megamenu.html?demo
```

## Run the unit tests

```bash
bash ../tests/run-tests.sh      # fglunit tests for the BDL package API
```
