#!/usr/bin/env bash
#
# Take a consistent copy of the production database before a risky change.
#
# Usage:
#   ./scripts/prod-dump.sh                 # → /var/lib/sqld/pre-change-<UTC time>.sql
#   ./scripts/prod-dump.sh pre-phase7      # → /var/lib/sqld/pre-phase7.sql
#
# libsql-server refuses `VACUUM INTO` ("unsupported statement"), so this takes
# the server's SQL dump (GET /dump, one read transaction, so a consistent
# snapshot while the app keeps running) through an app pod and writes it onto
# the database server's own volume. Nothing is written to the database itself,
# and the dump streams through this machine without being stored here.
# A 159 MB database dumped in about 4 minutes (153 MB of SQL, 2026-11-27).
#
# The copy protects against a bad change, not against losing that disk.
# Restore: build a database from the dump (`sqlite3 new.db < dump.sql`), then
# swap it in with the libsql deployment scaled to 0.

set -euo pipefail

NS=abaci
NAME="${1:-pre-change-$(date -u +%Y%m%d-%H%M%S)}"
OUT="/var/lib/sqld/${NAME}.sql"

APP=$(kubectl get pods -n "$NS" -l app=abaci-app --field-selector=status.phase=Running -o jsonpath='{.items[0].metadata.name}')
DB=$(kubectl get pods -n "$NS" -l app=libsql --field-selector=status.phase=Running -o jsonpath='{.items[0].metadata.name}')
if [ -z "$APP" ] || [ -z "$DB" ]; then
  echo "Error: need a running abaci-app pod and a running libsql pod" >&2
  exit 1
fi
if kubectl exec -n "$NS" "$DB" -- test -e "$OUT"; then
  echo "Error: $OUT already exists on the database volume; pick another name" >&2
  exit 1
fi
echo "app pod: $APP   database pod: $DB   → $OUT"

if ! kubectl exec -n "$NS" -c app "$APP" -- node -e '
const { Readable } = require("stream");
fetch("http://libsql.abaci.svc.cluster.local:8080/dump")
  .then((r) => {
    if (!r.ok) { console.error("dump refused: HTTP " + r.status); process.exit(1) }
    Readable.fromWeb(r.body).pipe(process.stdout)
  })
  .catch((e) => { console.error("dump failed: " + e.message); process.exit(1) })
' | kubectl exec -i -n "$NS" "$DB" -- sh -c "cat > $OUT"; then
  echo "FAILED: removing the partial file" >&2
  kubectl exec -n "$NS" "$DB" -- rm -f "$OUT"
  exit 1
fi

# A finished dump starts with PRAGMA foreign_keys=OFF; and ends with COMMIT;
kubectl exec -n "$NS" "$DB" -- sh -c "ls -la $OUT; echo '--- first line:'; head -n 1 $OUT; echo '--- last line:'; tail -n 1 $OUT; echo '--- tables:'; grep -c '^CREATE TABLE' $OUT; df -h /var/lib/sqld | tail -1"
