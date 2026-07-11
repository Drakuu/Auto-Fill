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

function mainWorldFill(data) {
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
      if (tag === 'select') {
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

function mainWorldClick(selector, index, strategy) {
  strategy = strategy || 'auto';
  try {
    var btn = null;
    if (selector) try { btn = document.querySelector(selector); } catch(e) {}
    if (!btn) {
      var all = document.querySelectorAll('button, input[type=submit], input[type=button], input[type=reset]');
      btn = all[index];
    }
    if (!btn) return;

    if (strategy === 'click' || strategy === 'auto') {
      btn.click();
    }
    if (strategy === 'dispatch' || strategy === 'auto') {
      btn.dispatchEvent(new Event('click', { bubbles: true }));
    }
    if (strategy === 'submit' || (strategy === 'auto' && btn.type === 'submit')) {
      var form = btn.closest('form');
      if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }
  } catch(e) {}
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
  }

  // Enable/disable buttons based on available content, NOT current tab
  document.getElementById("fillAllBtn").disabled = !hasFields;
  document.getElementById("clearAllBtn").disabled = !hasFields;
  document.getElementById("fillSubmitBtn").disabled = !hasFields || !hasButtons;
  document.getElementById("autoSubmitBtn").disabled = !hasFields || !hasButtons;
}

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
  renderAll();
}

function randFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

const words = ["alpha","beta","gamma","delta","epsilon","zeta","eta","theta","iota","kappa","lambda","mu","nu","xi","omicron","pi","rho","sigma","tau","upsilon","phi","chi","psi","omega","test","demo","sample","hello","world","foo","bar","baz","quick","brown","fox","jump","lazy","dog","red","blue","green","yellow","black","white","silver","gold","task","item","note","data","value","user","name","email","pass","key","id","new","edit","view","list","add","create","update","delete","save","cancel","submit","reset","form","page","file","text","number","phone","date","time","url","search","yes","no","on","off","true","false","one","two","three","four","five","admin","manager","moderator","editor","author","contributor","member","guest"];
const emails = ["@gmail.com","@yahoo.com","@outlook.com","@hotmail.com","@icloud.com","@proton.me","@pm.me","@example.com","@test.com"];
const countries = ["United States","Canada","United Kingdom","Australia","Germany","France","Japan","Brazil","India","Mexico","Italy","Spain","Netherlands","Sweden","South Korea","Singapore","New Zealand","Switzerland","Norway","Denmark"];
const cities = ["New York","Los Angeles","Chicago","Houston","Phoenix","London","Manchester","Toronto","Vancouver","Montreal","Sydney","Melbourne","Berlin","Munich","Paris","Lyon","Tokyo","Osaka","Mumbai","Delhi","Sao Paulo","Rio","Milan","Rome","Madrid","Barcelona","Amsterdam","Stockholm","Seoul","Singapore","Zurich","Oslo","Copenhagen"];
const states = ["California","Texas","Florida","New York","Illinois","Pennsylvania","Ohio","Georgia","North Carolina","Michigan","New Jersey","Virginia","Washington","Arizona","Massachusetts","Tennessee","Indiana","Missouri","Maryland","Wisconsin","Colorado","Minnesota","Alabama","South Carolina","Louisiana","Kentucky","Oregon","Oklahoma","Connecticut","Nevada"];
const streets = ["Main St","Oak Ave","Elm St","Park Rd","Broadway","High St","Maple Dr","Cedar Ln","Lake View","Sunset Blvd","River Rd","Hill St","Pine Ave","Forest Dr","Meadow Ln"];

function getLabelText(field) {
  return ((field.label || "") + " " + (field.name || "") + " " + (field.id || "") + " " + (field.placeholder || "")).toLowerCase();
}

function generateRandomValue(field) {
  if (field.options && field.options.length > 0) return randFrom(field.options);

  const label = getLabelText(field);
  const t = field.type || "text";

  // Label-based detection (country, city, state, zip, address, etc.)
  if (/country|nation/i.test(label)) return randFrom(countries);
  if (/city|town/i.test(label)) return randFrom(cities);
  if (/state|province|region/i.test(label)) return randFrom(states);
  if (/zip|postal|postcode|pincode/i.test(label)) return String(Math.floor(Math.random() * 90000) + 10000);
  if (/address|street|addr/i.test(label)) return Math.floor(Math.random() * 9999) + 1 + " " + randFrom(streets);
  if (/birth|dob|born/i.test(label)) return "1990-" + String(Math.floor(Math.random() * 12) + 1).padStart(2,"0") + "-" + String(Math.floor(Math.random() * 28) + 1).padStart(2,"0");
  if (/gender|sex/i.test(label)) return randFrom(["Male","Female","Other","Prefer not to say"]);
  if (/company|organization|org|employer|firm/i.test(label)) return randFrom(["Acme Corp","Globex Inc","Initech","Umbrella Corp","Stark Industries","Wayne Enterprises","Cyberdyne","Hooli","Dunder Mifflin","Sterling Cooper"]);

  // Type-based detection
  if (t === "email") return randFrom(words) + "." + randFrom(words) + Math.floor(Math.random() * 999) + randFrom(emails);
  if (t === "number" || t === "range") return String(Math.floor(Math.random() * 9999) + 1);
  if (t === "tel" || t === "phone") return "555-" + String(Math.floor(Math.random() * 900) + 100) + "-" + String(Math.floor(Math.random() * 9000) + 1000);
  if (t === "url") return "https://example.com/" + randFrom(words);
  if (t === "password") return randFrom(words) + randFrom(words) + Math.floor(Math.random() * 999);
  if (t === "date") return "2026-" + String(Math.floor(Math.random() * 12) + 1).padStart(2,"0") + "-" + String(Math.floor(Math.random() * 28) + 1).padStart(2,"0");
  if (t === "time") return String(Math.floor(Math.random() * 12) + 8).padStart(2,"0") + ":" + String(Math.floor(Math.random() * 4) * 15).padStart(2,"0");
  if (t === "datetime-local") return "2026-" + String(Math.floor(Math.random() * 12) + 1).padStart(2,"0") + "-" + String(Math.floor(Math.random() * 28) + 1).padStart(2,"0") + "T" + String(Math.floor(Math.random() * 12) + 8).padStart(2,"0") + ":00";
  if (t === "month") return "2026-" + String(Math.floor(Math.random() * 12) + 1).padStart(2,"0");
  if (t === "week") return "2026-W" + String(Math.floor(Math.random() * 52) + 1).padStart(2,"0");
  if (t === "color") return "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6,"0");
  if (t === "textarea" || field.tag === "textarea") return "Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";
  if (t === "checkbox") return "on";
  if (t === "radio") return randFrom(field.options || ["Yes", "No"]);

  // Search field
  if (/search/i.test(label)) return "";
  // Name field
  if (/first.?name|fname|given/i.test(label)) return randFrom(["John","Jane","Alex","Sarah","Michael","Emma","David","Sophia","James","Olivia","Robert","Ava","William","Mia","Daniel","Isabella","Thomas","Charlotte","Christopher","Amelia"]);
  if (/last.?name|lname|family|surname/i.test(label)) return randFrom(["Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez","Wilson","Anderson","Taylor","Thomas","Moore","Jackson","Martin","Lee","White","Harris"]);

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
  const count = await fillWithSequencing();
  const btn = buttons.find(b => b.type === "submit" || /submit|save|send|add/i.test(b.label)) || buttons[0];
  if (btn) {
    await execInMainWorld("click", { selector: btn.selector, index: btn.index });
    showStatus("Auto filled & submitted!");
  } else {
    showStatus("Auto filled (no button)", "warning");
  }
}

async function doFill(idx) {
  const f = fields[idx];
  const res = await execInMainWorld("fill", [{ selector: f.selector, index: f.index, value: f.fillValue || "" }]);
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

function matchSelectValue(value, options, optionTexts) {
  if (!options || !options.length) return value;
  if (options.includes(value)) return value;
  var lower = (value || "").toLowerCase();
  for (var i = 0; i < (optionTexts || []).length; i++) {
    if (optionTexts[i].toLowerCase() === lower) return options[i];
    if (optionTexts[i].toLowerCase().includes(lower)) return options[i];
  }
  for (var j = 0; j < options.length; j++) {
    if (lower.includes(options[j].toLowerCase())) return options[j];
  }
  return options[0] || value;
}

async function rematchRemainingSelects(selectData, startIdx) {
  try {
    var tabId = (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id;
    if (!tabId) return;
    var indices = [];
    for (var i = startIdx; i < selectData.length; i++) indices.push(selectData[i].index);
    var r = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: function(idxs) {
        var all = document.querySelectorAll('input:not([type=submit]):not([type=button]):not([type=reset]):not([type=hidden]):not([type=file]):not([type=image]), textarea, select');
        return idxs.map(function(idx) {
          var el = all[idx];
          if (!el || el.tagName.toLowerCase() !== 'select') return null;
          return {
            opts: Array.from(el.options).map(function(o) { return o.value; }).filter(function(v) { return v; }),
            texts: Array.from(el.options).map(function(o) { return o.text; })
          };
        });
      },
      args: [indices],
      world: "MAIN"
    });
    var results = r?.[0]?.result || [];
    for (var j = 0; j < results.length; j++) {
      if (results[j] && results[j].opts && results[j].opts.length) {
        var matched = matchSelectValue(selectData[startIdx + j].value, results[j].opts, results[j].texts);
        if (matched !== selectData[startIdx + j].value) selectData[startIdx + j].value = matched;
      }
    }
  } catch(e) {}
}

async function fillWithSequencing() {
  var selIdxs = [], normIdxs = [];
  fields.forEach(function(f, i) {
    if (f.fillValue === undefined || f.fillValue === null) return;
    if (f.tag === 'select') selIdxs.push(i);
    else normIdxs.push(i);
  });
  var filled = 0;
  if (normIdxs.length > 0) {
    var data = normIdxs.map(function(i) { return { selector: fields[i].selector, index: fields[i].index, value: fields[i].fillValue }; });
    var res = await execInMainWorld("fill", data);
    if (res && res.success) { normIdxs.forEach(function(i) { markFilled(i); }); filled += normIdxs.length; }
  }
  if (selIdxs.length > 0) {
    var selData = selIdxs.map(function(i) { return { selector: fields[i].selector, index: fields[i].index, value: fields[i].fillValue, fillIdx: i }; });
    for (var i = 0; i < selData.length; i++) {
      var item = selData[i];
      var res2 = await execInMainWorld("fill", [{ selector: item.selector, index: item.index, value: item.value }]);
      if (res2 && res2.success) { markFilled(item.fillIdx); filled++; }
      if (i + 1 < selData.length) {
        await new Promise(function(r) { setTimeout(r, 500); });
        await rematchRemainingSelects(selData, i + 1);
      }
    }
  }
  return filled;
}

async function fillAll() {
  var count = await fillWithSequencing();
  showStatus(count + " field" + (count !== 1 ? "s" : "") + " filled");
}

async function clearAll() {
  const data = fields.map(f => ({ selector: f.selector, index: f.index, value: "" }));
  await execInMainWorld("fill", data);
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
  await execInMainWorld("click", { selector: b.selector, index: b.index });
  showStatus("Clicked!");
}

async function doFillClick(idx) {
  const count = await fillWithSequencing();
  const b = buttons[idx];
  await execInMainWorld("click", { selector: b.selector, index: b.index });
  showStatus("Done!");
}

async function fillAndSubmit() {
  const count = await fillWithSequencing();
  const btn = buttons.find(b => b.type === "submit" || /submit|save|send|add/i.test(b.label)) || buttons[0];
  if (btn) {
    await execInMainWorld("click", { selector: btn.selector, index: btn.index });
    showStatus("Submitted!");
  } else {
    showStatus("Filled (no button)", "warning");
  }
}

function getProfileKey(host) { return "profiles_" + host; }

async function getAllProfiles() {
  const host = getHostname(currentUrl);
  const key = getProfileKey(host);
  const res = await chrome.storage.sync.get([key]);
  let profiles = res[key];

  // Migrate old single-profile format
  if (!profiles) {
    const old = await chrome.storage.sync.get(["p_" + host]);
    if (old["p_" + host]) {
      profiles = { Default: old["p_" + host] };
      await chrome.storage.sync.set({ [key]: profiles });
      await chrome.storage.sync.remove("p_" + host);
    }
  }
  return profiles || {};
}

async function saveProfile() {
  const host = getHostname(currentUrl);
  const key = getProfileKey(host);
  const name = document.getElementById("profileName").value.trim() || "Default";
  const profiles = await getAllProfiles();
  const p = {};
  fields.forEach(f => { p["i" + f.index] = f.fillValue || ""; });
  profiles[name] = p;
  await chrome.storage.sync.set({ [key]: profiles });
  populateProfileSelect(profiles, name);
  showStatus("Saved \"" + name + "\"");
}

async function loadProfile(name) {
  const host = getHostname(currentUrl);
  const key = getProfileKey(host);
  const profiles = await getAllProfiles();
  const p = profiles[name];
  if (!p) { showStatus("Profile not found", "error"); return; }
  fields.forEach(f => { const v = p["i" + f.index]; if (v !== undefined) f.fillValue = v; });
  document.querySelectorAll(".field-value").forEach((el, i) => { if (fields[i]) el.value = fields[i].fillValue || ""; });
  document.getElementById("profileName").value = name;
}

async function deleteProfile() {
  const sel = document.getElementById("profileSelect");
  const name = sel.value;
  if (!name) { showStatus("Select a profile to delete", "warning"); return; }
  const host = getHostname(currentUrl);
  const key = getProfileKey(host);
  const profiles = await getAllProfiles();
  delete profiles[name];
  await chrome.storage.sync.set({ [key]: profiles });
  populateProfileSelect(profiles);
  if (Object.keys(profiles).length === 0) document.getElementById("profileName").value = "Default";
  showStatus("Deleted \"" + name + "\"");
}

function populateProfileSelect(profiles, selected) {
  const sel = document.getElementById("profileSelect");
  sel.innerHTML = '<option value="">-- Load profile --</option>';
  Object.keys(profiles).forEach(name => {
    const opt = document.createElement("option");
    opt.value = name; opt.textContent = name;
    if (name === selected) opt.selected = true;
    sel.appendChild(opt);
  });
}

async function autoLoadProfile() {
  const profiles = await getAllProfiles();
  const names = Object.keys(profiles);
  if (names.length === 0) return;
  const name = names.includes("Default") ? "Default" : names[0];
  const p = profiles[name];
  if (!p) return;
  fields.forEach(f => { const v = p["i" + f.index]; if (v !== undefined) f.fillValue = v; });
  document.querySelectorAll(".field-value").forEach((el, i) => { if (fields[i]) el.value = fields[i].fillValue || ""; });
  document.getElementById("profileName").value = name;
  populateProfileSelect(profiles, name);
}

function exportProfiles() {
  const key = "profiles_";
  chrome.storage.sync.get(null, (all) => {
    const profileData = {};
    Object.keys(all).forEach(k => {
      if (k.startsWith(key) || k.startsWith("p_")) profileData[k] = all[k];
    });
    const blob = new Blob([JSON.stringify(profileData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "quick-fill-profiles.json"; a.click();
    URL.revokeObjectURL(url);
    showStatus("Exported!");
  });
}

function importProfiles() {
  document.getElementById("importFileInput").click();
}

document.getElementById("importFileInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const data = JSON.parse(reader.result);
      if (typeof data !== "object") throw new Error("Invalid format");
      await chrome.storage.sync.set(data);
      showStatus("Imported!");
      loadFields();
    } catch {
      showStatus("Invalid file", "error");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
});

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

document.getElementById("autoFillToggle").addEventListener("change", async (e) => {
  const host = getHostname(currentUrl);
  const res = await chrome.storage.sync.get(["autoFillDomains"]);
  const domains = res.autoFillDomains || {};
  if (e.target.checked) domains[host] = true;
  else delete domains[host];
  await chrome.storage.sync.set({ autoFillDomains: domains });
  showStatus(e.target.checked ? "Auto-fill enabled" : "Auto-fill disabled");
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
document.getElementById("loadProfileBtn").addEventListener("click", () => {
  const name = document.getElementById("profileSelect").value;
  if (name) loadProfile(name);
  else showStatus("Select a profile", "warning");
});
document.getElementById("deleteProfileBtn").addEventListener("click", deleteProfile);
document.getElementById("exportProfilesBtn").addEventListener("click", exportProfiles);
document.getElementById("importProfilesBtn").addEventListener("click", importProfiles);
document.getElementById("reloadExtBtn").addEventListener("click", () => {
  showStatus("Reloading...");
  setTimeout(() => chrome.runtime.reload(), 300);
});
document.getElementById("openRepoBtn").addEventListener("click", () => {
  chrome.tabs.create({ url: "https://github.com/Drakuu/Auto-Fill" });
});
async function loadAutoFillState() {
  const host = getHostname(currentUrl);
  if (!host || host === "unknown") return;
  const res = await chrome.storage.sync.get(["autoFillDomains"]);
  const domains = res.autoFillDomains || {};
  document.getElementById("autoFillToggle").checked = !!domains[host];
}

// Patch autoLoadProfile to also update auto-fill toggle
const origAutoLoad = autoLoadProfile;
autoLoadProfile = async function() {
  await origAutoLoad();
  loadAutoFillState();
};

document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.sync.get(["theme"], (res) => {
    if (res.theme === "dark") applyTheme(true);
  });
  showVersion();
  loadFields();
});
