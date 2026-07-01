# Makefile — megamenu
# fjs-megamenu web component + the com.fourjs.megamenu.MegaMenu BDL builder API.
#
#   make            build everything (package module + demo)   [= make all]
#   make build      compile the package module → com/fourjs/megamenu/MegaMenu.42m
#   make example    compile the demo form + program (examples/ex_megamenu.*)
#   make test       run the fglunit test suite (tests/)
#   make run        stage + compile + serve the demo under GAS (sandbox/run.sh)
#   make pack       fglpkg pack --list   (dry package listing; depends on build)
#   make publish    fglpkg publish       (to $FGLPKG_REGISTRY; needs login)
#   make env        print the fglpkg env wiring (FGLLDPATH / web-component dir)
#   make clean      remove compiled artifacts (.42m/.42f) and the sandbox app dir
#   make help       list the targets
#
# Tools resolve from $FGLDIR/bin (fglcomp/fglform/fglrun) plus fglpkg on PATH.
# Override any of them, e.g.:  make FGLCOMP=/opt/fourjs/fgl/bin/fglcomp

SHELL   := /bin/bash
ROOT    := $(patsubst %/,%,$(dir $(abspath $(lastword $(MAKEFILE_LIST)))))

FGLCOMP ?= fglcomp
FGLFORM ?= fglform
FGLPKG  ?= fglpkg

# --- the package module (the artifact fglpkg ships) ------------------------
PKG_DIR := com/fourjs/megamenu
PKG_SRC := $(PKG_DIR)/MegaMenu.4gl
PKG_MOD := $(PKG_DIR)/MegaMenu.42m

# --- the demo host (examples/) ---------------------------------------------
EX_DIR  := examples
EX_PROG := $(EX_DIR)/ex_megamenu.4gl
EX_FORM := $(EX_DIR)/ex_megamenu.per
EX_MOD  := $(EX_DIR)/ex_megamenu.42m
EX_42F  := $(EX_DIR)/ex_megamenu.42f

.DEFAULT_GOAL := all
.PHONY: all build example test run pack publish env clean help

all: build example

build: $(PKG_MOD)

example: $(EX_42F) $(EX_MOD)

# fglcomp writes the .42m into the current directory, so we cd into the package
# dir first — that drops MegaMenu.42m in com/fourjs/megamenu/, where fglpkg
# expects to find it (fglpkg.json: root = com/fourjs/megamenu, files = *.42m).
$(PKG_MOD): $(PKG_SRC)
	@echo "▶ compiling package module → $(PKG_MOD)"
	cd $(PKG_DIR) && $(FGLCOMP) -M MegaMenu.4gl

# the demo form (basename must match OPEN WINDOW … WITH FORM "ex_megamenu")
$(EX_42F): $(EX_FORM)
	@echo "▶ compiling demo form → $(EX_42F)"
	cd $(EX_DIR) && $(FGLFORM) ex_megamenu.per

# the demo program IMPORTs the package, so FGLLDPATH must see com/ under $(ROOT);
# it also depends on the built module so the import resolves at compile time.
$(EX_MOD): $(EX_PROG) $(PKG_MOD)
	@echo "▶ compiling demo program → $(EX_MOD)"
	cd $(EX_DIR) && FGLLDPATH="$(ROOT)$${FGLLDPATH:+:$$FGLLDPATH}" $(FGLCOMP) -M ex_megamenu.4gl

test:
	@echo "▶ running fglunit tests"
	bash tests/run-tests.sh

run:
	@echo "▶ staging + serving the demo under GAS"
	bash sandbox/run.sh

pack: build
	$(FGLPKG) pack --list

publish: build
	$(FGLPKG) publish

env:
	$(FGLPKG) env

clean:
	@echo "▶ removing compiled artifacts"
	rm -f $(PKG_MOD) $(EX_MOD) $(EX_42F)
	rm -f tests/*.42m
	rm -rf sandbox/app

help:
	@echo "megamenu — make targets:"
	@echo "  make build     compile the package module → $(PKG_MOD)"
	@echo "  make example   compile the demo form + program (examples/)"
	@echo "  make all       build + example   (default)"
	@echo "  make test      run the fglunit test suite"
	@echo "  make run       stage + serve the demo under GAS"
	@echo "  make pack      fglpkg pack --list (depends on build)"
	@echo "  make publish   fglpkg publish"
	@echo "  make env       print the fglpkg env wiring"
	@echo "  make clean     remove .42m/.42f artifacts + sandbox/app"
