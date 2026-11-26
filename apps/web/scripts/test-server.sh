#!/usr/bin/env bash
# Light production test server for local e2e and manual checks.
#
#   scripts/test-server.sh run     build if needed, then run the server in the foreground
#   scripts/test-server.sh start   build if needed, then run it in the background (waits for the port)
#   scripts/test-server.sh stop    stop a server started with `start`
#   scripts/test-server.sh build   build if needed, nothing else
#
# PORT (default 3002) picks the port; 3000 is refused (the owner's dev server).
# FORCE_BUILD=1 rebuilds even when the stamp matches. BUILD_HEAP_MB sets the build heap.
#
# Why not `pnpm dev`: the dev server peaks near 10 GB with a watcher and 25-36 s
# first compiles; this production server sits around 125-170 MB and serves pages
# in well under a second. The build (~6.7 GB peak, ~5-8 min) runs only when the
# app's content changed.
set -euo pipefail

cd "$(dirname "$0")/.."
WEB_DIR=$(pwd)
PORT=${PORT:-3002}
STAMP=.next/test-server.stamp
PIDFILE=.next/test-server.pid
LOGFILE=.next/test-server.log

if [ "$PORT" = 3000 ]; then
  echo "test-server: port 3000 belongs to the owner's dev server; pick another PORT" >&2
  exit 2
fi

# Content fingerprint: the git tree of the working copy as it stands (tracked
# changes and untracked, non-ignored files included), written through a scratch
# index. It names content, not history, so committing doesn't force a rebuild.
fingerprint() {
  local idx root
  root=$(git rev-parse --show-toplevel)
  idx=$(mktemp "${TMPDIR:-/tmp}/test-server-index.XXXXXX")
  cp "$(git rev-parse --path-format=absolute --git-path index)" "$idx"
  GIT_INDEX_FILE="$idx" git -C "$root" add -A
  # Files the app build never reads: e2e specs, the screenshots the smoke specs
  # rewrite, and unit tests. Left in, running or editing a test would force a rebuild.
  GIT_INDEX_FILE="$idx" git -C "$root" rm -r -q --cached --ignore-unmatch -- \
    apps/web/e2e apps/web/screenshots ':(glob)**/*.test.ts' ':(glob)**/*.test.tsx' >/dev/null
  GIT_INDEX_FILE="$idx" git -C "$root" write-tree
  rm -f "$idx"
}

build() {
  local want
  want=$(fingerprint)
  if [ -z "${FORCE_BUILD:-}" ] && [ -f "$STAMP" ] && [ -f .next/BUILD_ID ] && [ "$(cat "$STAMP")" = "$want" ]; then
    echo "test-server: build is current ($want), skipping"
    return 0
  fi
  echo "test-server: building ($want)"
  rm -f "$STAMP"

  # Workspace packages the app imports (turbo caches these; cheap when unchanged).
  (cd ../.. && pnpm turbo build --filter='@soroban/web^...')

  # NEXT_LIGHT_BUILD: see next.config.js. 6 GB of heap compiles this app (Node's
  # ~4 GB default runs out); the heap bounds the footprint, so no larger.
  NEXT_LIGHT_BUILD=1 NODE_OPTIONS="--max-old-space-size=${BUILD_HEAP_MB:-6144}" npm run build
  echo "$want" > "$STAMP"
}

# Production mode; Auth.js rejects localhost (UntrustedHost) without AUTH_TRUST_HOST.
serve_env() { export NODE_ENV=production AUTH_TRUST_HOST=true PORT; }

port_open() { nc -z localhost "$PORT" 2>/dev/null; }

case "${1:-run}" in
  build) build ;;
  run)
    build
    serve_env
    exec node server.js
    ;;
  start)
    if port_open; then
      echo "test-server: something already listens on :$PORT" >&2
      exit 1
    fi
    build
    serve_env
    nohup node server.js > "$LOGFILE" 2>&1 &
    echo $! > "$PIDFILE"
    # Bounded wait for the port (migrations run first): up to 120 s.
    for _ in $(seq 1 240); do
      if port_open; then
        echo "test-server: up on http://localhost:$PORT (pid $(cat "$PIDFILE"), log $WEB_DIR/$LOGFILE)"
        exit 0
      fi
      kill -0 "$(cat "$PIDFILE")" 2>/dev/null || { echo "test-server: server exited; see $LOGFILE" >&2; exit 1; }
      sleep 0.5
    done
    echo "test-server: no answer on :$PORT after 120 s; see $LOGFILE" >&2
    exit 1
    ;;
  stop)
    if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
      kill "$(cat "$PIDFILE")"
      rm -f "$PIDFILE"
      echo "test-server: stopped"
    else
      rm -f "$PIDFILE"
      echo "test-server: not running"
    fi
    ;;
  *)
    echo "usage: $0 {run|start|stop|build}" >&2
    exit 2
    ;;
esac
