const ANVIX_URL = "https://anvix-trust-scan.lovable.app";

function base64UrlEncode(s) {
  const b64 = btoa(unescape(encodeURIComponent(s)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function guessChannel(url) {
  const u = (url || "").toLowerCase();
  if (u.includes("linkedin.com")) return "linkedin";
  if (u.includes("mail.google.com")) return "gmail";
  if (u.includes("web.whatsapp.com")) return "whatsapp";
  if (u.includes("outlook.")) return "outlook";
  return "unknown";
}

function openInvestigation(intake) {
  const encoded = base64UrlEncode(JSON.stringify(intake));
  chrome.tabs.create({ url: `${ANVIX_URL}/investigate?intake=${encoded}` });

  chrome.storage.local.get({ recent: [] }, ({ recent }) => {
    const title = (intake.selection || intake.source_title || "Untitled").slice(0, 80);
    const next = [{ title, url: intake.source_url || "", at: Date.now() }, ...recent].slice(0, 5);
    chrome.storage.local.set({ recent: next });
  });
}

document.getElementById("investigate").addEventListener("click", async () => {
  const text = document.getElementById("evidence").value.trim();
  if (!text) {
    document.getElementById("evidence").focus();
    document.getElementById("evidence").style.borderColor = "#e94560";
    setTimeout(() => { document.getElementById("evidence").style.borderColor = "#23282f"; }, 1500);
    return;
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  openInvestigation({
    v: 1,
    selection: text,
    source_url: tab?.url || "",
    source_title: tab?.title || "",
    channel: guessChannel(tab?.url || ""),
    captured_at: new Date().toISOString(),
  });
});

document.getElementById("grabPage").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return;
  openInvestigation({
    v: 1,
    selection: "",
    source_url: tab.url,
    source_title: tab.title || "",
    channel: guessChannel(tab.url),
    captured_at: new Date().toISOString(),
  });
});

chrome.storage.local.get({ recent: [] }, ({ recent }) => {
  const ul = document.getElementById("recent");
  if (!recent.length) {
    ul.innerHTML = '<li class="empty">No investigations yet.</li>';
    return;
  }
  ul.innerHTML = recent
    .map((r) => `<li title="${escape(r.url)}">${escape(r.title)}</li>`)
    .join("");
});

function escape(s) {
  return (s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

// Sample scam prefill for first-time users
document.getElementById("sample")?.addEventListener("click", () => {
  document.getElementById("evidence").value =
    "Congratulations! You are selected for Amazon Data Entry work-from-home. Salary Rs 45,000/month. Pay Rs 1,500 registration fee via UPI to hr.amazon.pay@paytm to activate your account. WhatsApp +91 9876543210 for details.";
  document.getElementById("evidence").focus();
});

// Live status ping
fetch("https://anvix-trust-scan.lovable.app/favicon.ico", { mode: "no-cors" })
  .then(() => { const s = document.getElementById("status"); if (s) { s.textContent = "● live"; s.style.color = "#4ade80"; } })
  .catch(() => { const s = document.getElementById("status"); if (s) { s.textContent = "● offline"; s.style.color = "#e94560"; } });
