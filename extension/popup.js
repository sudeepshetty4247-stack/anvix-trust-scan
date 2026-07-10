const ANVIX_URL = "https://anvix-trust-scan.lovable.app";
const SCAN_ENDPOINT = `${ANVIX_URL}/api/public/quick-scan`;

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

function verdictColor(score) {
  if (score >= 75) return { fg: "#4ade80", bg: "rgba(74,222,128,.10)", label: "LIKELY SAFE" };
  if (score >= 55) return { fg: "#facc15", bg: "rgba(250,204,21,.10)", label: "CAUTION" };
  if (score >= 35) return { fg: "#fb923c", bg: "rgba(251,146,60,.10)", label: "HIGH RISK" };
  return { fg: "#f87171", bg: "rgba(248,113,113,.10)", label: "LIKELY FRAUD" };
}

function escape(s) {
  return (s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

async function runInlineScan(text) {
  const box = document.getElementById("verdict");
  box.style.display = "block";
  box.innerHTML = `<div class="loading">🔎 Analysing message…</div>`;
  try {
    const res = await fetch(SCAN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const c = verdictColor(data.score);
    box.innerHTML = `
      <div class="v-head" style="border-color:${c.fg};background:${c.bg}">
        <div class="v-score" style="color:${c.fg}">${data.score}<span>/100</span></div>
        <div>
          <div class="v-label" style="color:${c.fg}">${c.label}</div>
          <div class="v-sub">${escape(data.label)}</div>
        </div>
      </div>
      ${data.reasons.length ? `<div class="v-section"><h3>⚠️ Red flags</h3><ul>${data.reasons.map((r) => `<li>${escape(r)}</li>`).join("")}</ul></div>` : ""}
      ${data.positives.length ? `<div class="v-section"><h3>✅ Positive signals</h3><ul>${data.positives.map((r) => `<li>${escape(r)}</li>`).join("")}</ul></div>` : ""}
      <div class="v-section"><h3>🛡 Protect yourself</h3><ul>${data.checklist.map((r) => `<li>${escape(r)}</li>`).join("")}</ul></div>
      <button class="ghost" id="openFull" style="width:100%;margin-top:8px">Open full report on ANVIX ↗</button>
    `;
    document.getElementById("openFull").addEventListener("click", () => openInvestigation({
      v: 1, selection: text, channel: "extension", captured_at: new Date().toISOString(),
    }));
    saveRecent({ title: text.slice(0, 60), url: "", at: Date.now(), score: data.score });
  } catch (e) {
    box.innerHTML = `<div class="err">Could not reach ANVIX (${escape(e.message)}). <br/>Check your connection and try again.</div>`;
  }
}

function openInvestigation(intake) {
  const encoded = base64UrlEncode(JSON.stringify(intake));
  chrome.tabs.create({ url: `${ANVIX_URL}/investigate?intake=${encoded}` });
}

function saveRecent(entry) {
  chrome.storage.local.get({ recent: [] }, ({ recent }) => {
    chrome.storage.local.set({ recent: [entry, ...recent].slice(0, 5) });
  });
}

document.getElementById("investigate").addEventListener("click", async () => {
  const text = document.getElementById("evidence").value.trim();
  if (!text) {
    const ta = document.getElementById("evidence");
    ta.focus();
    ta.style.borderColor = "#e94560";
    setTimeout(() => { ta.style.borderColor = "#23282f"; }, 1500);
    return;
  }
  runInlineScan(text);
});

document.getElementById("grabPage").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => (document.body?.innerText || "").slice(0, 8000),
    });
    document.getElementById("evidence").value = result || "";
    if (result) runInlineScan(result);
  } catch (e) {
    document.getElementById("verdict").style.display = "block";
    document.getElementById("verdict").innerHTML = `<div class="err">Cannot read this page. Try pasting the text instead.</div>`;
  }
});

document.getElementById("sample")?.addEventListener("click", () => {
  const ta = document.getElementById("evidence");
  ta.value = "Congratulations! You are selected for Amazon Data Entry work-from-home. Salary Rs 45,000/month. Pay Rs 1,500 registration fee via UPI to hr.amazon.pay@paytm to activate your account. WhatsApp +91 9876543210 for details.";
  ta.focus();
  runInlineScan(ta.value);
});

chrome.storage.local.get({ recent: [] }, ({ recent }) => {
  const ul = document.getElementById("recent");
  if (!recent.length) { ul.innerHTML = '<li class="empty">No investigations yet.</li>'; return; }
  ul.innerHTML = recent.map((r) => {
    const s = typeof r.score === "number" ? `<span class="pill">${r.score}</span>` : "";
    return `<li>${s}${escape(r.title || "Untitled")}</li>`;
  }).join("");
});

// Live status
fetch(`${ANVIX_URL}/favicon.ico`, { mode: "no-cors" })
  .then(() => { const s = document.getElementById("status"); if (s) { s.textContent = "● live"; s.style.color = "#4ade80"; } })
  .catch(() => { const s = document.getElementById("status"); if (s) { s.textContent = "● offline"; s.style.color = "#e94560"; } });
