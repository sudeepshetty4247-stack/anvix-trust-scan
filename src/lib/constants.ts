// ANVIX shared constants — safe for client and server.

/**
 * Verified-employer domain bonus applied to the ML risk score when the
 * recruiter's domain is on the well-known allow-list (Stripe, Google,
 * Greenhouse, Lever, Ashby, Workday, Microsoft, Amazon, TCS, Infosys, etc.).
 *
 * Value chosen by `ml/evaluate.mjs` — see `ml/EVAL_REPORT.md` for the
 * confusion matrix and sweep that justifies this number. Do NOT change
 * without re-running the evaluator.
 */
export const VERIFIED_DOMAIN_BONUS = 10;

/**
 * Chrome Web Store listing URL. Empty string until the extension is
 * approved; the UI falls back to the local ZIP download when unset.
 * Replace with the real store URL after submission is approved.
 */
export const CHROME_STORE_URL = "";

/** File served from /public for manual "Load unpacked" installs. */
export const CHROME_EXTENSION_ZIP_PATH = "/anvix-scanner-v1.0.0.zip";
