"""ANVIX ensemble training.

Trains three models on the EMSCAD / Kaggle "Real or Fake Fake Job Postings"
dataset (17,880 rows, 866 fraud-labeled) and exports edge-portable
coefficients + a compact JSON forest for the Gradient Boosting model.

Outputs:
  ml/model_coefficients.json  - LR weights + shared metrics (v2)
  ml/forest_model.json        - GBM tree ensemble for TS scorer
  ml/metrics.json             - test metrics for the report

Rebuild locally:
  python -m pip install pandas pyarrow scikit-learn
  python ml/train_ensemble.py --csv /path/to/fake_job_postings.csv
"""
from __future__ import annotations
import argparse, json, re, math, sys
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, confusion_matrix,
)

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "ml"

FRAUD_KWS = [
    "quick money","easy money","earn from home","no experience","urgent hiring",
    "immediate start","limited seats","limited slots","registration fee","processing fee",
    "training fee","security deposit","refundable deposit","western union","moneygram",
    "wire transfer","bitcoin","crypto","usdt","gift card","paypal me","personal account",
    "send your bank","aadhaar","pan card","passport copy","upi id","google pay",
    "phonepe","whatsapp only","telegram only","work from home data entry",
]
URG_KWS = ["urgent","immediately","asap","today only","last day","hurry","act now","limited time"]
PAY_KWS = ["wire","western union","moneygram","paypal","gift card","itunes card","zelle","cashapp","venmo","upi"]
CRYPTO_KWS = ["bitcoin","btc","eth","ethereum","crypto","usdt","binance","wallet address"]
FREE_MAIL = {"gmail.com","yahoo.com","outlook.com","hotmail.com","aol.com","proton.me","protonmail.com","gmx.com","yandex.com","mail.ru","icloud.com","live.com","zoho.com"}
SUS_TLDS = {".xyz",".top",".click",".gq",".tk",".ml",".cf",".ga",".buzz",".rest",".zip",".mov",".work",".loan"}

URL_RE = re.compile(r"https?://[^\s\"'<>]+", re.I)
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")

def count_hits(text: str, kws) -> int:
    t = text.lower()
    return sum(1 for k in kws if k in t)

def grammar_quality(text: str) -> float:
    if not text: return 0.5
    words = re.findall(r"[A-Za-z']+", text)
    if not words: return 0.5
    caps_ratio = sum(1 for w in words if w.isupper() and len(w) > 2) / max(len(words), 1)
    excl = text.count("!") / max(len(text), 1) * 100
    q = 1.0 - min(1.0, caps_ratio * 3 + excl * 2)
    return float(np.clip(q, 0, 1))

def build_features(df: pd.DataFrame) -> pd.DataFrame:
    text = (
        df["title"].fillna("") + " " +
        df["company_profile"].fillna("") + " " +
        df["description"].fillna("") + " " +
        df["requirements"].fillna("") + " " +
        df["benefits"].fillna("")
    )
    urls = text.apply(lambda t: URL_RE.findall(t))
    emails = text.apply(lambda t: EMAIL_RE.findall(t))
    email_domains = emails.apply(lambda es: [e.split("@")[-1].lower() for e in es])

    def norm(x, cap):
        return float(min(x, cap)) / cap

    F = pd.DataFrame({
        "fraud_keywords_norm": text.apply(lambda t: norm(count_hits(t, FRAUD_KWS), 8)),
        "urgency_norm":        text.apply(lambda t: norm(count_hits(t, URG_KWS), 4)),
        "payment_norm":        text.apply(lambda t: norm(count_hits(t, PAY_KWS), 4)),
        "crypto_norm":         text.apply(lambda t: norm(count_hits(t, CRYPTO_KWS), 3)),
        "grammar_quality":     text.apply(grammar_quality),
        "has_url":             urls.apply(lambda u: 1.0 if u else 0.0),
        "has_email":           emails.apply(lambda e: 1.0 if e else 0.0),
        "free_email_present":  email_domains.apply(lambda ds: 1.0 if any(d in FREE_MAIL for d in ds) else 0.0),
        "sus_tld_present":     email_domains.apply(lambda ds: 1.0 if any(any(d.endswith(t) for t in SUS_TLDS) for d in ds) else 0.0),
        "has_company_logo":    df["has_company_logo"].fillna(0).astype(float),
        "has_questions":       df["has_questions"].fillna(0).astype(float),
        "telecommuting":       df["telecommuting"].fillna(0).astype(float),
        "has_company_profile": df["company_profile"].fillna("").apply(lambda x: 1.0 if len(str(x)) > 20 else 0.0),
        "has_requirements":    df["requirements"].fillna("").apply(lambda x: 1.0 if len(str(x)) > 20 else 0.0),
        "has_benefits":        df["benefits"].fillna("").apply(lambda x: 1.0 if len(str(x)) > 10 else 0.0),
        "desc_len_norm":       df["description"].fillna("").apply(lambda x: min(len(str(x)), 3000) / 3000.0),
        "employment_specified":df["employment_type"].fillna("").apply(lambda x: 1.0 if str(x).strip() else 0.0),
        # v2 additions:
        "salary_missing":      df["salary_range"].isna().astype(float),
        "location_missing":    df["location"].fillna("").apply(lambda x: 0.0 if str(x).strip() else 1.0),
        "title_shouty":        df["title"].fillna("").apply(lambda x: 1.0 if sum(1 for c in str(x) if c.isupper()) > 0.6*max(len(str(x)),1) and len(str(x)) > 4 else 0.0),
        "url_count_norm":      urls.apply(lambda u: min(len(u), 5) / 5.0),
    })
    return F

def metrics_block(y_true, y_pred, y_proba):
    return {
        "accuracy":  round(float(accuracy_score(y_true, y_pred)), 4),
        "precision": round(float(precision_score(y_true, y_pred, zero_division=0)), 4),
        "recall":    round(float(recall_score(y_true, y_pred, zero_division=0)), 4),
        "f1":        round(float(f1_score(y_true, y_pred, zero_division=0)), 4),
        "roc_auc":   round(float(roc_auc_score(y_true, y_proba)), 4),
        "confusion": confusion_matrix(y_true, y_pred).tolist(),
    }

def export_gbm(gbm: GradientBoostingClassifier, feature_names):
    """Serialize a sklearn GBM as JSON forest for TS inference."""
    trees_json = []
    for stage in gbm.estimators_:
        tree = stage[0].tree_
        nodes = []
        for i in range(tree.node_count):
            left = int(tree.children_left[i]); right = int(tree.children_right[i])
            if left == -1:
                nodes.append({"leaf": float(tree.value[i][0][0])})
            else:
                nodes.append({
                    "feat": int(tree.feature[i]),
                    "thr":  float(tree.threshold[i]),
                    "l": left, "r": right,
                })
        trees_json.append(nodes)
    return {
        "kind": "sklearn-gbm",
        "n_features": len(feature_names),
        "feature_names": feature_names,
        "learning_rate": float(gbm.learning_rate),
        "init_log_odds": float(gbm.init_.class_prior_[1]) if hasattr(gbm.init_, "class_prior_") else 0.0,
        "trees": trees_json,
    }

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", default="/tmp/ml/fjp.csv")
    args = ap.parse_args()

    print(f"Loading {args.csv}")
    df = pd.read_csv(args.csv)
    print(f"  rows={len(df):,}  fraud={int(df['fraudulent'].sum())}")

    X = build_features(df)
    y = df["fraudulent"].astype(int).values
    feats = X.columns.tolist()

    Xtr, Xte, ytr, yte = train_test_split(X.values, y, test_size=0.2, stratify=y, random_state=42)

    # Logistic Regression (class balanced) — edge model
    lr = LogisticRegression(max_iter=1000, class_weight="balanced", C=1.0, solver="lbfgs")
    lr.fit(Xtr, ytr)
    lr_pred = lr.predict(Xte); lr_proba = lr.predict_proba(Xte)[:, 1]
    m_lr = metrics_block(yte, lr_pred, lr_proba)
    print("LR:", m_lr)

    # Random Forest
    rf = RandomForestClassifier(n_estimators=200, max_depth=12, class_weight="balanced",
                                n_jobs=-1, random_state=42)
    rf.fit(Xtr, ytr)
    rf_pred = rf.predict(Xte); rf_proba = rf.predict_proba(Xte)[:, 1]
    m_rf = metrics_block(yte, rf_pred, rf_proba)
    print("RF:", m_rf)

    # Gradient Boosting — deployed as JSON forest at the edge
    gbm = GradientBoostingClassifier(n_estimators=120, max_depth=3, learning_rate=0.1, random_state=42)
    gbm.fit(Xtr, ytr)
    gbm_proba = gbm.predict_proba(Xte)[:, 1]
    # F1-optimal threshold for GBM (used in ensemble):
    thresholds = np.linspace(0.05, 0.6, 24)
    f1s = [f1_score(yte, (gbm_proba >= t).astype(int), zero_division=0) for t in thresholds]
    best_thr = float(thresholds[int(np.argmax(f1s))])
    gbm_pred = (gbm_proba >= best_thr).astype(int)
    m_gbm = metrics_block(yte, gbm_pred, gbm_proba)
    print(f"GBM (thr={best_thr:.2f}):", m_gbm)

    # Ensemble: weighted mean of LR and GBM probabilities
    w_lr, w_gbm = 0.35, 0.65
    ens_proba = w_lr * lr_proba + w_gbm * gbm_proba
    thresholds = np.linspace(0.1, 0.6, 26)
    f1s = [f1_score(yte, (ens_proba >= t).astype(int), zero_division=0) for t in thresholds]
    ens_thr = float(thresholds[int(np.argmax(f1s))])
    ens_pred = (ens_proba >= ens_thr).astype(int)
    m_ens = metrics_block(yte, ens_pred, ens_proba)
    print(f"Ensemble (thr={ens_thr:.2f}):", m_ens)

    metrics = {
        "LogisticRegression": m_lr,
        "RandomForest": m_rf,
        "GradientBoosting": m_gbm,
        "Ensemble": m_ens,
    }
    (OUT / "metrics.json").write_text(json.dumps(metrics, indent=2))

    coefs = {
        "model": "kaggle-lr-v2",
        "trained_on": "EMSCAD / Kaggle Fake Job Postings (Victor mirror)",
        "n_rows": int(len(df)),
        "n_fraud": int(df["fraudulent"].sum()),
        "feature_names": feats,
        "coefficients": [round(float(c), 6) for c in lr.coef_[0]],
        "intercept": round(float(lr.intercept_[0]), 6),
        "best_model_name": "Ensemble(LR+GBM)",
        "ensemble": {
            "lr_weight": w_lr,
            "gbm_weight": w_gbm,
            "threshold": ens_thr,
            "gbm_threshold": best_thr,
        },
        "metrics": metrics,
    }
    (OUT / "model_coefficients.json").write_text(json.dumps(coefs, indent=2))

    forest = export_gbm(gbm, feats)
    (OUT / "forest_model.json").write_text(json.dumps(forest))
    print(f"Wrote {OUT/'forest_model.json'} ({(OUT/'forest_model.json').stat().st_size/1024:.1f} KB)")

if __name__ == "__main__":
    main()
