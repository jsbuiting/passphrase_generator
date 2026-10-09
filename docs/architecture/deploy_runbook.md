# Deploy Runbook — passphrase.buiting.uk

## Architecture
```
Browser -> Cloudflare edge (TLS) -> cloudflared on the Pi (outbound tunnel)
        -> 127.0.0.1:8006 -> nginx-unprivileged container (:8080) -> static files
```
- Pi has zero inbound ports; the container port is bound to loopback only.
- Updates: push to `main` -> Actions builds arm64 -> `ghcr.io/jsbuiting/passphrase_generator:latest` -> Watchtower (300 s poll) recreates the container.
- Port 8006 on loopback; check it is free with `ss -tlnp` before the first deploy.

## One-time Pi setup
Uses an existing Cloudflare Tunnel; `<TUNNEL_UUID>` below is its ID (`cloudflared tunnel list`).

1. App directory and compose file:
   ```bash
   mkdir -p ~/apps/passphrase-generator && cd ~/apps/passphrase-generator
   # copy compose.yaml from this repo (scp or paste)
   ```
2. GHCR access. Either make the package public (GitHub -> Packages -> passphrase_generator -> Package settings -> Change visibility), which needs no login since the image contains nothing secret, or log in once on the host with a `read:packages` token and give Watchtower the same Docker credentials.
3. Start: `docker compose pull && docker compose up -d`, then `curl -i http://127.0.0.1:8006/healthz` and `docker ps` (should become `healthy`).
4. Cloudflare ingress. Back up, then edit:
   ```bash
   sudo cp /etc/cloudflared/config.yml /etc/cloudflared/config.yml.bak-$(date +%F)
   sudo nano /etc/cloudflared/config.yml
   ```
   Add before the catch-all `http_status:404` rule:
   ```yaml
     - hostname: passphrase.buiting.uk
       service: http://127.0.0.1:8006
   ```
5. DNS and restart:
   ```bash
   cloudflared tunnel route dns <TUNNEL_UUID> passphrase.buiting.uk
   sudo systemctl restart cloudflared && systemctl status cloudflared --no-pager
   ```
6. Verify from outside: `curl -I https://passphrase.buiting.uk` (check CSP and other headers).
7. Monitoring (optional): point an uptime monitor at `https://passphrase.buiting.uk/healthz`.

## Rollback
- Bad release: the `:latest` tag is overwritten each push, so roll forward by reverting the commit on `main` (CI rebuilds, Watchtower redeploys). For an immediate stop-gap, pin a previous digest on the Pi: set `image: ghcr.io/jsbuiting/passphrase_generator@sha256:<old>` in `compose.yaml` (find digests under the GitHub package's versions), `docker compose up -d`, and stop Watchtower from touching it with label `com.centurylinklabs.watchtower.enable=false` if needed.
- Tunnel change: `sudo cp /etc/cloudflared/config.yml.bak-<date> /etc/cloudflared/config.yml && sudo systemctl restart cloudflared`.
- Full removal: `docker compose down`, remove the ingress rule and the DNS record in Cloudflare, delete the uptime monitor.
