const VERSION_URL = "https://raw.githubusercontent.com/Drakuu/Auto-Fill/main/version.json";
const CHECK_INTERVAL = 2 * 60 * 1000; // every 2 minutes (for testing)

async function checkUpdate() {
  try {
    const res = await fetch(VERSION_URL + "?t=" + Date.now());
    const data = await res.json();
    const remote = data.version;
    const local = chrome.runtime.getManifest().version;
    if (remote !== local) {
      chrome.storage.local.set({ updateAvailable: remote, updateLocal: local });
      chrome.action.setBadgeText({ text: "NEW" });
      chrome.action.setBadgeBackgroundColor({ color: "#e36414" });
    } else {
      chrome.storage.local.set({ updateAvailable: null });
      chrome.action.setBadgeText({ text: "" });
    }
  } catch {}
}

chrome.runtime.onInstalled.addListener(() => {
  checkUpdate();
  setInterval(checkUpdate, CHECK_INTERVAL);
});
