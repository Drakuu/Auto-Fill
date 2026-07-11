const VERSION_URL = "https://raw.githubusercontent.com/Drakuu/Auto-Fill/main/version.json";
const CHECK_INTERVAL = 2 * 60 * 1000;

async function checkUpdate() {
  try {
    const res = await fetch(VERSION_URL + "?t=" + Date.now());
    const data = await res.json();
    const remote = data.version;
    const local = chrome.runtime.getManifest().version;

    let needsReload = false;
    try {
      const localRes = await fetch(chrome.runtime.getURL("version.json") + "?t=" + Date.now());
      const localData = await localRes.json();
      if (localData.lastPull) {
        const lastPull = parseInt(localData.lastPull) * 1000;
        const age = Date.now() - lastPull;
        if (age < CHECK_INTERVAL + 30000 && localData.version === remote) {
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

try {
  chrome.runtime.onInstalled.addListener(() => {
    checkUpdate();
    chrome.alarms.create("checkUpdate", { periodInMinutes: 2 });
  });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "checkUpdate") checkUpdate();
  });

  chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.action === "autoFill" || msg.action === "checkAutoFill") {
    const tabId = sender.tab?.id || msg.tabId;
    const domain = msg.domain;
    if (!tabId || !domain) return;

    chrome.storage.sync.get(["autoFillDomains", "profiles_" + domain, "p_" + domain], (res) => {
      // Only proceed if auto-fill is enabled for this domain
      const domains = res.autoFillDomains || {};
      if (msg.action === "checkAutoFill" && !domains[domain]) return;

      let profiles = res["profiles_" + domain];
      if (!profiles && res["p_" + domain]) {
        profiles = { Default: res["p_" + domain] };
      }
      const profile = profiles?.Default || Object.values(profiles || {})[0];
      if (!profile) return;

      const data = Object.entries(profile).map(([key, value]) => {
        const idx = parseInt(key.replace("i", ""), 10);
        return { index: idx, value, selector: "" };
      });

      chrome.scripting.executeScript({
        target: { tabId },
        func: autoFillFields,
        args: [data],
        world: "MAIN"
      });
    });
  }
});
} catch (e) {
  console.error("Quick Fill background init error:", e);
}

function autoFillFields(data) {
  var ns = (Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value') || {}).set
        || (Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value') || {}).set;
  (data || []).forEach(function(item) {
    try {
      var field = null;
      if (item.selector) try { field = document.querySelector(item.selector); } catch(e) {}
      if (!field) {
        var all = document.querySelectorAll('input:not([type=submit]):not([type=button]):not([type=reset]):not([type=hidden]):not([type=file]):not([type=image]), textarea, select');
        field = all[item.index];
      }
      if (!field) return;
      if (field.tagName.toLowerCase() === 'select') {
        var match = Array.from(field.options).some(function(o) { return o.value === item.value; });
        if (match) field.value = item.value;
        field.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        if (ns) ns.call(field, field.type === 'number' ? Number(item.value) : item.value);
        field.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      }
    } catch(e) {}
  });
}
