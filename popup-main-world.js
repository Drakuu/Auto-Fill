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
            var s = host.shadowRoot.querySelectorAll('input:not([type=submit]):not([type=button]):not([type=reset]):not([type=hidden]):not([type=file]):not([type=image]), textarea, select, [contenteditable]');
            field = s[item.index];
          }
        }
      } else if (item.iframeIndex !== undefined) {
        var iframes = document.querySelectorAll('iframe');
        var iframe = iframes[item.iframeIndex];
        if (iframe && iframe.contentDocument) {
          if (item.selector) try { field = iframe.contentDocument.querySelector(item.selector); } catch(e) {}
          if (!field) {
            var s2 = iframe.contentDocument.querySelectorAll('input:not([type=submit]):not([type=button]):not([type=reset]):not([type=hidden]):not([type=file]):not([type=image]), textarea, select, [contenteditable]');
            field = s2[item.index];
          }
        }
      }
      if (!field) {
        if (item.selector) try { field = document.querySelector(item.selector); } catch(e) {}
        if (!field) {
          var all = document.querySelectorAll('input:not([type=submit]):not([type=button]):not([type=reset]):not([type=hidden]):not([type=file]):not([type=image]), textarea, select, [contenteditable]');
          field = all[item.index];
        }
      }
      if (!field) return;
      var tag = field.tagName.toLowerCase();
      var type = (field.type || '').toLowerCase();
      var isRich = field.getAttribute('contenteditable') === 'true' || item.isRichText;
      if (isRich) {
        field.innerHTML = item.value;
        field.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
        field.dispatchEvent(new Event('blur', { bubbles: true }));
        return;
      }
      if (item.isCustomSelect && item.hiddenSelectSelector) {
        var hiddenSel = document.querySelector(item.hiddenSelectSelector);
        if (hiddenSel && hiddenSel.tagName === 'SELECT') {
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

function mainWorldFindDialogTrigger() {
  try {
    var all = document.querySelectorAll('button, input[type=button], a[class*=btn], a[role=button], [role=button]');
    var candidates = [];
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      var text = (el.textContent || el.value || '').trim().toLowerCase();
      if (text.includes('add') || text.includes('create') || text.includes('new') || text.includes('edit')) {
        if (el.offsetParent !== null) candidates.push(el);
      }
    }
    if (candidates.length === 0) return false;
    var btn = candidates[0];
    btn.click();
    btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
    btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    var reactKey = Object.keys(btn).find(function(k) { return k.startsWith('__reactProps') || k.startsWith('__reactEventHandlers'); });
    if (reactKey && btn[reactKey] && typeof btn[reactKey].onClick === 'function') {
      try { btn[reactKey].onClick.call(btn, { type: 'click', target: btn, preventDefault: function(){} }); } catch(e) {}
    }
    return true;
  } catch(e) { return false; }
}

function mainWorldFindNextButton() {
  try {
    var all = document.querySelectorAll('button, input[type=submit], input[type=button], a[class*=btn], a[role=button], [role=button]');
    var texts = ['next', 'continue', 'proceed', 'forward', 'step 2', 'step 3', 'step 4', 'step 5', 'finish', 'complete', 'done'];
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      var text = (el.textContent || el.value || '').trim().toLowerCase();
      if (el.offsetParent === null) continue;
      for (var t = 0; t < texts.length; t++) {
        if (text.includes(texts[t])) {
          el.click();
          el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
          el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
          el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
          var reactKey = Object.keys(el).find(function(k) { return k.startsWith('__reactProps') || k.startsWith('__reactEventHandlers'); });
          if (reactKey && el[reactKey] && typeof el[reactKey].onClick === 'function') {
            try { el[reactKey].onClick.call(el, { type: 'click', target: el, preventDefault: function(){} }); } catch(e) {}
          }
          return true;
        }
      }
    }
    return false;
  } catch(e) { return false; }
}

function mainWorldDetectErrors() {
  try {
    var errors = [];
    var fields = document.querySelectorAll("input, select, textarea");
    fields.forEach(function(el) {
      if (el.hasAttribute("aria-invalid") && el.getAttribute("aria-invalid") === "true") {
        var label = "";
        var lbl = document.querySelector("label[for=\"" + (el.id || "") + "\"]");
        if (lbl) label = lbl.textContent.trim();
        else label = el.name || el.id || el.placeholder || "unknown";
        errors.push({ field: label, type: "aria-invalid" });
      }
    });
    fields.forEach(function(el) {
      if (el.matches && el.matches(":invalid") && !errors.some(function(e) { return e.field === (el.name || el.id); })) {
        var label = "";
        var lbl = document.querySelector("label[for=\"" + (el.id || "") + "\"]");
        if (lbl) label = lbl.textContent.trim();
        else label = el.name || el.id || el.placeholder || "unknown";
        errors.push({ field: label, type: "html5-invalid" });
      }
    });
    var errorEls = document.querySelectorAll(".error, .invalid, .has-error, .field-error, .form-error, .help-block, .alert-danger, .validation-error, [role=alert]");
    errorEls.forEach(function(el) {
      if (el.textContent.trim() && el.offsetParent !== null) errors.push({ field: el.textContent.trim().substring(0, 80), type: "error-element" });
    });
    var summary = document.querySelector(".error-summary, .validation-summary, .error-message, .form-error");
    if (summary && summary.textContent.trim() && summary.offsetParent !== null) errors.push({ field: summary.textContent.trim().substring(0, 100), type: "error-summary" });
    return errors;
  } catch(e) { return []; }
}

function mainWorldFindAndClick(strategy) {
  strategy = strategy || 'auto';
  try {
    var all = document.querySelectorAll('button, input[type=submit], input[type=button], input[type=reset], a[class*=btn], a[class*=button], a[role=button], [role=button], [onclick]');
    var candidates = [];
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      var tag = el.tagName.toLowerCase();
      var text = (el.textContent || el.value || '').trim().toLowerCase();
      var type = (el.type || '').toLowerCase();
      var cls = (el.className || '').toLowerCase();
      var onclick = el.getAttribute('onclick');
      if (tag === 'button' || tag === 'input' || cls.includes('btn') || cls.includes('button') || el.getAttribute('role') === 'button' || onclick) {
        var score = 0;
        if (type === 'submit') score += 10;
        if (text.includes('submit') || text.includes('save') || text.includes('send') || text.includes('update') || text.includes('ok') || text.includes('done')) score += 5;
        if (text.includes('add') || text.includes('create') || text.includes('new')) score += 2;
        if (onclick) score += 3;
        if (tag === 'button') score += 2;
        if (cls.includes('primary') || cls.includes('main') || cls.includes('action')) score += 2;
        candidates.push({ el: el, score: score, tag: tag, text: text, type: type });
      }
    }
    candidates.sort(function(a, b) { return b.score - a.score; });
    if (candidates.length === 0) return;
    var btn = candidates[0].el;
    if (strategy === 'click' || strategy === 'auto') btn.click();
    if (strategy === 'dispatch' || strategy === 'auto') {
      btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
      btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
      btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
    }
    var reactKey = Object.keys(btn).find(function(k) { return k.startsWith('__reactProps') || k.startsWith('__reactEventHandlers'); });
    if (reactKey && btn[reactKey] && typeof btn[reactKey].onClick === 'function') {
      try { btn[reactKey].onClick.call(btn, { type: 'click', target: btn, preventDefault: function(){} }); } catch(e) {}
    }
    if (strategy === 'submit' || (strategy === 'auto' && btn.type === 'submit')) {
      var form = btn.closest('form');
      if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }
  } catch(e) {}
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

function mainWorldShowOverlay(entries) {
  try {
    var existing = document.getElementById('qf-overlay-style');
    if (existing) { existing.remove(); }
    var style = document.createElement('style');
    style.id = 'qf-overlay-style';
    style.textContent = '.qf-filled { outline: 2px solid #22c55e !important; outline-offset: 2px; position: relative; } .qf-error { outline: 2px solid #ef4444 !important; outline-offset: 2px; } .qf-skipped { outline: 2px solid #eab308 !important; outline-offset: 2px; } .qf-tag { position: absolute; top: -20px; left: 0; background: #22c55e; color: #fff; font-size: 10px; padding: 1px 6px; border-radius: 3px; white-space: nowrap; z-index: 999999; pointer-events: none; } .qf-tag.error { background: #ef4444; } .qf-tag.skipped { background: #eab308; color: #000; }';
    document.head.appendChild(style);
    entries.forEach(function(e) {
      var el = null;
      if (e.selector) try { el = document.querySelector(e.selector); } catch(ex) {}
      if (!el && e.index !== undefined) {
        var all = document.querySelectorAll('input, select, textarea');
        if (all[e.index]) el = all[e.index];
      }
      if (!el) return;
      el.classList.add(e.status === 'error' ? 'qf-error' : e.status === 'skipped' ? 'qf-skipped' : 'qf-filled');
      var tag = document.createElement('div');
      tag.className = 'qf-tag' + (e.status === 'error' ? ' error' : e.status === 'skipped' ? ' skipped' : '');
      tag.textContent = e.label + ': ' + (e.value || '').substring(0, 30);
      tag.style.position = 'absolute';
      var rect = el.getBoundingClientRect();
      tag.style.left = rect.left + 'px';
      tag.style.top = (rect.top - 18) + 'px';
      tag.style.position = 'fixed';
      document.body.appendChild(tag);
    });
    return true;
  } catch(e) { return false; }
}

function mainWorldHideOverlay() {
  try {
    var s = document.getElementById('qf-overlay-style');
    if (s) s.remove();
    document.querySelectorAll('.qf-filled, .qf-error, .qf-skipped').forEach(function(el) { el.classList.remove('qf-filled', 'qf-error', 'qf-skipped'); });
    document.querySelectorAll('.qf-tag').forEach(function(el) { el.remove(); });
    return true;
  } catch(e) { return false; }
}

function mainWorldHighlightField(selector) {
  mainWorldClearHighlight();
  var el;
  if (selector.startsWith("#")) el = document.getElementById(selector.slice(1));
  else if (selector.startsWith(".")) el = document.querySelector(selector);
  else el = document.querySelector('[name="' + selector.replace(/"/g, '\\"') + '"], #' + selector.replace(/"/g, '\\"') + ', [data-field-index="' + selector + '"]');
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.style.outline = "2px solid #e88a3a";
  el.style.outlineOffset = "2px";
  el.dataset.qfHighlight = "true";
}

function mainWorldClearHighlight() {
  document.querySelectorAll("[data-qf-highlight]").forEach(function(el) {
    el.style.outline = "";
    el.style.outlineOffset = "";
    delete el.dataset.qfHighlight;
  });
}

function mainWorldRestoreSingleField(original) {
  var el = document.querySelectorAll("input, textarea, select, [contenteditable=true], [role=combobox]")[original.index];
  if (!el) return;
  var tag = el.tagName.toLowerCase();
  if (tag === "input" && el.type === "checkbox") { el.checked = original.checked; }
  else if (tag === "input" || tag === "textarea") {
    var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set || Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    if (setter) { setter.call(el, original.value); }
    else { el.value = original.value; }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  } else if (tag === "select") {
    el.value = original.value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
  } else if (el.isContentEditable) {
    el.innerHTML = original.value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

function mainWorldCaptureOriginals() {
  try {
    var data = [];
    var all = document.querySelectorAll('input:not([type=submit]):not([type=button]):not([type=reset]):not([type=hidden]):not([type=file]):not([type=image]), textarea, select');
    all.forEach(function(el, i) {
      if (el.offsetParent === null) return;
      data.push({ idx: i, value: el.value, checked: el.checked });
    });
    return data;
  } catch(e) { return []; }
}

function mainWorldRestoreOriginals(data) {
  try {
    var all = document.querySelectorAll('input:not([type=submit]):not([type=button]):not([type=reset]):not([type=hidden]):not([type=file]):not([type=image]), textarea, select');
    data.forEach(function(item) {
      var el = all[item.idx];
      if (!el) return;
      var ns = (Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value') || {}).set
        || (Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value') || {}).set;
      if (el.type === 'checkbox' || el.type === 'radio') {
        el.checked = item.checked;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        if (ns) ns.call(el, item.value);
        el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      }
    });
    return true;
  } catch(e) { return false; }
}

function mainWorldDetectOTP() {
  try {
    var all = document.querySelectorAll('input');
    var otpFields = [];
    all.forEach(function(el) {
      if (el.offsetParent === null) return;
      var ac = (el.getAttribute('autocomplete') || '').toLowerCase();
      if (ac === 'one-time-code') { otpFields.push({ field: el.name || el.id || 'otp', type: 'autocomplete' }); return; }
      var type = (el.type || '').toLowerCase();
      var im = (el.getAttribute('inputmode') || '').toLowerCase();
      var ml = el.maxLength;
      if (type === 'text' || type === 'tel' || type === 'number') {
        if ((ac === 'otp' || ac === 'one-time') && ml > 0 && ml <= 8) { otpFields.push({ field: el.name || el.id || 'otp', type: 'autocomplete' }); return; }
        if (im === 'numeric' && ml > 0 && ml <= 8) { otpFields.push({ field: el.name || el.id || 'otp', type: 'inputmode' }); return; }
        if (ml > 0 && ml <= 6 && /^\d+$/.test(el.value || '')) { otpFields.push({ field: el.name || el.id || 'otp', type: 'numeric' }); return; }
      }
      if ((el.className || '').toLowerCase().indexOf('otp') >= 0 || (el.id || '').toLowerCase().indexOf('otp') >= 0) {
        otpFields.push({ field: el.name || el.id || 'otp', type: 'class' });
      }
    });
    var sixDigitInputs = [];
    all.forEach(function(el) {
      if (el.offsetParent === null) return;
      var ml = el.maxLength;
      var type = (el.type || '').toLowerCase();
      if ((type === 'text' || type === 'tel') && el.offsetParent !== null && ml >= 4 && ml <= 8) {
        var label = '';
        var lbl = document.querySelector('label[for="' + (el.id || '') + '"]');
        if (lbl) label = lbl.textContent.trim().toLowerCase();
        if (label.indexOf('otp') >= 0 || label.indexOf('code') >= 0 || label.indexOf('verification') >= 0 || label.indexOf('2fa') >= 0 || label.indexOf('mfa') >= 0 || label.indexOf('auth') >= 0) {
          sixDigitInputs.push({ field: el.name || el.id || 'otp', type: 'label' });
        }
      }
    });
    var allFound = otpFields.concat(sixDigitInputs);
    return allFound.length > 0 ? { detected: true, count: allFound.length, fields: allFound } : { detected: false };
  } catch(e) { return { detected: false, error: e.message }; }
}

function mainWorldCheckFillIntegrity(items) {
  try {
    var needsRefill = [];
    var all = document.querySelectorAll('input:not([type=submit]):not([type=button]):not([type=reset]):not([type=hidden]):not([type=file]):not([type=image]), textarea, select');
    (items || []).forEach(function(item) {
      if (item.type === 'file' || item.type === 'richtext' || item.type === 'checkbox' || item.type === 'radio') return;
      var el = null;
      if (item.selector) try { el = document.querySelector(item.selector); } catch(e) {}
      if (!el) { el = all[item.index]; }
      if (!el) return;
      var current = el.value;
      if (current === '' || current !== item.value) {
        needsRefill.push(item);
      }
    });
    return needsRefill;
  } catch(e) { return []; }
}

function mainWorldDetectPostSubmit() {
  try {
    var result = { status: "unknown", message: "", errors: [], confirmed: false, urlChanged: false };
    var successSelectors = ['.success', '.alert-success', '.toast-success', '.notification-success', '.message-success', '[role=status]', '.form-success', '.submit-success'];
    for (var si = 0; si < successSelectors.length; si++) {
      var els = document.querySelectorAll(successSelectors[si]);
      for (var ei = 0; ei < els.length; ei++) {
        var txt = (els[ei].textContent || '').trim().toLowerCase();
        if (txt.includes('success') || txt.includes('saved') || txt.includes('created') || txt.includes('submitted') || txt.includes('thank you')) {
          result.status = "success";
          result.message = txt.substring(0, 100);
          break;
        }
      }
      if (result.status === "success") break;
    }
    if (result.status !== "success") {
      var confirmBtns = document.querySelectorAll('button, input[type=button], a[class*=btn], [role=button]');
      for (var ci = 0; ci < confirmBtns.length; ci++) {
        var btn = confirmBtns[ci];
        var bt = (btn.textContent || btn.value || '').trim().toLowerCase();
        if (btn.offsetParent !== null && (bt.includes('yes') || bt.includes('confirm') || bt.includes('ok') || bt.includes('sure') || bt.includes('proceed'))) {
          btn.click();
          btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
          btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
          btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
          result.status = "confirmed";
          result.confirmed = true;
          result.message = "Auto-confirmed: \"" + bt + "\"";
          break;
        }
      }
    }
    if (result.status === "unknown") {
      var fields2 = document.querySelectorAll('input, select, textarea');
      var errList = [];
      fields2.forEach(function(el) {
        if (el.hasAttribute('aria-invalid') && el.getAttribute('aria-invalid') === 'true') {
          errList.push({ field: el.name || el.id || 'unknown', type: 'aria-invalid' });
        } else if (el.matches && el.matches(':invalid')) {
          errList.push({ field: el.name || el.id || 'unknown', type: 'html5-invalid' });
        }
      });
      if (errList.length > 0) {
        result.status = "errors";
        result.errors = errList;
        result.message = errList.length + " validation error(s)";
      }
    }
    return result;
  } catch(e) { return { status: "error", message: e.message, errors: [], confirmed: false, urlChanged: false }; }
}
