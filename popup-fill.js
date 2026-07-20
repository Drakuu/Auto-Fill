function syncPasswordConfirms() {
  var pwIdxs = [], confirmIdxs = [];
  fields.forEach(function(f, i) {
    if (f.type !== "password") return;
    var testStr = ((f.name || "") + " " + (f.id || "") + " " + (f.label || "")).toLowerCase();
    if (/confirm|verify|repeat|retype|again/.test(testStr)) confirmIdxs.push(i);
    else pwIdxs.push(i);
  });
  var pairs = [];
  pwIdxs.forEach(function(pi) {
    var best = { idx: -1, dist: 999 };
    confirmIdxs.forEach(function(ci) {
      var dist = Math.abs(pi - ci);
      if (dist < best.dist) { best.idx = ci; best.dist = dist; }
    });
    if (best.idx >= 0) {
      pairs.push({ pw: pi, confirm: best.idx });
      confirmIdxs = confirmIdxs.filter(function(x) { return x !== best.idx; });
    }
  });
  pairs.forEach(function(p) {
    if (fields[p.pw].fillValue) fields[p.confirm].fillValue = fields[p.pw].fillValue;
  });
}

async function autoGenerateValuesWithLearning() {
  var host = getHostname(currentUrl);
  var learned = await getLearnedValues(host);
  fields.forEach(function(f, i) {
    if (f.fillValue && f.fillValue.length > 0) return;
    var learnKey = f.name || f.id || "f" + f.index;
    if (learned[learnKey]) {
      f.fillValue = learned[learnKey].value;
      f._learned = true;
    } else {
      f.fillValue = generateRandomValue(f);
    }
  });
  syncPasswordConfirms();
  document.querySelectorAll(".field-value").forEach(function(el, i) {
    if (fields[i]) {
      el.value = fields[i].fillValue || "";
      if (fields[i]._learned) el.dataset.learned = "true";
      else delete el.dataset.learned;
    }
  });
  showStatus("Values generated" + (Object.keys(learned).length > 0 ? " (with learning)" : ""));
}

function autoGenerateValues() {
  fields.forEach((f, i) => {
    const val = generateRandomValue(f);
    f.fillValue = val;
  });
  syncPasswordConfirms();
  document.querySelectorAll(".field-value").forEach((el, i) => {
    if (fields[i]) el.value = fields[i].fillValue || "";
  });
  showStatus("Random values generated!");
}

async function autoFillAndSubmit() {
  _undoData = await captureOriginals();
  await autoGenerateValuesWithLearning();
  var count = await fillWithSequencing();
  await fillConditionalFields();
  var repaired = await autoRepair();
  const strategy = document.getElementById("submitStrategy")?.value || "auto";
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: mainWorldFindAndClick,
      args: [strategy],
      world: "MAIN"
    });
    await new Promise(function(r) { setTimeout(r, 800); });
    var postRes = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: mainWorldDetectPostSubmit,
      args: [],
      world: "MAIN"
    });
    var state = postRes?.[0]?.result || { status: "unknown" };
    var hasOTP = await detectOTPAfterSubmit();
    var statusMsg = "";
    if (state.status === "success") {
      statusMsg = "✅ Form submitted successfully";
    } else if (state.status === "confirmed") {
      statusMsg = "✅ Confirmed & submitted";
    } else if (state.status === "errors") {
      statusMsg = "⚠️ " + state.errors.length + " validation error(s)";
    } else {
      statusMsg = "Auto filled & submitted!";
    }
    if (repaired > 0) statusMsg += " (" + repaired + " repaired)";
    if (hasOTP) statusMsg += " 📱 OTP field detected";
    showStatus(statusMsg, state.status === "errors" ? "warning" : state.status === "success" || state.status === "confirmed" ? "success" : "");
  } catch (e) {
    showStatus("Submit failed: " + e.message, "error");
  }
}

async function doFill(idx) {
  const f = fields[idx];
  if (f.type === "file") { showStatus("Cannot auto-fill file inputs", "warning"); return; }
  const res = await execInMainWorld("fill", [{ selector: f.selector, index: f.index, value: f.fillValue || "", isCustomSelect: f.isCustomSelect, hiddenSelectSelector: f.hiddenSelectSelector, isRichText: f.type === "richtext" }]);
  if (res?.success) markFilled(idx);
  if (_isRecording) {
    var sel = f.name ? '[name="' + f.name.replace(/"/g, '\\"') + '"]' : f.id ? "#" + f.id : f.selector || "";
    addMacroStep("fill", idx, undefined, f.name || f.id || "", sel);
    updateMacroStepsUI();
  }
  showStatus("Filled!");
}

function markFilled(idx) {
  const cards = document.querySelectorAll(".field-card");
  const card = cards[idx];
  if (!card) return;
  card.classList.add("filled");
  const badge = card.querySelector(".filled-badge") || (function() {
    const b = document.createElement("span"); b.className = "filled-badge"; b.textContent = "✓";
    card.querySelector(".field-label").appendChild(b);
    return b;
  })();
  badge.textContent = "✓";
  if (!card.querySelector(".undo-single")) {
    var undoBtn = document.createElement("button");
    undoBtn.className = "undo-single";
    undoBtn.textContent = "↩";
    undoBtn.title = "Undo this field";
    undoBtn.addEventListener("click", function(e) { e.stopPropagation(); undoSingleField(idx); });
    card.querySelector(".input-row").appendChild(undoBtn);
  }
}

async function undoSingleField(idx) {
  var f = fields[idx];
  if (!f) return;
  var original = _undoData.find(function(d) { return d.index === f.index; });
  if (!original) { showStatus("No original value for this field", "warning"); return; }
  var [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: mainWorldRestoreSingleField,
    args: [original],
    world: "MAIN"
  });
  f.fillValue = original.value || "";
  var cards = document.querySelectorAll(".field-card");
  var card = cards[idx];
  if (card) {
    card.classList.remove("filled");
    var badge = card.querySelector(".filled-badge");
    if (badge) badge.remove();
    var ub = card.querySelector(".undo-single");
    if (ub) ub.remove();
    var input = card.querySelector(".field-value");
    if (input) input.value = original.value || "";
  }
  var changed = countChanged();
  showStatus("Field reverted (" + changed.changed + " field(s) remain changed)");
}

function countChanged() {
  var changed = 0;
  var unchanged = 0;
  fields.forEach(function(f, i) {
    var orig = _undoData.find(function(d) { return d.index === f.index; });
    if (orig && orig.value !== f.fillValue) changed++;
    else unchanged++;
  });
  return { changed: changed, total: fields.length };
}

function showDiffSummary() {
  if (_undoData.length === 0) return;
  var c = countChanged();
  if (c.changed > 0) showStatus(c.changed + " of " + c.total + " field(s) changed (↩ to undo one)");
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
  var allIdxs = [];
  fields.forEach(function(f, i) {
    if (f.fillValue === undefined || f.fillValue === null) return;
    allIdxs.push(i);
  });
  var filled = 0;
  for (var i = 0; i < allIdxs.length; i++) {
    var fi = allIdxs[i];
    var f = fields[fi];
    if (f.type === "file") { markFilled(fi); filled++; continue; }
    var item = { selector: f.selector, index: f.index, value: f.fillValue, isCustomSelect: f.isCustomSelect, hiddenSelectSelector: f.hiddenSelectSelector, isRichText: f.type === "richtext" };
    var res = await execInMainWorld("fill", [item]);
    if (res && res.success) { markFilled(fi); filled++; }
    if (f.type === "password" && fi < fields.length) syncPasswordConfirms();
    if (i + 1 < allIdxs.length) {
      var delay = (f.tag === 'select' || f.isCustomSelect) ? 500 : 100;
      await new Promise(function(r) { setTimeout(r, delay); });
      if (f.tag === 'select' || f.isCustomSelect) {
        var remIdxs = allIdxs.slice(i + 1).filter(function(ii) { return fields[ii].tag === 'select' || fields[ii].isCustomSelect; });
        if (remIdxs.length > 0) {
          var remData = remIdxs.map(function(ii) { return { selector: fields[ii].selector, index: fields[ii].index, value: fields[ii].fillValue, isCustomSelect: fields[ii].isCustomSelect, hiddenSelectSelector: fields[ii].hiddenSelectSelector, fillIdx: ii }; });
          await rematchRemainingSelects(remData, 0);
        }
      }
    }
  }
  return filled;
}

async function captureOriginals() {
  var [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return [];
  var r = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: mainWorldCaptureOriginals,
    args: [],
    world: "MAIN"
  });
  return r?.[0]?.result || [];
}

async function undoFill() {
  if (_undoData.length === 0) { showStatus("Nothing to undo", "warning"); return; }
  var [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: mainWorldRestoreOriginals,
    args: [_undoData],
    world: "MAIN"
  });
  _undoData = [];
  fields.forEach(function(f) { f.fillValue = ""; });
  document.querySelectorAll(".field-value").forEach(function(el) { el.value = ""; });
  document.querySelectorAll(".field-card.filled").forEach(function(c) {
    c.classList.remove("filled");
    var badge = c.querySelector(".filled-badge");
    if (badge) badge.remove();
  });
  showStatus("Undone — original values restored");
}

async function fillConditionalFields() {
  var existingSelectors = {};
  fields.forEach(function(f) { var sk = f.selector || "i" + f.index; existingSelectors[sk] = true; });
  for (var attempt = 0; attempt < 5; attempt++) {
    await new Promise(function(r) { setTimeout(r, 600); });
    var csRes = await sendMsg({ action: "getFormFields" });
    if (!csRes?.fields) break;
    var newFields = csRes.fields.filter(function(f) { return !existingSelectors[f.selector || "i" + f.index]; });
    if (newFields.length === 0) break;
    fields = csRes.fields;
    buttons = csRes.buttons;
    var filledAny = 0;
    for (var ni2 = 0; ni2 < newFields.length; ni2++) {
      var nf = newFields[ni2];
      if (nf.type === "file") continue;
      nf.fillValue = generateRandomValue(nf);
      var item3 = { selector: nf.selector, index: nf.index, value: nf.fillValue, isCustomSelect: nf.isCustomSelect, hiddenSelectSelector: nf.hiddenSelectSelector, isRichText: nf.type === "richtext" };
      var res3 = await execInMainWorld("fill", [item3]);
      if (res3 && res3.success) { filledAny++; }
      await new Promise(function(r) { setTimeout(r, 100); });
    }
    newFields.forEach(function(f) { var sk = f.selector || "i" + f.index; existingSelectors[sk] = true; });
    if (filledAny === 0) break;
  }
}

async function autoRepair() {
  var [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return 0;
  for (var attempt = 0; attempt < 3; attempt++) {
    await new Promise(function(r) { setTimeout(r, 2000); });
    var fillData = [];
    fields.forEach(function(f) {
      if (f.fillValue && f.type !== "file") {
        fillData.push({ selector: f.selector, index: f.index, value: f.fillValue, type: f.type });
      }
    });
    if (fillData.length === 0) break;
    var r2 = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: mainWorldCheckFillIntegrity,
      args: [fillData],
      world: "MAIN"
    });
    var needsRefill = r2?.[0]?.result || [];
    if (needsRefill.length === 0) break;
    var refillItems = needsRefill.map(function(item) {
      var f = fields.find(function(ff) { return (ff.selector && ff.selector === item.selector) || ff.index === item.index; });
      return { selector: item.selector, index: item.index, value: item.value, isCustomSelect: f && f.isCustomSelect, hiddenSelectSelector: f && f.hiddenSelectSelector, isRichText: f && f.type === "richtext" };
    });
    await execInMainWorld("fill", refillItems);
    await new Promise(function(r) { setTimeout(r, 500); });
    if (attempt === 2) return needsRefill.length;
  }
  return 0;
}

async function detectOTPAfterSubmit() {
  var [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return false;
  await new Promise(function(r) { setTimeout(r, 1500); });
  var r = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: mainWorldDetectOTP,
    args: [],
    world: "MAIN"
  });
  var otpRes = r?.[0]?.result || { detected: false };
  return otpRes.detected;
}

function exportFormData() {
  var host = getHostname(currentUrl);
  var ts = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19);
  var data = {
    exportedAt: ts,
    domain: host,
    url: currentUrl,
    fields: fields.map(function(f) {
      return {
        label: f.label || f.name || f.id || "field",
        name: f.name || "",
        type: f.type,
        value: f.fillValue || "",
        required: !!f.required
      };
    })
  };
  var json = JSON.stringify(data, null, 2);
  var blob = new Blob([json], { type: "application/json" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = host + "-" + ts + ".json";
  a.click();
  URL.revokeObjectURL(url);
  showStatus("Exported!");
}

function importFormFile(file) {
  var reader = new FileReader();
  reader.onload = function(e) {
    var text = e.target.result;
    var ext = file.name.split(".").pop().toLowerCase();
    var data;
    if (ext === "csv") {
      data = parseCSV(text);
    } else {
      try { data = JSON.parse(text); } catch(err) { showStatus("Invalid JSON: " + err.message, "error"); return; }
      if (Array.isArray(data)) {
        if (data.length > 0 && data[0].name && data[0].value !== undefined) {
          var obj = {};
          data.forEach(function(item) { if (item.name) obj[item.name.toLowerCase()] = item.value; });
          data = obj;
        } else if (data.length > 0 && data[0].label && data[0].value !== undefined) {
          var obj = {};
          data.forEach(function(item) { if (item.label) obj[item.label.toLowerCase()] = item.value; });
          data = obj;
        } else {
          data = {};
        }
      } else if (data.fields && Array.isArray(data.fields)) {
        var obj = {};
        data.fields.forEach(function(f) {
          if (f.name) obj[f.name.toLowerCase()] = f.value;
          if (f.label) obj[f.label.toLowerCase()] = f.value;
        });
        data = obj;
      } else if (typeof data === "object" && data !== null) {
        var obj = {};
        Object.keys(data).forEach(function(k) { obj[k.toLowerCase()] = data[k]; });
        data = obj;
      } else {
        showStatus("Unrecognized JSON format", "error"); return;
      }
    }
    applyImportedData(data);
  };
  reader.readAsText(file);
}

function parseCSV(text) {
  var lines = text.split("\n").filter(function(l) { return l.trim().length > 0; });
  if (lines.length < 2) { showStatus("CSV needs header + data rows", "error"); return {}; }
  var headers = lines[0].split(",").map(function(h) { return h.trim().toLowerCase().replace(/^"|"$/g, ""); });
  var result = {};
  for (var r = 1; r < lines.length; r++) {
    var vals = parseCSVLine(lines[r]);
    headers.forEach(function(h, i) {
      if (vals[i] && vals[i].trim()) {
        if (!result[h]) result[h] = vals[i].trim();
      }
    });
  }
  return result;
}

function parseCSVLine(line) {
  var result = [];
  var current = "";
  var inQuotes = false;
  for (var i = 0; i < line.length; i++) {
    var c = line[i];
    if (c === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current);
  return result;
}

function applyImportedData(data) {
  if (!data || Object.keys(data).length === 0) { showStatus("No data to import", "warning"); return; }
  var matched = 0;
  fields.forEach(function(f) {
    var keysToTry = [
      (f.name || "").toLowerCase(),
      (f.id || "").toLowerCase(),
      (f.label || "").toLowerCase(),
      (f.placeholder || "").toLowerCase()
    ].filter(function(k) { return k.length > 0; });
    for (var ki = 0; ki < keysToTry.length; ki++) {
      var k = keysToTry[ki];
      if (data[k] !== undefined && data[k] !== null && data[k] !== "") {
        f.fillValue = data[k];
        matched++;
        return;
      }
    }
  });
  document.querySelectorAll(".field-value").forEach(function(el, i) {
    if (fields[i]) el.value = fields[i].fillValue || "";
  });
  if (matched > 0) {
    showStatus("Imported " + matched + " field(s) from file");
  } else {
    showStatus("No matching fields found in import", "warning");
  }
}

function exportTemplate() {
  var template = _batchTemplate;
  if (!template || template.fields.length === 0) { showStatus("Save a template first", "warning"); return; }
  var json = JSON.stringify(template, null, 2);
  var blob = new Blob([json], { type: "application/json" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = "quick-fill-template-" + Date.now() + ".json";
  a.click();
  URL.revokeObjectURL(url);
  showStatus("Template exported");
}

function importTemplateFile(file) {
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var data = JSON.parse(e.target.result);
      if (!data.fields || !Array.isArray(data.fields)) { showStatus("Invalid template format", "error"); return; }
      var key = getBatchTemplateKey();
      data.timestamp = Date.now();
      chrome.storage.local.set({ [key]: data }, function() {
        _batchTemplate = data;
        document.getElementById("templateStatus").textContent = "Template: " + data.fields.length + " fields" + (data.urls?.length ? ", " + data.urls.length + " URLs" : "");
        document.getElementById("clearTemplateBtn").disabled = false;
        document.getElementById("batchFillBtn").disabled = false;
        if (data.urls) document.getElementById("batchUrls").value = data.urls.join("\n");
        showStatus("Template imported (" + data.fields.length + " fields)");
      });
    } catch(err) { showStatus("Invalid JSON: " + err.message, "error"); }
  };
  reader.readAsText(file);
}

async function batchFillUrls(urls) {
  if (!urls || urls.length === 0) { showStatus("No URLs provided", "warning"); return; }
  var template = await saveBatchTemplate();
  if (!template || template.fields.length === 0) { showStatus("No template — scan fields first", "warning"); return; }
  showStatus("Opening tabs...");
  var total = urls.length;
  var filled = 0;
  var skipped = 0;
  for (var i = 0; i < total; i++) {
    var url = urls[i].trim();
    if (!url) continue;
    if (!url.startsWith("http")) url = "https://" + url;
    try {
      var tab = await chrome.tabs.create({ url: url, active: false });
      await new Promise(function(r) { setTimeout(r, 3000); });
      var tabId = tab.id;
      try {
        await chrome.scripting.executeScript({ target: { tabId: tabId }, files: ["content.js"] });
        await new Promise(function(r) { setTimeout(r, 500); });
      } catch(e) {}
      var csRes = null;
      try {
        csRes = await chrome.tabs.sendMessage(tabId, { action: "getFormFields" });
      } catch(e) {}
      if (!csRes?.fields || csRes.fields.length === 0) {
        chrome.tabs.remove(tabId);
        skipped++;
        continue;
      }
      var matchFields = [];
      template.fields.forEach(function(tf) {
        var matched = csRes.fields.find(function(cf) {
          return (tf.name && cf.name && cf.name === tf.name) || (tf.id && cf.id && cf.id === tf.id);
        });
        if (matched) {
          matchFields.push({
            selector: matched.selector,
            index: matched.index,
            value: tf.fillValue,
            isCustomSelect: matched.isCustomSelect,
            hiddenSelectSelector: matched.hiddenSelectSelector
          });
        }
      });
      if (matchFields.length > 0) {
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: function(items) {
            var ns = (Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value') || {}).set
              || (Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value') || {}).set;
            items.forEach(function(item) {
              try {
                var field = null;
                if (item.selector) try { field = document.querySelector(item.selector); } catch(e) {}
                if (!field) {
                  var all = document.querySelectorAll('input:not([type=submit]):not([type=button]):not([type=reset]):not([type=hidden]):not([type=file]):not([type=image]), textarea, select');
                  field = all[item.index];
                }
                if (!field) return;
                if (ns) ns.call(field, item.value);
                field.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                if (field.tagName.toLowerCase() === 'select') field.dispatchEvent(new Event('change', { bubbles: true }));
              } catch(e) {}
            });
          },
          args: [matchFields],
          world: "MAIN"
        });
        filled++;
      } else {
        skipped++;
      }
      chrome.tabs.remove(tabId);
      showStatus(filled + "/" + total + " tabs filled (" + skipped + " skipped)");
    } catch(e) {
      skipped++;
    }
  }
  showStatus(filled + " of " + total + " tabs filled" + (skipped > 0 ? " (" + skipped + " skipped)" : ""));
}

async function fillAll() {
  _undoData = await captureOriginals();
  await autoGenerateValuesWithLearning();
  var count = await fillWithSequencing();
  await fillConditionalFields();
  var repaired = await autoRepair();
  var statusMsg = count + " field" + (count !== 1 ? "s" : "") + " filled";
  if (repaired > 0) statusMsg += " (" + repaired + " auto-repaired)";
  showStatus(statusMsg);
  showDiffSummary();
}

async function fillMultiStep() {
  _undoData = await captureOriginals();
  await autoGenerateValuesWithLearning();
  var count = await fillWithSequencing();
  var totalFilled = count;
  var [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) { showStatus(totalFilled + " field" + (totalFilled !== 1 ? "s" : "") + " filled"); return; }
  var steps = 1;
  for (var s = 0; s < 10; s++) {
    var r = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: mainWorldFindNextButton,
      args: [],
      world: "MAIN"
    });
    if (!r?.[0]?.result) break;
    steps++;
    await new Promise(function(res) { setTimeout(res, 800); });
    var csRes = await sendMsg({ action: "getFormFields" });
    if (!csRes?.fields) break;
    var oldLen = fields.length;
    fields = csRes.fields;
    buttons = csRes.buttons;
    var newIdxs = [];
    fields.forEach(function(f, i) { if (i >= oldLen) newIdxs.push(i); });
    if (newIdxs.length === 0) continue;
    fields.forEach(function(f) { if (f.fillValue === undefined) f.fillValue = generateRandomValue(f); });
    syncPasswordConfirms();
    count = 0;
    for (var ni = 0; ni < newIdxs.length; ni++) {
      var fi2 = newIdxs[ni];
      var f2 = fields[fi2];
      if (f2.type === "file") { markFilled(fi2); count++; continue; }
      var item2 = { selector: f2.selector, index: f2.index, value: f2.fillValue, isCustomSelect: f2.isCustomSelect, hiddenSelectSelector: f2.hiddenSelectSelector };
      var res2 = await execInMainWorld("fill", [item2]);
      if (res2 && res2.success) { markFilled(fi2); count++; }
      if (ni + 1 < newIdxs.length) {
        await new Promise(function(r2) { setTimeout(r2, 100); });
      }
    }
    totalFilled += count;
  }
  showStatus(totalFilled + " fields across " + steps + " step" + (steps !== 1 ? "s" : "") + " filled");
}

async function fillDialog() {
  showStatus("Opening dialog...");
  var [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  var r = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: mainWorldFindDialogTrigger,
    args: [],
    world: "MAIN"
  });
  if (!r?.[0]?.result) { showStatus("No dialog trigger found", "error"); return; }
  await new Promise(function(res) { setTimeout(res, 800); });
  var csRes = await sendMsg({ action: "getFormFields" });
  if (!csRes?.fields || csRes.fields.length === 0) {
    showStatus("No fields found in dialog", "warning"); return;
  }
  fields = csRes.fields;
  buttons = csRes.buttons;
  renderAll();
  await autoGenerateValuesWithLearning();
  var count = await fillWithSequencing();
  showStatus("Dialog fields filled");
  await new Promise(function(res) { setTimeout(res, 300); });
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: mainWorldFindAndClick,
      args: ["auto"],
      world: "MAIN"
    });
  } catch(e) {}
}

async function clearAll() {
  const data = fields.map(f => ({ selector: f.selector, index: f.index, value: "" }));
  await execInMainWorld("fill", data);
  fields.forEach(f => f.fillValue = "");
  _valueCache = {};
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
  if (_isRecording) {
    addMacroStep("click", undefined, idx, b.label || "", b.selector || "");
    updateMacroStepsUI();
  }
  showStatus("Clicked!");
}

async function doFillClick(idx) {
  const count = await fillWithSequencing();
  const b = buttons[idx];
  await execInMainWorld("click", { selector: b.selector, index: b.index });
  if (_isRecording) {
    addMacroStep("click", undefined, idx, b.label || "", b.selector || "");
    updateMacroStepsUI();
  }
  showStatus("Done!");
}

function renderMacroStep(s, i) {
  var label = s.type;
  if (s.type === "fill") label += " → " + (s.fieldName || s.fieldSelector || "field " + s.fieldIndex);
  else if (s.type === "click") label += " → " + (s.fieldName || "button " + (s.buttonIndex !== undefined ? s.buttonIndex + 1 : ""));
  else if (s.type === "wait") label += " → " + (s.value || s.delay || "500") + "ms";
  else if (s.type === "navigate") label += " → " + (s.value || s.fieldSelector || "");
  else if (s.type === "screenshot") label += "";
  var delayStr = i > 0 ? " (+" + s.delay + "ms)" : "";
  return '<div class="macro-step" draggable="true" data-idx="' + i + '">' +
    '<span class="macro-drag">⠿</span>' +
    '<span class="macro-num">' + (i + 1) + '.</span> ' +
    '<span class="macro-label">' + label + '</span>' +
    '<span class="macro-delay">' + delayStr + '</span>' +
    '<span class="macro-remove" data-idx="' + i + '">✕</span>' +
    '</div>';
}

function updateMacroStepsUI() {
  var el = document.getElementById("macroSteps");
  if (!el) return;
  if (_macroSteps.length === 0) {
    el.innerHTML = '<div style="color:var(--text-dim);padding:4px 0;text-align:center">No steps. Record fill/click actions or add steps below.</div>';
    return;
  }
  el.innerHTML = _macroSteps.map(function(s, i) { return renderMacroStep(s, i); }).join("");
  el.querySelectorAll(".macro-remove").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var idx = parseInt(this.dataset.idx);
      _macroSteps.splice(idx, 1);
      updateMacroStepsUI();
      if (!_isRecording) {
        document.getElementById("playMacroBtn").disabled = _macroSteps.length === 0;
        document.getElementById("saveMacroBtn").disabled = _macroSteps.length === 0;
        document.getElementById("macroStatusBadge").textContent = _macroSteps.length + " steps";
      }
    });
  });
  el.querySelectorAll(".macro-step").forEach(function(step) {
    step.addEventListener("dragstart", function(e) {
      e.dataTransfer.setData("text/plain", this.dataset.idx);
      this.classList.add("dragging");
    });
    step.addEventListener("dragend", function() { this.classList.remove("dragging"); });
    step.addEventListener("dragover", function(e) { e.preventDefault(); this.classList.add("drag-over"); });
    step.addEventListener("dragleave", function() { this.classList.remove("drag-over"); });
    step.addEventListener("drop", function(e) {
      e.preventDefault();
      this.classList.remove("drag-over");
      var fromIdx = parseInt(e.dataTransfer.getData("text/plain"));
      var toIdx = parseInt(this.dataset.idx);
      if (fromIdx === toIdx) return;
      var item = _macroSteps.splice(fromIdx, 1)[0];
      _macroSteps.splice(toIdx, 0, item);
      updateMacroStepsUI();
    });
  });
}

async function replayMacro(steps) {
  if (!steps || steps.length === 0) { showStatus("No steps to replay", "warning"); return; }
  showStatus("Replaying " + steps.length + " steps...");
  for (var i = 0; i < steps.length; i++) {
    var step = steps[i];
    if (step.delay > 0) await new Promise(function(r) { setTimeout(r, step.delay); });
    if (step.type === "fill") {
      var idx = step.fieldIndex;
      if (idx !== undefined && fields[idx]) {
        await doFill(idx);
      } else if (step.fieldName) {
        var found = -1;
        fields.forEach(function(f, fi) { if (f.name === step.fieldName || f.id === step.fieldName) found = fi; });
        if (found >= 0) await doFill(found);
      }
    } else if (step.type === "click") {
      var bidx = step.buttonIndex;
      if (bidx !== undefined && buttons[bidx]) {
        await doClick(bidx);
      }
    } else if (step.type === "wait") {
      var ms = parseInt(step.value) || 500;
      await new Promise(function(r) { setTimeout(r, ms); });
    } else if (step.type === "navigate") {
      var url = step.value || step.fieldSelector || "";
      if (url) {
        var [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) { await chrome.tabs.update(tab.id, { url: url }); await new Promise(function(r) { setTimeout(r, 2000); }); }
      }
    } else if (step.type === "screenshot") {
      var [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        try {
          var dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
          var link = document.createElement("a");
          link.download = "step-" + (i + 1) + "-" + Date.now() + ".png";
          link.href = dataUrl; link.click();
        } catch(e) { showStatus("Screenshot failed: " + e.message, "warning"); }
      }
    }
    updateMacroStepsUI();
  }
  showStatus("Replay complete (" + steps.length + " steps)");
}
