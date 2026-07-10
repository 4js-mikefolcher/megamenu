# fjs-megamenu — User Guide

How to add the **fjs-megamenu** mega menu to your Genero application: install the
package, build a menu with the BDL API, wire the web component into a form, and
handle selections. No JavaScript required.

- [1. What you get](#1-what-you-get)
- [2. Install](#2-install)
- [3. Quick start (complete app)](#3-quick-start-complete-app)
- [4. The BDL API](#4-the-bdl-api)
- [5. Building the menu](#5-building-the-menu)
- [6. Handling a selection](#6-handling-a-selection)
- [7. Wiring the form (`.per`)](#7-wiring-the-form-per)
- [8. PROPERTIES reference](#8-properties-reference)
- [9. Theming (GBC font & colors)](#9-theming-gbc-font--colors)
- [10. Keyboard & mouse](#10-keyboard--mouse)
- [11. Recently-Selected](#11-recently-selected)
- [12. Deployment notes](#12-deployment-notes)
- [13. Troubleshooting](#13-troubleshooting)
- [14. Field-value protocol (advanced)](#14-field-value-protocol-advanced)
- [15. Testing](#15-testing)
- [16. Publishing](#16-publishing)

---

## 1. What you get

The package ships two things:

| Artifact | Name | Purpose |
|---|---|---|
| Genero BDL module | `com.fourjs.megamenu.MegaMenu` | Build the menu tree and parse the selection. |
| Web component | `fjs-megamenu` (a `COMPONENTTYPE`) | The dark/light, animated, searchable mega-menu UI. |

The menu is a **1‑to‑3 level tree**:

```
level 1  — top bar item        (e.g. "Sales")
level 2  — category column     (e.g. "Customers")
level 3  — action card         (e.g. "New Customer")
```

A node with **no children is a leaf** — a directly selectable action. So a
top-bar item with no categories is a 1‑level action; a category with no actions
is a 2‑level action; a category with actions gives the full three levels.

The backend decides which menu the user sees, pushes it through one `STRING`
field, and is notified the instant the user chooses an action.

---

## 2. Install

```bash
fglpkg install megamenu          # from your registry ($FGLPKG_REGISTRY)
eval "$(fglpkg env)"             # wire the module + web component into the env
```

`fglpkg env` does two things:

1. Adds the package dir to **`FGLLDPATH`** so `IMPORT FGL com.fourjs.megamenu.MegaMenu`
   resolves.
2. Makes the web component discoverable. How depends on how you run:
   - **Direct mode (GDC / desktop):** prepends `.fglpkg/` to **`FGLIMAGEPATH`** —
     `eval "$(fglpkg env)"` is enough.
   - **GAS (GBC in a browser):** fglpkg can't edit your `.xcf`, so it prints a
     hint — add the `.fglpkg/webcomponents` path it shows to your application's
     `<WEB_COMPONENT_DIRECTORY>` in the `.xcf`.
   - **GWA:** `gwabuildtool ... $(fglpkg env --gwa)` adds the right
     `--webcomponent` flag per component.

> The component type `fjs-megamenu` resolves to
> `…/webcomponents/fjs-megamenu/fjs-megamenu.html`. The env wiring above is what
> lets Genero find it after install.

---

## 3. Quick start (complete app)

A minimal, complete two-file application.

**`menu.per`** — a form with the web component spanning the window:

```per
LAYOUT (TEXT="Application Menu", MINWIDTH=110, MINHEIGHT=30)
GRID
{
[wc                                                                          ]
[                                                                            ]
[                                                                            ]
[                                                                            ]
[                                                                            ]
}                                              -- tag the field ONCE; the empty
END                                            -- rows below extend it (do NOT
END                                            -- repeat [wc] — that makes N copies)

ATTRIBUTES
WEBCOMPONENT wc = FORMONLY.menu_data,
    COMPONENTTYPE = "fjs-megamenu",
    PROPERTIES = (
        title     = "Explore the Application",
        brand     = "Four Js",
        brandicon = "🚀",          -- optional; unset = the built-in 4js badge
        select    = "menu_select"
    ),
    SIZEPOLICY = FIXED, SCROLLBARS = NONE, STRETCH = X;
END
```

**`menu.4gl`** — build the menu, run the dialog, handle the selection:

```4gl
IMPORT FGL com.fourjs.megamenu.MegaMenu

MAIN
    DEFINE menu_data STRING

    DEFER INTERRUPT
    OPTIONS INPUT WRAP                 -- mandatory (see Troubleshooting)

    CLOSE WINDOW SCREEN
    OPEN WINDOW w WITH FORM "menu"

    LET menu_data = build_menu()       -- push the menu to the widget

    INPUT BY NAME menu_data WITHOUT DEFAULTS
        ATTRIBUTES(UNBUFFERED, ACCEPT = FALSE, CANCEL = FALSE)

        ON ACTION menu_select ATTRIBUTES(DEFAULTVIEW = NO)
            VAR sel = MegaMenu.parse(p_json: menu_data)
            MESSAGE "You chose: ", sel.label, " (", sel.id, ")"
            -- branch on sel.id here: open a form, run a sub-dialog, etc.

        ON ACTION close ATTRIBUTES(TEXT = "Quit")
            EXIT INPUT
    END INPUT

    CLOSE WINDOW w
END MAIN

FUNCTION build_menu() RETURNS STRING
    CALL MegaMenu.clear()
    CALL MegaMenu.menu("sales", "Sales", "💼")
      CALL MegaMenu.category("sales.cust", "Customers", "Accounts & contacts", "👤", "#34d399", "")
        CALL MegaMenu.action("sales.cust.new",  "New Customer",  "Create an account", "➕", "create add")
        CALL MegaMenu.action("sales.cust.list", "Customer List", "Browse & edit",     "📋", "browse")
      CALL MegaMenu.category("sales.bill", "Billing", "Invoices & payments", "💶", "#fbbf24", "")
        CALL MegaMenu.action("sales.bill.inv", "Create Invoice", "Raise an invoice", "🧾", "invoice")
    CALL MegaMenu.menu("reports", "Reports", "📈")          -- 2-level: categories are leaves
      CALL MegaMenu.category("rpt.sales", "Sales Report", "Revenue & margin", "📊", "#60a5fa", "kpi")
    CALL MegaMenu.menu("help", "Help", "❔")                -- 1-level: a leaf top item
    RETURN MegaMenu.build()
END FUNCTION
```

Compile and run (the field name in `INPUT BY NAME` and `FORMONLY.menu_data`
match — see [Troubleshooting](#13-troubleshooting)):

```bash
fglform menu.per
fglcomp -M menu.4gl
fglrun menu.42m            # under GDC; or deploy as a GAS app for GBC
```

---

## 4. The BDL API

`IMPORT FGL com.fourjs.megamenu.MegaMenu`, then call as `MegaMenu.<fn>`.

### Builder (stateful — build one menu at a time)

| Function | Adds | Notes |
|---|---|---|
| `clear()` | — | Reset the builder. Call first. |
| `menu(id, label, icon)` | a top-bar item (level 1) | Becomes the "current menu". |
| `category(id, label, desc, icon, color, keywords)` | a category (level 2) | Added to the current menu; becomes the "current category". `color` tints the icon badge. |
| `action(id, label, desc, icon, keywords)` | an action (level 3) | Added to the current category. |
| `noRecent()` | — | Excludes the **last-added** item from "Recently Selected". Call right after its `menu()`/`category()`/`action()`. |
| `build() RETURNS STRING` | — | Returns the JSON envelope to assign to the `WEBCOMPONENT` field. |

Calls are order-sensitive: `category()` adds to the most recent `menu()`,
`action()` to the most recent `category()`. A `category()` before any `menu()`
(or `action()` before any `category()`) is safely ignored.

Field meanings: `id` is a **stable, unique** identifier (what comes back on
selection, and the recents key); `label` is shown; `desc` is the small
sub-text; `icon` is an emoji or character; `keywords` adds extra search terms;
`color` (categories) is a hex tint for the icon badge.

### Selection

| Function | Returns | Notes |
|---|---|---|
| `parse(p_json) RETURNS (t_selection)` | the selection record | `VAR sel = MegaMenu.parse(p_json: menu_data)` → `sel.id`, `sel.label`, `sel.path`. NULL members on empty/invalid input. |
| `selectionId(p_json) RETURNS STRING` | the selected id | Convenience when you only need the id. |

### Public types

```4gl
PUBLIC TYPE t_selection RECORD
    kind  STRING,   -- always "select"
    id    STRING,   -- the chosen action id
    label STRING,   -- its label
    path  STRING    -- breadcrumb, e.g. "Sales > Customers"
END RECORD
```

`t_menu`, `t_category`, `t_action` are also public (used internally and handy if
you want to parse `build()` output in tests). `menuCount() RETURNS INTEGER`
returns how many top menus are in the builder.

---

## 5. Building the menu

`build_menu()` runs every time you want to (re)load the menu. **This is where
the backend decides what the user may see** — filter by the user's rights,
license, role, or data:

```4gl
FUNCTION build_menu() RETURNS STRING
    CALL MegaMenu.clear()

    CALL MegaMenu.menu("sales", "Sales", "💼")
      CALL MegaMenu.category("sales.cust", "Customers", "Accounts", "👤", "#34d399", "")
        CALL MegaMenu.action("sales.cust.new", "New Customer", "Create", "➕", "create add")
        IF user_can("customer.delete") THEN
            CALL MegaMenu.action("sales.cust.purge", "Purge", "Remove old", "🗑", "delete")
        END IF

    IF user_is_admin() THEN
        CALL MegaMenu.menu("admin", "Admin", "⚙")
          CALL MegaMenu.category("admin.users", "Users", "Accounts & roles", "🧑", "#34d399", "")
            CALL MegaMenu.action("admin.users.list", "User List", "All users", "📋", "people")
    END IF

    RETURN MegaMenu.build()
END FUNCTION
```

To **reload** the menu at runtime (e.g. after rights change), reassign the field
inside the dialog — that re-pushes it to the widget:

```4gl
ON ACTION reload
    LET menu_data = build_menu()
```

You can build the tree from a database just as easily — loop your rows and call
`menu()`/`category()`/`action()` as you go.

---

## 6. Handling a selection

When the user picks an action the widget fires `ON ACTION menu_select` (the name
comes from the `select` property) and the bound field holds the selection
envelope. Parse it and branch on the id:

```4gl
ON ACTION menu_select ATTRIBUTES(DEFAULTVIEW = NO)
    VAR sel = MegaMenu.parse(p_json: menu_data)
    CASE sel.id
        WHEN "sales.cust.new"  CALL open_new_customer()
        WHEN "sales.cust.list" CALL open_customer_list()
        WHEN "help"            CALL show_help()
        OTHERWISE              MESSAGE "Not implemented: ", sel.label
    END CASE
```

> **Do not reassign `menu_data` inside the `menu_select` handler.** The field
> already holds the selection; re-pushing the menu there would reset the user's
> place (open panel, search text) in the widget. Only reassign on an explicit
> `reload`.

`DEFAULTVIEW = NO` keeps this programmatic action off the toolbar.

---

## 7. Wiring the form (`.per`)

```per
WEBCOMPONENT wc = FORMONLY.menu_data,
    COMPONENTTYPE = "fjs-megamenu",
    PROPERTIES = ( … ),
    SIZEPOLICY = FIXED, SCROLLBARS = NONE, STRETCH = X;
```

Rules that matter:

- **One STRING field.** `FORMONLY.menu_data` is a `STRING` program variable — it
  carries the menu out and the selection back.
- **`COMPONENTTYPE = "fjs-megamenu"`** selects this widget.
- **`STRETCH = X`, `SIZEPOLICY = FIXED`, `SCROLLBARS = NONE`** stretch the field
  to the full width while keeping its grid-defined (bar) height — in overlay mode
  the drop panel floats over the content below rather than reserving space. Give
  the `LAYOUT` a generous `MINWIDTH`. (Use `STRETCH = BOTH` only for a
  full-window, in-flow menu that should fill the form vertically.)
- **Tag the field once** in the grid and leave the rows below it empty to make it
  span. Repeating `[wc]` on each line creates a *Matrix* — N separate widgets.
- The dialog uses `INPUT BY NAME menu_data … ATTRIBUTES(UNBUFFERED, ACCEPT=FALSE,
  CANCEL=FALSE)` and **`OPTIONS INPUT WRAP`** at program level.

You can place other fields on the same form (around the menu) as usual; just keep
the web component's grid cell to itself.

---

## 8. PROPERTIES reference

Set these in the `.per` `PROPERTIES (...)` block. All are optional.

| Property | Default | Meaning |
|---|---|---|
| `title` | *(none)* | Hero title shown above the bar. Empty ⇒ no hero. |
| `subtitle` | *(none)* | Hero subtitle. |
| `brand` | `menu` | Logo **text** in the bar (e.g. your app or company name). Empty ⇒ icon only. |
| `brandicon` | *(4js badge)* | Brand **mark**. An emoji/letter (`"🚀"`, `"A"`), an image URL/path (`"logo.png"`, `"data:image/svg+xml,…"`), or `"none"` to hide it. Unset ⇒ the built-in Four Js “4” badge. |
| `select` | `menu_select` | **Lowercase** `ON ACTION` name fired when an action is chosen. |
| `placeholder` | `Search…` | Search box placeholder text. |
| `theme` | `auto` | `auto` follows the GBC host theme; or force `dark` / `light`. |
| `accent` | *(from host)* | Accent color override, e.g. `#16b1a5`. Otherwise taken from the GBC theme. |
| `overlay` | `auto` | `auto` floats the drop panel over the page content (bar-only footprint) when embedded same-origin; `off` keeps the in-flow layout (field reserves the panel height). |
| `recentslabel` | `Recently Selected` | Header of the Recent panel. |
| `recentsmax` | `6` | Max number of recent actions kept/shown. |
| `recentscookie` | `fjs_megamenu_recents` | Cookie name for recents. |
| `showrecents` | `true` | Show the **Recent** button (`true`/`1`/`on`/`yes`). |

Booleans and numbers may arrive as strings from `fglform`; the widget coerces
them.

---

## 9. Theming (GBC font & colors)

The web component renders in a same-origin iframe, so it reads the host **Genero
Browser Client** styles and matches them automatically:

- **Font** — adopts the host's font family.
- **Light / dark** — with `theme = auto` (default) it follows the host theme:
  on a light GBC theme the menu uses a light palette, on a dark theme a dark one.
- **Accent** — takes the GBC highlight color, unless you set the `accent`
  property.

Override any of this from the `.per`:

```per
PROPERTIES = ( theme = "dark", accent = "#16b1a5", … )
```

With no reachable host (standalone in a plain browser) it keeps its built-in dark
theme. Panel expand/collapse and the category/action reveal are **animated**
(automatically disabled when the user prefers reduced motion).

### Overlay mode — the bar is the only thing that takes space

By default (`overlay = auto`) the menu **bar** is the only element that
permanently occupies vertical space. Size the `WEBCOMPONENT` field to just the
bar (≈4 grid rows) and put your real form fields directly beneath it; when a
menu opens, the widget **floats the drop panel over that content** instead of
reserving its height.

It works by reaching out from its (same-origin) iframe to its own host frame and
growing it over the form while a menu is open, then shrinking back to the bar on
close. If the host can't be reached (cross-origin) it falls back to the in-flow
layout — there the field must be tall enough to show the panel. Set
`overlay = "off"` to force the in-flow layout (and give the field more rows).
See `examples/ex_megamenu.per` for the bar-height field + content below it.

### Responsive layout

The menu is responsive with no configuration. When the rendered width falls
below ~760px (a narrow GBC window, a phone, or a small field) the bar folds to a
single **menu button** (☰); pressing it opens a stacked drawer containing the
search box and the menu items, and the mega panel reflows to one column. On
wider screens the full bar is shown and the button is hidden.

---

## 10. Keyboard & mouse

The menu is fully keyboard-operable, and `Tab` never escapes the component:

| Key | Action |
|---|---|
| *type* | search the whole menu (type-ahead, on every keystroke) |
| `←` / `→` | move along the top bar |
| `↓` / `Enter` | open a menu / drill into a category |
| `↑` / `↓` | move within a column or results list |
| `Enter` | select the highlighted action |
| `Esc` | back out / close |
| `Tab` | cycle focus (stays inside the widget) |
| `F1` | toggle the keyboard help |

Mouse: hover a top item to open it, hover a category to reveal its actions,
click an action to select. Search results and the Recent panel are click- and
keyboard-selectable.

---

## 11. Recently-Selected

Every selection is remembered client-side in a browser **cookie** (named by
`recentscookie`, capped at `recentsmax`). The **Recent** button shows them.

The list is **reconciled against the current menu on every load**: a recent only
appears if the backend still offers that action — so a recent is never a dead
entry, even if the user's rights change. No backend code is needed; it is purely
client-side. The cookie is scoped to the GAS origin (`path=/`, `SameSite=Lax`,
~1‑year lifetime).

To keep a specific item **out** of Recent — e.g. a utility action like *Reload*
or *Exit* placed on the bar — call `MegaMenu.noRecent()` immediately after the
`menu()`/`category()`/`action()` that added it:

```4gl
CALL MegaMenu.menu("exit", "Exit", "🚪")
CALL MegaMenu.noRecent()                 -- Exit is selectable but never recorded
```

Flagged items are still fully selectable; they are simply never written to the
recents cookie (the node carries `"norecent":"1"` in the envelope).

---

## 12. Deployment notes

- **UTF‑8 session (emoji icons).** Icons are emoji that travel as multi-byte text
  over the gICAPI connector, whose charset follows the DVM session locale. Run
  the application with a UTF‑8 locale so they render. In a GAS `.xcf`:

  ```xml
  <ENVIRONMENT_VARIABLE Id="LANG">en_US.UTF-8</ENVIRONMENT_VARIABLE>
  <ENVIRONMENT_VARIABLE Id="LC_ALL">en_US.UTF-8</ENVIRONMENT_VARIABLE>
  <ENVIRONMENT_VARIABLE Id="FGL_LENGTH_SEMANTICS">CHAR</ENVIRONMENT_VARIABLE>
  ```

- **Module resolution.** The DVM must find `com.fourjs.megamenu.MegaMenu` at
  runtime — `fglpkg env` adds it to `FGLLDPATH`; in a GAS `.xcf` set `FGLLDPATH`
  (or `PATH`) to include the package location.
- **Web component discovery.** For GAS, add the installed `.fglpkg/webcomponents`
  directory to the application's `<WEB_COMPONENT_DIRECTORY>`.

See [`sandbox/run.sh`](sandbox/run.sh) for a complete, working local GAS launch
that does all of the above.

---

## 13. Troubleshooting

**`-1102 Field (xxx) not found in form` when selecting / displaying.**
`INPUT BY NAME` and `DISPLAY ... TO` match the **`FORMONLY.<column>` name**, not
the layout tag. If your field is `EDIT lastsel = FORMONLY.lastsel`, use the
column name `lastsel` (not the tag) in the program. Easiest: make the tag and
column the same name.

**Emoji icons show as blank/boxes.** The DVM session isn't UTF‑8 — set `LANG` /
`LC_ALL` / `FGL_LENGTH_SEMANTICS` as in [Deployment](#12-deployment-notes).

**The menu doesn't appear (empty area).** Either the web component wasn't found
(check `COMPONENTTYPE`/`WEB_COMPONENT_DIRECTORY`/`FGLIMAGEPATH`) or the field got
an empty/invalid value. Confirm `build_menu()` returned a non-empty
`{"type":"menu",...}` string and was assigned to the field before/at the dialog.

**The program exits when I tab past the menu.** Add **`OPTIONS INPUT WRAP`** —
without it, tabbing past the last field implicitly accepts the dialog and a
single-field program falls through and exits.

**Selecting resets my search / open panel.** You reassigned the bound field
inside the `menu_select` handler. Don't — only reassign on an explicit reload.

**`-8444 ... must contain PACKAGE com.fourjs.megamenu`** (only if you edit the
module): a module under `com/fourjs/megamenu/` must declare `PACKAGE
com.fourjs.megamenu` as its first statement.

---

## 14. Field-value protocol (advanced)

If you build the envelope yourself or integrate a non-standard host, the
contract over the single `STRING` field is:

```
host → widget : {"type":"menu","items":[ <node>, … ]}
                node = { "id", "label", "icon"?, "desc"?, "color"?, "keywords"?,
                         "norecent"?, "children"?: [ <node>, … ] }
widget → host : {"type":"select","id":"…","label":"…","path":"A > B"}
```

`MegaMenu.build()` produces the first; `MegaMenu.parse()` reads the second. A
node with no (or empty) `children` is a leaf. A leaf whose `"norecent"` is set
(e.g. `"1"`) is selectable but is never added to the "Recent" list. The widget de-dupes re-delivered
values and ignores echoed `select` envelopes, so it is safe with GBC's repeated
field pushes and with multiple instances in one `DIALOG`.

---

## 15. Testing

The package ships fglunit tests for the BDL API:

```bash
bash tests/run-tests.sh           # compiles + runs the suite (terminal mode)
```

They cover the builder, the 1/2/3‑level structure, `build()` JSON, `parse()`
round-trip and bad-input handling, and JSON escaping. Model your own tests on
[`tests/test_MegaMenu.4gl`](tests/test_MegaMenu.4gl).

---

## 16. Publishing

To publish a new version (or your own fork):

```bash
( cd com/fourjs/megamenu && fglcomp -M MegaMenu.4gl )   # the .42m the package ships
fglpkg pack --list                                       # dry validation (writes nothing)
fglpkg publish                                           # to $FGLPKG_REGISTRY (needs login)
```

`fglpkg` ships the compiled module per Genero major version (a "variant"); the
web component ships once and works on any version. Required manifest fields for
publish are `name`, `version`, `description`, `author`, `license`, `repository`.
