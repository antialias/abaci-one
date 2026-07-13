#!/usr/bin/env bash
set -euo pipefail

# claude-usage-rule-test.sh — promtool unit tests for the claude-usage PrometheusRule.
#
# promtool can't eat a PrometheusRule CR, so we strip `.spec` into a bare rule-group
# file, drop it next to the test file, and run `promtool test rules` in a container.
#
# 100% OFFLINE: promtool never talks to Prometheus or Alertmanager, so this cannot
# notify anything. Run it until green BEFORE applying the rule to the cluster.
#
# Usage: infra/tools/claude-usage-rule-test.sh

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FILES="$HERE/../terraform/files"
IMAGE="${PROMTOOL_IMAGE:-prom/prometheus:v2.53.0}"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# macOS system python is PEP-668 "externally managed", so we cache a tiny venv for
# PyYAML rather than touching the host interpreter.
VENV="${TMPDIR:-/tmp}/claude-usage-promtool-venv"
if ! "$VENV/bin/python" -c 'import yaml' >/dev/null 2>&1; then
  echo "==> bootstrapping venv for PyYAML ($VENV)"
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install --quiet pyyaml
fi
PY_BIN="$VENV/bin/python"

echo "==> strip PrometheusRule .spec -> bare rule group"
"$PY_BIN" - "$FILES/claude-usage-rule.yaml" "$TMP/claude-usage-rule.rules.yaml" <<'PY'
import sys, yaml
cr = yaml.safe_load(open(sys.argv[1]))
assert cr["kind"] == "PrometheusRule", "not a PrometheusRule"
spec = cr["spec"]

# Guard the invariant that the whole delivery chain depends on: aggregates built with
# min()/count() drop every label, and the Alertmanager route matches namespace=
# "monitoring". A rule missing it is silently EMAILED instead of paging. Fail loudly.
missing = []
for g in spec["groups"]:
    for r in g["rules"]:
        if "alert" not in r:
            continue  # recording rule
        for req in ("namespace", "alertroute", "delivery"):
            if req not in (r.get("labels") or {}):
                missing.append(f"{r['alert']}: missing label `{req}`")
if missing:
    print("FATAL — routing-label invariant violated:", file=sys.stderr)
    for m in missing:
        print("  " + m, file=sys.stderr)
    sys.exit(1)

yaml.safe_dump(spec, open(sys.argv[2], "w"), sort_keys=False, allow_unicode=True)
n_alert = sum(1 for g in spec["groups"] for r in g["rules"] if "alert" in r)
n_rec = sum(1 for g in spec["groups"] for r in g["rules"] if "record" in r)
print(f"  ok: {n_rec} recording rules, {n_alert} alerts — all carry namespace/alertroute/delivery")
PY

cp "$FILES/claude-usage-rule_test.yaml" "$TMP/"

echo "==> promtool check rules"
docker run --rm -v "$TMP:/w" --entrypoint promtool "$IMAGE" check rules /w/claude-usage-rule.rules.yaml

echo "==> promtool test rules"
docker run --rm -v "$TMP:/w" --entrypoint promtool "$IMAGE" test rules /w/claude-usage-rule_test.yaml
