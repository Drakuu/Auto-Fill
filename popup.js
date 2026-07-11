let fields = [];
let buttons = [];
let currentUrl = "";
let currentTab = "fields";

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
  document.getElementById("fieldList").innerHTML = '<div class="spinner-wrap"><div class="spinner"></div><p class="loading-text">Scanning page...</p></div>';

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

  const hasFields = fields.length > 0;
  const hasButtons = buttons.length > 0;

  if (!hasFields && !hasButtons) {
    document.getElementById("searchBar").style.display = "none";
    document.getElementById("tabBar").style.display = "none";
    c.innerHTML = '<p class="empty">Nothing found.</p>'; return;
  }

  document.getElementById("searchBar").style.display = hasFields ? "block" : "none";
  document.getElementById("tabBar").style.display = hasFields && hasButtons ? "flex" : "none";
  document.getElementById("tabFieldsCount").textContent = fields.length;
  document.getElementById("tabButtonsCount").textContent = buttons.length;

  if (currentTab === "fields" && hasFields) {
    const groups = {};
    fields.forEach((f, i) => {
      const key = f.formIndex !== undefined && f.formIndex >= 0 ? "f" + f.formIndex : "ungrouped";
      if (!groups[key]) groups[key] = { label: f.formLabel || "Ungrouped", fields: [] };
      groups[key].fields.push({ field: f, idx: i });
    });

    Object.entries(groups).forEach(([key, group]) => {
      const section = document.createElement("div"); section.className = "form-section";
      const header = document.createElement("div"); header.className = "form-section-header";
      const arrow = document.createElement("span"); arrow.className = "form-section-arrow"; arrow.textContent = "▾";
      const title = document.createElement("span"); title.className = "form-section-title"; title.textContent = group.label;
      const count = document.createElement("span"); count.className = "form-section-count"; count.textContent = group.fields.length;
      const body = document.createElement("div"); body.className = "form-section-body";

      header.appendChild(arrow); header.appendChild(title); header.appendChild(count);
      header.addEventListener("click", () => {
        body.classList.toggle("collapsed");
        arrow.classList.toggle("collapsed");
      });
      section.appendChild(header); section.appendChild(body);
      c.appendChild(section);

      group.fields.forEach(({ field: f, idx: i }) => {
        const typeClass = f.type === "password" ? "type-password" : f.type === "email" ? "type-email" : f.type === "number" ? "type-number" : f.type === "tel" || f.type === "phone" ? "type-phone" : f.type === "url" ? "type-url" : f.type === "date" ? "type-date" : f.type === "textarea" || f.tag === "textarea" ? "type-textarea" : f.tag === "select" ? "type-select" : f.type === "checkbox" ? "type-checkbox" : f.type === "radio" ? "type-radio" : "type-text";
        const card = document.createElement("div"); card.className = "field-card " + typeClass;
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
        body.appendChild(card);
      });
    });
    document.getElementById("fillAllBtn").disabled = false;
    document.getElementById("clearAllBtn").disabled = false;
  } else {
    document.getElementById("fillAllBtn").disabled = true;
    document.getElementById("clearAllBtn").disabled = true;
  }

  if (currentTab === "buttons" && hasButtons) {
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
  } else {
    document.getElementById("fillSubmitBtn").disabled = true;
    document.getElementById("autoSubmitBtn").disabled = true;
  }
}

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
  renderAll();
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
  const res = await sendMsg({ action: "fillAllFields", data });
  if (res?.success) fields.forEach((_, i) => markFilled(i));
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
  const res = await sendMsg({ action: "fillAllFields", data: [{ selector: f.selector, index: f.index, value: f.fillValue || "" }] });
  if (res?.success) markFilled(idx);
  showStatus("Filled!");
}

function markFilled(idx) {
  const cards = document.querySelectorAll(".field-card");
  const card = cards[idx];
  if (!card) return;
  card.classList.add("filled");
  const badge = card.querySelector(".filled-badge") || (() => {
    const b = document.createElement("span"); b.className = "filled-badge"; b.textContent = "✓";
    card.querySelector(".field-label").appendChild(b);
    return b;
  })();
  badge.textContent = "✓";
}

async function fillAll() {
  const data = fields.map(f => ({ selector: f.selector, index: f.index, value: f.fillValue || "" }));
  const res = await sendMsg({ action: "fillAllFields", data });
  if (res?.success) fields.forEach((_, i) => markFilled(i));
  showStatus("All filled");
}

async function clearAll() {
  const data = fields.map(f => ({ selector: f.selector, index: f.index, value: "" }));
  await sendMsg({ action: "fillAllFields", data });
  fields.forEach(f => f.fillValue = "");
  document.querySelectorAll(".field-value").forEach(el => el.value = "");
  document.querySelectorAll(".field-card.filled").forEach(c => {
    c.classList.remove("filled");
    const badge = c.querySelector(".filled-badge");
    if (badge) badge.remove();
  });
  showStatus("Cleared");
}

async function doClick(idx) {
  const b = buttons[idx];
  await sendMsg({ action: "clickButton", selector: b.selector, index: b.index });
  showStatus("Clicked!");
}

async function doFillClick(idx) {
  const data = fields.map(f => ({ selector: f.selector, index: f.index, value: f.fillValue || "" }));
  const res = await sendMsg({ action: "fillAllFields", data });
  if (res?.success) fields.forEach((_, i) => markFilled(i));
  const b = buttons[idx];
  await sendMsg({ action: "clickButton", selector: b.selector, index: b.index });
  showStatus("Done!");
}

async function fillAndSubmit() {
  const data = fields.map(f => ({ selector: f.selector, index: f.index, value: f.fillValue || "" }));
  const res = await sendMsg({ action: "fillAllFields", data });
  if (res?.success) fields.forEach((_, i) => markFilled(i));

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

function applyTheme(dark) {
  document.body.dataset.theme = dark ? "dark" : "light";
  document.getElementById("themeIcon").innerHTML = dark
    ? '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'
    : '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
  chrome.storage.sync.set({ theme: dark ? "dark" : "light" });
}

document.getElementById("themeToggle").addEventListener("click", () => {
  applyTheme(document.body.dataset.theme !== "dark");
});

function showVersion() {
  const m = chrome.runtime.getManifest();
  document.getElementById("versionDisplay").textContent = "v" + m.version;
  chrome.storage.local.get(["updateAvailable"], (res) => {
    if (res.updateAvailable) {
      document.getElementById("newVersion").textContent = res.updateAvailable;
      document.getElementById("updateBanner").style.display = "flex";
    }
  });
}

document.querySelectorAll(".tab").forEach(t => {
  t.addEventListener("click", () => switchTab(t.dataset.tab));
});

document.getElementById("searchBar").addEventListener("input", () => {
  const q = document.getElementById("searchBar").value.toLowerCase();
  document.querySelectorAll(".field-card").forEach(card => {
    const label = card.querySelector(".field-label")?.textContent?.toLowerCase() || "";
    const info = card.querySelector(".field-info")?.textContent?.toLowerCase() || "";
    card.style.display = label.includes(q) || info.includes(q) ? "" : "none";
  });
});

document.getElementById("refreshBtn").addEventListener("click", loadFields);
document.getElementById("fillAllBtn").addEventListener("click", fillAll);
document.getElementById("clearAllBtn").addEventListener("click", clearAll);
document.getElementById("fillSubmitBtn").addEventListener("click", fillAndSubmit);
document.getElementById("autoSubmitBtn").addEventListener("click", autoFillAndSubmit);
document.getElementById("saveProfileBtn").addEventListener("click", saveProfile);
document.getElementById("loadProfileBtn").addEventListener("click", loadProfile);
document.getElementById("reloadExtBtn").addEventListener("click", () => chrome.runtime.reload());
document.getElementById("openRepoBtn").addEventListener("click", () => {
  chrome.tabs.create({ url: "https://github.com/Drakuu/Auto-Fill" });
});
document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.sync.get(["theme"], (res) => {
    if (res.theme === "dark") applyTheme(true);
  });
  showVersion();
  loadFields();
});
