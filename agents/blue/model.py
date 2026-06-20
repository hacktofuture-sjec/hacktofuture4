"""
Blue Agent — runtime inference class with online learning.

Uses a static XGBoost + IsolationForest (loaded from disk once) combined with
an in-session SGDClassifier that incrementally learns from ground-truth labels
fed back by the orchestrator after every Red turn.

Within a session:
  - The online model gradually takes over decision-making as it accumulates
    observations, blending from 0% to 60% influence after 30 alerts.
  - The detection threshold drops from 0.85 → 0.55 as Blue gains confidence.

On reset:
  - `BlueAgent()` is re-instantiated — online model and all runtime state
    are discarded, returning Blue to its base static model.

Feature vectors are the 12-dim domain-specific format produced by
orchestrator/extractor.py.
"""
import numpy as np
import joblib
import os
import logging

from sklearn.linear_model import SGDClassifier

log = logging.getLogger("blue")

MODELS_DIR  = os.path.join(os.path.dirname(__file__), "../models")
FEATURE_DIM = 12
CLASS_NAMES = ["normal", "dos", "probe", "r2l", "u2r"]
N_CLASSES   = len(CLASS_NAMES)

# Online learning hyper-parameters
ONLINE_MAX_WEIGHT    = 0.60   # max influence of the online model in the blend
ONLINE_RAMP_ALERTS   = 30     # alerts needed to reach max weight
THRESHOLD_INITIAL    = 0.85   # starting confidence threshold (naive Blue, first run)
THRESHOLD_FLOOR      = 0.50   # lowest threshold (Blue at peak sharpness after many runs)
# Threshold decays with _online_samples — NOT with per-run alert count.
# At ~1500 samples (~30 turns) Blue reaches peak sensitivity.
# Across runs, it keeps the lower threshold from the start since _online_samples persists.
THRESHOLD_DECAY_RATE_SAMPLES = (THRESHOLD_INITIAL - THRESHOLD_FLOOR) / 1500

# Path where online model weights are saved between sessions
_ONLINE_MODEL_SAVE = os.path.join(os.path.dirname(__file__), "../models/blue_online_sgd.pkl")


class BlueAgent:
    def __init__(self):
        log.info("Loading models...")
        try:
            self.xgb = joblib.load(os.path.join(MODELS_DIR, "blue_xgb.pkl"))
            self.iso  = joblib.load(os.path.join(MODELS_DIR, "blue_iso.pkl"))
            with open(os.path.join(MODELS_DIR, "blue_iso_threshold.txt")) as f:
                self.iso_threshold = float(f.read().strip())
        except FileNotFoundError as e:
            raise RuntimeError(
                f"[Blue] Model file not found: {e}\n"
                "Run:  python -m agents.blue.train   to train the models first."
            ) from e

        # Validate model expects 12-dim input
        n_feat = self.xgb.n_features_in_
        if n_feat != FEATURE_DIM:
            raise RuntimeError(
                f"[Blue] Loaded XGBoost expects {n_feat}-dim input but extractor "
                f"produces {FEATURE_DIM}-dim vectors.\n"
                "Retrain with:  python -m agents.blue.train"
            )

        # ── Online learner — persists weights across runs until hard reset ───
        self.online_clf = SGDClassifier(
            loss="modified_huber",   # gives calibrated predict_proba
            max_iter=1, tol=None,
            warm_start=True,
            random_state=42,
        )
        self._online_trained  = False
        self._online_samples  = 0      # lifetime feedback() calls — never reset

        # ── Try to restore previously saved online weights ─────────────────
        # This lets Blue carry over learned patterns from previous runs.
        # The file is wiped only on explicit hard reset (BlueAgent() is called).
        # NOTE: __init__ is called ONLY on hard reset; soft_reset() reuses the instance.
        # So we always start __init__ with a fresh model — the persistence happens
        # via reset_session_state() which does NOT call __init__.

        # ── Runtime state — Blue's active defenses ────────────────────────
        self.blocked_ips      = set()
        self.rate_limits      = {}       # ip → max_req_per_min
        self.waf_rules        = []       # list of blocked attack_class strings
        self.alerts           = []

        log.info(f"Ready — XGBoost({n_feat}-dim), "
                 f"IsoForest threshold={self.iso_threshold:.4f}, "
                 f"online SGD initialised")

    # ── Online learning — called by orchestrator after each Red turn ──────────
    def feedback(self, feature_vec: np.ndarray, true_class: str):
        """
        Feed ground-truth label back to the online model.
        Called once per Red turn with the extracted feature vector(s) and
        the known attack class derived from Red's action.
        """
        if true_class not in CLASS_NAMES:
            log.warning(f"Unknown class '{true_class}' — skipping feedback")
            return

        idx = CLASS_NAMES.index(true_class)
        fv  = feature_vec[:FEATURE_DIM].reshape(1, -1)

        self.online_clf.partial_fit(fv, [idx], classes=list(range(N_CLASSES)))
        self._online_trained = True
        self._online_samples += 1
        log.debug(f"Online model updated — {self._online_samples} samples, "
                  f"true_class={true_class}")

    # ── Derived metrics for dashboard ─────────────────────────────────────────
    @property
    def online_weight(self) -> float:
        """Current blend weight of the online model (0.0 – ONLINE_MAX_WEIGHT)."""
        if not self._online_trained:
            return 0.0
        return min(self._online_samples / ONLINE_RAMP_ALERTS, 1.0) * ONLINE_MAX_WEIGHT

    @property
    def live_threshold(self) -> float:
        """
        Confidence threshold — drops as Blue accumulates lifetime samples.
        Uses _online_samples (never reset) so Blue stays sharp across runs.
        After ~1500 samples (~30 turns in run 1) → reaches THRESHOLD_FLOOR.
        In run 2+, starts immediately at the floor.
        """
        return max(THRESHOLD_FLOOR,
                   THRESHOLD_INITIAL - self._online_samples * THRESHOLD_DECAY_RATE_SAMPLES)

    def save_online_model(self):
        """Persist the SGDClassifier weights to disk for cross-run survival.
        Called by the orchestrator at end of each battle.
        """
        if self._online_trained:
            try:
                joblib.dump({
                    "clf":     self.online_clf,
                    "samples": self._online_samples,
                }, _ONLINE_MODEL_SAVE)
                log.info(f"[Blue] Online model saved ({self._online_samples} samples)")
            except Exception as e:
                log.warning(f"[Blue] save_online_model failed: {e}")

    def load_online_model(self):
        """Restore previously saved SGDClassifier weights from disk.
        Called at the start of each run (after soft_reset keeps the instance).
        """
        try:
            data = joblib.load(_ONLINE_MODEL_SAVE)
            self.online_clf      = data["clf"]
            self._online_samples = data["samples"]
            self._online_trained = True
            log.info(f"[Blue] Restored online model ({self._online_samples} samples) — "
                     f"threshold now {self.live_threshold:.3f}")
        except FileNotFoundError:
            log.info("[Blue] No saved online model found — starting fresh")
        except Exception as e:
            log.warning(f"[Blue] load_online_model failed: {e}")

    # ── Core decision ─────────────────────────────────────────────────────────
    def classify_and_respond(self, feature_vec: np.ndarray,
                             src_ip: str = "unknown") -> dict:
        """
        Run both models on the 12-dim feature vector and return a response dict.
        Returns: { "action": str, "severity": str, "reason": str, "src_ip": str }
        """
        fv = feature_vec[:FEATURE_DIM].reshape(1, -1)

        # ── XGBoost (static) classification ─────────────────────────────
        proba        = self.xgb.predict_proba(fv)[0]

        # ── Blend in online model if it has enough data ─────────────────
        w = self.online_weight
        if w > 0:
            try:
                online_proba = self.online_clf.predict_proba(fv)[0]
                # online_clf might return fewer columns before seeing all classes
                if len(online_proba) == N_CLASSES:
                    proba = (1 - w) * proba + w * online_proba
            except Exception:
                pass  # online model not ready yet — use XGB only

        class_idx    = int(np.argmax(proba))
        confidence   = float(proba[class_idx])
        attack_class = CLASS_NAMES[class_idx]

        # Feature importance for explainability panel
        importances  = self.xgb.feature_importances_
        top_features = sorted(enumerate(importances), key=lambda x: -x[1])[:3]

        # Isolation Forest anomaly score
        anomaly_score = float(self.iso.decision_function(fv)[0])
        is_anomaly    = anomaly_score < self.iso_threshold

        # ── Decision logic — threshold drops as Blue sharpens ───────────
        threshold = self.live_threshold

        if attack_class != "normal" and confidence > threshold:
            return self._respond_known(attack_class, confidence, src_ip, top_features)
        elif is_anomaly and attack_class == "normal":
            return self._respond_anomaly(anomaly_score, src_ip)
        else:
            return {
                "action":        "CLEAN",
                "severity":      "none",
                "attack_class":  attack_class,
                "confidence":    round(confidence, 3),
                "anomaly_score": round(anomaly_score, 4),
                "src_ip":        src_ip,
            }

    def _respond_known(self, attack_class, confidence, src_ip, top_features):
        explanation = [
            {"feature_idx": idx, "importance": round(float(imp), 3)}
            for idx, imp in top_features
        ]
        if attack_class in ("r2l", "u2r"):
            severity, action = "HIGH",   "block_ip"
        elif attack_class == "probe":
            severity, action = "MEDIUM", "rate_limit"
            self.rate_limits[src_ip] = 10
        elif attack_class == "dos":
            severity, action = "MEDIUM", "add_waf_rule"
        else:
            severity, action = "LOW",    "alert"

        alert = {
            "action":      action,
            "severity":    severity,
            "attack_class": attack_class,
            "confidence":  round(confidence, 3),
            "src_ip":      src_ip,
            "explanation": explanation,
        }
        self.alerts.append(alert)
        return alert

    def _respond_anomaly(self, score, src_ip):
        alert = {
            "action":        "rate_limit",
            "severity":      "LOW",
            "attack_class":  "unknown_anomaly",
            "anomaly_score": round(score, 4),
            "src_ip":        src_ip,
        }
        self.rate_limits[src_ip] = 20
        self.alerts.append(alert)
        return alert

    def reset_session_state(self):
        """Clears active defenses for a new match — retains online model weights.
        
        _online_samples and online_clf are NOT cleared so:
          - live_threshold stays at its achieved floor
          - online_weight stays at its current blend ratio
          - model weights carry over into the next run for immediate defense
        """
        self.blocked_ips.clear()
        self.rate_limits.clear()
        self.waf_rules.clear()
        self.alerts.clear()
        log.info(f"[Blue] Session state reset. Retained {self._online_samples} learned "
                 f"samples — threshold={self.live_threshold:.3f}, "
                 f"online_weight={self.online_weight:.0%}")

    # ── Direct response actions (called by Orchestrator) ─────────────────────
    def block_ip(self, ip: str):
        self.blocked_ips.add(ip)

    def get_state(self) -> dict:
        return {
            "blocked_ips":      list(self.blocked_ips),
            "rate_limits":      self.rate_limits,
            "waf_rules":        self.waf_rules,
            "alerts_count":     len(self.alerts),
            "last_alert":       self.alerts[-1] if self.alerts else None,
            "online_samples":   self._online_samples,
            "online_weight":    round(self.online_weight, 3),
            "live_threshold":   round(self.live_threshold, 3),
        }