# fjs-megamenu — dark mega menu (1–3 levels), configured from the `.per`

A modern, dark **mega menu** web component for Genero: a top navigation bar
(**level 1**), a large drop panel with a **categories column** (level 2) and
**action cards** (level 3), plus full-menu **search** and a cookie-backed
**Recent** group. Styled after the bato-web-agency mega-menu reference.

- The **backend determines the menu** — it pushes the whole tree as one JSON
  envelope through a single `STRING` field. Items nest **1, 2 or 3 levels**.
- **Search** filters every leaf action (label, description, keywords, and its
  path) and shows a results list with the level **breadcrumb** (`Sales › Billing`).
- **Keyboard *and* mouse** — type to search, `←`/`→` along the bar, `↓`/`Enter`
  to open/drill, `↑`/`↓` within a column, `Enter` to select, `Esc` to back out,
  `Tab` to cycle, `F1` for help. Or hover/click with the mouse.
- **Backend notified on select** — choosing a leaf fires `gICAPI.SetFocus()` →
  `SetData({"type":"select","id","label","path"})` → `Action("menu_select")`.
- **Recent** group stored client-side as a **cookie** of leaf ids, reconciled
  against the backend's *current* tree on every load — a recent only appears if
  it is still an available, selectable action.

**Pure component**: 3 files (`.html|css|js`), vanilla JS, no build step, no npm,
no CDN, no framework. The app developer never touches JavaScript.

## The 1–3 level model

```
level 1  — top-bar menu        (a leaf here = a direct action, e.g. "Help")
level 2  — category column     (a leaf here = a direct action, e.g. "Sales Report")
level 3  — action card         (always a leaf)
```

A node is a **branch** if it has a non-empty `children` array, otherwise a
**leaf** (a selectable action). So:

- **1 level**: a top-bar item with no children → one click selects it.
- **2 levels**: a top-bar item whose children are leaves → the panel lists them
  in the categories column; the active one shows a *Select* card on the right.
- **3 levels**: a top-bar item → categories → action cards on the right.

## Using it in a `.per`

```per
WEBCOMPONENT wc = FORMONLY.menu_data,
    COMPONENTTYPE = "fjs-megamenu",
    PROPERTIES = (
        title       = "Explore the Application",
        subtitle    = "Search, browse and launch any action.",
        brand       = "Four Js",
        brandicon   = "🚀",
        placeholder = "Search the menu...",
        select      = "menu_select"
    ),
    SIZEPOLICY = FIXED, SCROLLBARS = NONE, STRETCH = X;
```

(Span the field across grid rows by tagging it once with empty rows below — see
`examples/ex_megamenu.per`.)

## PROPERTIES reference

| Property | Type | Default | Meaning |
|---|---|---|---|
| `title` | string | *(none)* | Hero title above the bar (empty ⇒ no hero). |
| `subtitle` | string | *(none)* | Hero subtitle. |
| `brand` | string | `menu` | Logo **text** in the bar (empty ⇒ icon only). |
| `brandicon` | string | *(4js badge)* | Brand **mark**: an emoji/letter (`🚀`/`A`), an image URL/path (`logo.png`, `data:…`), or `none`. Unset ⇒ the built-in Four Js “4” badge. |
| `select` | string | `menu_select` | **Lowercase** `ON ACTION` name fired on selection. |
| `placeholder` | string | `Search…` | Search box placeholder. |
| `recentslabel` | string | `Recently Selected` | Header of the Recent panel. |
| `recentsmax` | number | `6` | Max recents kept/shown. |
| `recentscookie` | string | `fjs_megamenu_recents` | Cookie name. |
| `showrecents` | bool | `true` | Show the Recent button (`true`/`1`/`on`/`yes`). |
| `theme` | string | `auto` | `auto` follows the GBC host (light/dark); or force `dark`/`light`. |
| `accent` | string | *(from host)* | Accent color override (e.g. `#16b1a5`); else taken from the GBC theme. |
| `overlay` | string | `auto` | `auto` floats the drop panel over the host content (bar-only footprint) when embedded same-origin; `off` keeps the in-flow layout (field reserves the panel height). |

### GBC theme awareness

The widget runs in a same-origin iframe, so it reads the host Genero Browser
Client's **font** and **colors** and matches them: it adopts the host font,
picks up the GBC highlight color as its accent (unless `accent` is set), and
switches between its dark and light palettes to follow the host theme (`theme =
auto`). With no reachable host (standalone / cross-origin) it keeps its dark
theme. Panel expand/collapse and the category/action reveal are animated
(disabled under `prefers-reduced-motion`); search runs on every keystroke.

### Overlay mode (bar-only footprint)

By default (`overlay = auto`) the widget makes the **bar** the only thing that
takes vertical space in the form: the `WEBCOMPONENT` field only needs to be the
bar's height (≈3–4 grid rows), and when a menu opens the widget **floats the
drop panel over the page content below it** rather than reserving the panel's
height.

It does this from its own JavaScript: the widget runs in a **same-origin**
iframe, so it reaches out to its host `<iframe>` element (`window.frameElement`),
positions it as a free-floating layer, lifts any clipping ancestors to
`overflow: visible`, and grows the frame downward while a menu is open —
shrinking back to the bar on close. With no reachable host (top-level /
cross-origin) or with `overlay = "off"`, it silently falls back to the in-flow
layout, where the field must reserve the panel's height.

So size the field to the bar (e.g. 4 rows) and place real form content directly
beneath it — see `examples/ex_megamenu.per`. If overlay can't engage in your GBC
build, set `overlay = "off"` and give the field enough rows for the panel.

### Responsive layout

When the rendered width drops below ~760px (a narrow GBC window, a phone, or a
small field) the bar can no longer hold the brand, every menu **and** the
search at once, so it collapses to a single **menu button** (☰). Pressing it
reveals a stacked drawer with the search box and the menu items; the mega panel
itself reflows to one column (categories above the action cards). On wider
screens the full bar is shown and the button is hidden — no configuration
needed.

Booleans/numbers arrive from `fglform` as strings — the widget coerces them.

## Field-value protocol (one STRING field, JSON envelopes)

```
host → wc : {"type":"menu","items":[ <node>, … ]}
            node = { "id", "label", "icon"?, "desc"?, "color"?, "keywords"?, "children"?: [ <node>, … ] }
wc → host : {"type":"select","id":"sales.cust.new","label":"New Customer","path":"Sales › Customers"}
```

- Every node needs a stable, unique `id`. A **leaf** (no `children`) is what the
  user selects and what is sent back; `path` carries its level breadcrumb.
- `icon` is an emoji/char; `color` (level-2) tints the category badge;
  `keywords` adds search terms.
- The widget keeps the last envelope current via `onFlushData`, calls
  `SetFocus()` before the action, and de-dupes re-delivered values, so it is
  safe with multiple instances in one `DIALOG` and immune to GBC re-push loops.
- Inbound `select` envelopes (echoed back by GBC) are ignored — only
  `type:"menu"` re-renders.

## Building the tree (the 4GL side)

A 1–3 level tree is modeled with **three distinct, non-recursive record types**
(one per level), using `json_name` for clean keys; an empty `children` array
marks a leaf. `util.JSON.stringify` serializes the whole thing:

```4gl
TYPE t_l3 RECORD id STRING ATTRIBUTES(json_name="id"), label STRING ATTRIBUTES(json_name="label"),
                 descr STRING ATTRIBUTES(json_name="desc"), icon STRING ATTRIBUTES(json_name="icon"),
                 keywords STRING ATTRIBUTES(json_name="keywords") END RECORD
TYPE t_l2 RECORD ... children DYNAMIC ARRAY OF t_l3 ATTRIBUTES(json_name="children") END RECORD
TYPE t_l1 RECORD ... children DYNAMIC ARRAY OF t_l2 ATTRIBUTES(json_name="children") END RECORD

FUNCTION build_menu() RETURNS STRING
    DEFINE items DYNAMIC ARRAY OF t_l1
    -- fill items (filter by the user's rights here), then:
    RETURN '{"type":"menu","items":' || util.JSON.stringify(items) || '}'
END FUNCTION
```

See `examples/ex_megamenu.4gl` for the full builder (with `add_l1`/`add_l2`/`add_l3`
helpers) and the `ON ACTION menu_select` handler that parses the selection.

## Recently-Selected (cookies)

Stored under `recentscookie` as a JSON array of leaf **ids**, most-recent first,
capped at `recentsmax`. On every load the widget maps ids → leaves in the
**current** tree and drops any the backend no longer offers. Cookie is scoped to
the GAS origin, `path=/`, `SameSite=Lax`, ~1-year max-age.

## Keyboard

`type` search · `←`/`→` bar · `↓`/`Enter` open & drill · `↑`/`↓` within a column ·
`Enter` select · `Esc` back/close · `Tab` cycle (stays in iframe) · `F1` help.

## Standalone test (no Genero stack)

```
open fjs-megamenu.html?demo            # auto-opens the first menu
open "fjs-megamenu.html?demo&q=invoice"  # prefilled search
open "fjs-megamenu.html?demo&top=2"      # open the 3rd top item (a 2-level menu)
open "fjs-megamenu.html?demo&recent=1"   # the Recent panel
```
