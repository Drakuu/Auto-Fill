console.log("Quick Fill: content script loaded on", window.location.hostname);

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
  let path = [];
  let current = el;
  while (current && current !== document.body && current !== document.documentElement) {
    let sel = current.tagName.toLowerCase();
    if (current.id) { path.unshift("#" + CSS.escape(current.id)); break; }
    const p = current.parentElement;
    if (p) {
      const sibs = Array.from(p.children).filter(s => s.tagName === current.tagName);
      if (sibs.length > 1) sel += ":nth-of-type(" + (sibs.indexOf(current) + 1) + ")";
    }
    path.unshift(sel);
    current = current.parentElement;
  }
  return path.join(" > ");
}

function execInMainWorld(type, data, selector, index) {
  const dataEl = document.createElement("div");
  dataEl.id = "__qf_action";
  dataEl.style.display = "none";
  dataEl.textContent = JSON.stringify({ type, data, selector, index });
  document.documentElement.appendChild(dataEl);

  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("inject.js");
  document.documentElement.appendChild(script);
  script.addEventListener("load", () => {
    script.remove();
    const rem = document.getElementById("__qf_action");
    if (rem) rem.remove();
  });
}

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

    const fields = [];
    document.querySelectorAll("input:not([type=submit]):not([type=button]):not([type=reset]):not([type=hidden]):not([type=file]):not([type=image]), textarea, select").forEach((el, i) => {
      const parentForm = el.closest("form");
      const formIdx = parentForm ? Array.from(topForms).indexOf(parentForm) : -1;
      const options = el.tagName.toLowerCase() === "select"
        ? Array.from(el.options).map(o => o.value).filter(v => v)
        : undefined;
      fields.push({
        kind: "field", index: i,
        tag: el.tagName.toLowerCase(), type: el.type || "text",
        name: el.name || "", id: el.id || "",
        placeholder: el.placeholder || "", label: getLabel(el),
        currentValue: el.value, required: el.required || false,
        selector: getUniqueSelector(el),
        options,
        formIndex: formIdx,
        formLabel: formIdx >= 0 ? formLabels[formIdx] : null
      });
    });
    const buttons = [];
    document.querySelectorAll("button, input[type=submit], input[type=button], input[type=reset]").forEach((el, i) => {
      const parentForm = el.closest("form");
      const formIdx = parentForm ? Array.from(topForms).indexOf(parentForm) : -1;
      let label = el.tagName === "BUTTON"
        ? el.textContent.trim() || el.getAttribute("aria-label") || el.name || el.id || "button"
        : el.value || el.name || el.id || "submit";
      buttons.push({ kind: "button", index: i, tag: el.tagName.toLowerCase(), type: el.type || "", label, id: el.id || "", selector: getUniqueSelector(el), formIndex: formIdx });
    });
    sendResponse({ fields, buttons, url: window.location.href });
    return;
  }

  if (message.action === "fillAllFields") {
    execInMainWorld("fill", message.data);
    setTimeout(() => sendResponse({ success: true }), 300);
    return true;
  }

  if (message.action === "clickButton") {
    execInMainWorld("click", null, message.selector, message.index);
    setTimeout(() => sendResponse({ success: true }), 200);
    return true;
  }

  sendResponse({ success: false, error: "Unknown action" });
});
