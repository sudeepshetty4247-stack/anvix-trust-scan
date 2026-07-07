// ANVIX Kaggle-trained Logistic Regression scorer.
// Coefficients were trained offline in /ml/train.py on the EMSCAD / Kaggle
// "Real / Fake Job Postings" dataset (17,880 rows, 866 fraud-labeled).
// Model comparison (test set, stratified 20% holdout):
//   LogisticRegression: accuracy 0.83, precision 0.17, recall 0.62, F1 0.26, ROC-AUC 0.76
//   RandomForest:       accuracy 0.95, precision 0.47, recall 0.50, F1 0.49, ROC-AUC 0.87
//   GradientBoosting:   accuracy 0.96, precision 0.90, recall 0.25, F1 0.40, ROC-AUC 0.84
// LR is deployed at the edge because it is a pure numeric function of the
// feature vector — no Python runtime, no model file loading at request time,
// no data leaves the worker. RF/GB metrics are reported for comparison in
// the trust report and the project report (chapter 7).

import coefsJson from "../../ml/model_coefficients.json";

export const KAGGLE_MODEL = coefsJson as {
  model: string;
  trained_on: string;
  n_rows: number;
  n_fraud: number;
  feature_names: string[];
  coefficients: number[];
  intercept: number;
  best_model_name: string;
  metrics: Record<string, {
    accuracy: number; precision: number; recall: number; f1: number;
    roc_auc: number; confusion: number[][];
  }>;
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
};

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

/** Returns P(fraud) in [0,1]. */
export function predictFraudProbability(f: KaggleFeatures): number {
  let z = KAGGLE_MODEL.intercept;
  const c = KAGGLE_MODEL.coefficients;
  const names = KAGGLE_MODEL.feature_names as (keyof KaggleFeatures)[];
  for (let i = 0; i < names.length; i++) {
    z += c[i] * (f[names[i]] ?? 0);
  }
  return sigmoid(z);
}

/** Contribution of each feature to the log-odds (for explainability). */
export function featureContributions(f: KaggleFeatures): Record<string, number> {
  const out: Record<string, number> = {};
  const c = KAGGLE_MODEL.coefficients;
  const names = KAGGLE_MODEL.feature_names as (keyof KaggleFeatures)[];
  for (let i = 0; i < names.length; i++) {
    out[names[i]] = c[i] * (f[names[i]] ?? 0);
  }
  return out;
}
