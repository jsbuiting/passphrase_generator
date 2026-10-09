# Changelog — `passphrase_generator`

## [Unreleased]

### Added
- Production deploy pipeline `Dockerfile` (nginx-unprivileged, non-root, `/healthz` healthcheck), `nginx.conf` + `security-headers.conf` (gzip, caching, strict CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy), `compose.yaml` (read-only, cap_drop ALL, 32 MB, `127.0.0.1:8006`), and `.github/workflows/build.yml` (tests + stale-`tailwind.css` check, arm64 build to GHCR).
- `docs/architecture/deploy_runbook.md`: Pi setup, Cloudflare Tunnel ingress, monitoring, rollback.
- `AGENTS.md`, `README.md`.
- `LICENSE` (MIT) and `SECURITY.md`.
- ESLint (`npm run lint`), run in CI before the tests.
- Tests for word-list parsing, cross-list de-duplication, clipboard copy results and the shipped word lists.

### Changed
- All parts are enabled by default. A visitor's on/off choices for parts and word lists are remembered in `localStorage` (only the choices, never a passphrase).
- Part labels and word-list panes are buttons, so they can be toggled from the keyboard; the passphrase field and copy button have accessible names; visible keyboard focus.
- Supply chain: GitHub Actions pinned to commit SHAs, base image pinned by digest, Dependabot for actions, Docker and npm; CI on Node 24; workflow token read-only by default.
- Security Analysis: the headline strength is now the passphrase-aware estimate (bits computed from the generator's real distributions, about 63 bits with all parts on). Edits to the field are shown as a range (up to ~11 bits per random change) or as "cannot be estimated" when the text is mostly your own. The character-based figure is kept as Scenario 2, labelled as a ceiling. Removed the "quantum-era" claim.
- Deploy docs no longer contain host-specific details (tunnel ID, paths, other services).
- Copy button uses the Clipboard API (falls back to `execCommand`).
- The passphrase field is editable again; the strength report updates as you type.
- Words that appear in both the English and Dutch list are sampled once instead of twice; the total word count reflects that.
- Removed profanity, slurs and sexual terms from both word lists (63 English, 45 Dutch entries).
- The page is interactive while the word lists load; Generate and Copy are enabled once they are in.
- nginx no longer writes an access log.

### Fixed
- A failed or malformed word-list load no longer produces a passphrase built from the placeholder word "word"; the page shows an error and generation stays disabled. At least one word list must stay selected.
- Resizing the window (or opening a mobile keyboard) no longer overwrites edits in the passphrase field.
- The copy button reports failure when nothing was copied, and does not report success for an empty field.
- Saving the part order no longer throws when browser storage is blocked.

### Removed
- `docs/archive/2026-09_pi_deployment_plan.md` (superseded native nginx/systemd plan).
