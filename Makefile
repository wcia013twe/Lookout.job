SHELL := /bin/sh
.DEFAULT_GOAL := dev

.PHONY: help dev up services frontend live down status install muse-dev muse-dev-down muse-dev-logs

MUSE_DEV_COMPOSE = docker compose --env-file backend/runtime/.env.tunnel.local -f backend/runtime/compose.yaml -f backend/runtime/compose.muse-dev.yaml --profile muse-dev

help:
	@printf '%s\n' 'make dev       Start Docker services, then frontend at http://localhost:3000' 'make live      Preview landed local main; follows new commits automatically' 'make services  Start local Supabase services only' 'make frontend  Start frontend against running local services' 'make down      Stop services, preserving local data (Ctrl-C stops frontend)' 'make status    Show local service URLs and credentials' 'make install   Install locked root and frontend dependencies'
	@printf '%s\n' 'make muse-dev       Start Node API, worker and optional Muse development tunnel (requires local Supabase)' 'make muse-dev-down  Stop only the development tunnel' 'make muse-dev-logs  Show tunnel connection logs'

# Local Supabase must already be running. Never stop/rebind another checkout's stack.
muse-dev:
	@test -f backend/runtime/.env.tunnel.local || { echo 'Copy backend/runtime/.env.tunnel.example to backend/runtime/.env.tunnel.local and fill in your ngrok token and HTTPS URL.'; exit 1; }
	$(MUSE_DEV_COMPOSE) up -d --build api worker tunnel

muse-dev-down:
	$(MUSE_DEV_COMPOSE) stop tunnel

muse-dev-logs:
	$(MUSE_DEV_COMPOSE) logs --tail=50 tunnel

# Recursive make keeps startup ordered, including with make -j.
dev up:
	$(MAKE) services
	$(MAKE) frontend

services:
	@command -v supabase >/dev/null || { echo 'Install the Supabase CLI first.'; exit 1; }
	@docker info >/dev/null 2>&1 || { echo 'Start Docker Desktop (or another Docker engine) first.'; exit 1; }
	supabase start

live:
	node scripts/live-main.mjs

frontend:
	@if [ "$$(git branch --show-current)" = main ]; then node scripts/live-main.mjs; else node scripts/local-frontend.mjs; fi

down:
	supabase stop

status:
	supabase status

install:
	npm ci
	npm ci --prefix next-app
