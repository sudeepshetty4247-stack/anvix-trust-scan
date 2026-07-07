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
