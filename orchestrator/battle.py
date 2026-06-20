"""
Battle Orchestrator — Turn Loop & State Machine
"""
import asyncio, sys, os, time, logging, json, random
from collections import deque
from datetime import datetime

# ── Realism constant ─────────────────────────────────────────────────────────
# Blue doesn't see 100% of log lines instantly (buffering, log rotation, etc.).
# 0.72 = Blue reliably detects ~72% of individual attack log entries per turn.
# Raise to 1.0 to restore old (unrealistically perfect) behaviour.
LOG_DETECTION_RATE = 0.72

import docker
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from agents.red.tools  import ACTION_FN, ACTION_NAMES
from agents.red.env    import NetworkAttackEnv
from agents.blue.model import BlueAgent
from agents.blue.team  import BlueTeam
from orchestrator.extractor  import batch_extract
from orchestrator.responses  import (
    block_ip, unblock_ip, restart_service, add_rate_limit,
    PATCH_REGISTRY,
)
from orchestrator.report import generate_report, report_to_markdown
from agents.human.simulator import HumanSimulator, USER_IPS as HUMAN_IPS

log = logging.getLogger("battle")

SERVICES = [
    "flask-sqli","node-pathtraversal","jwt-auth",
    "postgres-weak","redis-noauth","nginx-misconfig"
]

# Ground-truth mapping: Red action → Blue classification label.
# Used to feed supervised signal into Blue's online learner each turn.
ACTION_TO_CLASS = {
    "sqli":             "r2l",
    "path_traversal":   "probe",
    "jwt_none_forge":   "r2l",
    "brute_postgres":   "r2l",
    "redis_noauth":     "r2l",
    "nginx_alias_trav": "probe",
    "port_scan":        "probe",
    "exfiltrate":       "dos",
}

# MITRE ATT&CK tactic mapping — Phase 3
ATTACK_TACTIC = {
    "port_scan":          {"tactic": "Reconnaissance",    "id": "TA0043", "stage": 0},
    "sqli":               {"tactic": "Initial Access",    "id": "TA0001", "stage": 1},
    "path_traversal":     {"tactic": "Initial Access",    "id": "TA0001", "stage": 1},
    "jwt_none_forge":     {"tactic": "Credential Access", "id": "TA0006", "stage": 2},
    "brute_postgres":     {"tactic": "Credential Access", "id": "TA0006", "stage": 2},
    "redis_noauth":       {"tactic": "Collection",        "id": "TA0009", "stage": 3},
    "nginx_alias_trav":   {"tactic": "Collection",        "id": "TA0009", "stage": 3},
    "sqli_cred_dump":     {"tactic": "Lateral Movement",  "id": "TA0008", "stage": 4},
    "postgres_with_creds":{"tactic": "Lateral Movement",  "id": "TA0008", "stage": 4},
    "nginx_to_pg_config": {"tactic": "Lateral Movement",  "id": "TA0008", "stage": 4},
    "exfiltrate":         {"tactic": "Exfiltration",      "id": "TA0010", "stage": 5},
}

# Kill-chain stage names (ordered)
KILL_CHAIN_STAGES = [
    "Reconnaissance", "Initial Access", "Credential Access",
    "Collection", "Lateral Movement", "Exfiltration",
]

class BattleOrchestrator:
    def __init__(self, broadcast_fn):
        """
        broadcast_fn: async callable(event_type: str, payload: dict)
                      provided by the FastAPI WebSocket hub
        """
        self.broadcast = broadcast_fn
        self._docker   = docker.from_env()

        # ── Load agents ───────────────────────────────────────────────
        from stable_baselines3 import PPO
        models_dir = os.path.join(os.path.dirname(__file__), "../agents/models")
        self.red_model  = PPO.load(os.path.join(models_dir, "red_ppo"))
        self.blue_agent = BlueAgent()
        self.blue_team  = BlueTeam(self.blue_agent, None)  # PATCH_REGISTRY injected inside
        self.human_sim  = HumanSimulator()
        log.info("Agents loaded — Red, Blue, Human Simulator ready.")

        # ── Gym env (used only for observation building) ──────────────
        self.env = NetworkAttackEnv(use_real_cluster=True, blue_defense_prob=0.0)
        self.obs, _ = self.env.reset()

        # ── Battle state ──────────────────────────────────────────────
        self.state = {
            "turn":   0,
            "running": False,
            "winner": None,
            "red": {
                "last_action":       None,
                "last_result":       None,
                "last_reward":       0.0,
                "cumulative_reward": 0.0,
                "flags_found":       [],
                "blocked_count":     0,
                "kill_chain_reached": [],  # stages Red has hit
                "reward_history":     [],  # per-turn rewards for sparkline
            },
            "blue": {
                "last_action":  None,
                "alerts_fired": 0,
                "blocked_ips":  [],
                "last_explanation": None,
            },
            "services": {
                svc: {"up": True, "flag_stolen": False}
                for svc in SERVICES
            },
            "metrics": {
                "attacks_attempted":   0,
                "attacks_blocked":     0,
                "false_positives":     0,   # Blue alerted on non-attack traffic
                "human_fp":            0,   # Blue alerted specifically on human-sim IPs
                "human_requests":      0,   # total benign requests sent this session
                "flags_captured":      0,
                "mttd_samples":        [],
                "mttr_samples":        [],
            },
            "timeline": [],   # last 100 events
        }

        self._log_buf: dict[str, deque] = {s: deque(maxlen=30) for s in SERVICES}
        self._auto_unblock_tasks = []
        self._last_report: dict | None = None   # set at battle end

    # ── Public controls ────────────────────────────────────────────────────────
    async def start(self):
        # Always soft-reset on start — this loads any previously saved Blue weights.
        # On the very first run, load_online_model() quietly finds no file and skips.
        await self.soft_reset()

        self.state["running"] = True
        await self.broadcast("battle_start", {"ts": _ts()})

        # Decide whether Blue is in learning mode (first ever run) or defend mode.
        samples = self.blue_agent._online_samples
        if samples == 0:
            mode_msg = (
                "🎓 Blue Agent — LEARNING MODE (run 1). "
                "Blue will observe all attacks and build its knowledge base. "
                "No prior experience loaded."
            )
        else:
            mode_msg = (
                f"🛡 Blue Agent — DEFENDING (learned {samples} samples from previous run(s)). "
                f"Threshold={self.blue_agent.live_threshold:.2f}, "
                f"OnlineWeight={self.blue_agent.online_weight:.0%}"
            )
        await self.broadcast("orchestrator_log", {"ts": _ts(), "level": "INFO", "msg": mode_msg})
        await self.broadcast("orchestrator_log", {"ts": _ts(), "level": "INFO", "msg": "Battle started — Red and Blue agents initialised."})
        asyncio.create_task(self._loop())

    async def stop(self):
        self.state["running"] = False
        await self.broadcast("battle_stop", {"ts": _ts()})
        await self.broadcast("orchestrator_log", {"ts": _ts(), "level": "WARN", "msg": "Battle stopped by operator."})

    async def reset(self):
        await self.stop()
        await asyncio.sleep(0.5)
        
        # Fully flush backend IP tables so the next match starts fresh
        for ip in self.blue_agent.blocked_ips:
            await unblock_ip(ip)
            
        # Hard wipe the Red Agent environment to flush RL and Iterator history
        self.env = NetworkAttackEnv(use_real_cluster=True, blue_defense_prob=0.0)
        self.obs, _ = self.env.reset()
        # Delete persisted Blue knowledge so next run starts fresh
        import os as _os
        from agents.blue.model import _ONLINE_MODEL_SAVE
        try:
            _os.remove(_ONLINE_MODEL_SAVE)
            log.info("[Reset] Deleted saved Blue model — starting from scratch")
        except FileNotFoundError:
            pass
        self.blue_agent = BlueAgent()
        self.blue_team  = BlueTeam(self.blue_agent, None)  # fresh team, blank online model
        self.human_sim.reset()
        if hasattr(self, "_last_log_ts"):
            self._last_log_ts = {s: "" for s in SERVICES}
        s = self.state
        s["turn"]    = 0
        s["winner"]  = None
        s["running"] = False
        s["red"]     = {"last_action":None,"last_result":None,
                        "last_reward":0.0,"cumulative_reward":0.0,
                        "flags_found":[],"blocked_count":0,
                        "kill_chain_reached":[],"reward_history":[]}
        s["blue"]    = {"last_action":None,"alerts_fired":0,
                        "blocked_ips":[],
                        "last_explanation":None}
        s["services"] = {svc:{"up":True,"flag_stolen":False}
                         for svc in SERVICES}
        s["metrics"]  = {"attacks_attempted":0,"attacks_blocked":0,
                         "false_positives":0,"human_fp":0,"human_requests":0,
                         "flags_captured":0,
                         "mttd_samples":[],"mttr_samples":[]}
        s["timeline"] = []
        await self.broadcast("battle_reset", {"ts": _ts()})

    async def soft_reset(self):
        if self.state["running"]:
            await self.stop()
            await asyncio.sleep(0.5)
        
        # Fully flush backend IP tables so the next match starts fresh
        for ip in self.blue_agent.blocked_ips:
            await unblock_ip(ip)
            
        # Hard wipe the Red Agent environment to flush RL and Iterator history
        self.env = NetworkAttackEnv(use_real_cluster=True, blue_defense_prob=0.0)
        self.obs, _ = self.env.reset()
        
        # KEY DIFFERENCE: Do not overwrite self.blue_agent!
        # Reset only active defenses (blocked IPs, rate limits, alerts)
        # but keep all learned SGDClassifier weights.
        self.blue_agent.reset_session_state()
        # Load saved weights from disk (written at end of previous battle)
        # This ensures Blue starts the new run with its trained model immediately active.
        self.blue_agent.load_online_model()
        # Create a fresh team wrapper around the existing BlueAgent
        self.blue_team  = BlueTeam(self.blue_agent, None) 
        
        self.human_sim.reset()
        if hasattr(self, "_last_log_ts"):
            self._last_log_ts = {s: "" for s in SERVICES}
        s = self.state
        s["turn"]    = 0
        s["winner"]  = None
        s["running"] = False
        s["red"]     = {"last_action":None,"last_result":None,
                        "last_reward":0.0,"cumulative_reward":0.0,
                        "flags_found":[],"blocked_count":0,
                        "kill_chain_reached":[],"reward_history":[]}
        s["blue"]    = {"last_action":None,"alerts_fired":0,
                        "blocked_ips":[],
                        "last_explanation":None}
        s["services"] = {svc:{"up":True,"flag_stolen":False}
                         for svc in SERVICES}
        s["metrics"]  = {"attacks_attempted":0,"attacks_blocked":0,
                         "false_positives":0,"human_fp":0,"human_requests":0,
                         "flags_captured":0,
                         "mttd_samples":[],"mttr_samples":[]}
        s["timeline"] = []
        await self.broadcast("battle_reset", {"ts": _ts()})


    # ── Main loop ──────────────────────────────────────────────────────────────
    async def _loop(self):
        while self.state["running"]:
            turn = self.state["turn"]

            # ── RED TURN ─────────────────────────────────────────────
            action, _ = self.red_model.predict(self.obs, deterministic=False)
            action    = int(action)

            # Force Red to logically pivot to uncaptured flags
            from agents.red.env import ACTION_TO_SERVICE
            if action in [1, 2, 3, 4, 5, 6]:
                svc_target = ACTION_TO_SERVICE.get(action)
                if svc_target and self.state["services"][svc_target].get("flag_stolen"):
                    available = [a for a, s in ACTION_TO_SERVICE.items()
                                 if not self.state["services"][s].get("flag_stolen")]
                    if available:
                        action = random.choice(available)

            # Record attack timestamp BEFORE execution
            t_attack = time.time()

            # Execute in the real env (hits live Docker services)
            self.obs, reward, terminated, truncated, info = self.env.step(action)

            action_name = ACTION_NAMES.get(action, "exfiltrate")
            
            # Map successful flag capture to state metric
            svc = ACTION_TO_SERVICE.get(action)
            if svc and reward >= 13.0: 
                self.state["services"][svc]["flag_stolen"] = True

            # Is this a turn where Red is actually attacking (vs scanning/exfiltrating)?
            # Used to distinguish true positives from false positives in block counter.
            is_attack_turn = action_name not in ("port_scan", "exfiltrate")

            tactic_info = ATTACK_TACTIC.get(action_name, {})
            stage = tactic_info.get("stage", -1)
            tactic_name = tactic_info.get("tactic", "Unknown")

            if stage >= 0 and tactic_name not in self.state["red"]["kill_chain_reached"]:
                self.state["red"]["kill_chain_reached"].append(tactic_name)

            self.state["red"]["reward_history"].append({
                "turn": turn,
                "reward": round(float(reward), 2),
                "action": action_name
            })

            self.state["red"].update({
                "last_action":       action_name,
                "last_reward":       round(float(reward), 2),
                "cumulative_reward": round(self.state["red"]["cumulative_reward"] + float(reward), 2),
            })
            if self.env._real_flags_found:
                self.state["red"]["flags_found"] = list(self.env._real_flags_found)

            self.state["metrics"]["attacks_attempted"] += 1

            red_event = {
                "turn":        turn,
                "action":      action_name,
                "reward":      round(float(reward), 2),
                "flags_found": len(self.env._real_flags_found),
                "tactic":      tactic_info.get("tactic", "Unknown"),
                "tactic_id":   tactic_info.get("id", ""),
                "stage":       tactic_info.get("stage", -1),
                "ts":          _ts(),
            }
            self.state["timeline"].append({"agent": "red", **red_event})
            self.state["timeline"] = self.state["timeline"][-100:]

            await self.broadcast("red_action", red_event)
            await self.broadcast("orchestrator_log", {
                "ts":    _ts(),
                "level": "RED",
                "msg":   f"[Turn {turn}] Red → {action_name}  reward={round(float(reward),2):+}"
                         + (f"  🚩 flag captured" if reward >= 13.0 and svc else ""),
            })

            # ── ENV UPDATE — wait for logs to be written ────────────────────
            # Human simulator runs concurrently during the sleep window so its
            # benign requests land in Docker logs and Blue reads them naturally.
            human_task = asyncio.create_task(
                self.human_sim.run_turn(n_requests=random.randint(2, 5))
            )
            await asyncio.sleep(1.5)
            human_results = await human_task
            self.state["metrics"]["human_requests"] += len(human_results)
            if human_results:
                await self.broadcast("orchestrator_log", {
                    "ts":    _ts(),
                    "level": "INFO",
                    "msg":   f"[Turn {turn}] 🧑 Human: {len(human_results)} benign request(s) sent "
                             f"({', '.join(set(r['service'] for r in human_results))})",
                })
            t_logs_ready = time.time()          # logs are now available to Blue
            new_log_lines = await self._collect_logs()

            # ── BLUE TURN — multi-agent team processes all services in parallel ──
            blue_responses = []
            t_first_detect = None

            # Build input dict: service → [(feat_vec, src_ip)]
            features_by_service = {}
            for service_name, lines in new_log_lines.items():
                feats = batch_extract(lines, service_name,
                                      detection_prob=LOG_DETECTION_RATE)
                if feats:
                    features_by_service[service_name] = feats

            # Run Detector + Responder + Patcher concurrently
            if features_by_service:
                team_results = await self.blue_team.process_turn(features_by_service)

                for response in team_results:
                    action_r = response.get("action")
                    if action_r in ("CLEAN", None):
                        continue

                    # Responder / Detector action
                    if t_first_detect is None:
                        t_first_detect = time.time()
                    t_respond = time.time()

                    svc_name = response.get("_service", "unknown")
                    await self._execute_blue_response(response, svc_name)

                    mttd = round(t_first_detect - t_logs_ready, 4)
                    mttr = round(t_respond      - t_logs_ready, 4)

                    if is_attack_turn:
                        self.state["metrics"]["attacks_blocked"] += 1
                        self.state["red"]["blocked_count"]        += 1
                        self.state["metrics"]["mttd_samples"].append(mttd)
                        self.state["metrics"]["mttr_samples"].append(mttr)
                    else:
                        self.state["metrics"]["false_positives"] += 1
                        # If the alert src_ip is in the human IP pool → human FP
                        if response.get("src_ip", "") in HUMAN_IPS:
                            self.state["metrics"]["human_fp"] += 1
                            await self.broadcast("orchestrator_log", {
                                "ts":    _ts(),
                                "level": "WARN",
                                "msg": f"[Turn {turn}] ⚠ Human FP: Blue fired {response.get('action')} on "
                                       f"human IP {response.get('src_ip')} ({svc_name})",
                            })

                    blue_responses.append(response)

            if blue_responses:
                last = blue_responses[-1]
                self.state["blue"].update({
                    "last_action":      last["action"],
                    "alerts_fired":     self.state["blue"]["alerts_fired"] + len(blue_responses),
                    "blocked_ips":      list(self.blue_agent.blocked_ips),
                    "last_explanation": last.get("explanation"),
                })
                blue_event = {
                    "turn":      turn,
                    "responses": blue_responses,
                    "ts":        _ts(),
                }
                self.state["timeline"].append({"agent":"blue", **blue_event})
                await self.broadcast("blue_action", blue_event)
                for r in blue_responses:
                    agent_tag = r.get("_agent", "Blue")
                    rationale = r.get("rationale", "")
                    await self.broadcast("orchestrator_log", {
                        "ts":    _ts(),
                        "level": "BLUE",
                        "msg":   f"[Turn {turn}] [{agent_tag}] {r['action']}  sev={r.get('severity','?')}  class={r.get('attack_class','?')}  conf={int((r.get('confidence') or 0)*100)}%"
                                + (f"  — {rationale}" if rationale else ""),
                    })

            # ── BLUE ONLINE LEARNING — feed ground truth back ─────────
            # CRITICAL FIX: Don't label human traffic as attacks.
            # Separate lines by source IP before calling feedback().
            true_attack_class = ACTION_TO_CLASS.get(action_name, "normal")
            feedback_count = 0
            for service_name, lines in new_log_lines.items():
                features_all = batch_extract(lines, service_name, detection_prob=1.0)
                for feat_vec, src_ip in features_all:
                    # Route each log line to the correct ground-truth class
                    if src_ip in HUMAN_IPS:
                        ground_truth = "normal"           # benign human traffic
                    else:
                        ground_truth = true_attack_class  # Red's actual attack class
                    self.blue_agent.feedback(feat_vec, ground_truth)
                    feedback_count += 1
            if feedback_count > 0:
                await self.broadcast("orchestrator_log", {
                    "ts":    _ts(),
                    "level": "BLUE",
                    "msg":   f"[Turn {turn}] Blue learned from {feedback_count} samples "
                             f"(attack={true_attack_class})  online_weight={self.blue_agent.online_weight:.0%}  "
                             f"threshold={self.blue_agent.live_threshold:.2f}",
                })

            # ── State snapshot ─────────────────────────────────────────
            self.state["turn"] += 1
            await self.broadcast("state_update", self._snapshot())

            # ── Win conditions ─────────────────────────────────────────
            # Use _real_flags_found so only genuine HTTP-captured flags can win
            real_flags = self.env._real_flags_found
            self.state["metrics"]["flags_captured"] = len(real_flags)
            
            if terminated or len(real_flags) >= 6:
                self.state["winner"] = "RED"
                self.blue_agent.save_online_model()   # persist learning before battle ends
                self._last_report = generate_report(self.state, self.blue_agent)
                await self.broadcast("orchestrator_log", {"ts": _ts(), "level": "CRIT", "msg": f"RED WINS — all {len(real_flags)} flags captured and exfiltrated!"})
                await self.broadcast("orchestrator_log", {"ts": _ts(), "level": "BLUE",
                    "msg": f"[Blue] Knowledge saved — {self.blue_agent._online_samples} samples retained for next run."})
                await self.broadcast("battle_end", {
                    "winner": "RED",
                    "reason": "All flags successfully captured and exfiltrated",
                    "flags":  real_flags,
                    "ts":     _ts(),
                })
                await self.broadcast("battle_report", self._last_report)
                self.state["running"] = False
                return

            if turn >= 50 or truncated:
                self.state["winner"] = "BLUE"
                self.blue_agent.save_online_model()   # persist learning before battle ends
                self._last_report = generate_report(self.state, self.blue_agent)
                await self.broadcast("orchestrator_log", {"ts": _ts(), "level": "CRIT", "msg": "BLUE WINS — network defense held successful for 50 turns."})
                await self.broadcast("orchestrator_log", {"ts": _ts(), "level": "BLUE",
                    "msg": f"[Blue] Knowledge saved — {self.blue_agent._online_samples} samples retained for next run."})
                await self.broadcast("battle_end", {
                    "winner": "BLUE",
                    "reason": "Survival victory (50 turns)",
                    "ts":     _ts(),
                })
                await self.broadcast("battle_report", self._last_report)
                self.state["running"] = False
                return

            await asyncio.sleep(0.5)

    # ── Helpers ────────────────────────────────────────────────────────────────
    async def _collect_logs(self) -> dict[str, list[str]]:
        result = {}
        if not hasattr(self, "_last_log_ts"):
            self._last_log_ts = {s: "" for s in SERVICES}
            
        for svc in SERVICES:
            try:
                c = self._docker.containers.get(svc)
                raw = c.logs(tail=30, timestamps=True).decode("utf-8", errors="ignore")
                
                new_lines = []
                latest_ts = self._last_log_ts[svc]
                
                for line in raw.strip().split("\n"):
                    if not line.strip(): continue
                    parts = line.split(" ", 1)
                    if len(parts) != 2: continue
                    ts, content = parts[0], parts[1]
                    
                    if ts > self._last_log_ts[svc]:
                        new_lines.append(content)
                        if ts > latest_ts:
                            latest_ts = ts
                            
                self._last_log_ts[svc] = latest_ts
                result[svc] = new_lines
                for l in new_lines:
                    self._log_buf[svc].append(l)
            except Exception as e:
                result[svc] = []
        return result

    async def _execute_blue_response(self, response: dict, service: str):
        action = response.get("action")
        ip     = response.get("src_ip", "unknown")
        t0     = time.time()
        turn   = self.state["turn"]

        if action == "block_ip" and ip != "unknown":
            await block_ip(ip, service)
            self.blue_agent.blocked_ips.add(ip)
            await self.broadcast("orchestrator_log", {
                "ts":    _ts(),
                "level": "BLUE",
                "msg":   f"[Turn {turn}] 🚫 [VIRTUAL-BLOCK] Blue blocked IP {ip} on {service} "
                         f"(class={response.get('attack_class','?')}, conf={int((response.get('confidence') or 0)*100)}%)",
            })

            # ── VIRTUAL BLOCK ENFORCEMENT ───────────────────────────
            # If Blue successfully flags Red's IP (not a human FP), block Red from attacking
            # that service at the Python RL environment layer.
            if ip not in HUMAN_IPS:
                from agents.red.env import ACTION_TO_SERVICE, S_BLOCKED_SQLI, _DIRECT_ACTION_IDX
                if hasattr(self, "env"):
                    for action_id, svc in ACTION_TO_SERVICE.items():
                        if svc == service and 1 <= action_id <= 6:
                            offset = _DIRECT_ACTION_IDX.get(action_id)
                            if offset is not None:
                                self.env._state[S_BLOCKED_SQLI + offset] = 1.0

            # Auto-unblock after 15 seconds to allow Red to pivot and adapt
            asyncio.create_task(self._auto_unblock(ip, delay=15))

        elif action == "rate_limit" and ip != "unknown":
            await add_rate_limit(service, ip)
            await self.broadcast("orchestrator_log", {
                "ts":    _ts(),
                "level": "BLUE",
                "msg":   f"[Turn {turn}] 🐢 [VIRTUAL-RATE-LIMIT] Blue rate-limited IP {ip} on {service} "
                         f"(class={response.get('attack_class','?')}, conf={int((response.get('confidence') or 0)*100)}%)",
            })

        elif action == "add_waf_rule":
            rule = response.get("attack_class", "unknown")
            self.blue_agent.waf_rules.append(rule)
            await self.broadcast("orchestrator_log", {
                "ts":    _ts(),
                "level": "BLUE",
                "msg":   f"[Turn {turn}] 🛡 [WAF-RULE] Blue added WAF rule for '{rule}' on {service} "
                         f"(conf={int((response.get('confidence') or 0)*100)}%)",
            })


    async def _auto_unblock(self, ip: str, delay: int):
        await asyncio.sleep(delay)
        await unblock_ip(ip)
        self.blue_agent.blocked_ips.discard(ip)
        # Also clear the corresponding blocked bit in the Red env observation
        # so the PPO model knows the service is accessible again
        from agents.red.env import ACTION_TO_SERVICE, S_BLOCKED_SQLI, _DIRECT_ACTION_IDX
        for action_id, svc in ACTION_TO_SERVICE.items():
            if 1 <= action_id <= 6:
                offset = _DIRECT_ACTION_IDX.get(action_id)
                if offset is not None:
                    self.env._state[S_BLOCKED_SQLI + offset] = 0.0
        self.env._state[18] = 0.0  # clear S_BLUE_ALERT

    def _snapshot(self) -> dict:
        m        = self.state["metrics"]
        attempted = max(m["attacks_attempted"], 1)
        # Block rate is only over ACTUAL attack turns (excludes false positives)
        blocked_on_attacks = m["attacks_blocked"]
        block_rate = round(blocked_on_attacks / attempted * 100, 1)
        return {
            "turn":              self.state["turn"],
            "attacks_attempted": m["attacks_attempted"],
            "attacks_blocked":   m["attacks_blocked"],
            "false_positives":   m["false_positives"],
            "human_fp":          m.get("human_fp", 0),
            "human_requests":    m.get("human_requests", 0),
            "block_rate":        block_rate,
            "flags_captured":    m["flags_captured"],
            "services_up":       sum(1 for s in self.state["services"].values() if s["up"]),
            # MTTD: time from logs-available to first detection (not counting the 1.5s sleep)
            "mttd":              round(float(np.mean(m["mttd_samples"])), 3) if m["mttd_samples"] else 0,
            # MTTR: time from logs-available to response executed
            "mttr":              round(float(np.mean(m["mttr_samples"])), 3) if m["mttr_samples"] else 0,
            "red":               self.state["red"],
            "blue":              {
                **self.state["blue"],
                "online_weight":  round(self.blue_agent.online_weight, 3),
                "live_threshold": round(self.blue_agent.live_threshold, 3),
                "online_samples": self.blue_agent._online_samples,
            },
            "services":          self.state["services"],
            "timeline_tail":     self.state["timeline"][-20:],
        }

def _ts():
    return datetime.utcnow().isoformat()