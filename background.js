const VERSION_URL = "https://raw.githubusercontent.com/Drakuu/Auto-Fill/main/version.json";
const CHECK_INTERVAL = 2 * 60 * 1000; // every 2 minutes for testing

async function checkUpdate() {
  try {
    // Check GitHub for latest version
    const res = await fetch(VERSION_URL + "?t=" + Date.now());
    const data = await res.json();
    const remote = data.version;
    const local = chrome.runtime.getManifest().version;

    // Check if watcher has pulled updates (reads live file from disk)
    let needsReload = false;
    try {
      const localRes = await fetch(chrome.runtime.getURL("version.json") + "?t=" + Date.now());
      const localData = await localRes.json();
      if (localData.lastPull) {
        const lastPull = parseInt(localData.lastPull) * 1000;
        const age = Date.now() - lastPull;
        if (age < CHECK_INTERVAL + 30000 && localData.version === remote) {
          // Watcher just pulled — auto-reload
          needsReload = true;
        }
      }
    } catch {}

    if (needsReload) {
      chrome.action.setBadgeText({ text: "" });
      chrome.storage.local.set({ updateAvailable: null });
      chrome.runtime.reload();
      return;
    }

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
  chrome.alarms.create("checkUpdate", { periodInMinutes: 2 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "checkUpdate") checkUpdate();
});
