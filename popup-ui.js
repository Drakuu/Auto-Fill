async function loadFields() {
  document.getElementById("fillAllBtn").disabled = true;
  document.getElementById("clearAllBtn").disabled = true;
  document.getElementById("autoSubmitBtn").disabled = true;
  document.getElementById("fieldList").innerHTML = '<div class="spinner-wrap"><div class="spinner"></div><p class="loading-text">Scanning page...</p></div>';

  _undoData = [];
  fields.forEach(function(f) {
    var key = f.name || f.id || f.selector;
    if (f.fillValue) _valueCache[key] = f.fillValue;
  });

  if (!(await ensureCS())) {
    document.getElementById("fieldList").innerHTML = '<p class="error">Cannot access page.</p>'; return;
  }

  const res = await sendMsg({ action: "getFormFields" });
  if (!res?.fields) {
    document.getElementById("fieldList").innerHTML = '<p class="error">No response.</p>'; return;
  }

  fields = res.fields;
  buttons = res.buttons;

  fields.forEach(function(f) {
    var key = f.name || f.id || f.selector;
    if (_valueCache.hasOwnProperty(key)) f.fillValue = _valueCache[key];
  });
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
      const sectionKey = f.sectionLabel ? f.sectionLabel : (f.formIndex >= 0 ? "f" + f.formIndex : "ungrouped");
      const sectionLabel = f.sectionLabel || f.formLabel || "Ungrouped";
      if (!groups[sectionKey]) groups[sectionKey] = { label: sectionLabel, fields: [] };
      groups[sectionKey].fields.push({ field: f, idx: i });
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
        const typeClass = f.type === "password" ? "type-password" : f.type === "email" ? "type-email" : f.type === "number" ? "type-number" : f.type === "tel" || f.type === "phone" ? "type-phone" : f.type === "url" ? "type-url" : f.type === "date" ? "type-date" : f.type === "file" ? "type-file" : f.type === "richtext" ? "type-richtext" : f.type === "textarea" || f.tag === "textarea" ? "type-textarea" : f.tag === "select" || f.isCustomSelect ? "type-select" : f.type === "checkbox" ? "type-checkbox" : f.type === "radio" ? "type-radio" : "type-text";
        const card = document.createElement("div"); card.className = "field-card " + typeClass;
        const label = document.createElement("div"); label.className = "field-label";
        label.textContent = f.label || f.name || f.id || "Field " + (i + 1);
        if (f.required) label.innerHTML += ' <span class="required">*</span>';
        if (f._learned) label.innerHTML += ' <span class="learned-badge" title="Auto-learned from history">📌</span>';
        const info = document.createElement("div"); info.className = "field-info";
        info.textContent = f.isCustomSelect ? "<custom-select>" : "<" + f.tag + (f.type ? " type=" + f.type : "") + ">";
        const row = document.createElement("div"); row.className = "input-row";
        if (f.type === "file") {
          const note = document.createElement("span"); note.className = "file-note"; note.textContent = "📎 Browse on page to select file";
          const btn = document.createElement("button"); btn.className = "fill-btn"; btn.textContent = "Skip";
          btn.disabled = true; btn.style.opacity = "0.5"; btn.style.cursor = "not-allowed";
          row.appendChild(note); row.appendChild(btn);
        } else {
          const input = document.createElement("input"); input.className = "field-value";
          input.type = f.type === "password" ? "password" : "text";
          input.placeholder = f.placeholder || "Enter value...";
          input.value = f.currentValue || "";
          input.addEventListener("input", function() {
            fields[i].fillValue = input.value;
            saveLearnedValue(fields[i], input.value);
          });
          fields[i].fillValue = f.currentValue || "";
          const btn = document.createElement("button"); btn.className = "fill-btn"; btn.textContent = "Fill";
          btn.addEventListener("click", () => doFill(i));
          row.appendChild(input); row.appendChild(btn);
        }
        card.appendChild(label); card.appendChild(info); card.appendChild(row);
        body.appendChild(card);
      });
    });
  }

  if (currentTab === "buttons" && hasButtons) {
    buttons.forEach((b, i) => {
      const card = document.createElement("div"); card.className = "field-card button-card";
      const label = document.createElement("div"); label.className = "field-label";
      label.textContent = b.label || "Button " + (i + 1);
      const info = document.createElement("div"); info.className = "field-info";
      info.textContent = "<" + b.tag + (b.type ? " type=" + b.type : "") + ">";
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

  document.getElementById("fillAllBtn").disabled = !hasFields;
  document.getElementById("fillStepBtn").disabled = !hasFields;
  document.getElementById("fillDialogBtn").disabled = !hasButtons;
  document.getElementById("undoBtn").disabled = _undoData.length === 0;
  document.getElementById("clearAllBtn").disabled = !hasFields;
  document.getElementById("autoSubmitBtn").disabled = !hasFields || !hasButtons;
}

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
  renderAll();
}

async function toggleOverlay() {
  _overlayActive = !_overlayActive;
  var btn = document.getElementById("overlayToggle");
  var [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) { _overlayActive = false; return; }
  if (_overlayActive) {
    var entries = fields.map(function(f, i) {
      var status = "filled";
      if (f.type === "file") status = "skipped";
      return { selector: f.selector, index: f.index, label: f.label || f.name || f.id || "field", value: f.fillValue || "", status: status };
    });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: mainWorldShowOverlay,
      args: [entries],
      world: "MAIN"
    });
    btn.textContent = "Hide overlay";
  } else {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: mainWorldHideOverlay,
      args: [],
      world: "MAIN"
    });
    btn.textContent = "Show on page";
  }
}

function applyTheme(dark) {
  document.body.dataset.theme = dark ? "dark" : "light";
  document.getElementById("themeIcon").innerHTML = dark
    ? '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'
    : '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
  chrome.storage.sync.set({ theme: dark ? "dark" : "light" });
}

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

async function loadAutoFillState() {
  const host = getHostname(currentUrl);
  if (!host || host === "unknown") return;
  const res = await chrome.storage.sync.get(["autoFillDomains"]);
  const domains = res.autoFillDomains || {};
  document.getElementById("autoFillToggle").checked = !!domains[host];
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

document.getElementById("overlayToggle").addEventListener("click", toggleOverlay);

document.getElementById("exportFormBtn").addEventListener("click", exportFormData);

document.getElementById("batchHeader").addEventListener("click", function() {
  var body = document.getElementById("batchBody");
  var header = document.getElementById("batchHeader");
  body.style.display = body.style.display === "none" ? "block" : "none";
  header.classList.toggle("open");
});

document.getElementById("saveTemplateBtn").addEventListener("click", async function() {
  var urlsText = document.getElementById("batchUrls").value;
  var urls = urlsText.split("\n").filter(function(u) { return u.trim(); });
  if (urls.length === 0) { showStatus("Enter at least one URL first", "warning"); return; }
  await saveBatchTemplate(urls);
  document.getElementById("templateStatus").textContent = "Template: " + fields.length + " fields, " + urls.length + " URLs";
  document.getElementById("clearTemplateBtn").disabled = false;
  document.getElementById("batchFillBtn").disabled = false;
  showStatus("Batch template saved");
});

document.getElementById("clearTemplateBtn").addEventListener("click", async function() {
  await clearBatchTemplate();
  document.getElementById("templateStatus").textContent = "No template";
  document.getElementById("clearTemplateBtn").disabled = true;
  document.getElementById("batchFillBtn").disabled = true;
  showStatus("Template cleared");
});

document.getElementById("batchFillBtn").addEventListener("click", async function() {
  var urlsText = document.getElementById("batchUrls").value;
  var urls = urlsText.split("\n").filter(function(u) { return u.trim(); });
  if (urls.length === 0) { showStatus("No URLs", "warning"); return; }
  this.disabled = true;
  await batchFillUrls(urls);
  this.disabled = false;
});

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
document.getElementById("fillStepBtn").addEventListener("click", fillMultiStep);
document.getElementById("fillDialogBtn").addEventListener("click", fillDialog);
document.getElementById("undoBtn").addEventListener("click", undoFill);
document.getElementById("clearAllBtn").addEventListener("click", clearAll);
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
document.getElementById("checkUpdateBtn").addEventListener("click", async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await chrome.tabs.sendMessage(tab.id, { action: "ping" });
    }
  } catch {}
  chrome.runtime.sendMessage({ action: "checkUpdateNow" });
  showStatus("Checking...");
  setTimeout(() => {
    chrome.storage.local.get(["updateAvailable", "lastCheck"], (r) => {
      if (r.updateAvailable) showStatus("Update v" + r.updateAvailable + " available! Run git pull then Reload.", "warning");
      else showStatus("Up to date");
      showVersion();
    });
  }, 2000);
});
document.getElementById("reloadExtBtn").addEventListener("click", () => {
  showStatus("Reloading...");
  chrome.storage.local.get(["updateAvailable"], (r) => {
    const ver = r.updateAvailable ? " → v" + r.updateAvailable : "";
    document.getElementById("status").textContent = "Reloading" + ver + "...";
    document.getElementById("status").className = "status warning";
  });
  setTimeout(() => chrome.runtime.reload(), 500);
});
document.getElementById("openRepoBtn").addEventListener("click", () => {
  chrome.tabs.create({ url: "https://github.com/Drakuu/Auto-Fill" });
});

document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.sync.get(["theme"], (res) => {
    if (res.theme === "dark") applyTheme(true);
  });
  showVersion();
  loadFields();
  loadAutoFillState();
});
