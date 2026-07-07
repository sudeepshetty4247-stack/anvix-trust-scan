// ANVIX extension background service worker.
// Adds a "Investigate with ANVIX" context-menu entry that opens the app
// with the selected text (plus page URL + title) prefilled as evidence.

const ANVIX_URL = "https://anvix-trust-scan.lovable.app";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "anvix-investigate",
    title: "Investigate with ANVIX",
    contexts: ["selection", "page", "link", "image"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "anvix-investigate") return;

  const intake = {
    v: 1,
    source_url: info.pageUrl || tab?.url || "",
    source_title: tab?.title || "",
    selection: info.selectionText || "",
    link_url: info.linkUrl || "",
    src_image: info.srcUrl || "",
    channel: guessChannel(info.pageUrl || tab?.url || ""),
    captured_at: new Date().toISOString(),
  };

  const encoded = base64UrlEncode(JSON.stringify(intake));
  chrome.tabs.create({ url: `${ANVIX_URL}/investigate?intake=${encoded}` });

  // Remember last 5 investigations for the popup.
  chrome.storage.local.get({ recent: [] }, ({ recent }) => {
    const next = [
      { title: tab?.title || "Untitled page", url: info.pageUrl || tab?.url || "", at: Date.now() },
      ...recent,
    ].slice(0, 5);
    chrome.storage.local.set({ recent: next });
  });
});

function guessChannel(url) {
  const u = (url || "").toLowerCase();
  if (u.includes("linkedin.com")) return "linkedin";
  if (u.includes("mail.google.com")) return "gmail";
  if (u.includes("web.whatsapp.com")) return "whatsapp";
  if (u.includes("outlook.")) return "outlook";
  return "unknown";
}

function base64UrlEncode(s) {
  const b64 = btoa(unescape(encodeURIComponent(s)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
