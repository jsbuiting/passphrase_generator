# Agent Instructions — `passphrase_generator`

## What it is
A static, client-side passphrase generator (HTML/CSS/JS + word lists in `data/`). All generation happens in the browser using `crypto.getRandomValues`. **There is no server-side code and no server-side data**: nginx only serves files. Never add analytics, logging of generated values, or network calls from `js/`.

## Conventions
- Served set: `index.html`, `css/`, `js/`, `data/`, `fonts/`, `favicon.svg`. Nothing else is copied into the image (explicit `COPY`s in `Dockerfile`).
- Tests and lint: `npm ci && npm test && npm run lint` (ESLint, config in `eslint.config.js`). CI runs both.
- CSS: Tailwind is compiled, not loaded from a CDN. `css/tailwind.css` is committed; run `npm run build:css` after touching classes. CI fails if it is stale.
- Security headers + CSP live in `security-headers.conf` (marked CSP line). If the app needs a new source (e.g. inline style), change it there deliberately.
- Git: commit locally; push at coherent checkpoints.

## Deploy flow
push to `main` -> GitHub Actions (test, then arm64 build) -> `ghcr.io/jsbuiting/passphrase_generator:latest` -> Watchtower on the Pi (polls every 300 s) -> container `passphrase-generator`, bound to `127.0.0.1:8006` -> `cloudflared` -> `https://passphrase.buiting.uk`.

Pi-side setup and rollback: [`docs/architecture/deploy_runbook.md`](docs/architecture/deploy_runbook.md).

## Layout
- `nginx.conf`, `security-headers.conf`, `Dockerfile`, `.dockerignore`, `compose.yaml`, `.github/workflows/build.yml` — deploy pipeline.
- `docs/architecture/` — runbook.
- `CHANGELOG.md` — update under `[Unreleased]` when work ships.
