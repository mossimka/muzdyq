# Muzdyq developer shortcuts.
#
#   make help          list targets
#   make install       install backend + frontend dependencies
#   make dev-backend   run the API on :8000
#   make dev-frontend  run the PWA on :5173
#   make test          all automated tests
#   make lint          backend ruff + frontend eslint + typecheck
#   make up / down     Docker Compose stack

SHELL := /bin/bash
PY := backend/venv/bin
PORT ?= 8080

.DEFAULT_GOAL := help

.PHONY: help install backend-install frontend-install dev-backend dev-frontend \
        test test-backend test-frontend e2e lint lint-backend lint-frontend \
        typecheck build up down logs clean seed

help: ## Show this help
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

install: backend-install frontend-install ## Install backend and frontend dependencies

backend-install: ## Create the venv and install Python dependencies
	cd backend && python3 -m venv venv && \
		./venv/bin/pip install --upgrade pip && \
		./venv/bin/pip install -r requirements.txt -r requirements-dev.txt

frontend-install: ## Install Node dependencies from the lockfile
	cd frontend && npm ci --no-audit --no-fund

dev-backend: ## Run the API with reload on :8000
	cd backend && ./venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

dev-frontend: ## Run the Vite dev server on :5173
	cd frontend && npm run dev

test: test-backend test-frontend ## Run backend and frontend unit tests

test-backend: ## Run pytest
	cd backend && ./venv/bin/pytest -q

test-frontend: ## Run Vitest
	cd frontend && npm test

e2e: ## Run the Playwright smoke test (mocked API, no backend needed)
	cd frontend && npm run e2e

lint: lint-backend lint-frontend ## Run all linters

lint-backend: ## Ruff check
	cd backend && ./venv/bin/ruff check app tests

lint-frontend: ## ESLint + TypeScript build check
	cd frontend && npm run lint && npx tsc -b

typecheck: ## Frontend TypeScript check
	cd frontend && npx tsc -b

build: ## Production frontend build
	cd frontend && npm run build

up: ## Start the Compose stack (build if needed)
	docker compose up --build -d
	@echo "Muzdyq: http://localhost:$(PORT)"

down: ## Stop the Compose stack
	docker compose down

logs: ## Follow backend + frontend logs
	docker compose logs -f backend frontend

seed: ## Re-run idempotent seeding inside the backend container
	docker compose exec backend python -m app.seed

clean: ## Remove local build/test artefacts (keeps venv and node_modules)
	rm -rf frontend/dist frontend/test-results frontend/playwright-report \
		frontend/coverage backend/.pytest_cache backend/.ruff_cache
	find backend -type d -name __pycache__ -prune -exec rm -rf {} +
