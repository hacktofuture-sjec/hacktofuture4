"""
Red Agent Training — PPO via stable-baselines3
Run this script to produce red_ppo.zip in agents/models/
"""

import os, sys
import numpy as np
from stable_baselines3 import PPO
from stable_baselines3.common.env_util import make_vec_env
from stable_baselines3.common.callbacks import (
    EvalCallback, CheckpointCallback, BaseCallback
)
from stable_baselines3.common.monitor import Monitor

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from red.env import NetworkAttackEnv

MODELS_DIR = os.path.join(os.path.dirname(__file__), "../models")
os.makedirs(MODELS_DIR, exist_ok=True)

# ─── Training phases ──────────────────────────────────────────────────────────
# Phase 1 — pure exploration against live cluster, no Blue defense
# Phase 2 — add simulated Blue defense (ramp blue_defense_prob)
# Phase 3 — evaluate final policy

PHASES = [
    {"name": "exploration",        "steps": 30_000, "blue_prob": 0.0},
    {"name": "adversarial_easy",   "steps": 30_000, "blue_prob": 0.2},
    {"name": "adversarial_hard",   "steps": 40_000, "blue_prob": 0.4},
]

class TrainingLogger(BaseCallback):
    """Prints a summary line every N steps."""
    def __init__(self, log_interval=5000):
        super().__init__()
        self.log_interval = log_interval
        self._ep_rewards  = []

    def _on_step(self) -> bool:
        if self.locals.get("dones", [False])[0]:
            info = self.locals["infos"][0]
            self._ep_rewards.append(info.get("total_reward", 0))

        if self.num_timesteps % self.log_interval == 0 and self._ep_rewards:
            avg = np.mean(self._ep_rewards[-20:])
            print(f"  step={self.num_timesteps:>7,} | "
                  f"ep_reward (last 20 avg)={avg:+.1f}")
        return True


def make_env(blue_prob: float, use_cluster: bool = True):
    def _init():
        env = NetworkAttackEnv(
            use_real_cluster=use_cluster,
            blue_defense_prob=blue_prob
        )
        return Monitor(env)
    return _init


def train():
    print("=" * 60)
    print("Red Agent — PPO Training")
    print("=" * 60)

    # Check if cluster is reachable
    try:
        import requests
        requests.get("http://localhost:5000/health", timeout=2)
        # FORCE THIS TO FALSE FOR FAST TRAINING
        use_cluster = False 
        print("[Red] ✓ Live Docker cluster detected — BUT forcing simulation for fast training")
    except:
        use_cluster = False
        print("[Red] ⚠ Cluster unreachable — using simulation mode")
        print("      Start the cluster first: docker compose up -d")

    model = None

    for phase in PHASES:
        print(f"\n{'─'*60}")
        print(f"Phase: {phase['name']}  |  steps={phase['steps']:,}  "
              f"|  blue_defense_prob={phase['blue_prob']}")
        print(f"{'─'*60}")

        env = make_vec_env(
            make_env(phase["blue_prob"], use_cluster),
            n_envs=1
        )
        eval_env = make_vec_env(
            make_env(phase["blue_prob"], use_cluster),
            n_envs=1
        )

        if model is None:
            model = PPO(
                "MlpPolicy",
                env,
                verbose=0,
                learning_rate=3e-4,
                n_steps=512,
                batch_size=64,
                n_epochs=10,
                gamma=0.99,
                ent_coef=0.01,      # encourage exploration
                policy_kwargs={"net_arch": [128, 128]},
            )
        else:
            model.set_env(env)

        callbacks = [
            TrainingLogger(log_interval=5000),
            CheckpointCallback(
                save_freq=10_000,
                save_path=MODELS_DIR,
                name_prefix=f"red_ppo_{phase['name']}"
            ),
        ]

        model.learn(
            total_timesteps=phase["steps"],
            callback=callbacks,
            reset_num_timesteps=False,
        )
        env.close()
        eval_env.close()

    # ── Save final model ──────────────────────────────────────────────────────
    final_path = os.path.join(MODELS_DIR, "red_ppo")
    model.save(final_path)
    print(f"\n✅ Training complete.")
    print(f"   Final model saved → {final_path}.zip")

    # ── Quick evaluation ──────────────────────────────────────────────────────
    print("\n[Eval] Running 10 evaluation episodes...")
    eval_env = NetworkAttackEnv(use_real_cluster=use_cluster, blue_defense_prob=0.0)
    wins, total_rewards, flag_counts = 0, [], []

    for ep in range(10):
        obs, _ = eval_env.reset()
        done = False
        ep_reward = 0
        while not done:
            action, _ = model.predict(obs, deterministic=True)
            obs, reward, term, trunc, info = eval_env.step(int(action))
            ep_reward += reward
            done = term or trunc
        if info.get("flags_found", 0) > 0:
            wins += 1
        total_rewards.append(ep_reward)
        flag_counts.append(info.get("flags_found", 0))

    print(f"  Win rate (flag exfiltrated): {wins}/10")
    print(f"  Avg episode reward:          {np.mean(total_rewards):+.1f}")
    print(f"  Avg flags found:             {np.mean(flag_counts):.1f}")


if __name__ == "__main__":
    train()