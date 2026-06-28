.PHONY: install dev test test-server test-client lint help

## Install all dependencies (frontend + backend)
install:
	npm install
	cd server && npm install

## Start both dev servers concurrently (requires two terminals, or use dev-bg)
dev:
	@echo "Starting backend on :3001 and frontend on :5173"
	@echo "Run each in its own terminal, or use: make dev-bg"
	@echo ""
	@echo "  Terminal 1:  node server/index.js"
	@echo "  Terminal 2:  npm run dev"

## Start backend in the background, then start the Vite dev server in the foreground
dev-bg:
	@node server/index.js & echo $$! > .server.pid
	@echo "Backend started (PID $$(cat .server.pid)). Starting frontend..."
	npm run dev
	@kill $$(cat .server.pid) 2>/dev/null || true; rm -f .server.pid

## Run all tests (server unit/integration + frontend unit)
test: test-server test-client

## Run server tests (Jest + supertest)
test-server:
	cd server && npm test

## Run frontend tests (Vitest)
test-client:
	npm test

## Lint the frontend source
lint:
	npm run lint

## Record a fresh demo video (requires both dev servers running)
demo:
	node scripts/record-demo.js

## Build the frontend for production
build:
	npm run build

help:
	@echo ""
	@echo "  make install    — install all deps (frontend + backend)"
	@echo "  make dev        — print dev server instructions"
	@echo "  make dev-bg     — start backend in background, frontend in foreground"
	@echo "  make test       — run all tests"
	@echo "  make test-server — run server tests only (Jest)"
	@echo "  make test-client — run frontend tests only (Vitest)"
	@echo "  make demo       — record demo.webm (servers must be running)"
	@echo "  make build      — production build"
	@echo "  make lint       — ESLint"
	@echo ""
