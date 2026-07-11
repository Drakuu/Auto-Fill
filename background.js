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
      if (item.shadowHost) {
        var host = document.querySelector(item.shadowHost);
        if (host && host.shadowRoot) {
          if (item.selector) try { field = host.shadowRoot.querySelector(item.selector); } catch(e) {}
          if (!field) {
            var s = host.shadowRoot.querySelectorAll('input:not([type=submit]):not([type=button]):not([type=reset]):not([type=hidden]):not([type=file]):not([type=image]), textarea, select');
            field = s[item.index];
          }
        }
      } else if (item.iframeIndex !== undefined) {
        var iframes = document.querySelectorAll('iframe');
        var iframe = iframes[item.iframeIndex];
        if (iframe && iframe.contentDocument) {
          if (item.selector) try { field = iframe.contentDocument.querySelector(item.selector); } catch(e) {}
          if (!field) {
            var s2 = iframe.contentDocument.querySelectorAll('input:not([type=submit]):not([type=button]):not([type=reset]):not([type=hidden]):not([type=file]):not([type=image]), textarea, select');
            field = s2[item.index];
          }
        }
      }
      if (!field) {
        if (item.selector) try { field = document.querySelector(item.selector); } catch(e) {}
        if (!field) {
          var all = document.querySelectorAll('input:not([type=submit]):not([type=button]):not([type=reset]):not([type=hidden]):not([type=file]):not([type=image]), textarea, select');
          field = all[item.index];
        }
      }
      if (!field) return;
      var tag = field.tagName.toLowerCase();
      var type = (field.type || '').toLowerCase();
      var isCustom = tag === 'input' && (field.getAttribute('role') === 'combobox' || field.getAttribute('aria-haspopup') === 'listbox');
      if (isCustom) {
        var hiddenSel = null;
        var container = field.closest('[class*=select],[class*=dropdown],[class*=picker],.field,.form-group');
        if (container) {
          var sels = container.querySelectorAll('select');
          for (var si = 0; si < sels.length; si++) {
            if (sels[si].offsetHeight === 0 || sels[si].offsetParent === null || sels[si].style.display === 'none') {
              hiddenSel = sels[si]; break;
            }
          }
        }
        if (hiddenSel) {
          var match = Array.from(hiddenSel.options).some(function(o) { return o.value === item.value; });
          if (match) { hiddenSel.value = item.value; hiddenSel.dispatchEvent(new Event('change', { bubbles: true })); }
        }
        if (ns) ns.call(field, item.value);
        field.dispatchEvent(new Event('mousedown', { bubbles: true }));
        field.dispatchEvent(new Event('mouseup', { bubbles: true }));
        field.dispatchEvent(new Event('click', { bubbles: true }));
        field.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
        field.dispatchEvent(new Event('blur', { bubbles: true }));
      } else if (tag === 'select') {
        var match = Array.from(field.options).some(function(o) { return o.value === item.value; });
        if (match) {
          field.value = item.value;
          field.dispatchEvent(new Event('change', { bubbles: true }));
        }
      } else if (type === 'checkbox') {
        field.checked = item.value === 'on' || item.value === 'true' || (item.value && item.value !== 'off' && item.value !== 'false');
        field.dispatchEvent(new Event('click', { bubbles: true }));
        field.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (type === 'radio') {
        field.checked = true;
        field.dispatchEvent(new Event('click', { bubbles: true }));
        field.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        if (ns) ns.call(field, type === 'number' ? Number(item.value) : item.value);
        field.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      }
    } catch(e) {}
  });
}
