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

function getLearningKey(host) { return "learned_" + host; }

async function saveLearnedValue(field, value) {
  var host = getHostname(currentUrl);
  if (!host || host === "unknown" || !value) return;
  var key = getLearningKey(host);
  var key2 = field.name || field.id || "f" + field.index;
  var res = await chrome.storage.sync.get([key]);
  var data = res[key] || {};
  if (!data[key2]) data[key2] = { value: value, count: 0 };
  else { data[key2].value = value; }
  data[key2].count = (data[key2].count || 0) + 1;
  await chrome.storage.sync.set({ [key]: data });
}

async function getLearnedValues(host) {
  if (!host || host === "unknown") return {};
  var key = getLearningKey(host);
  var res = await chrome.storage.sync.get([key]);
  return res[key] || {};
}

async function getLearnedValueForField(field, host) {
  var data = await getLearnedValues(host);
  var key = field.name || field.id || "f" + field.index;
  return data[key] || null;
}

var _batchTemplate = null;

function getBatchTemplateKey() { return "batchTemplate"; }

async function saveBatchTemplate(urls) {
  var key = getBatchTemplateKey();
  var data = { timestamp: Date.now(), fields: [], urls: urls || [] };
  fields.forEach(function(f) {
    data.fields.push({
      name: f.name || "",
      id: f.id || "",
      label: f.label || "",
      selector: f.selector || "",
      index: f.index,
      type: f.type,
      fillValue: f.fillValue || ""
    });
  });
  await chrome.storage.local.set({ [key]: data });
  _batchTemplate = data;
  return data;
}

async function loadBatchTemplate() {
  var key = getBatchTemplateKey();
  var res = await chrome.storage.local.get([key]);
  _batchTemplate = res[key] || null;
  return _batchTemplate;
}

async function clearBatchTemplate() {
  var key = getBatchTemplateKey();
  await chrome.storage.local.remove(key);
  _batchTemplate = null;
}

var _isRecording = false;
var _macroSteps = [];
var _macroStartTime = 0;

function getMacroKey(name) { return "macro_" + name; }

async function saveMacro(name, steps) {
  var key = getMacroKey(name);
  var all = await listMacros();
  if (all.indexOf(name) === -1) all.push(name);
  await chrome.storage.sync.set({ ["_macroNames"]: all, [key]: { name: name, steps: steps, savedAt: Date.now() } });
}

async function loadMacro(name) {
  var key = getMacroKey(name);
  var res = await chrome.storage.sync.get([key]);
  return res[key] || null;
}

async function listMacros() {
  var res = await chrome.storage.sync.get(["_macroNames"]);
  return res["_macroNames"] || [];
}

async function deleteMacro(name) {
  var key = getMacroKey(name);
  var all = await listMacros();
  all = all.filter(function(n) { return n !== name; });
  await chrome.storage.sync.set({ ["_macroNames"]: all });
  await chrome.storage.sync.remove(key);
}

function startRecording() {
  _isRecording = true;
  _macroSteps = [];
  _macroStartTime = Date.now();
}

function stopRecording() {
  _isRecording = false;
  return _macroSteps;
}

function addMacroStep(type, fieldIndex, buttonIndex, fieldName, fieldSelector) {
  if (!_isRecording) return;
  var delay = _macroSteps.length === 0 ? 0 : Date.now() - _macroStartTime;
  _macroStartTime = Date.now();
  _macroSteps.push({
    type: type,
    fieldIndex: fieldIndex,
    buttonIndex: buttonIndex,
    fieldName: fieldName || "",
    fieldSelector: fieldSelector || "",
    delay: delay,
    timestamp: Date.now()
  });
}
