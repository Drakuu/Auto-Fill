let fields = [];
let buttons = [];
let currentUrl = "";
let currentTab = "fields";
let _valueCache = {};
let _overlayActive = false;
let _undoData = [];

function getHostname(url) {
  try { return new URL(url).hostname; } catch { return "unknown"; }
}

function showStatus(msg, type) {
  const el = document.getElementById("status");
  el.textContent = msg;
  el.className = "status " + (type || "");
  setTimeout(() => { el.textContent = ""; el.className = "status"; }, 3000);
}

async function sendMsg(msg) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return { success: false, error: "no tab" };
    return await chrome.tabs.sendMessage(tab.id, msg);
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function execInMainWorld(type, payload) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return { success: false };
    if (type === "fill") {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: mainWorldFill,
        args: [payload],
        world: "MAIN"
      });
    } else if (type === "click") {
      const strategy = payload.strategy || document.getElementById("submitStrategy")?.value || "auto";
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: mainWorldClick,
        args: [payload.selector, payload.index, strategy],
        world: "MAIN"
      });
    }
    return { success: true };
  } catch {
    return { success: false };
  }
}

async function ensureCS() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return false;
  try {
    const r = await chrome.tabs.sendMessage(tab.id, { action: "ping" });
    if (r?.pong) return true;
  } catch {}
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    await new Promise(r => setTimeout(r, 400));
    try {
      const r = await chrome.tabs.sendMessage(tab.id, { action: "ping" });
      return !!r?.pong;
    } catch { return false; }
  } catch { return false; }
}

function getProfileKey(host) { return "profiles_" + host; }
