var CUSTOM_RULES_KEY = "customGeneratorRules";

async function loadCustomRules() {
  var res = await chrome.storage.sync.get([CUSTOM_RULES_KEY]);
  return res[CUSTOM_RULES_KEY] || [];
}

async function saveCustomRules(rules) {
  await chrome.storage.sync.set({ [CUSTOM_RULES_KEY]: rules });
  customRulesCache = rules;
}

var customRulesCache = null;

async function getCustomRules() {
  if (customRulesCache) return customRulesCache;
  customRulesCache = await loadCustomRules();
  return customRulesCache;
}

async function addCustomRule(pattern, type, value) {
  var rules = await loadCustomRules();
  rules.push({ pattern: pattern, type: type, value: value, id: Date.now() + "_" + Math.random().toString(36).substring(2, 6) });
  await saveCustomRules(rules);
  return rules;
}

async function deleteCustomRule(id) {
  var rules = await loadCustomRules();
  rules = rules.filter(function(r) { return r.id !== id; });
  await saveCustomRules(rules);
  return rules;
}

async function clearCustomRules() {
  await saveCustomRules([]);
  return [];
}

function renderSettingsList(rules) {
  var list = document.getElementById("settingsList");
  if (!list) return;
  if (!rules || rules.length === 0) {
    list.innerHTML = '<p class="settings-empty">No custom rules yet. Add one below.</p>';
    return;
  }
  list.innerHTML = "";
  rules.forEach(function(rule) {
    var item = document.createElement("div");
    item.className = "settings-item";
    var info = document.createElement("div");
    info.className = "settings-item-info";
    var pat = document.createElement("span");
    pat.className = "settings-item-pattern";
    pat.textContent = "/" + rule.pattern + "/";
    var desc = document.createElement("span");
    desc.className = "settings-item-desc";
    desc.textContent = " → " + rule.type + ": " + rule.value;
    var del = document.createElement("button");
    del.className = "settings-item-del";
    del.textContent = "✕";
    del.addEventListener("click", async function() {
      var updated = await deleteCustomRule(rule.id);
      renderSettingsList(updated);
    });
    info.appendChild(pat);
    info.appendChild(desc);
    item.appendChild(info);
    item.appendChild(del);
    list.appendChild(item);
  });
}

async function openSettings() {
  document.getElementById("settingsOverlay").style.display = "flex";
  var rules = await loadCustomRules();
  renderSettingsList(rules);
}

function closeSettings() {
  document.getElementById("settingsOverlay").style.display = "none";
}

document.getElementById("settingsBtn").addEventListener("click", openSettings);
document.getElementById("settingsCloseBtn").addEventListener("click", closeSettings);

document.getElementById("addRuleBtn").addEventListener("click", async function() {
  var pattern = document.getElementById("rulePattern").value.trim();
  var type = document.getElementById("ruleType").value;
  var value = document.getElementById("ruleValue").value.trim();
  if (!pattern) { showStatus("Enter a regex pattern", "warning"); return; }
  if (!value) { showStatus("Enter a value", "warning"); return; }
  try { new RegExp(pattern); } catch(e) { showStatus("Invalid regex: " + e.message, "error"); return; }
  var rules = await addCustomRule(pattern, type, value);
  renderSettingsList(rules);
  document.getElementById("rulePattern").value = "";
  document.getElementById("ruleValue").value = "";
  showStatus("Rule added");
});

document.getElementById("clearRulesBtn").addEventListener("click", async function() {
  if (!confirm("Clear all custom rules?")) return;
  await clearCustomRules();
  renderSettingsList([]);
  showStatus("All rules cleared");
});
