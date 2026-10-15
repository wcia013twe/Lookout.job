# Static reference frontend

This directory contains the pre-React frontend, its presentation controllers, styles and vendored assets. Production is built from `../next-app/`; this directory is excluded from that export.

Retain these files while regression tests still exercise them. Shared live state and domain rules live in `../lib/`, and imports point to those canonical modules. New product UI belongs in `../next-app/`.

`npm run build:auth` rebuilds the reference authentication bundle here. Serve the repository root when inspecting `legacy/index.html` so its shared models and public catalog remain reachable.
