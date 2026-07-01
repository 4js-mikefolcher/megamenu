-- com/fourjs/megamenu/MegaMenu.4gl
--
-- User-friendly builder + helpers for the "fjs-megamenu" Genero web component.
--
-- Build a 1-to-3 level menu the user is allowed to see, with menu()/category()/
-- action(); call build() for the JSON envelope to assign to the WEBCOMPONENT
-- field (host -> widget); call parse() to read the selection the widget sends
-- back (widget -> host). The widget renders a top bar (level 1), a categories
-- column (level 2) and action cards (level 3), with search and a Recent group.
--
--   IMPORT FGL com.fourjs.megamenu.MegaMenu
--   ...
--   CALL MegaMenu.clear()
--   CALL MegaMenu.menu("sales", "Sales", "💼")
--   CALL MegaMenu.category("sales.cust", "Customers", "Accounts", "👤", "#34d399", "")
--   CALL MegaMenu.action("sales.cust.new", "New Customer", "Create", "➕", "create add")
--   LET menu_data = MegaMenu.build()
--   ...
--   VAR sel = MegaMenu.parse(p_json: menu_data)   -- sel.id / sel.label / sel.path
--
-- Structural rule: a node whose children list is empty is a LEAF (a directly
-- selectable action). So a menu() with no category() is a 1-level action; a
-- category() with no action() is a 2-level action; otherwise a category holds
-- level-3 actions.
PACKAGE com.fourjs.megamenu
IMPORT util

-- ---- the menu tree (json_name keeps clean JSON keys; one type per level) ----
PUBLIC TYPE t_action RECORD
    id       STRING ATTRIBUTES(json_name = "id"),
    label    STRING ATTRIBUTES(json_name = "label"),
    descr    STRING ATTRIBUTES(json_name = "desc"),
    icon     STRING ATTRIBUTES(json_name = "icon"),
    keywords STRING ATTRIBUTES(json_name = "keywords")
END RECORD
PUBLIC TYPE t_category RECORD
    id       STRING ATTRIBUTES(json_name = "id"),
    label    STRING ATTRIBUTES(json_name = "label"),
    descr    STRING ATTRIBUTES(json_name = "desc"),
    icon     STRING ATTRIBUTES(json_name = "icon"),
    color    STRING ATTRIBUTES(json_name = "color"),
    keywords STRING ATTRIBUTES(json_name = "keywords"),
    children DYNAMIC ARRAY OF t_action ATTRIBUTES(json_name = "children")
END RECORD
PUBLIC TYPE t_menu RECORD
    id       STRING ATTRIBUTES(json_name = "id"),
    label    STRING ATTRIBUTES(json_name = "label"),
    icon     STRING ATTRIBUTES(json_name = "icon"),
    children DYNAMIC ARRAY OF t_category ATTRIBUTES(json_name = "children")
END RECORD

-- the selection envelope the widget sends back
PUBLIC TYPE t_selection RECORD
    kind  STRING ATTRIBUTES(json_name = "type"),
    id    STRING ATTRIBUTES(json_name = "id"),
    label STRING ATTRIBUTES(json_name = "label"),
    path  STRING ATTRIBUTES(json_name = "path")
END RECORD

PRIVATE DEFINE m_items DYNAMIC ARRAY OF t_menu

-- Reset the builder. Call before adding menus.
PUBLIC FUNCTION clear()
    CALL m_items.clear()
END FUNCTION

-- Add a top-level menu (level 1); it becomes the "current menu".
-- A menu with no categories is itself a selectable action (a 1-level menu).
PUBLIC FUNCTION menu(p_id STRING, p_label STRING, p_icon STRING)
    DEFINE n INTEGER
    CALL m_items.appendElement()
    LET n = m_items.getLength()
    LET m_items[n].id = p_id
    LET m_items[n].label = p_label
    LET m_items[n].icon = p_icon
END FUNCTION

-- Add a category (level 2) under the current menu; it becomes the "current
-- category". A category with no actions is itself a selectable action (2-level).
PUBLIC FUNCTION category(p_id STRING, p_label STRING, p_desc STRING,
                         p_icon STRING, p_color STRING, p_keywords STRING)
    DEFINE g, c INTEGER
    LET g = m_items.getLength()
    IF g < 1 THEN RETURN END IF        -- category() before menu(): ignored
    CALL m_items[g].children.appendElement()
    LET c = m_items[g].children.getLength()
    LET m_items[g].children[c].id = p_id
    LET m_items[g].children[c].label = p_label
    LET m_items[g].children[c].descr = p_desc
    LET m_items[g].children[c].icon = p_icon
    LET m_items[g].children[c].color = p_color
    LET m_items[g].children[c].keywords = p_keywords
END FUNCTION

-- Add an action (level 3) under the current category.
PUBLIC FUNCTION action(p_id STRING, p_label STRING, p_desc STRING,
                       p_icon STRING, p_keywords STRING)
    DEFINE g, c, k INTEGER
    LET g = m_items.getLength()
    IF g < 1 THEN RETURN END IF        -- action() before menu(): ignored
    LET c = m_items[g].children.getLength()
    IF c < 1 THEN RETURN END IF        -- action() before category(): ignored
    CALL m_items[g].children[c].children.appendElement()
    LET k = m_items[g].children[c].children.getLength()
    LET m_items[g].children[c].children[k].id = p_id
    LET m_items[g].children[c].children[k].label = p_label
    LET m_items[g].children[c].children[k].descr = p_desc
    LET m_items[g].children[c].children[k].icon = p_icon
    LET m_items[g].children[c].children[k].keywords = p_keywords
END FUNCTION

-- Number of top-level menus currently in the builder (handy for tests/guards).
PUBLIC FUNCTION menuCount() RETURNS INTEGER
    RETURN m_items.getLength()
END FUNCTION

-- Build the JSON envelope to assign to the WEBCOMPONENT field (host -> widget).
PUBLIC FUNCTION build() RETURNS STRING
    RETURN '{"type":"menu","items":' || util.JSON.stringify(m_items) || '}'
END FUNCTION

-- Parse the selection envelope the widget sends back (widget -> host) and
-- RETURN it as a record. On bad/empty input the record members are NULL.
--   VAR selection = MegaMenu.parse(p_json: menu_data)
PUBLIC FUNCTION parse(p_json STRING) RETURNS (t_selection)
    DEFINE selection t_selection
    INITIALIZE selection.* TO NULL
    IF p_json IS NULL OR p_json == "" THEN RETURN selection END IF
    TRY
        CALL util.JSON.parse(p_json, selection)
    CATCH
        INITIALIZE selection.* TO NULL
    END TRY
    RETURN selection
END FUNCTION

-- Convenience: the selected action id (NULL if none / unparseable).
PUBLIC FUNCTION selectionId(p_json STRING) RETURNS STRING
    VAR sel = parse(p_json: p_json)
    RETURN sel.id
END FUNCTION
