# ---- frontend build -------------------------------------------------------
FROM node:22-bookworm-slim AS frontend

WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY frontend/ ./
RUN npm run build


# ---- runtime --------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=3001 \
    DATA_DIR=/data \
    KANE_CLI_CHROME_PATH=/usr/bin/chromium

# Browser for Kane. Kane drives a real browser, so the image needs one, not just
# the CLI. Debian's chromium comes from the same apt mirror as everything else,
# which keeps the build reproducible; the Google-hosted .deb is flaky on some
# networks (TLS to dl.google.com gets reset).
RUN apt-get update -o Acquire::Retries=3 && apt-get install -y --no-install-recommends -o Acquire::Retries=3 \
      chromium ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g @testmuai/kane-cli@0.10.5 --no-audit --no-fund

WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY backend/src ./src
COPY backend/demo-site ./demo-site
COPY --from=frontend --chown=node:node /build/frontend/dist /frontend/dist

RUN mkdir -p /data && chown -R node:node /data /app
USER node
ENV HOME=/home/node

VOLUME ["/data"]
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health').then(r=>process.exit(r.status===200?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/index.js"]
