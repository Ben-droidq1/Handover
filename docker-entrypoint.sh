#!/bin/sh
set -e

# PaaS platforms (Render, Fly, Railway) mount a persistent disk owned by root.
# The app runs as the unprivileged "node" user, so take ownership of the data
# dir and HOME once when we start as root, then drop privileges.
HOME_DIR="${HOME:-/home/node}"

if [ "$(id -u)" = "0" ]; then
  mkdir -p /data "$HOME_DIR"
  chown -R node:node /data "$HOME_DIR" 2>/dev/null || true
  if command -v setpriv >/dev/null 2>&1; then
    exec setpriv --reuid=node --regid=node --init-groups \
      env HOME="$HOME_DIR" node src/index.js
  fi
fi

exec node src/index.js
