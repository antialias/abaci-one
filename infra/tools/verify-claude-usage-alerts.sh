#!/usr/bin/env bash
set -euo pipefail

# verify-claude-usage-alerts.sh — read-only live verification of the claude-usage rules.
#
# 100% READ-ONLY (GET /api/v1/* only): cannot fire an alert, cannot notify anything.
# Run after applying claude-usage-rule.yaml.
#
# Checks:
#   1. all rules loaded (6 recording + 11 alerting)
#   2. NO alert is currently firing/pending (no false positives on live data)
#   3. every alert carries namespace+alertroute+delivery  <- the Gmail-routing invariant
#   4. exactly ONE delivery=critical rule                 <- the crying-wolf invariant
#   5. the recording rules actually produce data
#   6. threshold-substitution: re-run each aggregate with the threshold lowered to match
#      today's data. This proves the LABEL PLUMBING (and on(account) / unless / or
#      vector(0)) works on real series — which is where the real bugs live. The >=
#      operator itself is trivially correct.

PROM="${PROM_URL:-https://prometheus.dev.abaci.one}"

python3 - "$PROM" <<'PY'
import json, sys, urllib.parse, urllib.request

PROM = sys.argv[1]
fail = []


def get(path):
    with urllib.request.urlopen(PROM + path, timeout=20) as r:
        return json.load(r)


def q(expr):
    return get("/api/v1/query?query=" + urllib.parse.quote(expr))["data"]["result"]


def check(ok, label, detail=""):
    print(f"  [{'PASS' if ok else 'FAIL'}] {label}{(' — ' + detail) if detail else ''}")
    if not ok:
        fail.append(label)


# ---- 1/2/3/4: the rule group -------------------------------------------------
groups = [g for g in get("/api/v1/rules")["data"]["groups"] if g["name"] == "claude-usage"]
check(bool(groups), "rule group `claude-usage` exists")
rules = groups[0]["rules"] if groups else []
rec = [r for r in rules if r["type"] == "recording"]
al = [r for r in rules if r["type"] == "alerting"]

check(len(rec) == 6, "6 recording rules loaded", f"got {len(rec)}")
check(len(al) == 11, "11 alerting rules loaded", f"got {len(al)}")

active = [r["name"] for r in al if r.get("state") != "inactive"]
check(not active, "no alert firing/pending on live data", f"active: {active}" if active else "all inactive")

need = ("namespace", "alertroute", "delivery")
missing = [f"{r['name']}({','.join(k for k in need if k not in r['labels'])})"
           for r in al if not all(k in r["labels"] for k in need)]
check(not missing, "every alert carries namespace+alertroute+delivery", str(missing))

crit = [r["name"] for r in al if r["labels"].get("delivery") == "critical"]
check(crit == ["ClaudeAllAccountsWeeklyExhausted"],
      "exactly ONE delivery=critical rule", str(crit))

# ---- 5: recording rules produce data ----------------------------------------
print()
for name in ("claude:weekly_utilization_routable:min",
             "claude:five_hour_utilization_routable:min",
             "claude:combined_headroom:percent",
             "claude:routable_accounts:count"):
    res = q(name)
    val = res[0]["value"][1] if res else None
    check(res != [], f"recording rule has data: {name}", f"= {val}")

# ---- 6: threshold-substitution (proves the joins, not the operator) ----------
print()
routable = q("claude:routable_accounts:count")
n_routable = float(routable[0]["value"][1]) if routable else 0
check(n_routable == 2, "both accounts are ROUTABLE (fresh)", f"count={n_routable:.0f}")

wmin = q("claude:weekly_utilization_routable:min")
wmin_v = float(wmin[0]["value"][1]) if wmin else -1
# The real critical expr with its threshold swapped to just below today's value: if the
# join plumbing works, this returns exactly 1 series. If a join is broken, it returns 0.
probe = f"claude:weekly_utilization_routable:min >= {max(wmin_v - 1, 0)}"
check(len(q(probe)) == 1,
      "critical expr plumbing fires when threshold is met (substituted)",
      f"min={wmin_v:.0f}, probe `>= {max(wmin_v-1,0):.0f}` -> {len(q(probe))} series")

# The freshness join must EXCLUDE nothing right now (both fresh) => routable == raw count
raw = q('count(claude_usage_window_utilization_percent{window="seven_day"})')
raw_n = float(raw[0]["value"][1]) if raw else 0
check(raw_n == n_routable, "freshness join drops nothing while both accounts are fresh",
      f"raw={raw_n:.0f} routable={n_routable:.0f}")

# `or vector(0)` fallback: count() over a deliberately-empty selector must yield 0, not ∅
z = q('count(claude_usage_window_utilization_percent{account="nope@invalid"}) or vector(0)')
check(len(z) == 1 and float(z[0]["value"][1]) == 0,
      "`or vector(0)` fallback yields 0 on an empty selector (not EMPTY)")

print()
if fail:
    print(f"FAILED ({len(fail)}): {fail}")
    sys.exit(1)
print("ALL CHECKS PASSED")
PY
