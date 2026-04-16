"""
Red Agent — Custom Gymnasium Environment
Fixed bugs:
  1. _sim_exploit() always returned failure → PPO learned nothing
  2. Actions 7-9 had no ACTION_FN entries → chain attacks silently failed
  3. _is_patch_window_active() compared action names to service names → never matched
  4. next_payload() can return None → payload[:60] crash
  5. _try_exfiltrate() required 3 flags → unreachable win condition
  6. Chain unlock used S_CRASH_FLASK semantics → wrong indices
  7. Actions 7-9 tried/blocked mapped to nginx's slots (index 11/17)
"""

import gymnasium as gym
import numpy as np
from gymnasium import spaces

from .tools import ACTION_FN, ACTION_NAMES
from .mutation_engine import MutationEngine, MUTATION_TABLE
from .response_analyzer import AttackResponse

# ─── State Vector Layout (32 dimensions) ────────────────────────────────────
#
#  [0-5]   port_open[6]           — which ports responded
#  [6-11]  exploit_tried[6]       — actions 1-6 attempted this episode
#  [12-17] exploit_blocked[6]     — actions 1-6 blocked by Blue
#  [18]    blue_alert_active
#  [19-24] service_patched[6]     — Blue has fully patched this service
#  [25-27] chain_tried[3]         — actions 7-9 attempted (FIX: dedicated slots)
#  [28-30] chain_unlocked[3]      — prerequisite chain steps completed
#  [31]    time_progress

S_PORT_FLASK    = 0;  S_PORT_NODE    = 1;  S_PORT_JWT   = 2
S_PORT_PG       = 3;  S_PORT_REDIS   = 4;  S_PORT_NGINX = 5
S_TRIED_SQLI    = 6;  S_TRIED_PATH   = 7;  S_TRIED_JWT  = 8
S_TRIED_PG      = 9;  S_TRIED_REDIS  = 10; S_TRIED_NGX  = 11
S_BLOCKED_SQLI  = 12; S_BLOCKED_PATH = 13; S_BLOCKED_JWT = 14
S_BLOCKED_PG    = 15; S_BLOCKED_REDIS= 16; S_BLOCKED_NGX = 17
S_BLUE_ALERT    = 18
S_PATCHED_FLASK = 19; S_PATCHED_NODE = 20; S_PATCHED_JWT = 21
S_PATCHED_PG    = 22; S_PATCHED_REDIS= 23; S_PATCHED_NGX = 24
# FIX: dedicated chain slots — no longer aliasing S_CRASH_*
S_CHAIN_TRIED_0 = 25  # action 7 (sqli_cred_dump)
S_CHAIN_TRIED_1 = 26  # action 8 (postgres_with_creds)
S_CHAIN_TRIED_2 = 27  # action 9 (nginx_to_pg_config)
S_CHAIN_UNLOCK_0= 28  # sqli_cred_dump succeeded → creds available
S_CHAIN_UNLOCK_1= 29  # postgres_with_creds succeeded → DB access
S_CHAIN_UNLOCK_2= 30  # nginx_to_pg_config succeeded → config read
S_TIME_PROGRESS = 31

STATE_DIM   = 32
MAX_STEPS   = 60
NUM_ACTIONS = 11   # 0-6: direct exploits, 7-9: chains, 10: exfiltrate

# FIX: map action number → service name for patch-window detection
ACTION_TO_SERVICE = {
    1: "flask-sqli",
    2: "node-pathtraversal",
    3: "jwt-auth",
    4: "postgres-weak",
    5: "redis-noauth",
    6: "nginx-misconfig",
    7: "flask-sqli",        # sqli_cred_dump targets flask
    8: "postgres-weak",     # postgres_with_creds targets postgres
    9: "nginx-misconfig",   # nginx_to_pg_config targets nginx
}

# FIX: map action 1-6 → tried/blocked state indices
_DIRECT_ACTION_IDX = {1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5}  # offsets from base

REWARDS = {
    "timestep":             -0.5,
    "attack_blocked":       -2.0,
    "patch_window_exploit": 20.0,   # hit service while Blue is mid-patching
    "flag_captured":        15.0,
    "flag_captured_full":   50.0,   # via exfiltrate action
    "new_vuln_confirmed":    5.0,   # 500 / partial exec
    "new_path_found":        3.0,   # coverage reward
    "exploit_success":       5.0,   # no flag but access gained
    "exploit_fail":         -1.0,
    "pivot_successful":     10.0,   # chain unlock
    "exfiltrate_success":   50.0,
    "scan_new":              2.0,   # port scan first time
}

# FIX: realistic simulation probabilities per action
_SIM_PROBS = {
    1: 0.75,   # sqli — high success
    2: 0.70,   # path traversal
    3: 0.80,   # jwt none — very easy
    4: 0.55,   # postgres brute — moderate
    5: 0.85,   # redis noauth — almost always works
    6: 0.65,   # nginx alias
    7: 0.50,   # sqli cred dump — harder
    8: 0.55,   # postgres with creds (needs unlock)
    9: 0.45,   # nginx to pg config
}
_FLAG_ACTIONS  = {1, 2, 3, 4, 5, 6}   # these directly yield a flag token (added 4: postgres)
_CHAIN_UNLOCKS = {
    7: "chain_0",   # sqli_cred_dump → creds
    8: "chain_1",   # postgres_with_creds → db access
    9: "chain_2",   # nginx_to_pg_config → config
}
_CHAIN_SLOT_MAP = {"chain_0": S_CHAIN_UNLOCK_0,
                   "chain_1": S_CHAIN_UNLOCK_1,
                   "chain_2": S_CHAIN_UNLOCK_2}


class NetworkAttackEnv(gym.Env):
    metadata = {"render_modes": ["human"]}

    def __init__(self, use_real_cluster=True, blue_defense_prob=0.0,
                 use_llm=True):
        super().__init__()
        self.use_real_cluster  = use_real_cluster
        self.blue_defense_prob = blue_defense_prob
        self.use_llm           = use_llm

        self.observation_space = spaces.Box(
            low=0.0, high=1.0, shape=(STATE_DIM,), dtype=np.float32
        )
        self.action_space = spaces.Discrete(NUM_ACTIONS)
        self._reset_state()

    def _reset_state(self):
        self._state           = np.zeros(STATE_DIM, dtype=np.float32)
        self._step_count      = 0
        self._flags_found     = []   # union of real + sim (kept for training compat)
        self._real_flags_found= []   # ONLY flags from live HTTP responses
        self._sim_flags_found = []   # ONLY sim-generated flags (use_real_cluster=False)
        self._total_reward    = 0.0
        self._chain_data      = {}
        self._mutation_engine = MutationEngine()
        self._last_responses  = {}   # action_name → AttackResponse
        # Seed port-open bits: in real cluster all services are always running
        if self.use_real_cluster:
            for i in range(6):
                self._state[i] = 1.0

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        self._reset_state()
        return self._state.copy(), {}

    def step(self, action: int):
        self._step_count += 1
        self._state[S_TIME_PROGRESS] = min(self._step_count / MAX_STEPS, 1.0)
        reward = REWARDS["timestep"]

        if action == 10:
            terminated, r = self._try_exfiltrate()
        elif action == 0:
            r = self._do_port_scan()
            terminated = False
        elif 1 <= action <= 9:
            terminated, r = self._run_exploit_adaptive(action)
        else:
            r, terminated = REWARDS["exploit_fail"], False

        reward += r
        self._total_reward += reward
        truncated = self._step_count >= MAX_STEPS

        info = {
            "step":         self._step_count,
            "action_name":  ACTION_NAMES.get(action, f"action_{action}"),
            "reward":       round(reward, 3),
            "total_reward": round(self._total_reward, 3),
            "flags_found":  len(self._flags_found),
        }
        return self._state.copy(), reward, terminated, truncated, info

    # ─── Port Scan ───────────────────────────────────────────────────────────

    def _do_port_scan(self) -> float:
        """Scan ports. Reward only on first successful scan."""
        already_known = self._state[S_PORT_FLASK] == 1.0

        if self.use_real_cluster:
            from .tools import port_scan
            result = port_scan()
            ports  = result.get("data", {})
            key_map = ["flask", "node", "jwt", "postgres", "redis", "nginx"]
            new_ports = 0
            for i, k in enumerate(key_map):
                was = self._state[i]
                now = float(ports.get(k, False))
                if now and not was:
                    new_ports += 1
                self._state[i] = now
            return new_ports * REWARDS["scan_new"]
        else:
            # Simulation: all ports open
            if already_known:
                return 0.0
            for i in range(6):
                self._state[i] = 1.0
            return REWARDS["scan_new"]

    # ─── Core Exploit Loop ────────────────────────────────────────────────────

    def _run_exploit_adaptive(self, action: int):
        """
        FIX: Actions 1-6 use tried/blocked from their dedicated indices.
             Actions 7-9 use dedicated chain_tried slots (25-27).
        """
        action_name = ACTION_NAMES.get(action, f"action_{action}")

        # ── Tried / blocked index lookup ─────────────────────────────────────
        if 1 <= action <= 6:
            offset      = _DIRECT_ACTION_IDX[action]
            tried_idx   = S_TRIED_SQLI   + offset   # 6-11
            blocked_idx = S_BLOCKED_SQLI + offset   # 12-17

            # Virtual Block active: abort attempt before sending to target
            if self._state[blocked_idx] == 1.0:
                return False, REWARDS["attack_blocked"]
        else:
            # Chain actions (7-9): dedicated slots
            chain_offset = action - 7                # 0, 1, 2
            tried_idx    = S_CHAIN_TRIED_0 + chain_offset   # 25-27
            blocked_idx  = None   # chain actions can't be "blocked" the same way

        # ── Chain prerequisite check ─────────────────────────────────────────
        # Action 8 (postgres_with_creds) needs creds from action 7 first
        if action == 8 and self._state[S_CHAIN_UNLOCK_0] != 1.0:
            self._state[tried_idx] = 1.0
            return False, REWARDS["exploit_fail"] * 0.5   # soft fail, not stuck

        # ── Simulated Blue defense ────────────────────────────────────────────
        if np.random.random() < self.blue_defense_prob:
            if blocked_idx is not None:
                self._state[blocked_idx] = 1.0
            self._state[S_BLUE_ALERT] = 1.0
            return False, REWARDS["attack_blocked"]

        # Check if service is patched (DEPRECATED - always False in NIDS mode)
        svc_patched = False


        # ── Get payload from MutationEngine (LLM or Tier-1) ──────────────────
        payload = None
        if self.use_llm and action in (1, 2, 6):
            last_resp = self._last_responses.get(action_name)
            full_ctx  = {
                "act":              int(self._state[S_TIME_PROGRESS] * 3) + 1,
                "chain_unlocked":   [i for i in range(3)
                                     if self._state[S_CHAIN_UNLOCK_0 + i] == 1.0],
            }
            try:
                raw_payload, tier = self._mutation_engine.next_payload(
                    action_name, last_resp, full_ctx
                )
                # FIX: guard against None from exhausted iterator
                if raw_payload:
                    payload = raw_payload
                    print(f"[MutEngine] {action_name} tier={tier} "
                          f"payload={str(payload)[:60]}")
            except Exception as e:
                print(f"[MutEngine] Error: {e}")

        # ── Execute ───────────────────────────────────────────────────────────
        if self.use_real_cluster:
            result = self._execute_real(action, payload)
        else:
            # FIX: realistic simulation — was always returning False
            result = self._sim_exploit(action)

        self._state[tried_idx] = 1.0

        # ── Record response for MutationEngine feedback ───────────────────────
        ar = result.get("response")
        is_new_path = False
        if ar is not None and payload:
            is_new_path = self._mutation_engine.coverage.record(payload, ar)
            self._last_responses[action_name] = ar

        # ── Compute reward ────────────────────────────────────────────────────
        reward = 0.0

        if result.get("flag"):
            flag = result["flag"]
            is_sim_flag = "sim_" in str(flag)

            if self.use_real_cluster and is_sim_flag:
                # Guard: _execute_real should never produce sim flags.
                # Emit a warning so any future regression surfaces immediately.
                import warnings
                warnings.warn(f"[Red] Sim flag leaked into real-cluster mode: {flag}",
                              RuntimeWarning, stacklevel=2)
            else:
                # Track in the shared union list (used by training / render)
                if flag not in self._flags_found:
                    self._flags_found.append(flag)
                # Route into the correct sub-list for accurate battle reporting
                if is_sim_flag:
                    if flag not in self._sim_flags_found:
                        self._sim_flags_found.append(flag)
                else:
                    if flag not in self._real_flags_found:
                        self._real_flags_found.append(flag)

            reward += REWARDS["flag_captured"]

        elif result.get("unlocks"):
            # Chain step succeeded — unlock next action
            unlock_key = result["unlocks"]
            slot = _CHAIN_SLOT_MAP.get(unlock_key)
            if slot is not None:
                self._state[slot] = 1.0
                self._chain_data[unlock_key] = result.get("data", "")
                reward += REWARDS["pivot_successful"]

        elif ar and getattr(ar, "partial_exec", False):
            # 500 response = server processed our input = interesting path
            reward += REWARDS["new_vuln_confirmed"]
        elif is_new_path:
            # New response fingerprint = unexplored code path = AFL-style signal
            reward += REWARDS["new_path_found"]
        elif result.get("success"):
            reward += REWARDS["exploit_success"]
        else:
            reward += REWARDS["exploit_fail"]

        return False, reward

    def _execute_real(self, action: int, payload=None) -> dict:
        """Execute against live Docker cluster."""
        try:
            if action == 1 and payload:
                from .tools import http_probe_sqli
                return http_probe_sqli(payload)
            elif action == 2 and payload:
                from .tools import path_traversal
                return path_traversal(payload)
            elif action == 6 and payload:
                from .tools import nginx_alias_traversal
                return nginx_alias_traversal(payload)
            elif action in ACTION_FN:
                return ACTION_FN[action]()
            else:
                return {"success": False, "data": f"no fn for action {action}",
                        "flag": None}
        except Exception as e:
            return {"success": False, "data": str(e), "flag": None}

    # FIX: _sim_exploit now has realistic probabilities per action
    def _sim_exploit(self, action: int) -> dict:
        """
        Simulation mode for training.
        FIXED: was returning all-False — PPO learned nothing.
        Now uses per-action success probabilities so training is meaningful.
        """
        prob    = _SIM_PROBS.get(action, 0.5)
        success = np.random.random() < prob

        if not success:
            return {"success": False, "flag": None, "data": "sim_fail",
                    "response": None}

        # Direct exploit → return flag
        if action in _FLAG_ACTIONS:
            flag = f"FLAG{{sim_{ACTION_NAMES.get(action, 'unk')}}}"
            return {"success": True, "flag": flag,
                    "data": f"sim_success_{action}", "response": None}

        # Chain action → unlock next step
        if action in _CHAIN_UNLOCKS:
            return {"success": True, "flag": None,
                    "data": f"sim_chain_{action}",
                    "unlocks": _CHAIN_UNLOCKS[action],
                    "response": None}

        return {"success": True, "flag": None, "data": "sim_access", "response": None}

        # "patching" services are tracked separately by the blue agent.
        # During sim, we use a probabilistic proxy based on time.
        if not self.use_real_cluster:
            # In simulation: 20% chance we're in a patch window
            return np.random.random() < 0.2
        # In real cluster: checked via shared reference to blue agent state
        return getattr(self, '_patch_window_services', set()) and \
               service in getattr(self, '_patch_window_services', set())

    def set_patch_window(self, services: set):
        """Called by battle.py to tell env which services are mid-patch."""
        self._patch_window_services = services

    # FIX: win condition checks _real_flags_found (live HTTP) in real-cluster mode,
    # so simulation-generated FLAG{sim_...} strings can't trigger a victory.
    def _try_exfiltrate(self):
        flags = self._real_flags_found if self.use_real_cluster else self._flags_found
        if flags:
            return True, REWARDS["exfiltrate_success"]
        return False, REWARDS["exploit_fail"]

    def render(self):
        phase = int(self._state[S_TIME_PROGRESS] * 3) + 1
        print(f"  T={self._step_count:3d} act={phase} "
              f"flags={len(self._flags_found)} "
              f"reward={self._total_reward:+.1f} "
              f"chains={int(self._state[S_CHAIN_UNLOCK_0])}"
              f"{int(self._state[S_CHAIN_UNLOCK_1])}"
              f"{int(self._state[S_CHAIN_UNLOCK_2])}")