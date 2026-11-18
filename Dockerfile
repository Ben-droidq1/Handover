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
    KANE_CLI_CHROME_PATH=/usr/bin/google-chrome-stable

# Chrome and its shared libraries. Kane drives a real Chrome, so the image
# needs the browser, not just the CLI.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates wget gnupg \
      fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 libcups2 libdbus-1-3 \
      libdrm2 libgbm1 libgtk-3-0 libnspr4 libnss3 libx11-xcb1 libxcomposite1 libxdamage1 \
      libxfixes3 libxkbcommon0 libxrandr2 xdg-utils \
    && wget -q -O /tmp/chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
    && apt-get install -y /tmp/chrome.deb \
    && rm -f /tmp/chrome.deb \
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

CMD ["node", "src/index.js"]
