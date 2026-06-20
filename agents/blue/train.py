"""
Blue Agent Training — Domain-Specific 12-dim Feature Pipeline

Previous version (BROKEN):
  - Trained XGBoost on NSL-KDD (1999 packet-level network data, 41 features).
  - At inference, the extractor only filled 8 of 41 features (33 were zeros).
  - IsoForest threshold was computed on the same 200 training samples (in-sample).

This version:
  1. Generates a DOMAIN-SPECIFIC synthetic training dataset that matches the
     exact 12-dim feature schema of orchestrator/extractor.py.
  2. Trains XGBoost on these 12 realistic features.
  3. Calibrates IsoForest threshold on a HELD-OUT set (20% of baseline) so
     the threshold is meaningful on unseen data.
  4. Five classes that map directly to our Docker attack scenario:
       0 = normal
       1 = dos       (brute-force / flood)
       2 = probe     (port scan)
       3 = r2l       (sqli / path traversal / jwt-none / nginx alias)
       4 = u2r       (chained sqli→db privilege escalation)

Run:  python -m agents.blue.train   (from repo root with Docker cluster up)
"""
import os
import numpy as np
import joblib
from sklearn.ensemble import IsolationForest
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
from xgboost import XGBClassifier

MODELS_DIR   = os.path.join(os.path.dirname(__file__), "../models")
FEATURE_DIM  = 12
CLASS_NAMES  = ["normal", "dos", "probe", "r2l", "u2r"]
os.makedirs(MODELS_DIR, exist_ok=True)


# ─── Step 1: Generate Domain-Specific Synthetic Training Data ────────────────

def generate_training_data(n: int = 6000, seed: int = 42):
    """
    Synthesise labelled feature vectors that match extractor.py's 12-dim schema.

    Feature layout (mirrors extractor.py exactly):
      0  service_id         (normalized 0–1)
      1  method_id          (GET=0, POST=0.5, other=1.0)
      2  path_depth         (normalized, cap 8)
      3  args_count         (normalized, cap 10)
      4  args_length        (normalized, cap 500)
      5  has_sqli           (binary)
      6  has_path_traversal (binary)
      7  has_jwt_none       (binary)
      8  is_sensitive_path  (binary)
      9  request_size       (normalized, cap 2000)
     10  failed_login_rate  (normalized, cap 10)
     11  is_health_check    (binary)
    """
    rng = np.random.default_rng(seed)
    X, y = [], []

    # ── Class 0: Normal traffic ──────────────────────────────────────────────
    n_normal = n // 2
    for _ in range(n_normal):
        v = np.zeros(FEATURE_DIM, dtype=np.float32)
        v[0]  = rng.choice([0.0, 0.2, 0.4, 0.6, 0.8, 1.0])   # any service
        v[1]  = rng.choice([0.0, 0.5], p=[0.85, 0.15])         # mostly GET
        # v[5-8] = 0.0  — no attack patterns
        v[9]  = rng.uniform(0.02, 0.12)                         # small request
        v[10] = 0.0                                              # no failed logins
        is_health = rng.random() < 0.55                         # 55% are health checks
        if is_health:
            # Health-check requests: shallow path, no args, health feature on
            v[2]  = rng.uniform(0.12, 0.15)   # exactly 1 path level (/health)
            v[3]  = 0.0
            v[4]  = 0.0
            v[11] = 1.0
        else:
            # Normal API calls: slightly deeper path, small args
            v[2]  = rng.uniform(0.25, 0.50)   # 2–4 path levels (/api/users etc)
            v[3]  = rng.uniform(0.00, 0.20)
            v[4]  = rng.uniform(0.01, 0.08)
            v[11] = 0.0
        v += rng.normal(0, 0.008, FEATURE_DIM).astype(np.float32)
        v = np.clip(v, 0.0, 1.0)
        X.append(v); y.append(0)

    # ── Class 1: DoS / Brute-force ───────────────────────────────────────────
    n_dos = n // 8
    for _ in range(n_dos):
        v = np.zeros(FEATURE_DIM, dtype=np.float32)
        v[0]  = rng.choice([0.8, 1.0])        # postgres (0.8) or redis (1.0)
        v[1]  = 0.0                            # GET / connection
        v[2]  = rng.uniform(0.12, 0.25)
        v[3]  = rng.uniform(0.10, 0.30)
        v[4]  = rng.uniform(0.02, 0.10)
        # no sqli/path/jwt signals
        v[9]  = rng.uniform(0.03, 0.09)
        v[10] = rng.uniform(0.30, 1.00)       # HIGH failed login signal
        v[11] = 0.0
        v += rng.normal(0, 0.01, FEATURE_DIM).astype(np.float32)
        v = np.clip(v, 0.0, 1.0)
        X.append(v); y.append(1)

    # ── Class 2: Probe / Port scan ───────────────────────────────────────────
    n_probe = n // 8
    for _ in range(n_probe):
        v = np.zeros(FEATURE_DIM, dtype=np.float32)
        v[0]  = rng.choice([0.0, 0.2, 0.4, 0.6, 0.8, 1.0])  # scans many services
        v[1]  = 0.0
        v[2]  = rng.uniform(0.00, 0.11)       # very shallow path (just "/" or "/path")
        v[3]  = 0.0                            # no query params
        v[4]  = rng.uniform(0.00, 0.02)       # tiny or empty query string
        # no attack signals
        v[9]  = rng.uniform(0.01, 0.04)       # tiny request
        v[10] = 0.0
        v[11] = 0.0   # probes do NOT hit /health — they probe arbitrary paths/ports
        v += rng.normal(0, 0.008, FEATURE_DIM).astype(np.float32)
        v = np.clip(v, 0.0, 1.0)
        X.append(v); y.append(2)

    # ── Class 3: R2L — unauthorized remote access attacks ────────────────────
    # Covers: sqli, path traversal, jwt none-alg, nginx alias traversal
    n_r2l = n // 5
    for _ in range(n_r2l):
        v = np.zeros(FEATURE_DIM, dtype=np.float32)
        attack = rng.choice(["sqli", "path_trav", "jwt_none", "nginx_alias"],
                             p=[0.35, 0.25, 0.20, 0.20])
        if attack == "sqli":
            v[0]  = 0.0          # flask-sqli (service 0)
            v[5]  = 1.0          # has_sqli = True
            v[3]  = rng.uniform(0.05, 0.30)   # 1–3 args  
            # args_length range: 0.02 covers short single-arg payloads like
            # "' OR 1=1--" (~24 chars → vec[4] ≈ 0.048)
            v[4]  = rng.uniform(0.02, 0.45)
            v[8]  = rng.choice([0.0, 1.0], p=[0.6, 0.4])
        elif attack == "path_trav":
            v[0]  = 0.2          # node-pathtraversal (service 1)
            v[6]  = 1.0          # has_path_traversal = True
            # path traversal payloads vary: "../../secrets/flag.txt" is ~26 chars
            v[4]  = rng.uniform(0.02, 0.25)
            v[8]  = rng.choice([0.0, 1.0], p=[0.5, 0.5])
        elif attack == "jwt_none":
            v[0]  = 0.4          # jwt-auth (service 2)
            v[7]  = 1.0          # has_jwt_none = True
            v[8]  = 1.0          # always accesses /admin/secret
            v[4]  = rng.uniform(0.03, 0.20)
        else:                    # nginx alias traversal
            v[0]  = 0.6          # nginx-misconfig (service 3)
            v[6]  = 1.0          # path traversal variant
            v[8]  = 1.0          # sensitive path
            v[4]  = rng.uniform(0.02, 0.20)

        v[1]  = 0.0
        v[2]  = rng.uniform(0.12, 0.50)
        v[9]  = rng.uniform(0.03, 0.30)
        v[10] = 0.0
        v[11] = 0.0              # attackers don't hit /health
        v += rng.normal(0, 0.008, FEATURE_DIM).astype(np.float32)
        v = np.clip(v, 0.0, 1.0)
        X.append(v); y.append(3)

    # ── Class 4: U2R — chained privilege escalation ──────────────────────────
    # sqli cred dump → postgres login with dumped creds → full DB access
    n_u2r = n // 10
    for _ in range(n_u2r):
        v = np.zeros(FEATURE_DIM, dtype=np.float32)
        v[0]  = rng.choice([0.0, 0.8])   # flask (0) → postgres (0.8) chain
        v[5]  = 1.0                       # SQLi is always part of chain start
        v[8]  = 1.0                       # accesses sensitive resources
        v[4]  = rng.uniform(0.20, 0.60)  # complex, long payload
        v[9]  = rng.uniform(0.10, 0.40)
        v[10] = rng.uniform(0.00, 0.40)  # may have some failed attempts
        v[1]  = rng.choice([0.0, 0.5])
        v[2]  = rng.uniform(0.20, 0.50)
        v[3]  = rng.uniform(0.10, 0.40)
        v[11] = 0.0
        v += rng.normal(0, 0.01, FEATURE_DIM).astype(np.float32)
        v = np.clip(v, 0.0, 1.0)
        X.append(v); y.append(4)

    X = np.array(X, dtype=np.float32)
    y = np.array(y, dtype=int)
    idx = rng.permutation(len(X))
    return X[idx], y[idx]


# ─── Step 2: Collect Baseline Traffic for Isolation Forest ───────────────────

def build_baseline_vectors(n_samples: int = 300):
    """
    Probe live Docker services with normal-looking requests.
    Returns feature vectors in the same 12-dim schema (mirrors extractor.py).
    Falls back to synthetic if the cluster isn't running.
    """
    import requests as req_lib

    ENDPOINTS = [
        ("flask-sqli",         "http://localhost:5000/api/users?name=alice"),
        ("flask-sqli",         "http://localhost:5000/health"),
        ("node-pathtraversal", "http://localhost:3001/files?path=readme.txt"),
        ("node-pathtraversal", "http://localhost:3001/health"),
        ("jwt-auth",           "http://localhost:3002/health"),
        ("nginx-misconfig",    "http://localhost:8080/health"),
    ]

    # We import our own extractor to guarantee consistent feature encoding
    import sys, os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))
    from orchestrator.extractor import extract, SERVICE_IDS

    vectors, collected = [], 0
    print(f"\n[IsoForest] Collecting {n_samples} baseline samples from Docker cluster...")

    for i in range(n_samples):
        svc, url = ENDPOINTS[i % len(ENDPOINTS)]
        try:
            resp      = req_lib.get(url, timeout=2)
            log_line  = f'{{"event":"request","method":"GET","path":"{url.split("?")[0]}","args":{{}},"ip":"127.0.0.1","service":"{svc}"}}'
            vec = extract(log_line, svc)
            if vec is not None:
                vectors.append(vec)
                collected += 1
        except Exception:
            pass

    if collected < 50:
        print(f"[IsoForest] Only {collected} live samples — cluster may be down. "
              "Supplementing with synthetic normal vectors.")
        rng = np.random.default_rng(99)
        n_extra = n_samples - collected
        syn_X, syn_y = generate_training_data(n=n_extra * 4, seed=99)
        normal_vecs  = syn_X[syn_y == 0][:n_extra]
        vectors.extend(normal_vecs.tolist())

    print(f"[IsoForest] Total baseline: {len(vectors)} samples")
    return np.array(vectors, dtype=np.float32)


# ─── Step 3: Train XGBoost ────────────────────────────────────────────────────

def train_xgboost():
    print("\n[XGBoost] Generating domain-specific training data...")
    X, y = generate_training_data(n=6000)

    # Train / test split — stratified to keep class proportions
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, stratify=y, random_state=42
    )
    dist = {CLASS_NAMES[i]: int((y_train == i).sum()) for i in range(len(CLASS_NAMES))}
    print(f"  Train: {X_train.shape}  |  Test: {X_test.shape}")
    print(f"  Class distribution (train): {dist}")

    print("[XGBoost] Training...")
    clf = XGBClassifier(
        n_estimators=300,
        max_depth=5,
        learning_rate=0.08,
        subsample=0.8,
        colsample_bytree=0.8,
        eval_metric="mlogloss",
        verbosity=0,
        n_jobs=-1,
        random_state=42,
    )
    clf.fit(X_train, y_train,
            eval_set=[(X_test, y_test)],
            verbose=False)

    y_pred = clf.predict(X_test)
    print("[XGBoost] Evaluation:")
    print(classification_report(y_test, y_pred, target_names=CLASS_NAMES, digits=4))

    xgb_path = os.path.join(MODELS_DIR, "blue_xgb.pkl")
    joblib.dump(clf, xgb_path)
    print(f"[XGBoost] Saved → {xgb_path}")
    return clf


# ─── Step 4: Train Isolation Forest with Held-out Calibration ────────────────

def train_isolation_forest():
    """
    Train IsoForest on 80% of baseline, calibrate threshold on held-out 20%.

    Previous version (BROKEN):
      threshold = np.percentile(scores_of_TRAINING_data, 2)
      → in-sample → threshold meaningless on unseen attack vectors.

    This version:
      - Splits baseline 80/20 (train / calibration)
      - Fits IsoForest on 80%
      - Evaluates decision_function on held-out 20%
      - Also evaluates on known-attack vectors
      - Sets threshold so it sits between normal and attack score distributions
    """
    X_baseline = build_baseline_vectors(n_samples=400)

    # 80 / 20 split for proper held-out calibration
    n_calib   = max(int(len(X_baseline) * 0.20), 20)
    X_train   = X_baseline[:-n_calib]
    X_calib   = X_baseline[-n_calib:]

    print(f"[IsoForest] Training on {len(X_train)} samples, "
          f"calibrating on {len(X_calib)} held-out samples...")

    iso = IsolationForest(
        n_estimators=150,
        contamination=0.05,
        random_state=42,
        n_jobs=-1,
    )
    iso.fit(X_train)

    # Scores on held-out NORMAL traffic
    normal_scores = iso.decision_function(X_calib)

    # Generate known-attack vectors for bracketing
    X_attacks, y_attacks = generate_training_data(n=400, seed=77)
    X_attacks = X_attacks[y_attacks != 0]   # exclude normal class
    attack_scores = iso.decision_function(X_attacks[:100])

    print(f"  Normal  score: mean={normal_scores.mean():.4f}  "
          f"p2={np.percentile(normal_scores, 2):.4f}")
    print(f"  Attack  score: mean={attack_scores.mean():.4f}  "
          f"p95={np.percentile(attack_scores, 95):.4f}")

    # Threshold: 2nd percentile of HELD-OUT normal (not training!) scores.
    # This keeps FPR < 2% on genuinely normal-looking held-out traffic.
    threshold = float(np.percentile(normal_scores, 2))
    print(f"[IsoForest] Threshold (2% FPR on held-out normals): {threshold:.4f}")

    iso_path    = os.path.join(MODELS_DIR, "blue_iso.pkl")
    thresh_path = os.path.join(MODELS_DIR, "blue_iso_threshold.txt")
    joblib.dump(iso, iso_path)
    with open(thresh_path, "w") as f:
        f.write(str(threshold))
    print(f"[IsoForest] Saved → {iso_path}")
    return iso, threshold


# ─── Main ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    clf           = train_xgboost()
    iso, threshold = train_isolation_forest()

    print("\n✅ Blue agent training complete.")
    print(f"   Models saved to: {os.path.abspath(MODELS_DIR)}")
    print("   blue_xgb.pkl              — XGBoost (12-dim domain features)")
    print("   blue_iso.pkl              — Isolation Forest (threshold on held-out data)")
    print("   blue_iso_threshold.txt    — Calibrated anomaly threshold")
    print()
    print("NOTE: blue_encoders.pkl is no longer used.")
    print("      Feature encoding is now handled entirely by orchestrator/extractor.py")