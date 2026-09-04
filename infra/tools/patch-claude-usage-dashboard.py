#!/usr/bin/env python3
"""Add the switchover and member-health rows to the claude-usage Grafana dashboard.

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
OURS = {101, 103, 105, 107, 109, 111, 201, 203, 205, 207, 209, 211, 213}  # panel ids this script owns
ROW_H = 36  # switchover (17), health heading (1), and three health rows (6 each)
ANN = "Account switchover"
VERSION = 4
TITLE = "Claude Code Usage — quota, burn & switchover"


def tgt(expr, legend="{{account}}", instant=True, ref="A"):
    return {"datasource": DS, "expr": expr, "legendFormat": legend,
            "refId": ref, "instant": instant, "range": not instant}


def steps(*pairs):
    return {"mode": "absolute",
            "steps": [{"value": v, "color": c} for v, c in pairs]}


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
        "id": 103, "type": "stat", "title": "Routing now (per model lane)",
        "description": ("Where the switch-proxy sends each MODEL LANE right now "
                        "(`claude_usage_lane_preferred == 1`). One chip per lane: "
                        "fable can ride one account while everything else stays on "
                        "the other — concurrently."),
        "datasource": DS, "gridPos": {"x": 6, "y": 0, "w": 6, "h": 5},
        "targets": [tgt("claude_usage_lane_preferred == 1", "{{lane}} → {{account}}")],
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
        "description": ("How long ago ANY lane last flipped accounts (max over "
                        "lanes). 'No data' = never switched since the exporter "
                        "started."),
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
        "id": 109, "type": "state-timeline", "title": "Lane routing over time",
        "description": ("`claude_usage_lane_preferred` — which account served each "
                        "model lane, when. A row flipping is that lane's switchover; "
                        "two lanes on different accounts at once is split routing."),
        "datasource": DS, "gridPos": {"x": 0, "y": 5, "w": 24, "h": 6},
        "targets": [tgt("claude_usage_lane_preferred == 1", "{{lane}} → {{account}}",
                        instant=False)],
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
    {
        "id": 111, "type": "timeseries", "title": "Lane-effective utilization",
        "description": (
            "The switchover policy's actual input, per lane per account: "
            "`claude_usage_lane_effective_percent` = max(overall 7-day, that "
            "model's scoped weekly cap). THIS is the panel that answers \"why did "
            "fable move when overall weekly looked fine\" — the scoped cap was the "
            "binding constraint. A lane moves off home base when its line there "
            "crosses 80%."
        ),
        "datasource": DS, "gridPos": {"x": 0, "y": 11, "w": 24, "h": 6},
        "targets": [tgt("claude_usage_lane_effective_percent",
                        "{{lane}} @ {{account}}", instant=False)],
        "options": {
            "legend": {"displayMode": "list", "placement": "bottom",
                       "showLegend": True, "calcs": ["lastNotNull"]},
            "tooltip": {"mode": "multi", "sort": "desc"},
        },
        "fieldConfig": {"defaults": {
            "unit": "percent", "min": 0, "max": 100, "decimals": 0,
            "custom": {"lineWidth": 2, "fillOpacity": 0, "showPoints": "never",
                       "spanNulls": True},
            "color": {"mode": "palette-classic"},
        }, "overrides": []},
    },
]

# #125: current samples only, no alert rules and no last-value carry across gaps.
def health_series(panel_id, title, x, y, width, targets, unit="short"):
    return {
        "id": panel_id, "type": "timeseries", "title": title, "datasource": DS,
        "gridPos": {"x": x, "y": y, "w": width, "h": 6}, "targets": targets,
        "options": {"legend": {"displayMode": "list", "placement": "bottom", "showLegend": True},
                    "tooltip": {"mode": "multi", "sort": "desc"}},
        "fieldConfig": {"defaults": {"unit": unit, "min": 0,
            "custom": {"lineWidth": 2, "fillOpacity": 0, "showPoints": "never", "spanNulls": False},
            "color": {"mode": "palette-classic"}}, "overrides": []},
    }


PANELS += [
    {"id": 201, "type": "row", "title": "Member health", "collapsed": False,
     "gridPos": {"x": 0, "y": 17, "w": 24, "h": 1}, "panels": []},
    {"id": 203, "type": "state-timeline", "title": "Health state by endpoint", "datasource": DS,
     "description": "One row per endpoint; absent scrape samples remain gaps. Health scoring covers class requests.",
     "gridPos": {"x": 0, "y": 18, "w": 24, "h": 6},
     "targets": [tgt('sum by (key) (switch_health_state{state="healthy"} * 0 or switch_health_state{state="convalescent"} * 1 or switch_health_state{state="half_open"} * 2 or switch_health_state{state="open"} * 3)', "{{key}}", instant=False)],
     "options": {"showValue": "auto", "rowHeight": 0.9, "mergeValues": True,
                 "legend": {"showLegend": True, "displayMode": "list", "placement": "bottom"},
                 "tooltip": {"mode": "single", "sort": "none"}},
     "fieldConfig": {"defaults": {"custom": {"spanNulls": False},
         "mappings": [{"type": "value", "options": {
             "0": {"text": "healthy", "color": "green"}, "1": {"text": "convalescent", "color": "blue"},
             "2": {"text": "half_open", "color": "yellow"}, "3": {"text": "open", "color": "red"}}}]}, "overrides": []}},
    health_series(205, "Episode hold step (k)", 0, 24, 8,
                  [tgt("switch_health_episode_k", "{{key}}", instant=False)]),
    health_series(207, "Degradation rate and trip threshold", 8, 24, 8,
                  [tgt("switch_health_evidence_rate", "{{key}}", instant=False),
                   tgt('switch_health_config{name="trip_rate"}', "trip threshold", instant=False, ref="B")], "percentunit"),
    health_series(209, "Routing decisions by hop", 16, 24, 8,
                  [tgt("sum by (class, hop_kind) (rate(switch_health_route_decisions_total[$__rate_interval]))", "{{class}} · {{hop_kind}}", instant=False)], "reqps"),
    health_series(211, "Health exhaustion responses (529)", 0, 30, 12,
                  [tgt("sum by (class, pinned) (increase(switch_health_exhausted_total[$__rate_interval]))", "{{class}} · pinned={{pinned}}", instant=False)]),
    health_series(213, "Prefills paid and pending returns", 12, 30, 12,
                  [tgt("sum by (class) (increase(switch_health_prefills_paid_total[$__rate_interval]))", "{{class}} · prefills", instant=False),
                   tgt("switch_health_ramp_pending", "{{class}} · pending", instant=False, ref="B")]),
]

ANNOTATION = {
    "name": ANN,
    "datasource": DS,
    "enable": True,
    "iconColor": "purple",
    # Fires on the (lane, account) that BECAME preferred (== 1), so each lane's
    # switchover marks once rather than twice (the losing account also `changes`).
    "expr": "changes(claude_usage_lane_preferred[2m]) > 0 and claude_usage_lane_preferred == 1",
    "titleFormat": "🔀 Lane switchover",
    "textFormat": "{{lane}} now routing to {{account}}",
    "step": "60s",
}


def patch(d):
    # 1. strip our panels so this is a re-runnable transform, not an append
    keep = [p for p in d["panels"] if p.get("id") not in OURS]

    # 2. renormalise: whatever we did last time, put the old panels back at y=0...
    if keep:
        top = min(p["gridPos"]["y"] for p in keep)
        for p in keep:
            p["gridPos"]["y"] -= top
    # 3. ...then push them down by exactly one switchover row
    for p in keep:
        p["gridPos"]["y"] += ROW_H

    d["panels"] = [json.loads(json.dumps(p)) for p in PANELS] + keep

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
