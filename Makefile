# GapWise hi-fi prototype: run `make help` for targets.
# Works with GNU make 3.81+ (macOS default). Recipes are tab-indented.
# Scripts under scripts/ are created by Claude Code while following BUILD.md;
# targets that need them say which phase creates them.

SHELL := /bin/bash
PORT ?= 3000
PNPM := pnpm
NODE_MAJOR := 22
ONLY ?= all          # geodata: all | places | walking
BASE_PATH ?= /

.DEFAULT_GOAL := help
.PHONY: help setup dev typecheck test e2e check sections-check figma-check push geodata places-check figures build preview dist clean

help: ## List targets
	@grep -E '^[a-z0-9-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  \033[1m%-14s\033[0m %s\n", $$1, $$2}'

setup: ## Check Node, install deps, ensure a Chromium for Playwright
	@node -e 'const m=+process.versions.node.split(".")[0]; if(m<$(NODE_MAJOR)){console.error("Need Node $(NODE_MAJOR)+, found "+process.versions.node+" (try: mise install)");process.exit(1)}'
	@command -v $(PNPM) >/dev/null || corepack enable
	$(PNPM) install
	@if [ ! -x /usr/bin/chromium ]; then $(PNPM) exec playwright install chromium; fi

dev: ## Start the dev server on PORT (default 3000)
	PORT=$(PORT) $(PNPM) dev

typecheck: ## TypeScript check, no emit
	$(PNPM) typecheck

test: ## Unit tests (logic, state, personas)
	$(PNPM) test

e2e: ## Playwright desktop + mobile (starts its own preview server; see BUILD.md Phase 1)
	$(PNPM) build
	PORT=$(PORT) $(PNPM) test:e2e

check: typecheck test e2e ## Everything that must be green before a checkpoint

sections-check: ## Verify docs/tulane-sections.csv is fully filled in (BUILD.md 4.0)
	@awk -F',' 'NR>1 && NF>0 { for (i=5;i<=11;i++) if ($$i=="") { printf "row %d (%s %s): missing %s\n", NR, $$1, $$3, h[i]; bad=1 } } NR==1 { for (i=1;i<=NF;i++) h[i]=$$i } END { if (bad) exit 1; print "tulane-sections.csv complete" }' docs/tulane-sections.csv

figma-check: ## Confirm the Figma config the build depends on is intact, then build
	@test -f .figma/make/site.json || { echo "Missing .figma/make/site.json: restore it from the low-fi zip"; exit 1; }
	@grep -q figmaSiteConfiguration vite.config.ts || { echo "Figma plugins were removed from vite.config.ts"; exit 1; }
	@grep -q FIGMA_PUBLIC_URL vite.config.ts || { echo "vite.config.ts no longer reads FIGMA_PUBLIC_URL"; exit 1; }
	$(PNPM) build
	@echo "Build OK. Next: make push (Vercel redeploys from GitHub)."

push: figma-check typecheck test ## Typecheck + unit tests, then commit and push to GitHub; Vercel redeploys (MSG="...")
	@git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "Not a git repo. Run: git init && git remote add origin <repo-url>"; exit 1; }
	@git remote get-url origin >/dev/null 2>&1 || { echo "No 'origin' remote. Add your GitHub repo: git remote add origin <url>"; exit 1; }
	git add -A
	git commit -m "$(or $(MSG),GapWise hi-fi update)" || echo "Nothing new to commit"
	git push -u origin HEAD

geodata: ## Geocode places + fetch walking times/routes into src/gw/data (ONLY=all|places|walking)
	@test -f scripts/geodata.mjs || { echo "scripts/geodata.mjs not found: it is created in BUILD.md Phase 2"; exit 1; }
	node scripts/geodata.mjs --only=$(strip $(ONLY))

places-check: ## Screenshot of every place pin for Davis to verify -> docs/places-check.png
	@test -f scripts/places-check.mjs || { echo "scripts/places-check.mjs not found: it is created in BUILD.md Phase 2"; exit 1; }
	$(PNPM) build
	node scripts/places-check.mjs --port=$(PORT)

figures: ## Report figures from deep links -> docs/figures/*.png (BUILD.md Phase 8)
	@test -f scripts/figures.mjs || { echo "scripts/figures.mjs not found: it is created in BUILD.md Phase 8"; exit 1; }
	$(PNPM) build
	node scripts/figures.mjs --port=$(PORT)

build: ## Production build to dist/ (BASE_PATH=/repo/ for GitHub Pages)
	BASE_PATH=$(BASE_PATH) $(PNPM) build

preview: build ## Serve the production build on PORT
	PORT=$(PORT) $(PNPM) preview

dist: build ## Zip dist/ for drag-and-drop hosting (e.g. Netlify Drop)
	@rm -f gapwise-dist.zip
	cd dist && zip -qr ../gapwise-dist.zip .
	@echo "Wrote gapwise-dist.zip"

clean: ## Remove build output, test artifacts and generated figures
	rm -rf dist gapwise-dist.zip test-results playwright-report docs/figures docs/places-check.png
