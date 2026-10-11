# Pinned by digest so a moved tag cannot change the image; Dependabot proposes updates.
FROM nginxinc/nginx-unprivileged:1.31-alpine@sha256:b9241c6e7b8e9a862f129d8d4199ab64b10390949a78bdd5603379b32c844083

# Static site only; no build step in the image (css/tailwind.css is committed
# and CI fails if it is stale). Explicit COPYs = only the served set ships.
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY security-headers.conf /etc/nginx/security-headers.conf

COPY index.html favicon.svg /usr/share/nginx/html/
COPY css/ /usr/share/nginx/html/css/
COPY js/ /usr/share/nginx/html/js/
COPY data/ /usr/share/nginx/html/data/
COPY fonts/ /usr/share/nginx/html/fonts/

# Cache-bust: stamp css/ and js/ links in index.html (never cached) with a hash
# of their contents, so a deploy can't pair new HTML with old cached scripts.
USER root
RUN cd /usr/share/nginx/html \
 && v=$(cat css/*.css js/*.js | sha256sum | cut -c1-12) \
 && sed -i -E "s#(href|src)=\"((css|js)/[^\"?]+)\"#\1=\"\2?v=$v\"#g" index.html \
 && test "$(grep -c "?v=$v" index.html)" -eq 4

# Base image already runs as uid 101 (nginx); stated explicitly for auditors.
USER 101
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
