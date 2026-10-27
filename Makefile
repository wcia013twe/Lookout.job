SHELL := /bin/sh
.DEFAULT_GOAL := dev

.PHONY: help dev up services frontend live down status install

help:
	@printf '%s\n' 'make dev       Start Docker services, then frontend at http://localhost:3000' 'make live      Preview landed local main; follows new commits automatically' 'make services  Start local Supabase services only' 'make frontend  Start frontend against running local services' 'make down      Stop services, preserving local data (Ctrl-C stops frontend)' 'make status    Show local service URLs and credentials' 'make install   Install locked root and frontend dependencies'

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
	node scripts/local-frontend.mjs

down:
	supabase stop

status:
	supabase status

install:
	npm ci
	npm ci --prefix next-app
