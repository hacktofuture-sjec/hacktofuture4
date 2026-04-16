"""
Battle Report Generator — Phase 5
Generates a structured end-of-battle report dict (and optionally markdown)
from the final BattleOrchestrator state.

The report is:
  1. Broadcast as a WS `battle_report` event when the battle ends
  2. Available at GET /battle/report as JSON
  3. Available at GET /battle/report.md as Markdown
"""
from datetime import datetime


def generate_report(state: dict, blue_agent) -> dict:
    """
    Build a battle report dict from the final orchestrator state.

    Args:
        state:      BattleOrchestrator.state
        blue_agent: BlueAgent instance (for online learning stats)

    Returns:
        report dict ready for JSON serialisation or markdown rendering
    """
    m        = state["metrics"]
    red      = state["red"]
    blue     = state["blue"]
    services = state["services"]
    turn     = state["turn"]
    winner   = state.get("winner", "DRAW")

    attempted = max(m["attacks_attempted"], 1)
    blocked   = m["attacks_blocked"]
    block_rate = round(blocked / attempted * 100, 1)

    flags_stolen   = [s for s, v in services.items() if v.get("flag_stolen")]
    flags_intact   = [s for s, v in services.items() if not v.get("flag_stolen")]

    mttd = round(float(sum(m["mttd_samples"]) / len(m["mttd_samples"])), 3) \
           if m["mttd_samples"] else None
    mttr = round(float(sum(m["mttr_samples"]) / len(m["mttr_samples"])), 3) \
           if m["mttr_samples"] else None

    # Red reward sparkline summary
    reward_history = red.get("reward_history", [])
    peak_reward    = max((r["reward"] for r in reward_history), default=0)
    worst_turn     = min(reward_history, key=lambda r: r["reward"], default={})

    # Blue online learning summary
    online_weight   = round(blue_agent.online_weight, 3)
    online_samples  = blue_agent._online_samples
    live_threshold  = round(blue_agent.live_threshold, 3)

    report = {
        "generated_at":    datetime.utcnow().isoformat() + "Z",
        "winner":          winner,
        "total_turns":     turn,
        "summary": {
            "attacks_attempted":  m["attacks_attempted"],
            "attacks_blocked":    blocked,
            "block_rate_pct":     block_rate,
            "flags_captured":     m["flags_captured"],
            "false_positives":    m["false_positives"],
            "human_requests":     m.get("human_requests", 0),
            "human_fp":           m.get("human_fp", 0),
        },
        "timing": {
            "mttd_s": mttd,
            "mttr_s": mttr,
        },
        "red": {
            "cumulative_reward": red.get("cumulative_reward", 0),
            "peak_turn_reward":  peak_reward,
            "worst_turn":        worst_turn,
            "kill_chain_stages_reached": red.get("kill_chain_reached", []),
            "flags_exfiltrated": flags_stolen,
        },
        "blue": {
            "online_weight":      online_weight,
            "online_samples":     online_samples,
            "live_threshold":     live_threshold,
        },
        "services": {
            name: {
                "flag_stolen": v.get("flag_stolen", False),
                "outcome":     (
                    "🚩 Compromised" if v.get("flag_stolen") else "✓ Survived"
                ),
            }
            for name, v in services.items()
        },
        "kill_chain_coverage": _kill_chain_coverage(red.get("kill_chain_reached", [])),
    }
    return report


def report_to_markdown(report: dict) -> str:
    """Render the report dict as a human-readable Markdown string."""
    w        = report["winner"]
    s        = report["summary"]
    t        = report["timing"]
    red      = report["red"]
    blue     = report["blue"]
    services = report["services"]
    kc       = report["kill_chain_coverage"]

    winner_line = {
        "RED":  "🔴 **RED WINS** — attacker successfully exfiltrated flags",
        "BLUE": "🔵 **BLUE WINS** — defender held all flags",
        None:   "⚖ **DRAW** — battle ended prematurely",
    }.get(w, f"Winner: {w}")

    svc_rows = "\n".join(
        f"| `{name}` | {v['outcome']} |"
        for name, v in services.items()
    )

    kc_rows = "\n".join(
        f"| {stage} | {'✅' if reached else '❌'} |"
        for stage, reached in kc.items()
    )

    return f"""# Battle Report
Generated: {report['generated_at']}

## Result
{winner_line}

## Summary
| Metric | Value |
|---|---|
| Total Turns | {report['total_turns']} |
| Attacks Attempted | {s['attacks_attempted']} |
| Attacks Blocked | {s['attacks_blocked']} |
| Block Rate | {s['block_rate_pct']}% |
| Flags Captured | {s['flags_captured']} / 6 |
| False Positives | {s['false_positives']} |

## Detection Timing
| Metric | Value |
|---|---|
| MTTD (Mean Time to Detect) | {t['mttd_s']}s |
| MTTR (Mean Time to Respond) | {t['mttr_s']}s |

## Red Agent Performance
- Cumulative Reward: **{red['cumulative_reward']}**
- Peak Turn Reward: {red['peak_turn_reward']}
- Kill Chain Stages Reached: {', '.join(red['kill_chain_stages_reached']) or 'None'}
- Flags Exfiltrated: {', '.join(red['flags_exfiltrated']) or 'None'}

## Blue Agent Performance
- Online Learning Weight: **{blue['online_weight']:.0%}**
- Training Samples Seen: {blue['online_samples']}
- Detection Threshold: {blue['live_threshold']}

## Service Outcomes
| Service | Outcome |
|---|---|
{svc_rows}

## MITRE ATT&CK Kill Chain
| Stage | Red Reached |
|---|---|
{kc_rows}

## 🧑 Human Simulator — False Positive Audit
| Metric | Value |
|---|---|
| Benign Requests Sent | {s.get('human_requests', 0)} |
| Blue Alerts on Human IPs | {s.get('human_fp', 0)} |
| Precision | {f"{(1 - s.get('human_fp', 0) / max(s.get('human_requests', 1), 1)) * 100:.1f}%"} |
"""


def _kill_chain_coverage(reached: list) -> dict:
    stages = [
        "Reconnaissance", "Initial Access", "Credential Access",
        "Collection", "Lateral Movement", "Exfiltration",
    ]
    return {s: (s in reached) for s in stages}
