// ANVIX Kaggle-trained ensemble scorer.
// Coefficients + forest were trained in /ml/train_ensemble.py on the
// EMSCAD / Kaggle "Real or Fake Fake Job Postings" dataset
// (17,880 rows, 866 fraud-labeled).
//
// Ensemble = logit-average of Logistic Regression (edge-native, 21 features)
// and a 120-tree Gradient Boosting forest (max_depth=3), both trained on
// the same feature vector. RF is reported for comparison only.
//
// Test-set metrics (see ml/metrics.json, updated by every training run):
//   LogisticRegression: acc 0.82, prec 0.16, recall 0.62, F1 0.25, ROC-AUC 0.77
//   RandomForest:       acc 0.92, prec 0.32, recall 0.64, F1 0.42, ROC-AUC 0.91
//   GradientBoosting:   acc 0.96, prec 0.78, recall 0.35, F1 0.49, ROC-AUC 0.88
//   Ensemble(LR+GBM):   acc 0.96, prec 0.66, recall 0.35, F1 0.45, ROC-AUC 0.87
//
// Both models run entirely at the edge — no Python runtime, no model file
// loaded at request time, no evidence leaves the worker.

import coefsJson from "../../ml/model_coefficients.json";
import forestJson from "../../ml/forest_model.json";

export const KAGGLE_MODEL = coefsJson as {
  model: string;
  trained_on: string;
  n_rows: number;
  n_fraud: number;
  feature_names: string[];
  coefficients: number[];
  intercept: number;
  best_model_name: string;
  ensemble: {
    lr_weight: number;
    gbm_weight: number;
    threshold: number;
    gbm_threshold: number;
  };
  metrics: Record<
    string,
    {
      accuracy: number;
      precision: number;
      recall: number;
      f1: number;
      roc_auc: number;
      confusion: number[][];
    }
  >;
};

type ForestNode =
  | { leaf: number }
  | { feat: number; thr: number; l: number; r: number };

const FOREST = forestJson as {
  kind: "sklearn-gbm";
  n_features: number;
  feature_names: string[];
  learning_rate: number;
  init_log_odds: number;
  trees: ForestNode[][];
};

export type KaggleFeatures = {
  fraud_keywords_norm: number;
  urgency_norm: number;
  payment_norm: number;
  crypto_norm: number;
  grammar_quality: number;
  has_url: number;
  has_email: number;
  free_email_present: number;
  sus_tld_present: number;
  has_company_logo: number;
  has_questions: number;
  telecommuting: number;
  has_company_profile: number;
  has_requirements: number;
  has_benefits: number;
  desc_len_norm: number;
  employment_specified: number;
  // v2 additions:
  salary_missing: number;
  location_missing: number;
  title_shouty: number;
  url_count_norm: number;
};

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
const clip = (p: number) => Math.max(1e-6, Math.min(1 - 1e-6, p));
const logit = (p: number) => Math.log(clip(p) / (1 - clip(p)));

function toVector(f: KaggleFeatures, names: string[]): number[] {
  return names.map((n) => (f as unknown as Record<string, number>)[n] ?? 0);
}

/** Logistic Regression P(fraud) in [0,1]. */
export function predictFraudProbability(f: KaggleFeatures): number {
  let z = KAGGLE_MODEL.intercept;
  const c = KAGGLE_MODEL.coefficients;
  const names = KAGGLE_MODEL.feature_names;
  const v = toVector(f, names);
  for (let i = 0; i < names.length; i++) z += c[i] * v[i];
  return sigmoid(z);
}

/** Gradient Boosting P(fraud) using the exported forest. */
export function predictForestProbability(f: KaggleFeatures): number {
  const v = toVector(f, FOREST.feature_names);
  let score = FOREST.init_log_odds;
  for (const tree of FOREST.trees) {
    let i = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const node = tree[i];
      if ("leaf" in node) {
        score += FOREST.learning_rate * node.leaf;
        break;
      }
      i = v[node.feat] <= node.thr ? node.l : node.r;
    }
  }
  return sigmoid(score);
}

/**
 * Ensemble P(fraud): logit-average of LR + GBM, weighted by the training-time
 * blend that maximised F1. Also returns the per-model probabilities so the
 * trust report can show the breakdown.
 */
export function predictEnsemble(f: KaggleFeatures): {
  ensemble: number;
  lr: number;
  gbm: number;
  threshold: number;
} {
  const lr = predictFraudProbability(f);
  const gbm = predictForestProbability(f);
  const { lr_weight, gbm_weight, threshold } = KAGGLE_MODEL.ensemble;
  const z = lr_weight * logit(lr) + gbm_weight * logit(gbm);
  return { ensemble: sigmoid(z), lr, gbm, threshold };
}

/** Contribution of each feature to the LR log-odds (for explainability). */
export function featureContributions(f: KaggleFeatures): Record<string, number> {
  const out: Record<string, number> = {};
  const c = KAGGLE_MODEL.coefficients;
  const names = KAGGLE_MODEL.feature_names;
  const v = toVector(f, names);
  for (let i = 0; i < names.length; i++) out[names[i]] = c[i] * v[i];
  return out;
}
