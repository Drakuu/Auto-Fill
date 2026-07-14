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
  autoGenerateValues();
  var count = await fillWithSequencing();
  await fillConditionalFields();
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
    if (state.status === "success") {
      showStatus("✅ Form submitted successfully", "success");
    } else if (state.status === "confirmed") {
      showStatus("✅ Confirmed & submitted", "success");
    } else if (state.status === "errors") {
      showStatus("⚠️ " + state.errors.length + " validation error(s)", "warning");
    } else {
      showStatus("Auto filled & submitted!");
    }
  } catch (e) {
    showStatus("Submit failed: " + e.message, "error");
  }
}

async function doFill(idx) {
  const f = fields[idx];
  if (f.type === "file") { showStatus("Cannot auto-fill file inputs", "warning"); return; }
  const res = await execInMainWorld("fill", [{ selector: f.selector, index: f.index, value: f.fillValue || "", isCustomSelect: f.isCustomSelect, hiddenSelectSelector: f.hiddenSelectSelector, isRichText: f.type === "richtext" }]);
  if (res?.success) markFilled(idx);
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

async function fillAll() {
  _undoData = await captureOriginals();
  autoGenerateValues();
  var count = await fillWithSequencing();
  await fillConditionalFields();
  showStatus(count + " field" + (count !== 1 ? "s" : "") + " filled");
}

async function fillMultiStep() {
  _undoData = await captureOriginals();
  autoGenerateValues();
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
  autoGenerateValues();
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
  showStatus("Clicked!");
}

async function doFillClick(idx) {
  const count = await fillWithSequencing();
  const b = buttons[idx];
  await execInMainWorld("click", { selector: b.selector, index: b.index });
  showStatus("Done!");
}
