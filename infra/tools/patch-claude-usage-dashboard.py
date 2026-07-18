#!/usr/bin/env python3
"""Add the switchover row to the claude-usage Grafana dashboard.

Rewrites infra/terraform/files/claude-usage-dashboard.json IN PLACE. Terraform
applies it from that file (filemd5 trigger -> kubectl create configmap), so the
file is the source of truth; do not hand-edit the live ConfigMap.

WHY a script instead of just editing the JSON: the dashboard is 18KB of
generated-looking Grafana schema and the edit is a *layout* change (every existing
panel shifts down). Doing that by hand is how you get overlapping panels.

IDEMPOTENT — running it twice produces byte-identical output:
  * our panels (ids in OURS) are stripped first, then re-added
  * y is renormalised so the smallest surviving panel sits at 0 BEFORE we shift,
    so repeated runs don't cumulatively push the old panels down the page
  * VERSION is a constant, not an increment (an increment would change the file's
    md5 on every run and make terraform think it drifted)

Usage: infra/tools/patch-claude-usage-dashboard.py [--check]
  --check  exit 1 if the file would change (for CI / pre-commit); writes nothing.
"""
import json
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
DASH = HERE / ".." / "terraform" / "files" / "claude-usage-dashboard.json"

DS = {"type": "prometheus", "uid": "prometheus"}
OURS = {101, 103, 105, 107, 109, 201, 203, 205, 207, 209, 211, 213, 215}  # panel ids this script owns
SWITCH_ROW_H = 9                         # height of the switchover row we prepend (5 + 4)
PROVIDER_ROW_H = 17                      # height of the provider quota row (8 + 4 + 5)
ANN = "Account switchover"
VERSION = 3
TITLE = "Claude Code Usage — quota, burn & switchover"


def tgt(expr, legend="{{account}}", instant=True, ref="A"):
    return {"datasource": DS, "expr": expr, "legendFormat": legend,
            "refId": ref, "instant": instant, "range": not instant}


def steps(*pairs):
    return {"mode": "absolute",
            "steps": [{"value": v, "color": c} for v, c in pairs]}


def timeseries_options():
    return {
        "legend": {"displayMode": "list", "placement": "bottom", "showLegend": True,
                   "calcs": ["lastNotNull"]},
        "tooltip": {"mode": "multi", "sort": "desc"},
    }


def ts_field_config(unit="percent", min_val=0, max_val=100):
    return {
        "defaults": {
            "unit": unit, "min": min_val, "max": max_val, "decimals": 0,
            "custom": {"lineWidth": 2, "fillOpacity": 0, "showPoints": "never",
                       "spanNulls": True},
            "color": {"mode": "palette-classic"},
        },
        "overrides": [],
    }


# --- the switchover row -------------------------------------------------------
# The mental model this row encodes: with auto-switchover, ONE hot account is a
# non-event (the proxy just routes around it). The number that actually predicts
# "Claude stops working" is the headroom on the BEST account. So that is the hero
# stat, and the old per-account gauges get demoted below it.
PANELS = [
    {
        "id": 101, "type": "stat", "title": "Weekly headroom (best account)",
        "description": (
            "100 − min(7-day utilization) across all *routable* accounts "
            "(`claude:combined_headroom:percent`). This is the real runway: the "
            "switch-proxy routes to whichever account is coolest, so Claude only "
            "dies when THIS hits zero. Accounts with stale data (dead token) are "
            "excluded — a stale account's last-good number is a lie and would "
            "otherwise make this look healthy while the live account burns down."
        ),
        "datasource": DS, "gridPos": {"x": 0, "y": 0, "w": 6, "h": 5},
        "targets": [tgt("claude:combined_headroom:percent", "headroom")],
        "options": {"colorMode": "background", "graphMode": "area",
                    "textMode": "value", "reduceOptions": {
                        "calcs": ["lastNotNull"], "fields": "", "values": False}},
        "fieldConfig": {"defaults": {
            "unit": "percent", "min": 0, "max": 100, "decimals": 0,
            "color": {"mode": "thresholds"},
            "thresholds": steps((None, "red"), (10, "orange"), (25, "yellow"),
                                (40, "green")),
        }, "overrides": []},
    },
    {
        "id": 103, "type": "stat", "title": "Routing now",
        "description": ("The account the switch-proxy is currently sending Claude "
                        "Code to (`claude_usage_preferred == 1`)."),
        "datasource": DS, "gridPos": {"x": 6, "y": 0, "w": 6, "h": 5},
        "targets": [tgt("claude_usage_preferred == 1")],
        "options": {"colorMode": "background", "graphMode": "none",
                    "textMode": "name", "reduceOptions": {
                        "calcs": ["lastNotNull"], "fields": "", "values": False}},
        "fieldConfig": {"defaults": {
            "color": {"mode": "fixed", "fixedColor": "blue"},
            "thresholds": steps((None, "blue")),
        }, "overrides": []},
    },
    {
        "id": 105, "type": "stat", "title": "Last switchover",
        "description": ("How long ago the proxy last flipped accounts. 'No data' = "
                        "it has never switched since the exporter started."),
        "datasource": DS, "gridPos": {"x": 12, "y": 0, "w": 6, "h": 5},
        # `> 0` filters the never-switched sentinel to EMPTY so the panel reads
        # "No data" instead of "56 years ago".
        "targets": [tgt("time() - (claude_usage_switch_last_timestamp_seconds > 0)",
                        "ago")],
        "options": {"colorMode": "value", "graphMode": "none",
                    "textMode": "value", "reduceOptions": {
                        "calcs": ["lastNotNull"], "fields": "", "values": False}},
        "fieldConfig": {"defaults": {
            "unit": "s", "decimals": 0, "color": {"mode": "thresholds"},
            "thresholds": steps((None, "text")),
        }, "overrides": []},
    },
    {
        "id": 107, "type": "stat", "title": "Routable accounts",
        "description": (
            "Accounts with FRESH usage data (`claude:routable_accounts:count`) — "
            "i.e. how many the proxy can actually fail over to. 2 = redundant. "
            "1 = you are back to single-account operation (usually a dead OAuth "
            "refresh token). 0 = flying blind."
        ),
        "datasource": DS, "gridPos": {"x": 18, "y": 0, "w": 6, "h": 5},
        "targets": [tgt("claude:routable_accounts:count", "routable")],
        "options": {"colorMode": "background", "graphMode": "none",
                    "textMode": "value", "reduceOptions": {
                        "calcs": ["lastNotNull"], "fields": "", "values": False}},
        "fieldConfig": {"defaults": {
            "decimals": 0, "color": {"mode": "thresholds"},
            "thresholds": steps((None, "red"), (1, "orange"), (2, "green")),
        }, "overrides": []},
    },
    {
        "id": 109, "type": "state-timeline", "title": "Account routing over time",
        "description": ("`claude_usage_preferred` per account — which account was "
                        "live, when. Each lane flip is a switchover."),
        "datasource": DS, "gridPos": {"x": 0, "y": 5, "w": 24, "h": 4},
        "targets": [tgt("claude_usage_preferred", instant=False)],
        "options": {
            "showValue": "never", "rowHeight": 0.9, "mergeValues": True,
            "alignValue": "center",
            "legend": {"displayMode": "list", "placement": "bottom",
                       "showLegend": True},
            "tooltip": {"mode": "single", "sort": "none"},
        },
        "fieldConfig": {"defaults": {
            "color": {"mode": "thresholds"},
            "thresholds": steps((None, "transparent"), (1, "blue")),
        }, "overrides": []},
    },
]

ANNOTATION = {
    "name": ANN,
    "datasource": DS,
    "enable": True,
    "iconColor": "purple",
    # Fires on the account that BECAME preferred (== 1), so each switchover marks
    # once rather than twice (the losing account also `changes`).
    "expr": "changes(claude_usage_preferred[2m]) > 0 and claude_usage_preferred == 1",
    "titleFormat": "🔀 Account switchover",
    "textFormat": "now routing to {{account}}",
    "step": "60s",
}


# --- the provider quota row ---------------------------------------------------
# Phase 1: Kimi. These panels are additive; they do not alter the Anthropic
# account panels below. The "all targets" headroom stat is the unified runway
# that will drive Phase 2 cross-provider class switching.
PROVIDER_PANELS = [
    {
        "id": 201, "type": "stat", "title": "All-targets headroom",
        "description": (
            "Best headroom across routable Anthropic accounts AND providers "
            "(`claude:all_targets_best_headroom:percent`). This is the unified "
            "runway for Phase 2 cross-provider routing. It is 0-100; when it "
            "hits zero, every account and every provider is exhausted."
        ),
        "datasource": DS, "gridPos": {"x": 0, "y": 9, "w": 6, "h": 5},
        "targets": [tgt("claude:all_targets_best_headroom:percent", "headroom")],
        "options": {"colorMode": "background", "graphMode": "area",
                    "textMode": "value", "reduceOptions": {
                        "calcs": ["lastNotNull"], "fields": "", "values": False}},
        "fieldConfig": {"defaults": {
            "unit": "percent", "min": 0, "max": 100, "decimals": 0,
            "color": {"mode": "thresholds"},
            "thresholds": steps((None, "red"), (10, "orange"), (25, "yellow"),
                                (40, "green")),
        }, "overrides": []},
    },
    {
        "id": 203, "type": "stat", "title": "Provider effective %",
        "description": (
            "`provider_effective_percent{provider=\"kimi\"}` — max(5-hour, "
            "weekly) utilization. This is the value Phase 2 will route on."
        ),
        "datasource": DS, "gridPos": {"x": 6, "y": 9, "w": 6, "h": 5},
        "targets": [tgt("provider_effective_percent{provider=\"kimi\"}", "kimi")],
        "options": {"colorMode": "background", "graphMode": "area",
                    "textMode": "value", "reduceOptions": {
                        "calcs": ["lastNotNull"], "fields": "", "values": False}},
        "fieldConfig": {"defaults": {
            "unit": "percent", "min": 0, "max": 100, "decimals": 0,
            "color": {"mode": "thresholds"},
            "thresholds": steps((None, "green"), (80, "yellow"), (90, "orange"),
                                (95, "red")),
        }, "overrides": []},
    },
    {
        "id": 205, "type": "stat", "title": "Provider poll health",
        "description": (
            "`provider_poll_success` for each provider. 1 = fresh poll, 0 = "
            "the last poll failed and the exporter is serving last-good data."
        ),
        "datasource": DS, "gridPos": {"x": 12, "y": 9, "w": 6, "h": 5},
        "targets": [tgt("provider_poll_success", "{{provider}}")],
        "options": {"colorMode": "background", "graphMode": "none",
                    "textMode": "value_and_name", "reduceOptions": {
                        "calcs": ["lastNotNull"], "fields": "", "values": False}},
        "fieldConfig": {"defaults": {
            "unit": "short", "decimals": 0,
            "color": {"mode": "thresholds"},
            "thresholds": steps((None, "red"), (1, "green")),
            "mappings": [{"type": "value", "options": {
                "0": {"text": "FAIL"}, "1": {"text": "OK"}}}],
        }, "overrides": []},
    },
    {
        "id": 207, "type": "stat", "title": "Provider data age",
        "description": (
            "How stale the served provider numbers are (`provider_data_age_seconds`). "
            "Climbs while the provider endpoint is backed off or failing."
        ),
        "datasource": DS, "gridPos": {"x": 18, "y": 9, "w": 6, "h": 5},
        "targets": [tgt("provider_data_age_seconds", "{{provider}}")],
        "options": {"colorMode": "value", "graphMode": "none",
                    "textMode": "value_and_name", "reduceOptions": {
                        "calcs": ["lastNotNull"], "fields": "", "values": False}},
        "fieldConfig": {"defaults": {
            "unit": "s", "decimals": 0, "color": {"mode": "thresholds"},
            "thresholds": steps((None, "green"), (1800, "red")),
        }, "overrides": []},
    },
    {
        "id": 209, "type": "timeseries", "title": "Provider effective over time",
        "description": (
            "`provider_effective_percent` trend per provider — the Phase 2 "
            "routing signal."
        ),
        "datasource": DS, "gridPos": {"x": 0, "y": 14, "w": 12, "h": 6},
        "targets": [tgt("provider_effective_percent", "{{provider}}", instant=False)],
        "options": timeseries_options(),
        "fieldConfig": ts_field_config(),
    },
    {
        "id": 211, "type": "gauge", "title": "Kimi 5h used",
        "description": "Kimi 5-hour rolling window utilization.",
        "datasource": DS, "gridPos": {"x": 12, "y": 14, "w": 6, "h": 6},
        "targets": [tgt("provider_quota_utilization_percent{provider=\"kimi\",window=\"five_hour\"}", "kimi")],
        "options": {"showThresholdLabels": False, "showThresholdMarkers": True,
                    "reduceOptions": {"calcs": ["lastNotNull"], "fields": "",
                                      "values": False}},
        "fieldConfig": {"defaults": {
            "unit": "percent", "min": 0, "max": 100,
            "thresholds": steps((None, "green"), (75, "yellow"), (90, "orange"),
                                (98, "red")),
        }, "overrides": []},
    },
    {
        "id": 213, "type": "gauge", "title": "Kimi weekly used",
        "description": "Kimi weekly window utilization.",
        "datasource": DS, "gridPos": {"x": 18, "y": 14, "w": 6, "h": 6},
        "targets": [tgt("provider_quota_utilization_percent{provider=\"kimi\",window=\"seven_day\"}", "kimi")],
        "options": {"showThresholdLabels": False, "showThresholdMarkers": True,
                    "reduceOptions": {"calcs": ["lastNotNull"], "fields": "",
                                      "values": False}},
        "fieldConfig": {"defaults": {
            "unit": "percent", "min": 0, "max": 100,
            "thresholds": steps((None, "green"), (70, "yellow"), (85, "orange"),
                                (95, "red")),
        }, "overrides": []},
    },
    {
        "id": 215, "type": "stat", "title": "Provider metadata",
        "description": (
            "`provider_parallel_limit` and `provider_membership_level` per provider. "
            "Informational; may explain why requests are refused when utilization "
            "looks low."
        ),
        "datasource": DS, "gridPos": {"x": 0, "y": 20, "w": 24, "h": 4},
        "targets": [
            tgt("provider_parallel_limit{provider=\"kimi\"}", "parallel — {{provider}}"),
            tgt("provider_membership_level{provider=\"kimi\"}", "membership — {{level}}"),
        ],
        "options": {"colorMode": "value", "graphMode": "none",
                    "textMode": "value_and_name", "reduceOptions": {
                        "calcs": ["lastNotNull"], "fields": "", "values": False}},
        "fieldConfig": {"defaults": {
            "decimals": 0, "color": {"mode": "fixed", "fixedColor": "blue"},
            "thresholds": steps((None, "blue")),
        }, "overrides": []},
    },
]


def patch(d):
    # 1. strip our panels so this is a re-runnable transform, not an append
    keep = [p for p in d["panels"] if p.get("id") not in OURS]

    # 2. renormalise: whatever we did last time, put the old panels back at y=0...
    if keep:
        top = min(p["gridPos"]["y"] for p in keep)
        for p in keep:
            p["gridPos"]["y"] -= top
    # 3. ...then push them down by exactly the rows we prepend
    for p in keep:
        p["gridPos"]["y"] += SWITCH_ROW_H + PROVIDER_ROW_H

    d["panels"] = [json.loads(json.dumps(p)) for p in PANELS + PROVIDER_PANELS] + keep

    anns = d.setdefault("annotations", {}).setdefault("list", [])
    anns[:] = [a for a in anns if a.get("name") != ANN]
    anns.append(json.loads(json.dumps(ANNOTATION)))

    d["title"] = TITLE
    d["version"] = VERSION
    return d


def main():
    check = "--check" in sys.argv
    before = DASH.read_text()
    after = json.dumps(patch(json.loads(before)), indent=2, ensure_ascii=False) + "\n"

    if before == after:
        print("dashboard already up to date (no change)")
        return 0
    if check:
        print("FAIL: dashboard is out of date — run patch-claude-usage-dashboard.py",
              file=sys.stderr)
        return 1

    DASH.write_text(after)
    d = json.loads(after)
    print(f"wrote {DASH.name}: {len(d['panels'])} panels, "
          f"{len(d['annotations']['list'])} annotation(s)")
    print("  switchover row:", [p["title"] for p in d["panels"][:len(PANELS)]])
    ys = sorted({p["gridPos"]["y"] for p in d["panels"]})
    print("  row y-offsets:", ys)
    return 0


if __name__ == "__main__":
    sys.exit(main())
