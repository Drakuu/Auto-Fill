let fields = [];
let buttons = [];
let currentUrl = "";

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

async function loadFields() {
  document.getElementById("fillAllBtn").disabled = true;
  document.getElementById("clearAllBtn").disabled = true;
  document.getElementById("fillSubmitBtn").disabled = true;
  document.getElementById("autoSubmitBtn").disabled = true;
  document.getElementById("fieldList").innerHTML = '<p class="loading">Scanning page...</p>';

  if (!(await ensureCS())) {
    document.getElementById("fieldList").innerHTML = '<p class="error">Cannot access page.</p>'; return;
  }

  const res = await sendMsg({ action: "getFormFields" });
  if (!res?.fields) {
    document.getElementById("fieldList").innerHTML = '<p class="error">No response.</p>'; return;
  }

  fields = res.fields;
  buttons = res.buttons;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentUrl = res.url || tab?.url || "";
  document.getElementById("currentPage").textContent = getHostname(currentUrl);
  renderAll();
  autoLoadProfile();
}

function renderAll() {
  const c = document.getElementById("fieldList");
  c.innerHTML = "";
  if (fields.length === 0 && buttons.length === 0) { c.innerHTML = '<p class="empty">Nothing found.</p>'; return; }

  if (fields.length > 0) {
    const t = document.createElement("div"); t.className = "section-title"; t.textContent = "Form Fields";
    c.appendChild(t);
    fields.forEach((f, i) => {
      const card = document.createElement("div"); card.className = "field-card";
      const label = document.createElement("div"); label.className = "field-label";
      label.textContent = f.label || f.name || f.id || `Field ${i + 1}`;
      if (f.required) label.innerHTML += ' <span class="required">*</span>';
      const info = document.createElement("div"); info.className = "field-info";
      info.textContent = `<${f.tag}${f.type ? " type=" + f.type : ""}>`;
      const row = document.createElement("div"); row.className = "input-row";
      const input = document.createElement("input"); input.className = "field-value";
      input.type = f.type === "password" ? "password" : "text";
      input.placeholder = f.placeholder || "Enter value...";
      input.value = f.currentValue || "";
      input.addEventListener("input", () => { fields[i].fillValue = input.value; });
      fields[i].fillValue = f.currentValue || "";
      const btn = document.createElement("button"); btn.className = "fill-btn"; btn.textContent = "Fill";
      btn.addEventListener("click", () => doFill(i));
      row.appendChild(input); row.appendChild(btn);
      card.appendChild(label); card.appendChild(info); card.appendChild(row);
      c.appendChild(card);
    });
    document.getElementById("fillAllBtn").disabled = false;
    document.getElementById("clearAllBtn").disabled = false;
  }

  if (buttons.length > 0) {
    const t = document.createElement("div"); t.className = "section-title"; t.textContent = "Page Buttons";
    c.appendChild(t);
    buttons.forEach((b, i) => {
      const card = document.createElement("div"); card.className = "field-card button-card";
      const label = document.createElement("div"); label.className = "field-label";
      label.textContent = b.label || `Button ${i + 1}`;
      const info = document.createElement("div"); info.className = "field-info";
      info.textContent = `<${b.tag}${b.type ? " type=" + b.type : ""}>`;
      const row = document.createElement("div"); row.className = "input-row";
      const cb = document.createElement("button"); cb.className = "click-btn"; cb.textContent = "Click";
      cb.addEventListener("click", () => doClick(i));
      const fcb = document.createElement("button"); fcb.className = "fill-click-btn"; fcb.textContent = "Fill & Click";
      fcb.addEventListener("click", () => doFillClick(i));
      row.appendChild(cb); row.appendChild(fcb);
      card.appendChild(label); card.appendChild(info); card.appendChild(row);
      c.appendChild(card);
    });
    document.getElementById("fillSubmitBtn").disabled = false;
    document.getElementById("autoSubmitBtn").disabled = false;
  }
}

function randFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

const words = ["alpha","beta","gamma","delta","epsilon","zeta","eta","theta","iota","kappa","lambda","mu","nu","xi","omicron","pi","rho","sigma","tau","upsilon","phi","chi","psi","omega","test","demo","sample","hello","world","foo","bar","baz","quick","brown","fox","jump","lazy","dog","red","blue","green","yellow","black","white","silver","gold","task","item","note","data","value","user","name","email","pass","key","id","new","edit","view","list","add","create","update","delete","save","cancel","submit","reset","form","page","file","text","number","phone","date","time","url","search","yes","no","on","off","true","false","one","two","three","four","five","admin","manager","moderator","editor","author","contributor","member","guest"];
const emails = ["@gmail.com","@yahoo.com","@outlook.com","@hotmail.com","@icloud.com","@proton.me","@pm.me","@example.com","@test.com"];

function generateRandomValue(field) {
  if (field.options && field.options.length > 0) return randFrom(field.options);
  const t = field.type || "text";
  if (t === "email") return randFrom(words) + "." + randFrom(words) + Math.floor(Math.random() * 999) + randFrom(emails);
  if (t === "number") return String(Math.floor(Math.random() * 9999) + 1);
  if (t === "tel" || t === "phone") return "555-" + String(Math.floor(Math.random() * 900) + 100) + "-" + String(Math.floor(Math.random() * 9000) + 1000);
  if (t === "url") return "https://example.com/" + randFrom(words);
  if (t === "password") return randFrom(words) + randFrom(words) + Math.floor(Math.random() * 999);
  if (t === "date") return "2026-" + String(Math.floor(Math.random() * 12) + 1).padStart(2,"0") + "-" + String(Math.floor(Math.random() * 28) + 1).padStart(2,"0");
  if (t === "textarea" || field.tag === "textarea") return "Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";
  return randFrom(words) + " " + randFrom(words) + " " + randFrom(words);
}

function autoGenerateValues() {
  fields.forEach((f, i) => {
    const val = generateRandomValue(f);
    f.fillValue = val;
  });
  document.querySelectorAll(".field-value").forEach((el, i) => {
    if (fields[i]) el.value = fields[i].fillValue || "";
  });
  showStatus("Random values generated!");
}

async function autoFillAndSubmit() {
  autoGenerateValues();
  const data = fields.map(f => ({ selector: f.selector, index: f.index, value: f.fillValue || "" }));
  await sendMsg({ action: "fillAllFields", data });
  const btn = buttons.find(b => b.type === "submit" || /submit|save|send|add/i.test(b.label)) || buttons[0];
  if (btn) {
    await sendMsg({ action: "clickButton", selector: btn.selector, index: btn.index });
    showStatus("Auto filled & submitted!");
  } else {
    showStatus("Auto filled (no button)", "warning");
  }
}

async function doFill(idx) {
  const f = fields[idx];
  await sendMsg({ action: "fillAllFields", data: [{ selector: f.selector, index: f.index, value: f.fillValue || "" }] });
  showStatus("Filled!");
}

async function fillAll() {
  const data = fields.map(f => ({ selector: f.selector, index: f.index, value: f.fillValue || "" }));
  await sendMsg({ action: "fillAllFields", data });
  showStatus("All filled");
}

async function clearAll() {
  const data = fields.map(f => ({ selector: f.selector, index: f.index, value: "" }));
  await sendMsg({ action: "fillAllFields", data });
  fields.forEach(f => f.fillValue = "");
  document.querySelectorAll(".field-value").forEach(el => el.value = "");
  showStatus("Cleared");
}

async function doClick(idx) {
  const b = buttons[idx];
  await sendMsg({ action: "clickButton", selector: b.selector, index: b.index });
  showStatus("Clicked!");
}

async function doFillClick(idx) {
  const data = fields.map(f => ({ selector: f.selector, index: f.index, value: f.fillValue || "" }));
  await sendMsg({ action: "fillAllFields", data });
  const b = buttons[idx];
  await sendMsg({ action: "clickButton", selector: b.selector, index: b.index });
  showStatus("Done!");
}

async function fillAndSubmit() {
  const data = fields.map(f => ({ selector: f.selector, index: f.index, value: f.fillValue || "" }));
  await sendMsg({ action: "fillAllFields", data });

  const btn = buttons.find(b => b.type === "submit" || /submit|save|send|add/i.test(b.label)) || buttons[0];
  if (btn) {
    await sendMsg({ action: "clickButton", selector: btn.selector, index: btn.index });
    showStatus("Submitted!");
  } else {
    showStatus("Filled (no button)", "warning");
  }
}

async function saveProfile() {
  const host = getHostname(currentUrl);
  const p = {};
  fields.forEach(f => { p["i" + f.index] = f.fillValue || ""; });
  await chrome.storage.sync.set({ ["p_" + host]: p });
  showStatus("Saved");
}

async function autoLoadProfile() {
  const host = getHostname(currentUrl);
  const res = await chrome.storage.sync.get(["p_" + host]);
  const p = res["p_" + host];
  if (!p) return;
  fields.forEach(f => { const v = p["i" + f.index]; if (v !== undefined) f.fillValue = v; });
  document.querySelectorAll(".field-value").forEach((el, i) => { if (fields[i]) el.value = fields[i].fillValue || ""; });
}

async function loadProfile() { await autoLoadProfile(); showStatus("Loaded"); }

document.getElementById("refreshBtn").addEventListener("click", loadFields);
document.getElementById("fillAllBtn").addEventListener("click", fillAll);
document.getElementById("clearAllBtn").addEventListener("click", clearAll);
document.getElementById("fillSubmitBtn").addEventListener("click", fillAndSubmit);
document.getElementById("autoSubmitBtn").addEventListener("click", autoFillAndSubmit);
document.getElementById("saveProfileBtn").addEventListener("click", saveProfile);
document.getElementById("loadProfileBtn").addEventListener("click", loadProfile);
document.addEventListener("DOMContentLoaded", loadFields);
