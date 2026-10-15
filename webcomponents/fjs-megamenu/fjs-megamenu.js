"use strict";

/* fjs-megamenu — dark "mega menu" web component (gICAPI v1.0).
 * The backend pushes one {"type":"menu","items":[…]} tree (1–3 levels deep);
 * the widget renders a top bar (level 1) + a drop panel with a categories
 * column (level 2) and an actions area (level 3), plus full-menu search and a
 * cookie-backed "Recent" group. Choosing a leaf emits
 * {"type":"select","id","label","path"} + fires ON ACTION in the dialog. */

var gICAPI; // injected by GBC/GDC before onICHostReady fires

const DEFAULTS = {
  title: "", subtitle: "", brand: "menu",
  brandicon: "",   // "" → built-in 4js badge; emoji/letter; image URL/data-URI; or "none"
  select: "menu_select", placeholder: "Search…",
  recentslabel: "Recently Selected", recentsmax: 6,
  recentscookie: "fjs_megamenu_recents", showrecents: true,
  theme: "auto",   // 'auto' (follow the GBC host), 'dark', or 'light'
  accent: "",      // override the accent color (else taken from the GBC theme)
  overlay: "auto"  // 'auto' = float the panel over the host when embedded same-origin; 'off' = in-flow
};

// the default brand mark (Four Js "4" badge) — used when `brandicon` is unset.
const DEFAULT_BRAND_SVG =
  '<svg viewBox="0 0 24 24" fill="none">' +
  '<rect x="1.5" y="1.5" width="21" height="21" rx="6" fill="currentColor"/>' +
  '<path d="M13 6.5v11M13 6.5L7.5 13.7h7.8" stroke="#0a0d0e" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round"/></svg>';
let OPTS = Object.assign({}, DEFAULTS);

// ---- state ------------------------------------------------------------------
let tree = [];            // level-1 nodes: {id,label,desc,icon,color,keywords,children[]}
let leafById = {};        // id -> {node, path:[labels], pathStr}
let allLeaves = [];       // [{node, path, pathStr}]
let openTop = -1;         // index of the open level-1 item (panel open), or -1
let activeTop = 0;        // keyboard-highlighted top item
let activeL2 = 0;         // active category (level-2) index within the open top
let activeL3 = 0;         // active card index within col3
let mode = "browse";      // 'browse' | 'search' | 'recent'
let zone = "bar";         // keyboard focus zone: 'bar' | 'l2' | 'l3'
let gridNodes = [];       // nodes currently shown as cards in col3 (selectable)
let current = "";         // last envelope SetData'd (re-pushed on flush)
let lastData = null;      // de-dupe inbound onData (GBC re-delivers the same value)
let hasFocus = false;
let closeTimer = null;
let panelHideT = null;    // pending "set hidden" timer after the close animation
let missingIds = 0;       // count of nodes the backend sent without an id

const $ = (id) => document.getElementById(id);
const elHero = $("hero"), elHeroTitle = $("heroTitle"), elHeroSub = $("heroSub"),
      elBrand = $("brandName"), elBrandIcon = $("brandIcon"), elTopnav = $("topnav"),
      elMenuToggle = $("menuToggle"),
      elSearchWrap = $("searchWrap"), elSearch = $("search"),
      elRecentBtn = $("recentBtn"), elRecentLabel = $("recentLabel"),
      elPanel = $("panel"), elL2list = $("l2list"),
      elCol2Label = $("col2Label"), elCol3Label = $("col3Label"), elL3grid = $("l3grid"),
      elStatL = $("statL"), elStatR = $("statR"),
      elHelp = $("helpcard");

// ---- gICAPI contract --------------------------------------------------------
function onICHostReady(version) {
  gICAPI.onData = (s) => handleData(s);
  gICAPI.onProperty = (s) => handleProperties(s);
  gICAPI.onFocus = (p) => { hasFocus = p; if (p) { focusSearch(); applyHostTheme(); maybeEnableOverlay(); } };
  gICAPI.onFlushData = () => pushCurrent();
  setHost("connected to DVM (gICAPI " + version + ")", "ok");
  applyHostTheme();
  maybeEnableOverlay();
}
window.onICHostReady = onICHostReady;
function hasHost() { return typeof gICAPI !== "undefined" && gICAPI && gICAPI.SetData; }
// never push an empty value — that would clobber the menu envelope the backend
// put in the shared field before the user has selected anything.
function pushCurrent() { if (hasHost() && current) gICAPI.SetData(current); }

// emit a select envelope + fire ON ACTION; SetFocus first so multiple
// fjs-megamenu fields can share one ON ACTION in a DIALOG.
function emit(env, action) {
  current = JSON.stringify(env);
  lastData = current;
  if (hasHost()) {
    if (action && gICAPI.SetFocus) gICAPI.SetFocus();
    gICAPI.SetData(current);
    if (action) gICAPI.Action(action);
  }
}

// ---- config -----------------------------------------------------------------
function truthy(v) { const s = String(v).toLowerCase(); return v === true || s === "1" || s === "true" || s === "on" || s === "yes"; }
function clampInt(v, lo, hi, d) { const n = parseInt(v, 10); return isNaN(n) ? d : Math.max(lo, Math.min(hi, n)); }

function handleProperties(propsStr) {
  if (!propsStr) return;
  let p;
  try { p = typeof propsStr === "string" ? JSON.parse(propsStr) : propsStr; }
  catch { setHost("bad PROPERTIES JSON", "warn"); return; }
  if (p.title != null) OPTS.title = String(p.title);
  if (p.subtitle != null) OPTS.subtitle = String(p.subtitle);
  if (p.brand != null) OPTS.brand = String(p.brand);
  if (p.brandicon != null) OPTS.brandicon = String(p.brandicon);
  if (p.select != null) OPTS.select = String(p.select).toLowerCase();
  if (p.placeholder != null) OPTS.placeholder = String(p.placeholder);
  if (p.recentslabel != null) OPTS.recentslabel = String(p.recentslabel);
  if (p.recentscookie != null) OPTS.recentscookie = String(p.recentscookie);
  if (p.recentsmax != null) OPTS.recentsmax = clampInt(p.recentsmax, 1, 24, DEFAULTS.recentsmax);
  if (p.showrecents != null) OPTS.showrecents = truthy(p.showrecents);
  if (p.theme != null) OPTS.theme = String(p.theme).toLowerCase();
  if (p.accent != null) OPTS.accent = String(p.accent);
  if (p.overlay != null) OPTS.overlay = String(p.overlay).toLowerCase();
  applyChrome();
  applyHostTheme();
  maybeEnableOverlay();
}

function applyChrome() {
  elBrand.textContent = OPTS.brand;
  elBrand.style.display = OPTS.brand ? "" : "none";   // empty brand ⇒ icon-only (or nothing)
  applyBrandIcon();
  elSearch.placeholder = OPTS.placeholder;
  elRecentLabel.textContent = "Recent";
  elRecentBtn.hidden = !OPTS.showrecents;
  if (OPTS.title) {
    elHeroTitle.textContent = OPTS.title;
    elHeroSub.textContent = OPTS.subtitle || "";
    elHeroSub.style.display = OPTS.subtitle ? "" : "none";
    elHero.hidden = false;
  } else {
    elHero.hidden = true;
  }
}

// Render the configurable brand mark. `brandicon` may be:
//   ""        → the built-in Four Js "4" badge (default)
//   "none"    → no icon (brand text only)
//   a URL / data-URI / path (http(s):, data:, /…, ./…) → an <img> logo
//   anything else (an emoji or a letter) → shown as text, tinted with the accent
function applyBrandIcon() {
  if (!elBrandIcon) return;
  const v = (OPTS.brandicon || "").trim();
  elBrandIcon.classList.remove("brand-text");
  if (!v) { elBrandIcon.hidden = false; elBrandIcon.innerHTML = DEFAULT_BRAND_SVG; return; }
  if (/^none$/i.test(v)) { elBrandIcon.hidden = true; elBrandIcon.textContent = ""; return; }
  elBrandIcon.hidden = false;
  if (/^(https?:|data:|\.{0,2}\/)/i.test(v)) {
    const img = document.createElement("img");
    img.className = "brand-img"; img.alt = ""; img.src = v;
    elBrandIcon.textContent = ""; elBrandIcon.appendChild(img);
  } else {
    elBrandIcon.classList.add("brand-text");
    elBrandIcon.textContent = v;             // emoji / letter (textContent ⇒ safe)
  }
}

// ---- GBC theme awareness ----------------------------------------------------
// The widget runs in a same-origin iframe (served by GAS), so it can read the
// host GBC page's font and colors and match them. Falls back silently to its
// own dark theme when there is no reachable host (standalone / cross-origin).
function setTheme(t) { document.body.classList.toggle("theme-light", t === "light"); }
function setVar(name, val) { if (val) document.documentElement.style.setProperty(name, val); }
function rgbLuminance(s) {
  const m = String(s || "").match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(",").map((x) => parseFloat(x));
  if (p.length < 3 || p.some(isNaN)) return null;
  if (p.length >= 4 && p[3] === 0) return null;        // transparent — no signal
  return (0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]) / 255;
}
function applyHostTheme() {
  // explicit overrides first
  if (OPTS.theme === "dark" || OPTS.theme === "light") setTheme(OPTS.theme);
  if (OPTS.accent) setVar("--accent", OPTS.accent);
  let pdoc;
  try { const pw = window.parent; pdoc = (pw && pw !== window) ? pw.document : null; if (pdoc) void pdoc.body; }
  catch (e) { return; }                                 // cross-origin host — keep defaults
  if (!pdoc || !pdoc.body) return;
  const pw = window.parent;
  const rootCS = pw.getComputedStyle(pdoc.documentElement);
  const bodyCS = pw.getComputedStyle(pdoc.body);
  // font: always adopt the host's font family
  if (bodyCS.fontFamily) setVar("--font", bodyCS.fontFamily);
  // accent: take the GBC highlight/selection color unless a property overrides it
  if (!OPTS.accent) {
    const grab = (names) => { for (const n of names) { const v = (rootCS.getPropertyValue(n) || bodyCS.getPropertyValue(n)).trim(); if (v) return v; } return ""; };
    setVar("--accent", grab(["--highlightBackgroundColor", "--default-highlightBackgroundColor", "--currentRowBackgroundColor", "--accent-color", "--primary-color"]));
  }
  // light/dark: follow the host background luminance when theme = auto
  if (OPTS.theme === "auto" || !OPTS.theme) {
    const lum = rgbLuminance(bodyCS.backgroundColor);
    if (lum != null) setTheme(lum > 0.5 ? "light" : "dark");
  }
}

// ---- overlay mode (float the panel over the host content) -------------------
// In GBC the widget lives in a SAME-ORIGIN <iframe>. We reach out to that host
// frame element (window.frameElement) and, while a menu is open, lift it above
// its neighbours and grow it downward — OUT of normal flow — so the drop panel
// floats over the form, and the field only has to reserve the BAR's height.
// On close the frame shrinks back to the bar. With no reachable host
// (top-level / cross-origin) or overlay="off", we silently keep the in-flow
// layout. Everything is wrapped in try/catch so a hostile host never breaks us.
let overlayOn = false, frameEl = null, frameCell = null, savedOverlay = null, liftedAncestors = [];
let hostDismissHooked = false;

function hostFrameEl() { try { return window.frameElement || null; } catch (e) { return null; } }
function frameWin() { try { return frameEl ? frameEl.ownerDocument.defaultView : null; } catch (e) { return null; } }

function maybeEnableOverlay() {
  if (overlayOn || OPTS.overlay === "off") return;
  const fe = hostFrameEl();
  if (!fe) return;                                   // not embedded same-origin → keep in-flow
  try {
    frameEl = fe; frameCell = fe.parentElement;
    const w = frameWin();
    savedOverlay = {
      pos: fe.style.position, top: fe.style.top, left: fe.style.left, width: fe.style.width,
      height: fe.style.height, z: fe.style.zIndex, trans: fe.style.transition, bg: fe.style.background,
      cellPos: frameCell ? frameCell.style.position : null, cellOv: frameCell ? frameCell.style.overflow : null
    };
    if (frameCell && w && w.getComputedStyle(frameCell).position === "static") frameCell.style.position = "relative";
    if (frameCell) frameCell.style.overflow = "visible";   // never clip the bar's bottom border
    fe.style.position = "absolute"; fe.style.top = "0"; fe.style.left = "0"; fe.style.width = "100%";
    fe.style.transition = document.body.classList.contains("noanim") ? "none" : "height .2s cubic-bezier(.2,.7,.3,1)";
    // keep the widget's own themed background (var(--bg)) — do NOT go transparent,
    // or the host's (light) surface shows through and reads as white in dark mode.
    document.body.classList.add("overlay");
    overlayOn = true;
    hookHostDismiss();   // tap on the host content (outside the iframe) → dismiss
    overlayCollapse();
  } catch (e) { overlayOn = false; document.body.classList.remove("overlay"); }
}

// layout-based (scroll-independent) height the bar needs: its bottom + a gap.
function barFootprint() { try { const b = $("bar"); return Math.ceil(b.offsetTop + b.offsetHeight + 8); } catch (e) { return 72; } }

// Float the frame above the host's other fields. z-index only ranks within a
// stacking context, so raising just the iframe leaves sibling field cells (in
// their own contexts) painting on top. We walk the whole ancestor chain and, at
// each level, clear clipping (overflow:visible) AND lift it above its siblings
// (position + a high z-index) — so the floating subtree wins stacking the whole
// way up to the form root. All originals are cached and restored on collapse.
function floatFrame() {
  unfloatFrame();
  try {
    const w = frameWin(); if (!w) return;
    let el = frameEl.parentElement, n = 0;
    while (el && n < 14 && el !== el.ownerDocument.documentElement && el !== el.ownerDocument.body) {
      const cs = w.getComputedStyle(el);
      liftedAncestors.push({ el: el, ov: el.style.overflow, pos: el.style.position, z: el.style.zIndex });
      if (cs.overflow !== "visible") el.style.overflow = "visible";
      if (cs.position === "static") el.style.position = "relative";
      el.style.zIndex = "100000";
      el = el.parentElement; n++;
    }
  } catch (e) {}
}
function unfloatFrame() {
  try { for (const a of liftedAncestors) { a.el.style.overflow = a.ov; a.el.style.position = a.pos; a.el.style.zIndex = a.z; } } catch (e) {}
  liftedAncestors = [];
}

// recompute the host frame's height: bar+panel while open (capped to the space
// available below it in the host), just the bar while closed.
function syncOverlay() {
  if (!overlayOn || !frameEl) return;
  try {
    const navOpen = document.body.classList.contains("nav-open");      // responsive drawer (hamburger)
    const panelOpen = elPanel && elPanel.classList.contains("open");   // mega drop panel
    const helpOpen = elHelp && !elHelp.hidden;                          // F1 card (hangs below the bar)
    // the card alone grows the frame just to show it: keep the frame see-through
    // below the bar so the host form shows around the card (see .help-only)
    document.documentElement.classList.toggle("help-only", helpOpen && !panelOpen && !navOpen);
    if (!navOpen && !panelOpen && !helpOpen) { overlayCollapse(); return; }
    floatFrame();
    frameEl.style.zIndex = "100001";
    const w = frameWin();
    let avail = 99999;
    if (w) { const top = frameEl.getBoundingClientRect().top; avail = Math.max(160, w.innerHeight - top - 12); }
    const bar = barFootprint();   // includes the drawer's height when nav-open
    document.documentElement.style.setProperty("--barfoot", bar + "px");
    let h;
    if (panelOpen) {
      elPanel.style.maxHeight = Math.max(140, Math.min(460, avail - bar)) + "px";
      h = bar + elPanel.offsetHeight + 10;
    } else {
      h = bar + 6;                // hamburger drawer only — fit the bar + drawer
    }
    if (helpOpen) {               // fit the card to the host space, then grow the frame to its bottom
      const top = fitHelp(avail);
      h = Math.max(h, Math.ceil(top + elHelp.offsetHeight + 16));   // + room for its shadow
    }
    frameEl.style.height = Math.min(h, avail) + "px";
    // scrollIntoView (markCard/markL2) can scroll the bar off the top while the
    // frame is mid-resize — pin the frame's own viewport back to the top.
    try { (document.scrollingElement || document.documentElement).scrollTop = 0; document.body.scrollTop = 0; } catch (e) {}
  } catch (e) {}
}
function overlayExpand() { syncOverlay(); }
function overlayCollapse() {
  if (!overlayOn || !frameEl) return;
  try {
    frameEl.style.zIndex = (savedOverlay && savedOverlay.z) || "";
    // fill the field cell, but never less than the full bar (so its bottom
    // border is always shown even if the field is given too few rows).
    const cellH = frameCell ? frameCell.clientHeight : 0;
    frameEl.style.height = Math.max(barFootprint(), cellH) + "px";
    unfloatFrame();
  } catch (e) {}
}

// close everything (drawer + panel + help) — used by outside-tap dismissal.
function dismissMenu() { elHelp.hidden = true; setNavOpen(false); closePanel(); }

// A pointerdown that reaches the HOST document happened OUTSIDE our iframe (taps
// inside it are consumed by the iframe), i.e. outside the menu — so dismiss any
// open menu. Same-origin only; wrapped in try/catch.
function hookHostDismiss() {
  if (hostDismissHooked || !frameEl) return;
  try {
    const pdoc = frameEl.ownerDocument;
    if (!pdoc) return;
    pdoc.addEventListener("pointerdown", () => {
      if (overlayOn && (document.body.classList.contains("nav-open") || !elHelp.hidden ||
          (elPanel && elPanel.classList.contains("open")))) dismissMenu();
    }, true);
    hostDismissHooked = true;
  } catch (e) {}
}

// ---- data -------------------------------------------------------------------
function handleData(str) {
  if (!str || str === lastData) return;   // de-dupe re-deliveries
  lastData = str;
  let env;
  try { env = JSON.parse(str); }
  catch { setHost("bad JSON from host", "warn"); return; }
  if (!env || env.type !== "menu") return; // ignore echoed select envelopes
  current = str;                            // so a flush re-asserts the menu, never ""
  tree = Array.isArray(env.items) ? env.items : [];
  indexTree();
  buildBar();
  closePanel();
  setLocal(tree.length + " menus · " + allLeaves.length + " actions");
  if (missingIds) setHost(missingIds + " menu node(s) have no id (unselectable)", "warn");
}

function hasKids(n) { return n && Array.isArray(n.children) && n.children.length > 0; }

function indexTree() {
  leafById = {}; allLeaves = []; missingIds = 0;
  const walk = (node, path) => {
    if (hasKids(node)) {
      const p = path.concat(node.label || node.id || "?");
      for (const c of node.children) walk(c, p);
    } else if (node && node.id != null) {
      const rec = { node: node, path: path.slice(), pathStr: path.join(" › ") };
      if (leafById[node.id] == null) leafById[node.id] = rec;
      allLeaves.push(rec);
    } else if (node) { missingIds++; }   // leaf with no id — cannot be selected
  };
  for (const top of tree) walk(top, []);
}

// ---- recents (cookies) ------------------------------------------------------
function getCookie(name) {
  const safe = name.replace(/([.$?*|{}()\[\]\\\/+^])/g, "\\$1");
  const m = document.cookie.match(new RegExp("(?:^|; )" + safe + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : "";
}
function setCookie(name, val, days) {
  document.cookie = name + "=" + encodeURIComponent(val) + "; path=/; max-age=" + (days * 86400) + "; SameSite=Lax";
}
function readRecents() {
  const raw = getCookie(OPTS.recentscookie);
  if (!raw) return [];
  try { const a = JSON.parse(raw); return Array.isArray(a) ? a.filter((x) => typeof x === "string") : []; }
  catch { return []; }
}
function pushRecent(id) {
  let ids = readRecents().filter((x) => x !== id);
  ids.unshift(id);
  if (ids.length > OPTS.recentsmax) ids = ids.slice(0, OPTS.recentsmax);
  setCookie(OPTS.recentscookie, JSON.stringify(ids), 365);
}
// reconcile stored ids against the CURRENT tree — only still-available leaves
function recentRecs() {
  const out = [];
  for (const id of readRecents()) {
    const r = leafById[id];
    if (r) { out.push(r); if (out.length >= OPTS.recentsmax) break; }
  }
  return out;
}

// ---- helpers ----------------------------------------------------------------
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c])); }
function hl(text, q) {
  const s = String(text == null ? "" : text);
  if (!q) return esc(s);
  const i = s.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return esc(s);
  return esc(s.slice(0, i)) + "<mark>" + esc(s.slice(i, i + q.length)) + "</mark>" + esc(s.slice(i + q.length));
}

// Hover opens menus only with a real pointer on the wide layout. In the narrow
// (hamburger) drawer the items stack vertically, so opening on hover makes the
// panel switch as the mouse travels to the target — and touch devices have no
// real hover at all. In those cases a click/tap is required (the standard touch
// pattern). matchMedia tracks the live state, so resizing flips the behavior.
const MQ_NARROW  = window.matchMedia ? window.matchMedia("(max-width: 760px)") : { matches: false };
const MQ_NOHOVER = window.matchMedia ? window.matchMedia("(hover: none)") : { matches: false };
function hoverOpens() { return !MQ_NARROW.matches && !MQ_NOHOVER.matches; }

// ---- render: top bar (level 1) ---------------------------------------------
function buildBar() {
  elTopnav.innerHTML = "";
  tree.forEach((top, i) => {
    const li = document.createElement("li");
    const el = document.createElement("div");
    el.className = "top" + (!hasKids(top) && top.id == null ? " disabled" : ""); el.dataset.i = i;
    let html = "";
    if (top.icon) html += '<span class="top-ico">' + esc(top.icon) + "</span>";
    html += "<span>" + esc(top.label || top.id) + "</span>";
    if (hasKids(top)) html += '<span class="chev">▾</span>';
    el.innerHTML = html;
    el.addEventListener("mouseenter", () => { if (!hoverOpens()) return; activeTop = i; markTop(); if (hasKids(top)) openPanel(i, false); });
    el.addEventListener("mousedown", (e) => e.preventDefault());
    el.addEventListener("click", () => {
      activeTop = i;
      if (hasKids(top)) { if (openTop === i) closePanel(); else openPanel(i, false); }
      else selectNode(top);
    });
    li.appendChild(el); elTopnav.appendChild(li);
  });
  markTop();
}
function topEls() { return Array.from(elTopnav.querySelectorAll(".top")); }
function markTop() {
  topEls().forEach((el, i) => {
    el.classList.toggle("open", i === openTop);
    el.classList.toggle("active", i === activeTop && zone === "bar");
  });
}

// ---- render: panel ----------------------------------------------------------
function setMode(m) { mode = m; const open = elPanel.classList.contains("open"); elPanel.className = "mode-" + m + (open ? " open" : ""); }

// animated show/hide of the mega panel (expand / collapse)
function panelShow() {
  if (panelHideT) { clearTimeout(panelHideT); panelHideT = null; }
  if (elPanel.hidden) { elPanel.hidden = false; void elPanel.offsetWidth; } // reflow so the transition runs
  elPanel.classList.add("open");
}
function panelHide() {
  elPanel.classList.remove("open");
  if (panelHideT) clearTimeout(panelHideT);
  panelHideT = setTimeout(() => { if (!elPanel.classList.contains("open")) elPanel.hidden = true; panelHideT = null; }, 200);
}

function openPanel(i, focusInside) {
  if (!hasKids(tree[i])) return;
  cancelClose();
  openTop = i; activeTop = i; setMode("browse");
  panelShow();
  elRecentBtn.classList.remove("open");
  elCol2Label.textContent = "Categories";
  buildL2();
  activeL2 = 0; setL2(0);
  if (focusInside) zone = "l2";
  markTop(); markL2();
  overlayExpand();
}
function closePanel() {
  cancelClose();
  openTop = -1; setMode("browse"); panelHide(); zone = "bar";
  elRecentBtn.classList.remove("open");
  markTop();
  overlayCollapse();
}
function cancelClose() { if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; } }
function scheduleClose() { cancelClose(); closeTimer = setTimeout(() => { if (mode === "browse") closePanel(); }, 240); }

function buildL2() {
  elL2list.innerHTML = "";
  const kids = tree[openTop] ? (tree[openTop].children || []) : [];
  kids.forEach((n, i) => {
    const el = document.createElement("div");
    el.className = "l2" + (hasKids(n) ? "" : " leaf") + (!hasKids(n) && n.id == null ? " disabled" : ""); el.dataset.i = i;
    const badge = document.createElement("div"); badge.className = "badge";
    badge.textContent = n.icon || "•"; if (n.color) badge.style.color = n.color;
    const body = document.createElement("div"); body.className = "l2-body";
    body.innerHTML = '<div class="l2-label">' + esc(n.label || n.id) + "</div>" +
                     (n.desc ? '<div class="l2-desc">' + esc(n.desc) + "</div>" : "");
    const go = document.createElement("span"); go.className = "go"; go.textContent = hasKids(n) ? "→" : "↵";
    el.appendChild(badge); el.appendChild(body); el.appendChild(go);
    el.addEventListener("mouseenter", () => { if (hoverOpens()) setL2(i); });
    el.addEventListener("mousedown", (e) => e.preventDefault());
    el.addEventListener("click", () => { if (hasKids(n)) { setL2(i); zone = "l3"; markCard(); } else selectNode(n); });
    elL2list.appendChild(el);
  });
}
function l2Els() { return Array.from(elL2list.querySelectorAll(".l2")); }
function markL2() {
  l2Els().forEach((el, i) => el.classList.toggle("active", i === activeL2));
  const a = l2Els()[activeL2]; if (a) a.scrollIntoView({ block: "nearest" });
}
function setL2(i) { activeL2 = i; markL2(); buildL3(); }

function buildL3() {
  const node = tree[openTop] && tree[openTop].children ? tree[openTop].children[activeL2] : null;
  elL3grid.innerHTML = ""; gridNodes = []; activeL3 = 0;
  if (!node) return;
  if (hasKids(node)) {
    elCol3Label.textContent = node.label || "";
    node.children.forEach((c) => { gridNodes.push(c); elL3grid.appendChild(makeCard(c, "")); });
  } else {
    elCol3Label.textContent = "";
    gridNodes.push(node);
    elL3grid.appendChild(makeDetail(node));
  }
  markCard();
  overlayExpand();   // panel content height changed → resize the floating frame
}

function makeCard(node, q) {
  const el = document.createElement("div");
  el.className = "card" + (node.id == null ? " disabled" : ""); el.dataset.id = node.id;
  el.innerHTML =
    '<div class="card-art">' + esc(node.icon || "▸") + "</div>" +
    '<div class="card-body"><div class="card-title">' + hl(node.label || node.id, q) + "</div>" +
    (node.desc ? '<div class="card-desc">' + hl(node.desc, q) + "</div>" : "") +
    (node._path ? '<div class="card-path">' + esc(node._path) + "</div>" : "") +
    "</div>";
  // set the tint via the DOM (browser validates) — never interpolate color into innerHTML
  if (node.color) { const a = el.querySelector(".card-art"); if (a) a.style.color = node.color; }
  el.addEventListener("mouseenter", () => { activeL3 = gridNodes.indexOf(node); markCard(false); });
  el.addEventListener("mousedown", (e) => e.preventDefault());
  if (node.id != null) el.addEventListener("click", () => selectNode(node));
  return el;
}
function makeDetail(node) {
  const el = document.createElement("div");
  el.className = "detail"; el.dataset.id = node.id;
  const badge = document.createElement("div"); badge.className = "badge"; badge.textContent = node.icon || "•";
  if (node.color) badge.style.color = node.color;
  const body = document.createElement("div");
  body.innerHTML = '<div class="detail-title">' + esc(node.label || node.id) + "</div>" +
                   (node.desc ? '<div class="detail-desc">' + esc(node.desc) + "</div>" : "");
  const pick = document.createElement("span"); pick.className = "pick"; pick.textContent = "Select →";
  el.appendChild(badge); el.appendChild(body); el.appendChild(pick);
  el.addEventListener("mousedown", (e) => e.preventDefault());
  el.addEventListener("click", () => selectNode(node));
  return el;
}
function cardEls() { return Array.from(elL3grid.querySelectorAll(".card, .detail")); }
function markCard(scroll) {
  const inZone = zone === "l3";
  cardEls().forEach((el, i) => el.classList.toggle("active", inZone && i === activeL3));
  if (scroll !== false) { const a = cardEls()[activeL3]; if (a && inZone) a.scrollIntoView({ block: "nearest" }); }
}

// ---- search & recent (full-width col3) -------------------------------------
function search(q) {
  const ql = q.toLowerCase();
  const toks = ql.split(/\s+/).filter(Boolean);   // AND-of-words: each term may live in a different field
  if (!toks.length) return [];
  const res = [];
  for (const r of allLeaves) {
    const n = r.node;
    const label = (n.label || "").toLowerCase();
    const hay = (label + " " + (n.desc || "") + " " + (n.keywords || "") + " " + r.pathStr).toLowerCase();
    if (!toks.every((t) => hay.includes(t))) continue;
    let score = 0;
    if (label === ql) score = 100;
    else if (label.startsWith(ql)) score = 80;
    else if (label.includes(ql)) score = 60;
    else if (toks.every((t) => label.includes(t))) score = 50;
    else score = 30;
    res.push({ r: r, score: score });
  }
  res.sort((a, b) => b.score - a.score || (a.r.node.label || "").localeCompare(b.r.node.label || ""));
  return res.map((x) => x.r);
}
function showSearch() {
  const q = elSearch.value.trim();
  if (!q) { if (mode === "search") closePanel(); return; }
  cancelClose();
  setMode("search"); panelShow(); openTop = -1;
  elRecentBtn.classList.remove("open"); markTop();
  const recs = search(q);
  elCol3Label.textContent = recs.length + " result" + (recs.length === 1 ? "" : "s");
  elL3grid.innerHTML = ""; gridNodes = []; activeL3 = 0;
  if (recs.length === 0) {
    const e = document.createElement("div"); e.id = "empty";
    e.textContent = "No actions match “" + q + "”."; elL3grid.appendChild(e);
  } else {
    const hlq = q.split(/\s+/).filter(Boolean)[0] || q;   // highlight the first term
    for (const r of recs) { const n = Object.assign({}, r.node, { _path: r.pathStr }); gridNodes.push(n); elL3grid.appendChild(makeCard(n, hlq)); }
  }
  zone = "l3"; markCard();
  overlayExpand();
}
function openRecent() {
  cancelClose();
  setMode("recent"); panelShow(); openTop = -1;
  elRecentBtn.classList.add("open"); markTop();
  const recs = recentRecs();
  elCol3Label.textContent = OPTS.recentslabel;
  elL3grid.innerHTML = ""; gridNodes = []; activeL3 = 0;
  if (recs.length === 0) {
    const e = document.createElement("div"); e.id = "empty";
    e.textContent = "Nothing selected yet — your recent actions will appear here."; elL3grid.appendChild(e);
  } else {
    for (const r of recs) { const n = Object.assign({}, r.node, { _path: r.pathStr }); gridNodes.push(n); elL3grid.appendChild(makeCard(n, "")); }
  }
  zone = "l3"; markCard();
  overlayExpand();
}

// ---- selection --------------------------------------------------------------
function selectNode(node) {
  if (!node || node.id == null) return;
  const rec = leafById[node.id];
  const pathStr = rec ? rec.pathStr : "";
  const label = node.label || node.id;
  const skipRecent = !!((rec && rec.node && rec.node.norecent) || node.norecent);
  emit({ type: "select", id: node.id, label: label, path: pathStr }, OPTS.select);
  if (!skipRecent) pushRecent(node.id);   // items flagged norecent stay out of Recent
  setLocal("selected: " + (pathStr ? pathStr + " › " : "") + label);
  if (!hasHost()) setHost("demo — would fire ON ACTION " + OPTS.select, "warn");
  setNavOpen(false);                   // collapse the responsive drawer after a pick
  elSearch.value = "";                 // clear any search query
  closePanel();                        // contract the menu after a selection
}

// ---- status / help ----------------------------------------------------------
function setHost(msg, cls) { elStatR.textContent = msg; elStatR.className = cls || ""; }
function setLocal(msg) { elStatL.textContent = msg; }
function focusSearch() { try { elSearch.focus(); } catch (e) {} }

// responsive drawer: below the CSS breakpoint the bar collapses to a single
// menu button; toggling it reveals the menu items + search (no effect on wide
// layouts, where the class is simply ignored by the stylesheet).
function setNavOpen(v) {
  document.body.classList.toggle("nav-open", v);
  if (elMenuToggle) elMenuToggle.setAttribute("aria-expanded", v ? "true" : "false");
  if (v) focusSearch();
  overlayExpand();   // grow/shrink the host frame to fit (or release) the drawer
}
function toggleNav() {
  if (document.body.classList.contains("nav-open")) { setNavOpen(false); closePanel(); } // tap ☰ to close → collapse everything
  else setNavOpen(true);
}
function toggleHelp(show) {
  const willShow = (show === undefined) ? elHelp.hidden : show;
  elHelp.hidden = !willShow; if (!willShow) focusSearch();
  if (willShow && !overlayOn) fitHelp(window.innerHeight);   // in-flow: fit inside the field
  syncOverlay();   // overlay: grow the host frame to show the card, or release it
}
// cap the F1 card to the space between its top and `availBottom` (layout px
// from the top of this document) so it never runs off the bottom; its body
// scrolls instead. Returns the card's top (its offsetParent is the bar).
function fitHelp(availBottom) {
  const top = $("bar").offsetTop + elHelp.offsetTop;
  elHelp.style.maxHeight = Math.max(120, availBottom - top - 10) + "px";
  return top;
}

// ---- keyboard (capture phase — Tab must never leave the iframe) -------------
function own(e) { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); }
function gridCols() {
  // estimate columns in the col3 grid for up/down row moves
  const els = cardEls(); if (els.length < 2) return 1;
  const top0 = els[0].offsetTop; let c = 1;
  for (let i = 1; i < els.length; i++) { if (els[i].offsetTop === top0) c++; else break; }
  return Math.max(1, c);
}
function moveCard(d) {
  const n = gridNodes.length; if (!n) return;
  activeL3 = Math.max(0, Math.min(n - 1, activeL3 + d)); markCard();
}
function onKey(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (!elHelp.hidden) { own(e); if (e.key === "Escape" || e.key === "F1") toggleHelp(false); return; }

  if (e.key === "F1") { own(e); toggleHelp(true); return; }
  if (e.key === "Tab") { own(e); tabMove(e.shiftKey ? -1 : 1); return; }

  if (e.key === "Escape") {
    own(e);
    if (mode === "search" || mode === "recent") { if (mode === "search") elSearch.value = ""; closePanel(); }
    else if (zone === "l3") { zone = "l2"; markCard(); markL2(); }
    else if (openTop >= 0) { closePanel(); }   // zone l2, or a panel the mouse opened (zone stays bar)
    else if (elSearch.value) { elSearch.value = ""; }
    else if (document.body.classList.contains("nav-open")) { setNavOpen(false); }
    return;
  }

  // Left/Right only when the search box is empty (else they edit the caret)
  const navLR = !elSearch.value;

  switch (e.key) {
    case "ArrowDown":
      own(e);
      if (zone === "bar") { if (hasKids(tree[activeTop])) openPanel(activeTop, true), markL2(); }
      else if (zone === "l2") { activeL2 = Math.min(l2Els().length - 1, activeL2 + 1); setL2(activeL2); }
      else if (zone === "l3") { moveCard(gridCols()); }
      break;
    case "ArrowUp":
      own(e);
      if (zone === "l2") { if (activeL2 === 0) { zone = "bar"; markTop(); markL2(); } else { activeL2--; setL2(activeL2); } }
      else if (zone === "l3") {
        if (activeL3 >= gridCols()) { moveCard(-gridCols()); }            // up a row
        else if (mode === "browse") { zone = "l2"; markCard(); markL2(); } // top row → categories
        else { zone = "bar"; markCard(); markTop(); }                     // search/recent → top bar
      }
      break;
    case "ArrowRight":
      if (!navLR) return; own(e);
      if (zone === "bar") { moveTop(1); }
      else if (zone === "l2") { const n = curL2(); if (hasKids(n)) { zone = "l3"; activeL3 = 0; markL2(); markCard(); } }
      else if (zone === "l3") { moveCard(1); }
      break;
    case "ArrowLeft":
      if (!navLR) return; own(e);
      if (zone === "bar") { moveTop(-1); }
      else if (zone === "l2") { zone = "bar"; markTop(); markL2(); }
      else if (zone === "l3") {
        if (activeL3 % gridCols() === 0) { if (mode === "browse") { zone = "l2"; markCard(); markL2(); } } // never into the hidden column in search/recent
        else moveCard(-1);
      }
      break;
    case "Enter":
      own(e);
      if (zone === "bar") { const t = tree[activeTop]; if (hasKids(t)) { openPanel(activeTop, true); markL2(); } else selectNode(t); }
      else if (zone === "l2") { const n = curL2(); if (hasKids(n)) { zone = "l3"; activeL3 = 0; markL2(); markCard(); } else selectNode(n); }
      else if (zone === "l3") { selectNode(gridNodes[activeL3]); }
      break;
    default: break; // printable chars reach the (always-focused) search input
  }
}
function curL2() { return tree[openTop] && tree[openTop].children ? tree[openTop].children[activeL2] : null; }
function moveTop(d) {
  const n = tree.length; if (!n) return;
  activeTop = (activeTop + d + n) % n; markTop();
  if (openTop >= 0) { if (hasKids(tree[activeTop])) openPanel(activeTop, false); else closePanel(); }
}
function tabMove(d) {
  if (mode === "search" || mode === "recent" || zone === "l3") { moveCard(d); return; }
  if (zone === "l2") { activeL2 = (activeL2 + d + l2Els().length) % l2Els().length; setL2(activeL2); return; }
  moveTop(d);
}
window.addEventListener("keydown", onKey, true);

// ---- mouse: hover-close, outside-click, search/recent ----------------------
// A press inside the widget takes the keyboard. The item handlers cancel
// mousedown (to keep the search caret), which also stops the browser moving
// focus into this frame — so focus the search box ourselves, and ask the
// dialog to make this the current field.
function claimFocus() {
  if (!document.hasFocus()) focusSearch();
  if (!hasFocus && hasHost() && gICAPI.SetFocus) gICAPI.SetFocus();
}
document.addEventListener("mousedown", claimFocus, true);
elPanel.addEventListener("mouseenter", cancelClose);
elPanel.addEventListener("mouseleave", scheduleClose);
$("bar").addEventListener("mouseleave", scheduleClose);
$("bar").addEventListener("mouseenter", cancelClose);
document.addEventListener("pointerdown", (e) => {
  // tap inside the iframe but outside the bar + panel → dismiss
  if (!$("bar").contains(e.target) && !elPanel.contains(e.target)) dismissMenu();
});
elSearch.addEventListener("focus", () => elSearchWrap.classList.add("focus"));
elSearch.addEventListener("blur", () => elSearchWrap.classList.remove("focus"));
elSearch.addEventListener("input", showSearch);
elSearchWrap.addEventListener("click", focusSearch);
elRecentBtn.addEventListener("click", () => { if (mode === "recent") closePanel(); else openRecent(); });
if (elMenuToggle) elMenuToggle.addEventListener("click", toggleNav);
$("helpclose").addEventListener("click", () => toggleHelp(false));

// ---- standalone demo (fjs-megamenu.html?demo) ------------------------------
const DEMO_MENU = { type: "menu", items: [
  { id: "sales", label: "Sales", icon: "💼", children: [
    { id: "sales.cust", label: "Customers", desc: "Accounts & contacts", icon: "👤", color: "#34d399", children: [
      { id: "sales.cust.new",  label: "New Customer",  desc: "Create an account", icon: "➕", keywords: "create add account" },
      { id: "sales.cust.list", label: "Customer List", desc: "Browse & edit",      icon: "📋", keywords: "browse search accounts" },
      { id: "sales.cust.seg",  label: "Segments",      desc: "Groups & tags",      icon: "🎯", keywords: "group tag marketing" } ] },
    { id: "sales.ord", label: "Orders", desc: "Quotes & orders", icon: "🧾", color: "#60a5fa", children: [
      { id: "sales.ord.new",  label: "New Order",  desc: "Start an order",   icon: "➕", keywords: "create sale" },
      { id: "sales.ord.open", label: "Open Orders", desc: "In progress",     icon: "📂", keywords: "pending fulfil" },
      { id: "sales.ord.ret",  label: "Returns",    desc: "RMAs & refunds",   icon: "↩", keywords: "rma refund credit" } ] },
    { id: "sales.bill", label: "Billing", desc: "Invoices & payments", icon: "💶", color: "#fbbf24", children: [
      { id: "sales.bill.inv", label: "Create Invoice", desc: "Raise an invoice", icon: "🧾", keywords: "invoice bill" },
      { id: "sales.bill.pay", label: "Payments",       desc: "Record payments",  icon: "💳", keywords: "payment receipt" },
      { id: "sales.bill.cn",  label: "Credit Notes",   desc: "Issue credits",    icon: "📃", keywords: "credit refund" } ] } ] },
  { id: "inv", label: "Inventory", icon: "📦", children: [
    { id: "inv.prod", label: "Products", desc: "Catalog & pricing", icon: "🏷", color: "#a78bfa", children: [
      { id: "inv.prod.cat", label: "Catalog",     desc: "All products",  icon: "📚", keywords: "items sku" },
      { id: "inv.prod.price", label: "Price Lists", desc: "Manage prices", icon: "💲", keywords: "pricing tariff" },
      { id: "inv.prod.cats", label: "Categories", desc: "Classification", icon: "🗂", keywords: "group family" } ] },
    { id: "inv.stock", label: "Stock", desc: "Levels & movements", icon: "📊", color: "#2dd4bf", children: [
      { id: "inv.stock.lvl", label: "Stock Levels", desc: "By site",      icon: "📈", keywords: "quantity warehouse" },
      { id: "inv.stock.xfer", label: "Transfers",   desc: "Between sites", icon: "🔁", keywords: "move transfer" },
      { id: "inv.stock.adj", label: "Adjustments",  desc: "Corrections",   icon: "🛠", keywords: "adjust count" } ] },
    { id: "inv.sup", label: "Suppliers", desc: "Vendors & POs", icon: "🚚", color: "#f472b6", children: [
      { id: "inv.sup.dir", label: "Directory",       desc: "Supplier list", icon: "📒", keywords: "vendor contact" },
      { id: "inv.sup.po",  label: "Purchase Orders", desc: "Create & track", icon: "🧾", keywords: "po procurement buy" } ] } ] },
  { id: "rpt", label: "Reports", icon: "📈", children: [
    { id: "rpt.sales", label: "Sales Report",  desc: "Revenue & margin",    icon: "📊", color: "#60a5fa", keywords: "revenue kpi" },
    { id: "rpt.low",   label: "Low Stock",     desc: "Below reorder point", icon: "⚠", color: "#fbbf24", keywords: "reorder shortage" },
    { id: "rpt.aged",  label: "Aged Debtors",  desc: "Receivables ageing",  icon: "🕐", color: "#f87171", keywords: "ageing receivable" } ] },
  { id: "admin", label: "Admin", icon: "⚙", children: [
    { id: "admin.users", label: "Users", desc: "Accounts & roles", icon: "🧑", color: "#34d399", children: [
      { id: "admin.users.list", label: "User List",   desc: "All users",   icon: "📋", keywords: "people account" },
      { id: "admin.users.roles", label: "Roles",      desc: "Role groups", icon: "🛡", keywords: "permission group" },
      { id: "admin.users.perm", label: "Permissions", desc: "Fine-grained", icon: "🔑", keywords: "access rights" } ] },
    { id: "admin.set", label: "Settings", desc: "Configuration", icon: "⚙", color: "#94a3b8", children: [
      { id: "admin.set.gen", label: "General",      desc: "App settings",   icon: "🔧", keywords: "config preferences" },
      { id: "admin.set.loc", label: "Localization", desc: "Language & TZ",  icon: "🌐", keywords: "language locale timezone" },
      { id: "admin.set.int", label: "Integrations", desc: "APIs & webhooks", icon: "🔌", keywords: "api webhook connect" } ] },
    { id: "admin.audit", label: "Audit Log", desc: "Security & change history", icon: "🗂", color: "#a78bfa", keywords: "audit security log history" } ] },
  { id: "help", label: "Help", icon: "❔" },
  { id: "contact", label: "Contact", icon: "✉" }
] };

function loadDemo() {
  const sp0 = new URLSearchParams(location.search);
  handleProperties(JSON.stringify({
    title: sp0.get("title") || "",          // no hero by default (compact); ?title=… to add one
    subtitle: sp0.get("subtitle") || "",
    brand: "Four Js",
    brandicon: sp0.get("brandicon") || "",   // ?brandicon=🚀 etc. (default = 4js badge)
    placeholder: "Search the menu…", select: "menu_select",
    theme: sp0.get("theme") || "dark", accent: "#16b1a5"   // standalone preview: Four Js teal
  }));
  handleData(JSON.stringify(DEMO_MENU));
  setHost("demo mode (no DVM) — cookies live", "warn");
  const sp = new URLSearchParams(location.search);
  if (sp.get("nav") === "1") setNavOpen(true);   // test hook: open the responsive drawer
  if (sp.get("q")) { elSearch.value = sp.get("q"); showSearch(); }
  else if (sp.get("recent") === "1") { openRecent(); }
  else if (sp.get("open") !== "0") { openPanel(parseInt(sp.get("top") || "0", 10) || 0, false); }
}

(function init() {
  if (new URLSearchParams(location.search).has("noanim")) document.body.classList.add("noanim");
  applyChrome();
  applyHostTheme();
  maybeEnableOverlay();
  focusSearch();
  if (new URLSearchParams(location.search).has("demo")) loadDemo();
})();
