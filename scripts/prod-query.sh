#!/usr/bin/env bash
#
# Query the production libsql database from a running app pod.
#
# Usage:
#   ./scripts/prod-query.sh "SELECT id, email FROM users LIMIT 5"
#   ./scripts/prod-query.sh "SELECT * FROM players WHERE id = 'abc123'"
#
# Finds a running abaci-app pod, execs a Node.js script that hits the
# libsql HTTP API, and formats the result as a table.

set -euo pipefail

if [ $# -eq 0 ]; then
  echo "Usage: $0 \"SQL query\"" >&2
  exit 1
fi

SQL="$1"

# Find a running pod
POD=$(kubectl get pods -n abaci -l app=abaci-app -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
if [ -z "$POD" ]; then
  echo "Error: no running abaci-app pod found" >&2
  exit 1
fi

# Node script that queries libsql and formats output as a table
read -r -d '' NODE_SCRIPT << 'NODESCRIPT' || true
const sql = process.argv[1];
fetch('http://libsql.abaci.svc.cluster.local:8080/v2/pipeline', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ requests: [{ type: 'execute', stmt: { sql } }] })
})
.then(r => r.json())
.then(data => {
  const res = data.results[0];
  if (res.type === 'error') {
    console.error('SQL Error:', res.error.message);
    process.exit(1);
  }
  const { cols, rows } = res.response.result;
  if (rows.length === 0) {
    console.log('(0 rows)');
    return;
  }
  const headers = cols.map(c => c.name);
  const values = rows.map(row => row.map(cell => cell.type === 'null' ? 'NULL' : String(cell.value)));
  const widths = headers.map((h, i) => Math.max(h.length, ...values.map(r => r[i].length)));
  const pad = (s, w) => s + ' '.repeat(w - s.length);
  console.log(headers.map((h, i) => pad(h, widths[i])).join(' | '));
  console.log(widths.map(w => '-'.repeat(w)).join('-+-'));
  values.forEach(row => console.log(row.map((v, i) => pad(v, widths[i])).join(' | ')));
  console.log(`\n(${rows.length} row${rows.length === 1 ? '' : 's'})`);
})
.catch(err => { console.error('Fetch error:', err.message); process.exit(1); });
NODESCRIPT

kubectl exec -n abaci "$POD" -- node -e "$NODE_SCRIPT" -- "$SQL"
