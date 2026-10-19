-- example.4gl — demo host for the fjs-megamenu web component.
-- Shipped in the package (a "programs" entry): run it with
--   fglpkg bdl megamenu example
-- Its form keeps the distinct name ex_megamenu: the package's form folder is
-- on every consumer's FGLRESOURCEPATH, so a generic form name could shadow
-- theirs. (Never name either file "megamenu": it would collide with the
-- package module MegaMenu on case-insensitive file systems.)
--
-- Shows the user-friendly package API: build the 1-to-3 level menu with
-- MegaMenu.menu()/category()/action(), push it through one STRING field, and
-- read the selection with MegaMenu.parse(). Search, the level drill-down,
-- keyboard nav, animation and the cookie-backed "Recent" group are handled
-- client-side by the widget; GBC theme (font/colors) is adopted automatically.
IMPORT FGL com.fourjs.megamenu.MegaMenu

MAIN
    DEFINE menu_data STRING
    DEFINE v_last STRING

    DEFER INTERRUPT
    OPTIONS INPUT WRAP   -- mandatory: field-exit must WRAP, not implicitly ACCEPT

    CLOSE WINDOW SCREEN
    OPEN WINDOW w_menu WITH FORM "ex_megamenu"

    LET menu_data = build_demo_menu()   -- push the menu tree to the widget (onData)

    -- demo page-body content: these fields sit directly beneath the mega menu,
    -- so the form shows how little vertical space the menu now consumes.
    DISPLAY "ACME Industries Ltd" TO f1
    DISPLAY "SO-100244"           TO f2
    DISPLAY "Open"                TO f3

    INPUT BY NAME menu_data WITHOUT DEFAULTS
        ATTRIBUTES(UNBUFFERED, ACCEPT = FALSE, CANCEL = FALSE)

        -- fired by the widget via gICAPI.Action("menu_select"); menu_data now
        -- holds the selection envelope. Do NOT reassign menu_data here, or the
        -- re-push would reset the user's place in the widget.
        ON ACTION menu_select ATTRIBUTES(DEFAULTVIEW = NO)
            LET v_last = describe_selection(menu_data)
            DISPLAY v_last TO lastsel
            MESSAGE "Backend received selection: " || v_last

        ON ACTION reload ATTRIBUTES(TEXT = "Reload menu")
            LET menu_data = build_demo_menu()
            MESSAGE "Menu reloaded from backend"

        ON ACTION close ATTRIBUTES(TEXT = "Quit")
            EXIT INPUT
    END INPUT

    CLOSE WINDOW w_menu
END MAIN

-- The backend is now aware of the chosen action (sel.id). A real app would
-- branch on sel.id here to open a form / run a sub-dialog.
FUNCTION describe_selection(p_json STRING) RETURNS STRING
    DEFINE lbl STRING
    VAR sel = MegaMenu.parse(p_json: p_json)

    -- "" is NULL in Genero, so `x != ""` is never TRUE: test getLength()
    -- (0 for NULL too) to know whether a string has content.
    IF sel.id.getLength() == 0 THEN
        RETURN "(no selection)"
    END IF
    LET lbl = sel.label
    IF lbl IS NULL THEN LET lbl = sel.id END IF

    -- CASE sel.id
    --     WHEN "sales.cust.new" CALL open_new_customer()
    --     ...
    -- END CASE

    IF sel.path.getLength() > 0 THEN
        RETURN sel.path || " > " || lbl || "   [" || sel.id || "]"
    END IF
    RETURN lbl || "   [" || sel.id || "]"
END FUNCTION

-- Build the 1-to-3 level menu the current user is allowed to see, using the
-- package's builder API. In a real app, fetch this from the database /
-- authorization service and filter by the user's rights.
FUNCTION build_demo_menu() RETURNS STRING
    CALL MegaMenu.clear()

    CALL MegaMenu.menu("sales", "Sales", "💼")
      CALL MegaMenu.category("sales.cust", "Customers", "Accounts & contacts", "👤", "#34d399", "")
        CALL MegaMenu.action("sales.cust.new",  "New Customer",  "Create an account", "➕", "create add account")
        CALL MegaMenu.action("sales.cust.list", "Customer List", "Browse & edit",     "📋", "browse search accounts")
        CALL MegaMenu.action("sales.cust.seg",  "Segments",      "Groups & tags",     "🎯", "group tag marketing")
      CALL MegaMenu.category("sales.ord", "Orders", "Quotes & orders", "🧾", "#60a5fa", "")
        CALL MegaMenu.action("sales.ord.new",  "New Order",   "Start an order", "➕", "create sale")
        CALL MegaMenu.action("sales.ord.open", "Open Orders", "In progress",    "📂", "pending fulfil")
        CALL MegaMenu.action("sales.ord.ret",  "Returns",     "RMAs & refunds", "↩",  "rma refund credit")
      CALL MegaMenu.category("sales.bill", "Billing", "Invoices & payments", "💶", "#fbbf24", "")
        CALL MegaMenu.action("sales.bill.inv", "Create Invoice", "Raise an invoice", "🧾", "invoice bill")
        CALL MegaMenu.action("sales.bill.pay", "Payments",       "Record payments",  "💳", "payment receipt")
        CALL MegaMenu.action("sales.bill.cn",  "Credit Notes",   "Issue credits",    "📃", "credit refund")

    CALL MegaMenu.menu("inv", "Inventory", "📦")
      CALL MegaMenu.category("inv.prod", "Products", "Catalog & pricing", "🏷", "#a78bfa", "")
        CALL MegaMenu.action("inv.prod.cat",   "Catalog",     "All products",   "📚", "items sku")
        CALL MegaMenu.action("inv.prod.price", "Price Lists", "Manage prices",  "💲", "pricing tariff")
        CALL MegaMenu.action("inv.prod.cats",  "Categories",  "Classification", "🗂", "group family")
      CALL MegaMenu.category("inv.stock", "Stock", "Levels & movements", "📊", "#2dd4bf", "")
        CALL MegaMenu.action("inv.stock.lvl",  "Stock Levels", "By site",       "📈", "quantity warehouse")
        CALL MegaMenu.action("inv.stock.xfer", "Transfers",    "Between sites", "🔁", "move transfer")
        CALL MegaMenu.action("inv.stock.adj",  "Adjustments",  "Corrections",   "🛠", "adjust count")
      CALL MegaMenu.category("inv.sup", "Suppliers", "Vendors & POs", "🚚", "#f472b6", "")
        CALL MegaMenu.action("inv.sup.dir", "Directory",       "Supplier list",  "📒", "vendor contact")
        CALL MegaMenu.action("inv.sup.po",  "Purchase Orders", "Create & track", "🧾", "po procurement buy")

    -- Reports: a 2-level menu — its categories are themselves leaf actions.
    CALL MegaMenu.menu("rpt", "Reports", "📈")
      CALL MegaMenu.category("rpt.sales", "Sales Report", "Revenue & margin",    "📊", "#60a5fa", "revenue kpi")
      CALL MegaMenu.category("rpt.low",   "Low Stock",    "Below reorder point", "⚠", "#fbbf24", "reorder shortage")
      CALL MegaMenu.category("rpt.aged",  "Aged Debtors", "Receivables ageing",  "🕐", "#f87171", "ageing receivable")

    CALL MegaMenu.menu("admin", "Admin", "⚙")
      CALL MegaMenu.category("admin.users", "Users", "Accounts & roles", "🧑", "#34d399", "")
        CALL MegaMenu.action("admin.users.list",  "User List",   "All users",    "📋", "people account")
        CALL MegaMenu.action("admin.users.roles", "Roles",       "Role groups",  "🛡", "permission group")
        CALL MegaMenu.action("admin.users.perm",  "Permissions", "Fine-grained", "🔑", "access rights")
      CALL MegaMenu.category("admin.set", "Settings", "Configuration", "⚙", "#94a3b8", "")
        CALL MegaMenu.action("admin.set.gen", "General",      "App settings",    "🔧", "config preferences")
        CALL MegaMenu.action("admin.set.loc", "Localization", "Language & TZ",   "🌐", "language locale timezone")
        CALL MegaMenu.action("admin.set.int", "Integrations", "APIs & webhooks", "🔌", "api webhook connect")
      CALL MegaMenu.category("admin.audit", "Audit Log", "Security & change history", "🗂", "#a78bfa", "audit security log history")

    -- two level-1 leaves: a single click selects them directly (1-level actions)
    CALL MegaMenu.menu("help", "Help", "❔")
    CALL MegaMenu.menu("contact", "Contact", "✉")

    RETURN MegaMenu.build()
END FUNCTION
