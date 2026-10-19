# megamenu — `fjs-megamenu` mega-menu for Genero (fglpkg package)

A modern, dark/light **mega menu** for Genero — a top navigation bar (level 1),
a large drop panel with a categories column (level 2) and action cards
(level 3) — delivered as a self-contained gICAPI web component **plus a
user-friendly Genero BDL builder API**, packaged for `fglpkg`.

- **Backend-driven, 1–3 levels** — the BDL builds the menu the user may see and
  pushes it through one `STRING` field.
- **Type-ahead search** — filters every action on each keystroke; results show
  the level breadcrumb.
- **Keyboard *and* mouse** — `type` to search, `←`/`→` along the bar, `↓`/`Enter`
  to open/drill, `↑`/`↓` within a column, `Enter` to select, `Esc` to back out,
  `F1` for help.
- **Animated** expand/collapse of the panel and a reveal of categories/actions
  (respects `prefers-reduced-motion`).
- **Overlay (bar-only footprint)** — the field only needs the bar's height; the
  drop panel **floats over the page content** when open (the widget grows its own
  same-origin host frame at runtime). Disable with `overlay = "off"`.
- **GBC-themed** — adopts the host Genero Browser Client's font and colors and
  follows its light/dark theme automatically (same-origin read; falls back to
  its own dark theme standalone). Override with the `theme`/`accent` properties.
- **Recently Selected** group stored as a browser **cookie**, reconciled against
  the backend's current options so a recent is always still selectable.
- **Backend notified on select** — `ON ACTION menu_select` fires with the
  chosen `id`/`label`/`path`.

## Install (fglpkg)

```bash
fglpkg install megamenu          # from your registry ($FGLPKG_REGISTRY)
eval "$(fglpkg env)"             # adds the BDL module to FGLLDPATH and the
                                 # web component to FGLIMAGEPATH / WEB_COMPONENT_DIRECTORY
```

This installs the **BDL module** `com.fourjs.megamenu.MegaMenu`, the **web
component** `fjs-megamenu`, and a runnable **example**. For GAS, add the printed
`.fglpkg/webcomponents` path to your `.xcf` `<WEB_COMPONENT_DIRECTORY>`.

```bash
fglpkg bdl megamenu example          # run the bundled demo (GDC / direct mode)
fglpkg docs megamenu example.4gl     # print its sources (also ex_megamenu.per)
```

## Use it — the BDL API

```4gl
IMPORT FGL com.fourjs.megamenu.MegaMenu

FUNCTION build_menu() RETURNS STRING
    CALL MegaMenu.clear()
    CALL MegaMenu.menu("sales", "Sales", "💼")                       -- level 1
      CALL MegaMenu.category("sales.cust", "Customers", "Accounts",   -- level 2
                             "👤", "#34d399", "")
        CALL MegaMenu.action("sales.cust.new", "New Customer",        -- level 3
                             "Create an account", "➕", "create add")
    CALL MegaMenu.menu("reports", "Reports", "📈")                    -- (2-level: category as leaf)
      CALL MegaMenu.category("rpt.sales", "Sales Report", "Revenue",
                             "📊", "#60a5fa", "kpi")
    CALL MegaMenu.menu("help", "Help", "❔")                          -- (1-level: menu as leaf)
    RETURN MegaMenu.build()
END FUNCTION
```

Read the selection the widget sends back:

```4gl
ON ACTION menu_select ATTRIBUTES(DEFAULTVIEW = NO)
    VAR sel = MegaMenu.parse(p_json: menu_data)   -- sel.id / sel.label / sel.path
    -- CASE sel.id WHEN "sales.cust.new" CALL open_new_customer() ... END CASE
```

A node with no children is a **leaf** (a directly selectable action): a `menu()`
with no `category()` is a 1-level action; a `category()` with no `action()` is a
2-level action; otherwise a category holds level-3 actions.

### API reference (`com.fourjs.megamenu.MegaMenu`)

| Function | Purpose |
|---|---|
| `clear()` | Reset the builder. |
| `menu(id, label, icon)` | Add a top-level menu (level 1). |
| `category(id, label, desc, icon, color, keywords)` | Add a category to the current menu (level 2). |
| `action(id, label, desc, icon, keywords)` | Add an action to the current category (level 3). |
| `noRecent()` | Flag the last-added item so it is never stored in "Recently Selected" (e.g. Reload/Exit). |
| `build() RETURNS STRING` | The JSON envelope to assign to the `WEBCOMPONENT` field. |
| `parse(p_json) RETURNS (t_selection)` | Parse the selection envelope → record (`id`/`label`/`path`). |
| `selectionId(p_json) RETURNS STRING` | Convenience: the selected id. |
| `menuCount() RETURNS INTEGER` | Number of top menus added (handy for tests). |

## Wire it into a `.per`

```per
WEBCOMPONENT wc = FORMONLY.menu_data,
    COMPONENTTYPE = "fjs-megamenu",
    PROPERTIES = (
        title = "Explore the Application",   -- optional hero
        brand = "Four Js",                   -- bar logo text
        accent = "#16b1a5",                  -- optional accent override
        select = "menu_select"               -- ON ACTION name fired on select
    ),
    SIZEPOLICY = FIXED, SCROLLBARS = NONE, STRETCH = X;
```

Full PROPERTIES (incl. `theme`, `subtitle`, `placeholder`, `recentslabel`,
`recentsmax`, `recentscookie`, `showrecents`) and the field-value protocol are in
[webcomponents/fjs-megamenu/README.md](webcomponents/fjs-megamenu/README.md).

## Layout

```
fglpkg.json                          package manifest (mixed: BDL + webcomponent)
com/fourjs/megamenu/MegaMenu.4gl     the user-facing BDL builder API
webcomponents/fjs-megamenu/          the web component runtime (html/css/js)
examples/example.4gl, ex_megamenu.per  the demo (`fglpkg bdl megamenu example`)
tests/test_MegaMenu.4gl              fglunit tests (+ run-tests.sh)      repository only
sandbox/run.sh                       stage → compile → run under GAS     repository only
```

The package ships the compiled module, the web component, the docs, and the
example (compiled into `com/fourjs/megamenu/`, sources in `examples/`). The
tests and the sandbox are only in the
[source repository](https://github.com/4js-mikefolcher/megamenu).

## Develop / test / run

```bash
fglpkg install                     # once: the fglunit devDependency
bash tests/run-tests.sh            # fglunit: 13 tests
cd sandbox && ./run.sh             # → http://localhost:6394/ua/r/megamenu (GBC)
```

`run.sh` needs `FGLDIR`/`FGLASDIR`. It sets `LANG=en_US.UTF-8` +
`FGL_LENGTH_SEMANTICS=CHAR` in the generated `.xcf` so multi-byte (emoji) icons
survive the gICAPI connector. Standalone (no Genero): open
`webcomponents/fjs-megamenu/fjs-megamenu.html?demo`.

## Publish

Compile what the package ships, then publish (per-Genero-major variant):

```bash
make build              # MegaMenu.42m + the example program/form → com/fourjs/megamenu/
fglpkg pack --list      # dry validation
fglpkg publish          # to $FGLPKG_REGISTRY (needs login)
```
