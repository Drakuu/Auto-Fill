const VERSION_URL = "https://raw.githubusercontent.com/Drakuu/Auto-Fill/main/version.json";

async function checkUpdate() {
  try {
    const res = await fetch(VERSION_URL + "?t=" + Date.now());
    const data = await res.json();
    const remote = data.version;
    const local = chrome.runtime.getManifest().version;

    // Check if watcher just pulled (lastPull written within last 6 min)
    // If lastPull is recent, files were updated on disk — reload regardless of version comparison
    try {
      const localRes = await fetch(chrome.runtime.getURL("version.json") + "?t=" + Date.now());
      const localData = await localRes.json();
      if (localData.lastPull) {
        const age = Date.now() - parseInt(localData.lastPull) * 1000;
        if (age < 360000) {
          chrome.storage.local.get(["lastReloadTime"], function(r) {
            var lastReload = r.lastReloadTime || 0;
            var minInterval = 30 * 60 * 1000; // 30 min cooldown
            if (Date.now() - lastReload < minInterval) return;
            chrome.action.setBadgeText({ text: "" });
            chrome.storage.local.set({ updateAvailable: null, lastReloadTime: Date.now() });
            chrome.runtime.reload();
          });
          return;
        }
      }
    } catch {}

    if (remote !== local) {
      chrome.storage.local.set({ updateAvailable: remote, updateLocal: local, lastCheck: Date.now() });
      chrome.action.setBadgeText({ text: "NEW" });
      chrome.action.setBadgeBackgroundColor({ color: "#e36414" });
    } else {
      chrome.storage.local.set({ updateAvailable: null, lastCheck: Date.now() });
      chrome.action.setBadgeText({ text: "" });
    }
  } catch {}
}

function setupContextMenus() {
  chrome.contextMenus.removeAll(function() {
    chrome.contextMenus.create({ id: "qf-fill", title: "Fill all fields", contexts: ["page", "editable"] });
    chrome.contextMenus.create({ id: "qf-fill-submit", title: "Fill & Submit", contexts: ["page", "editable"] });
  });
}

try {
  chrome.runtime.onInstalled.addListener(() => {
    checkUpdate();
    chrome.alarms.create("checkUpdate", { periodInMinutes: 5 });
    setupContextMenus();
  });

  chrome.commands.onCommand.addListener((command, tab) => {
    if (!tab?.id) return;
    if (command === "fill-all") {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: contextMenuFillAll,
        args: [],
        world: "MAIN"
      });
    } else if (command === "fill-submit") {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: contextMenuFillAndSubmit,
        args: [],
        world: "MAIN"
      });
    }
  });

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (!tab?.id) return;
    if (info.menuItemId === "qf-fill") {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: contextMenuFillAll,
        args: [],
        world: "MAIN"
      });
    } else if (info.menuItemId === "qf-fill-submit") {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: contextMenuFillAndSubmit,
        args: [],
        world: "MAIN"
      });
    }
  });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "checkUpdate") checkUpdate();
  });

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "checkUpdateNow") { checkUpdate(); if (sendResponse) sendResponse({ ok: true }); return; }
    if (msg.action === "getUpdateStatus") {
      chrome.storage.local.get(["updateAvailable", "updateLocal"], (r) => {
        sendResponse({ available: r.updateAvailable, current: chrome.runtime.getManifest().version });
      });
      return true;
    }
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
          var idx = key.startsWith("i") ? parseInt(key.replace("i", ""), 10) : -1;
          var name = key.startsWith("n_") ? key.substring(2) : "";
          var id = key.startsWith("id_") ? key.substring(3) : "";
          return { index: idx, value, name, id, selector: "" };
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

function contextMenuFillAll() {
  try {
    var fields = [];
    var all = document.querySelectorAll('input:not([type=submit]):not([type=button]):not([type=reset]):not([type=hidden]):not([type=file]):not([type=image]), textarea, select, [contenteditable]');
    all.forEach(function(el, i) {
      if (el.offsetParent === null) return;
      fields.push({ el: el, index: i, type: el.type || 'text', tag: el.tagName.toLowerCase() });
    });
    if (fields.length === 0) return;
    var ns = (Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value') || {}).set
      || (Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value') || {}).set;
    fields.forEach(function(f) {
      var val = f.type === 'checkbox' ? 'on' : f.type === 'number' ? Math.floor(Math.random() * 100) + 1 : f.type === 'email' ? 'user' + Math.floor(Math.random() * 1000) + '@gmail.com' : generateWord() + ' ' + generateWord() + ' ' + generateWord();
      if (f.tag === 'select') {
        var opts = Array.from(f.el.options).filter(function(o) { return o.value; });
        if (opts.length) val = opts[Math.floor(Math.random() * opts.length)].value;
      }
      if (ns && f.type !== 'checkbox' && f.type !== 'radio') ns.call(f.el, f.type === 'number' ? Number(val) : val);
      f.el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      if (f.tag === 'select') f.el.dispatchEvent(new Event('change', { bubbles: true }));
    });
  } catch(e) {}
  function generateWord() { return ['alpha','beta','gamma','delta','omega','sigma','prime','edge','peak','core','base','nova','pulse','drive','wave','flux','grid','node','byte','hive','synth','neo','zen','ark','forge','tide','bold','cast','peak','dawn','echo'][Math.floor(Math.random() * 32)]; }
}

function contextMenuFillAndSubmit() {
  try {
    contextMenuFillAll();
    setTimeout(function() {
      var all = document.querySelectorAll('button, input[type=submit], input[type=button], a[class*=btn], a[role=button], [role=button]');
      var best = null, bestScore = -1;
      all.forEach(function(el) {
        var text = (el.textContent || el.value || '').trim().toLowerCase();
        if (el.offsetParent === null) return;
        var score = 0;
        if ((el.type || '').toLowerCase() === 'submit') score += 10;
        if (text.includes('submit') || text.includes('save') || text.includes('send') || text.includes('update')) score += 5;
        if (text.includes('add') || text.includes('create') || text.includes('new')) score += 2;
        if (el.hasAttribute('onclick')) score += 3;
        if (el.tagName.toLowerCase() === 'button') score += 2;
        if ((el.className || '').toLowerCase().includes('primary')) score += 2;
        if (score > bestScore) { bestScore = score; best = el; }
      });
      if (best) {
        best.click();
        best.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
        best.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
        best.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      }
    }, 300);
  } catch(e) {}
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
        if (item.name) { try { field = document.querySelector('[name="' + item.name.replace(/"/g, '') + '"]'); } catch(e) {} }
        if (!field && item.id) { try { field = document.getElementById(item.id); } catch(e) {} }
        if (!field && item.selector) { try { field = document.querySelector(item.selector); } catch(e) {} }
        if (!field && item.index >= 0) {
          var all = document.querySelectorAll('input:not([type=submit]):not([type=button]):not([type=reset]):not([type=hidden]):not([type=file]):not([type=image]), textarea, select, [contenteditable]');
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
