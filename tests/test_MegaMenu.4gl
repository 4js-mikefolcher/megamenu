-- test_MegaMenu.4gl — fglunit tests for com.fourjs.megamenu.MegaMenu
-- Run:  see tests/run-tests.sh  (needs the fglunit package + this package on FGLLDPATH)
IMPORT FGL com.fourjs.fglunit.FglUnit
IMPORT FGL com.fourjs.fglunit.Assertions
IMPORT FGL com.fourjs.megamenu.MegaMenu
IMPORT util

-- mirror of the envelope build() emits, so we can parse it back and inspect it
PRIVATE TYPE t_envelope RECORD
    kind  STRING ATTRIBUTES(json_name = "type"),
    items DYNAMIC ARRAY OF MegaMenu.t_menu ATTRIBUTES(json_name = "items")
END RECORD

MAIN
    CALL FglUnit.suite("MegaMenu")
    CALL FglUnit.setSetup(FUNCTION reset)
    CALL FglUnit.register("test_menu_count",             FUNCTION test_menu_count)
    CALL FglUnit.register("test_clear_resets",           FUNCTION test_clear_resets)
    CALL FglUnit.register("test_build_envelope_type",    FUNCTION test_build_envelope_type)
    CALL FglUnit.register("test_three_levels",           FUNCTION test_three_levels)
    CALL FglUnit.register("test_two_level_leaf",         FUNCTION test_two_level_leaf)
    CALL FglUnit.register("test_one_level_leaf",         FUNCTION test_one_level_leaf)
    CALL FglUnit.register("test_orphan_calls_are_ignored", FUNCTION test_orphan_calls_are_ignored)
    CALL FglUnit.register("test_norecent_flag",          FUNCTION test_norecent_flag)
    CALL FglUnit.register("test_parse_selection",        FUNCTION test_parse_selection)
    CALL FglUnit.register("test_parse_empty_is_null",    FUNCTION test_parse_empty_is_null)
    CALL FglUnit.register("test_parse_bad_json_is_null", FUNCTION test_parse_bad_json_is_null)
    CALL FglUnit.register("test_selection_id_helper",    FUNCTION test_selection_id_helper)
    CALL FglUnit.register("test_json_escaping",          FUNCTION test_json_escaping)
    EXIT PROGRAM FglUnit.run()
END MAIN

-- runs before each test (registered via setSetup)
PRIVATE FUNCTION reset()
    CALL MegaMenu.clear()
END FUNCTION

-- a small representative tree: a 3-level menu, a 2-level (leaf category) menu,
-- and a 1-level (leaf) menu.
PRIVATE FUNCTION sampleTree()
    CALL MegaMenu.clear()
    CALL MegaMenu.menu("sales", "Sales", "S")
    CALL MegaMenu.category("sales.cust", "Customers", "Accounts", "C", "#34d399", "")
    CALL MegaMenu.action("sales.cust.new",  "New Customer",  "Create", "N", "create add")
    CALL MegaMenu.action("sales.cust.list", "Customer List", "Browse", "L", "browse")
    CALL MegaMenu.menu("rpt", "Reports", "R")
    CALL MegaMenu.category("rpt.sales", "Sales Report", "Revenue", "X", "#60a5fa", "kpi")  -- 2-level leaf
    CALL MegaMenu.menu("help", "Help", "H")                                                -- 1-level leaf
END FUNCTION

PUBLIC FUNCTION test_menu_count()
    CALL MegaMenu.menu("a", "A", "")
    CALL MegaMenu.menu("b", "B", "")
    CALL Assertions.assertEqualsInt(2, MegaMenu.menuCount(), "two menus were added")
END FUNCTION

PUBLIC FUNCTION test_clear_resets()
    CALL MegaMenu.menu("a", "A", "")
    CALL MegaMenu.clear()
    CALL Assertions.assertEqualsInt(0, MegaMenu.menuCount(), "clear() empties the builder")
END FUNCTION

PUBLIC FUNCTION test_build_envelope_type()
    DEFINE env t_envelope
    CALL sampleTree()
    CALL util.JSON.parse(MegaMenu.build(), env)
    CALL Assertions.assertEquals("menu", env.kind, "envelope type is 'menu'")
    CALL Assertions.assertEqualsInt(3, env.items.getLength(), "three top-level menus")
END FUNCTION

PUBLIC FUNCTION test_three_levels()
    DEFINE env t_envelope
    CALL sampleTree()
    CALL util.JSON.parse(MegaMenu.build(), env)
    CALL Assertions.assertEquals("sales", env.items[1].id, "level-1 id")
    CALL Assertions.assertEquals("sales.cust", env.items[1].children[1].id, "level-2 id")
    CALL Assertions.assertEqualsInt(2, env.items[1].children[1].children.getLength(), "two level-3 actions")
    CALL Assertions.assertEquals("sales.cust.new", env.items[1].children[1].children[1].id, "level-3 id")
    CALL Assertions.assertEquals("New Customer", env.items[1].children[1].children[1].label, "level-3 label")
END FUNCTION

PUBLIC FUNCTION test_two_level_leaf()
    DEFINE env t_envelope
    CALL sampleTree()
    CALL util.JSON.parse(MegaMenu.build(), env)
    CALL Assertions.assertEquals("rpt", env.items[2].id, "reports menu")
    CALL Assertions.assertEqualsInt(1, env.items[2].children.getLength(), "one category")
    CALL Assertions.assertEqualsInt(0, env.items[2].children[1].children.getLength(),
        "a category with no actions is a leaf (children = [])")
END FUNCTION

PUBLIC FUNCTION test_one_level_leaf()
    DEFINE env t_envelope
    CALL sampleTree()
    CALL util.JSON.parse(MegaMenu.build(), env)
    CALL Assertions.assertEquals("help", env.items[3].id, "help menu")
    CALL Assertions.assertEqualsInt(0, env.items[3].children.getLength(),
        "a menu with no categories is a leaf (children = [])")
END FUNCTION

PUBLIC FUNCTION test_norecent_flag()
    DEFINE env t_envelope
    -- level-1: noRecent() flags the most-recently-added menu
    CALL MegaMenu.menu("m1", "M1", "")
    CALL MegaMenu.menu("m2", "M2", "")
    CALL MegaMenu.noRecent()
    -- level-3: noRecent() flags the most-recently-added action
    CALL MegaMenu.menu("sales", "Sales", "")
    CALL MegaMenu.category("sales.c", "C", "", "", "", "")
    CALL MegaMenu.action("sales.c.a1", "A1", "", "", "")
    CALL MegaMenu.action("sales.c.a2", "A2", "", "", "")
    CALL MegaMenu.noRecent()
    CALL util.JSON.parse(MegaMenu.build(), env)
    CALL Assertions.assertNull(env.items[1].norecent, "unflagged level-1 has no norecent")
    CALL Assertions.assertEquals("1", env.items[2].norecent, "flagged level-1 has norecent=1")
    CALL Assertions.assertNull(env.items[3].children[1].children[1].norecent,
        "unflagged level-3 action has no norecent")
    CALL Assertions.assertEquals("1", env.items[3].children[1].children[2].norecent,
        "flagged level-3 action has norecent=1")
END FUNCTION

PUBLIC FUNCTION test_orphan_calls_are_ignored()
    -- category()/action() before their parent should be no-ops, not crashes
    CALL MegaMenu.category("x", "X", "", "", "", "")
    CALL MegaMenu.action("y", "Y", "", "", "")
    CALL Assertions.assertEqualsInt(0, MegaMenu.menuCount(), "orphan category/action add nothing")
END FUNCTION

PUBLIC FUNCTION test_parse_selection()
    VAR sel = MegaMenu.parse(p_json:
        '{"type":"select","id":"sales.cust.new","label":"New Customer","path":"Sales > Customers"}')
    CALL Assertions.assertEquals("sales.cust.new", sel.id, "parsed id")
    CALL Assertions.assertEquals("New Customer", sel.label, "parsed label")
    CALL Assertions.assertEquals("Sales > Customers", sel.path, "parsed path")
END FUNCTION

PUBLIC FUNCTION test_parse_empty_is_null()
    VAR sel = MegaMenu.parse(p_json: "")
    CALL Assertions.assertNull(sel.id, "empty input -> null id")
END FUNCTION

PUBLIC FUNCTION test_parse_bad_json_is_null()
    VAR sel = MegaMenu.parse(p_json: "this is not json")
    CALL Assertions.assertNull(sel.id, "bad json -> null id (no crash)")
END FUNCTION

PUBLIC FUNCTION test_selection_id_helper()
    CALL Assertions.assertEquals("x.y",
        MegaMenu.selectionId('{"type":"select","id":"x.y","label":"L"}'),
        "selectionId() convenience getter")
END FUNCTION

PUBLIC FUNCTION test_json_escaping()
    DEFINE env t_envelope
    -- labels with JSON-significant characters must round-trip (stringify escapes them)
    CALL MegaMenu.menu("m", 'He said "hi" & <ok>', "")
    CALL util.JSON.parse(MegaMenu.build(), env)
    CALL Assertions.assertEquals('He said "hi" & <ok>', env.items[1].label,
        "special characters survive JSON escaping")
END FUNCTION
