document.addEventListener("DOMContentLoaded", () => {
  try {
    chrome.storage.sync.get(["autoFillDomains"], (res) => {
      const domains = res.autoFillDomains || {};
      if (domains[window.location.hostname]) {
        chrome.runtime.sendMessage({ action: "checkAutoFill", domain: window.location.hostname });
      }
    });
  } catch (e) {}
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "ping") {
    sendResponse({ pong: true });
    return;
  }

  if (message.action === "getFormFields") {
    const topForms = document.querySelectorAll("form");
    const formLabels = [];
    topForms.forEach((f, i) => {
      formLabels.push(f.id || f.name || f.getAttribute("aria-label") || f.action?.replace(/^https?:\/\/[^/]+/, "") || "Form " + (i + 1));
    });

    const result = { fields: [], buttons: [] };
    scanForFields(document, result, topForms, formLabels);
    sendResponse({ fields: result.fields, buttons: result.buttons, url: window.location.href });
    return;
  }

  sendResponse({ success: false, error: "Unknown action" });
});

function getLabel(el) {
  if (el.id) {
    const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (label) return label.textContent.trim();
  }
  const parent = el.closest("label");
  if (parent) return parent.textContent.trim();
  const prev = el.previousElementSibling;
  if (prev && prev.tagName === "LABEL") return prev.textContent.trim();
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel) return ariaLabel;
  return el.name || el.placeholder || el.id || "";
}

function getUniqueSelector(el) {
  if (el.id) return "#" + CSS.escape(el.id);
  if (el.name) return el.tagName.toLowerCase() + '[name="' + CSS.escape(el.name) + '"]';
  return "";
}

function isFormField(el) {
  const tag = el.tagName.toLowerCase();
  if (tag === "textarea" || tag === "select") return true;
  if (tag === "input") {
    const type = (el.type || "").toLowerCase();
    return !["submit", "button", "reset", "hidden", "file", "image"].includes(type);
  }
  return false;
}

function isPageButton(el) {
  const tag = el.tagName.toLowerCase();
  if (tag === "button") return true;
  if (tag === "input") {
    const type = (el.type || "").toLowerCase();
    return ["submit", "button", "reset"].includes(type);
  }
  return false;
}

function scanForFields(root, result, topForms, formLabels) {
  // Collect fields and buttons in this root
  const all = root.querySelectorAll ? root.querySelectorAll("input, textarea, select, button") : [];
  all.forEach(el => {
    if (isFormField(el)) {
      const parentForm = el.closest("form");
      const formIdx = parentForm ? Array.from(topForms).indexOf(parentForm) : -1;
      const options = el.tagName.toLowerCase() === "select"
        ? Array.from(el.options).map(o => o.value).filter(v => v)
        : undefined;
      result.fields.push({
        kind: "field", index: result.fields.length,
        tag: el.tagName.toLowerCase(), type: el.type || "text",
        name: el.name || "", id: el.id || "",
        placeholder: el.placeholder || "", label: getLabel(el),
        currentValue: el.value, required: el.required || false,
        selector: getUniqueSelector(el),
        options,
        formIndex: formIdx,
        formLabel: formIdx >= 0 ? formLabels[formIdx] : null
      });
    }
    if (isPageButton(el)) {
      const parentForm = el.closest("form");
      const formIdx = parentForm ? Array.from(topForms).indexOf(parentForm) : -1;
      let label = el.tagName === "BUTTON"
        ? el.textContent.trim() || el.getAttribute("aria-label") || el.name || el.id || "button"
        : el.value || el.name || el.id || "submit";
      result.buttons.push({
        kind: "button", index: result.buttons.length,
        tag: el.tagName.toLowerCase(), type: el.type || "",
        label, id: el.id || "",
        selector: getUniqueSelector(el), formIndex: formIdx
      });
    }
  });

  // Recurse into shadow roots
  const allElements = root.querySelectorAll ? root.querySelectorAll("*") : [];
  allElements.forEach(el => {
    if (el.shadowRoot) scanForFields(el.shadowRoot, result, topForms, formLabels);
  });

  // Recurse into same-origin iframes (only from document)
  if (root === document) {
    root.querySelectorAll("iframe").forEach(iframe => {
      try {
        if (iframe.contentDocument) scanForFields(iframe.contentDocument, result, topForms, formLabels);
      } catch (e) {}
    });
  }
}
