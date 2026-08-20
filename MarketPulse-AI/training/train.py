"""
train.py  – Full ML training pipeline for MarketPulse AI
Runs: feature engineering → chronological split → train 4 models →
      evaluate → select best → save artifacts
"""
import os, sys, json, warnings
import numpy as np
import pandas as pd
import joblib
from datetime import datetime

warnings.filterwarnings("ignore")

# ── paths ─────────────────────────────────────────────────────────────────────
BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(BASE, "..")
DATA_PATH   = os.path.join(ROOT, "data", "XAUUSD_clean.csv")
MODELS_DIR  = os.path.join(ROOT, "models")
REPORTS_DIR = os.path.join(ROOT, "reports")
os.makedirs(MODELS_DIR,  exist_ok=True)
os.makedirs(REPORTS_DIR, exist_ok=True)

sys.path.insert(0, BASE)
from features import add_features, FEATURE_COLS

# ── sklearn / xgboost ─────────────────────────────────────────────────────────
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score,
    f1_score, roc_auc_score, confusion_matrix, classification_report
)
try:
    from xgboost import XGBClassifier
    HAS_XGB = True
except ImportError:
    HAS_XGB = False
    print("XGBoost not found – skipping")

# ── 1. Load & feature-engineer ────────────────────────────────────────────────
print("="*60)
print("MarketPulse AI  –  Training Pipeline")
print("="*60)

df_raw = pd.read_csv(DATA_PATH, parse_dates=["Date"])
print(f"Loaded {len(df_raw)} rows  |  {df_raw['Date'].min().date()} → {df_raw['Date'].max().date()}")

df = add_features(df_raw)
df.dropna(subset=FEATURE_COLS + ["target"], inplace=True)
df.reset_index(drop=True, inplace=True)
print(f"After feature engineering: {len(df)} rows")

# ── 2. Chronological split 70 / 15 / 15 ──────────────────────────────────────
n = len(df)
train_end  = int(n * 0.70)
val_end    = int(n * 0.85)

train_df = df.iloc[:train_end]
val_df   = df.iloc[train_end:val_end]
test_df  = df.iloc[val_end:]

print(f"\nTrain : {len(train_df)} rows  ({train_df['Date'].min().date()} – {train_df['Date'].max().date()})")
print(f"Val   : {len(val_df)}  rows  ({val_df['Date'].min().date()} – {val_df['Date'].max().date()})")
print(f"Test  : {len(test_df)}  rows  ({test_df['Date'].min().date()} – {test_df['Date'].max().date()})")

X_train = train_df[FEATURE_COLS].values
y_train = train_df["target"].values
X_val   = val_df[FEATURE_COLS].values
y_val   = val_df["target"].values
X_test  = test_df[FEATURE_COLS].values
y_test  = test_df["target"].values

# ── 3. Scale ─────────────────────────────────────────────────────────────────
scaler = StandardScaler()
X_train_s = scaler.fit_transform(X_train)
X_val_s   = scaler.transform(X_val)
X_test_s  = scaler.transform(X_test)

# class balance
bull_pct = y_train.mean() * 100
bear_pct = 100 - bull_pct
print(f"\nClass balance (train): BULL={bull_pct:.1f}%  BEAR={bear_pct:.1f}%")
class_weight = "balanced" if abs(bull_pct - 50) > 5 else None


# ── 4. Evaluate helper ────────────────────────────────────────────────────────
def evaluate(name, model, X, y, use_scaled=True):
    Xs = X if not use_scaled else X
    y_pred = model.predict(Xs)
    y_prob = model.predict_proba(Xs)[:, 1]
    cm = confusion_matrix(y, y_pred).tolist()
    return {
        "model": name,
        "accuracy":  round(float(accuracy_score(y, y_pred)),  4),
        "precision": round(float(precision_score(y, y_pred, zero_division=0)), 4),
        "recall":    round(float(recall_score(y, y_pred, zero_division=0)),    4),
        "f1":        round(float(f1_score(y, y_pred, zero_division=0)),        4),
        "roc_auc":   round(float(roc_auc_score(y, y_prob)),   4),
        "confusion_matrix": cm,
    }

# ── 5. Train models ───────────────────────────────────────────────────────────
models = {}
val_metrics = {}
all_metrics = {}

# 5a. Logistic Regression (baseline)
print("\n[1/4] Logistic Regression …")
lr = LogisticRegression(max_iter=2000, class_weight=class_weight, random_state=42)
lr.fit(X_train_s, y_train)
vm = evaluate("LogisticRegression", lr, X_val_s, y_val)
models["LogisticRegression"] = {"model": lr, "scaled": True}
val_metrics["LogisticRegression"] = vm
print(f"  Val Acc={vm['accuracy']}  F1={vm['f1']}  AUC={vm['roc_auc']}")

# 5b. Random Forest
print("[2/4] Random Forest …")
rf = RandomForestClassifier(n_estimators=300, max_depth=8, min_samples_leaf=10,
                             class_weight=class_weight, random_state=42, n_jobs=-1)
rf.fit(X_train, y_train)
vm = evaluate("RandomForest", rf, X_val, y_val, use_scaled=False)
models["RandomForest"] = {"model": rf, "scaled": False}
val_metrics["RandomForest"] = vm
print(f"  Val Acc={vm['accuracy']}  F1={vm['f1']}  AUC={vm['roc_auc']}")

# 5c. XGBoost
if HAS_XGB:
    print("[3/4] XGBoost …")
    scale_pos = float((y_train == 0).sum() / (y_train == 1).sum())
    xgb = XGBClassifier(n_estimators=400, max_depth=5, learning_rate=0.05,
                         subsample=0.8, colsample_bytree=0.8,
                         scale_pos_weight=scale_pos if abs(bull_pct-50)>5 else 1,
                         eval_metric="logloss", use_label_encoder=False,
                         random_state=42, n_jobs=-1)
    xgb.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)
    vm = evaluate("XGBoost", xgb, X_val, y_val, use_scaled=False)
    models["XGBoost"] = {"model": xgb, "scaled": False}
    val_metrics["XGBoost"] = vm
    print(f"  Val Acc={vm['accuracy']}  F1={vm['f1']}  AUC={vm['roc_auc']}")
else:
    print("[3/4] XGBoost – SKIPPED (not installed)")

# 5d. Simple MLP neural network (sklearn)
print("[4/4] Neural Network (MLP) …")
from sklearn.neural_network import MLPClassifier
mlp = MLPClassifier(hidden_layer_sizes=(128, 64, 32), activation="relu",
                    max_iter=500, random_state=42, early_stopping=True,
                    validation_fraction=0.1, n_iter_no_change=20)
mlp.fit(X_train_s, y_train)
vm = evaluate("NeuralNetwork", mlp, X_val_s, y_val)
models["NeuralNetwork"] = {"model": mlp, "scaled": True}
val_metrics["NeuralNetwork"] = vm
print(f"  Val Acc={vm['accuracy']}  F1={vm['f1']}  AUC={vm['roc_auc']}")

# ── 6. Select best model (by ROC-AUC on val) ─────────────────────────────────
best_name = max(val_metrics, key=lambda k: val_metrics[k]["roc_auc"])
print(f"\n★ Best model (val AUC): {best_name}  AUC={val_metrics[best_name]['roc_auc']}")

best_info  = models[best_name]
best_model = best_info["model"]
uses_scale = best_info["scaled"]

# ── 7. Final evaluation on held-out test set ──────────────────────────────────
Xt = X_test_s if uses_scale else X_test
test_m = evaluate(best_name, best_model, Xt, y_test)
print(f"\nTest metrics for {best_name}:")
for k, v in test_m.items():
    if k not in ["model","confusion_matrix"]:
        print(f"  {k}: {v}")
print(f"  Confusion matrix: {test_m['confusion_matrix']}")

# build full comparison table (test scores for all models)
comparison = []
for name, info in models.items():
    Xeval = X_test_s if info["scaled"] else X_test
    m = evaluate(name, info["model"], Xeval, y_test)
    m["val_auc"] = val_metrics[name]["roc_auc"]
    comparison.append(m)

# ── 8. Feature importance / SHAP-lite ────────────────────────────────────────
feature_importance = {}
if best_name in ("RandomForest", "XGBoost"):
    imp = best_model.feature_importances_
    feature_importance = dict(sorted(
        zip(FEATURE_COLS, imp.tolist()), key=lambda x: x[1], reverse=True
    ))
elif best_name == "LogisticRegression":
    coef = np.abs(best_model.coef_[0])
    feature_importance = dict(sorted(
        zip(FEATURE_COLS, coef.tolist()), key=lambda x: x[1], reverse=True
    ))
elif best_name == "NeuralNetwork":
    # Use coefficient magnitudes of first layer as proxy importance
    w = np.abs(best_model.coefs_[0]).mean(axis=1)
    feature_importance = dict(sorted(
        zip(FEATURE_COLS, w.tolist()), key=lambda x: x[1], reverse=True
    ))

top_features = list(feature_importance.keys())[:15]
print(f"\nTop-5 features: {top_features[:5]}")

# ── 9. Historical test predictions (for Historical Predictions page) ──────────
test_preds = []
for i, (_, row) in enumerate(test_df.iterrows()):
    x = row[FEATURE_COLS].values.reshape(1, -1)
    xs = scaler.transform(x) if uses_scale else x
    prob = float(best_model.predict_proba(xs)[0][1])
    pred = 1 if prob >= 0.5 else 0
    test_preds.append({
        "date":     str(row["Date"].date()),
        "open":     round(float(row["Open"]),  2),
        "high":     round(float(row["High"]),  2),
        "low":      round(float(row["Low"]),   2),
        "close":    round(float(row["Close"]), 2),
        "actual":   int(row["target"]),
        "predicted":pred,
        "bull_prob":round(prob,       4),
        "bear_prob":round(1-prob,     4),
        "correct":  int(pred == int(row["target"])),
    })

# ── 10. Save everything ───────────────────────────────────────────────────────
# 10a. scaler
joblib.dump(scaler, os.path.join(MODELS_DIR, "scaler.pkl"))

# 10b. best model
joblib.dump(best_model, os.path.join(MODELS_DIR, f"best_model.pkl"))

# 10c. all models
for name, info in models.items():
    joblib.dump(info["model"], os.path.join(MODELS_DIR, f"{name}.pkl"))

# 10d. metadata JSON
split_info = {
    "train_start": str(train_df["Date"].min().date()),
    "train_end":   str(train_df["Date"].max().date()),
    "val_start":   str(val_df["Date"].min().date()),
    "val_end":     str(val_df["Date"].max().date()),
    "test_start":  str(test_df["Date"].min().date()),
    "test_end":    str(test_df["Date"].max().date()),
    "train_rows":  len(train_df),
    "val_rows":    len(val_df),
    "test_rows":   len(test_df),
}
class_dist = {
    "train_bull_pct": round(bull_pct, 2),
    "train_bear_pct": round(bear_pct, 2),
    "test_bull_pct":  round(float(y_test.mean()*100), 2),
    "test_bear_pct":  round(float((1-y_test.mean())*100), 2),
}
metadata = {
    "asset":             "XAUUSD",
    "timeframe":         "D1",
    "best_model":        best_name,
    "uses_scaler":       uses_scale,
    "feature_cols":      FEATURE_COLS,
    "top_features":      top_features,
    "feature_importance":feature_importance,
    "split_info":        split_info,
    "class_distribution":class_dist,
    "val_metrics":       val_metrics,
    "test_metrics":      test_m,
    "model_comparison":  comparison,
    "trained_at":        datetime.now().isoformat(),
    "total_rows":        len(df),
}
with open(os.path.join(MODELS_DIR, "metadata.json"), "w") as f:
    json.dump(metadata, f, indent=2)

# 10e. historical test predictions
with open(os.path.join(REPORTS_DIR, "test_predictions.json"), "w") as f:
    json.dump(test_preds, f, indent=2)

# 10f. clean dataset for backend (OHLCV + all features)
df.to_csv(os.path.join(MODELS_DIR, "featured_data.csv"), index=False)

print("\n✓ Artifacts saved:")
print(f"  models/best_model.pkl  (={best_name})")
print(f"  models/scaler.pkl")
print(f"  models/metadata.json")
print(f"  reports/test_predictions.json")
print(f"  models/featured_data.csv")
print("\n✓ Training complete!")
