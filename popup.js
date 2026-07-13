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

function mainWorldFindAndClick(strategy) {
  strategy = strategy || 'auto';
  try {
    var all = document.querySelectorAll('button, input[type=submit], input[type=button], input[type=reset], a, [role=button], [onclick], div[class*=btn], span[class*=btn]');
    console.log('[QF] Candidates found:', all.length);
    var candidates = [];
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      var tag = el.tagName.toLowerCase();
      var text = (el.textContent || el.value || '').trim().toLowerCase();
      var type = (el.type || '').toLowerCase();
      var cls = (el.className || '').toLowerCase();
      var onclick = el.getAttribute('onclick');
      console.log('[QF] ' + i + ': <' + tag + '> type=' + type + ' class="' + cls + '" text="' + text.substring(0, 50) + '" onclick=' + (onclick ? 'yes' : 'no'));
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
    console.log('[QF] Sorted candidates (score):', candidates.map(function(c) { return c.tag + '[' + c.type + '] "' + c.text.substring(0, 30) + '" score=' + c.score; }));
    if (candidates.length === 0) { console.log('[QF] No button candidates found'); return; }
    var btn = candidates[0].el;
    console.log('[QF] Clicking: <' + candidates[0].tag + '> type=' + candidates[0].type + ' text="' + candidates[0].text.substring(0, 50) + '"');
    if (strategy === 'click' || strategy === 'auto') { btn.click(); console.log('[QF] .click() done'); }
    if (strategy === 'dispatch' || strategy === 'auto') {
      btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
      btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
      btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
      console.log('[QF] events dispatched');
    }
    var reactKey = Object.keys(btn).find(function(k) { return k.startsWith('__reactProps') || k.startsWith('__reactEventHandlers'); });
    if (reactKey && btn[reactKey] && typeof btn[reactKey].onClick === 'function') {
      try { btn[reactKey].onClick.call(btn, { type: 'click', target: btn, preventDefault: function(){} }); console.log('[QF] React onClick called'); } catch(e) {}
    }
    if (strategy === 'submit' || (strategy === 'auto' && btn.type === 'submit')) {
      var form = btn.closest('form');
      if (form) { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); console.log('[QF] form.submit done'); }
    }
  } catch(e) { console.log('[QF] Error:', e.message); }
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
        const typeClass = f.type === "password" ? "type-password" : f.type === "email" ? "type-email" : f.type === "number" ? "type-number" : f.type === "tel" || f.type === "phone" ? "type-phone" : f.type === "url" ? "type-url" : f.type === "date" ? "type-date" : f.type === "textarea" || f.tag === "textarea" ? "type-textarea" : f.tag === "select" || f.isCustomSelect ? "type-select" : f.type === "checkbox" ? "type-checkbox" : f.type === "radio" ? "type-radio" : "type-text";
        const card = document.createElement("div"); card.className = "field-card " + typeClass;
        const label = document.createElement("div"); label.className = "field-label";
        label.textContent = f.label || f.name || f.id || `Field ${i + 1}`;
        if (f.required) label.innerHTML += ' <span class="required">*</span>';
        const info = document.createElement("div"); info.className = "field-info";
        info.textContent = f.isCustomSelect ? `<custom-select>` : `<${f.tag}${f.type ? " type=" + f.type : ""}>`;
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
  document.getElementById("autoSubmitBtn").disabled = !hasFields || !hasButtons;
}

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
  renderAll();
}

function randFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pad(n, w) { return String(n).padStart(w, "0"); }

// ---- Procedural generators (data created at runtime, not stored in arrays) ----

function genFirst() {
  const s = ["J","A","M","S","D","C","R","T","E","K","N","L","B","H","P","V","W","G","Z","O"];
  const m = ["a","o","e","i","u","an","en","in","on","ar","or","el","al","am","em","ad","ed","av","ev","as","es","is","at","et","it","ac","ic","ol","il","ak","ek","ik","ap","ep","ip"];
  const e = ["n","s","d","t","h","nn","ss","tt","ck","rk","th","nd","ld","rd","st","nt","rt","ll","mm","rl","rn","ry","ro"];
  return randFrom(s) + randFrom(m) + (Math.random() > 0.45 ? randFrom(m) : "") + randFrom(e);
}
function genLast() {
  const s = ["S","M","W","B","J","H","C","R","A","D","T","G","K","L","P","F","E","N","V","O"];
  const m = ["i","o","a","e","u","ar","er","or","al","el","il","am","em","im","an","en","in","on","un","ow","aw","ay","ey","le","so","to","man","for","land","wood","field","well","hill","ham","b","l","f","m","p","r","s","t","k","d","g","w","n","y"];
  const e = ["s","n","r","d","t","l","k","e","y","son","ton","man","er","ley","ett","sen","ham","berg","burg","stein","shire","field","ford","wood","well","hill","land","ward","lyn","ers","ick","art","ark","ink","ers","son","ton","man","ley","ett","sen","ham","by"];
  return randFrom(s) + randFrom(m) + (Math.random() > 0.3 ? randFrom(e) : "");
}
function genEmail() { return genFirst().toLowerCase() + "." + genLast().toLowerCase() + randInt(10, 999) + randFrom(["@gmail.com","@yahoo.com","@outlook.com","@icloud.com","@proton.me","@example.com"]); }
function genPhone() { return "555-" + pad(randInt(100, 999), 3) + "-" + pad(randInt(1000, 9999), 4); }
function genCountry() { return randFrom(["United States","Canada","United Kingdom","Australia","Germany","France","Japan","Brazil","India","Mexico","Italy","Spain","Netherlands","Sweden","South Korea","Singapore","New Zealand","Switzerland","Norway","Denmark"]); }
function genCity() { return randFrom(["New York","Los Angeles","Chicago","Houston","London","Manchester","Toronto","Vancouver","Sydney","Melbourne","Berlin","Munich","Paris","Tokyo","Osaka","Mumbai","Delhi","Sao Paulo","Madrid","Barcelona","Amsterdam","Stockholm","Seoul","Singapore","Zurich","Copenhagen","Rome","Dublin","Dubai","Bangalore","Austin","Denver","Portland","Seattle","Boston","Nashville","Miami","Atlanta","Phoenix","Montreal"]); }
function genState() { return randFrom(["California","Texas","Florida","New York","Illinois","Pennsylvania","Ohio","Georgia","North Carolina","Michigan","New Jersey","Virginia","Washington","Arizona","Massachusetts","Tennessee","Indiana","Missouri","Maryland","Wisconsin","Colorado","Minnesota","Alabama","South Carolina","Louisiana","Kentucky","Oregon","Oklahoma","Connecticut","Nevada","Utah","Iowa","Kansas","Arkansas","Mississippi","Hawaii","Alaska"]); }
function genStreet() { return randInt(100, 9999) + " " + randFrom(["Main St","Oak Ave","Elm St","Park Rd","Broadway","High St","Maple Dr","Cedar Ln","Lake View","Sunset Blvd","River Rd","Hill St","Pine Ave","Forest Dr","Meadow Ln","Willow Way","Creek Ct","Springs Blvd","Harbor Dr","Valley Rd"]); }
function genZip() { return pad(randInt(10000, 99999), 5); }
function genPassword() { return genFirst().toLowerCase() + genLast().toLowerCase() + randInt(10, 999) + randFrom(["!","@","#","$"]); }
function genCompany() { return randFrom(["Acme","Globex","Initech","Umbrella","Stark","Wayne","Cyberdyne","Hooli","Dunder","Oscorp","Soylent","Wonka","Aperture","Tyrell","Massive","Nimbus","Gekko","Sterling","Vandelay","Prestige"]) + " " + randFrom(["Corp","Inc","LLC","Industries","Technologies","Group","Labs","Systems","Media","Ventures","Global","Solutions","Dynamics","Works","Enterprises"]); }
function genJob() { return randFrom(["Senior","Lead","Principal","Staff","Junior","",""]) + (Math.random() > 0.3 ? " " : "") + randFrom(["Software Engineer","Product Manager","Data Analyst","UX Designer","DevOps Engineer","QA Tester","Technical Writer","Solutions Architect","Security Analyst","ML Engineer","Full Stack Developer","Frontend Developer","Backend Developer","Engineering Manager","Product Designer","Scrum Master","Business Analyst","Marketing Manager","Sales Associate","Accountant","HR Coordinator","Consultant","Operations Manager","Creative Director","Research Scientist","Systems Admin","Network Engineer","Support Specialist","Data Scientist","Cloud Architect"]); }
function genUrl() { return "https://" + genFirst().toLowerCase() + randFrom(["com","net","io","org","co","app"]); }
function genDate() { return "199" + randInt(0, 9) + "-" + pad(randInt(1, 12), 2) + "-" + pad(randInt(1, 28), 2); }
function genLorem() { return "Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."; }
function genWord() { return randFrom(["alpha","beta","gamma","delta","omega","sigma","prime","edge","peak","core","base","nova","pulse","drive","wave","flux","grid","node","byte","hive","synth","neo","zen","ark","forge","tide","bold","cast","peak","dawn","echo"]); }

// ---- Detectors (field → generator key) ----
// ---- Detection tables (add rows to extend) ----

const acMap = {
  "given-name":"first","first-name":"first","cc-given-name":"first",
  "family-name":"last","last-name":"last","cc-family-name":"last",
  "name":"name","cc-name":"name",
  "nickname":"username","username":"username",
  "email":"email",
  "tel":"phone","tel-national":"phone","tel-area-code":"phone","home-phone":"phone","mobile":"phone","work-phone":"phone",
  "country":"country","country-name":"country",
  "address-level1":"state","address-level2":"city",
  "postal-code":"zip","zip":"zip",
  "street-address":"street","address-line1":"street","address-line2":"apt","address-line3":"street",
  "organization":"company","company":"company",
  "organization-title":"job","job-title":"job",
  "bday":"date","bday-day":"date","bday-month":"month","bday-year":"year",
  "sex":"gender","gender":"gender",
  "url":"url",
  "cc-number":"ccnum","cc-exp":"ccexp","cc-exp-month":"month","cc-exp-year":"year",
  "cc-csc":"cvv","cc-security-code":"cvv","cc-type":"cctype",
  "transaction-currency":"currency","transaction-amount":"amount",
  "one-time-code":"otp",
  "new-password":"password","current-password":"password",
  "language":"lang","photo":"url"
};
const typeStrictMap = { "email":"email", "tel":"phone", "phone":"phone", "url":"url", "password":"password" };
const typeLooseMap = { "number":"number", "range":"number", "date":"date", "time":"time", "datetime-local":"datetime", "month":"month", "week":"week", "color":"color", "checkbox":"checkbox", "radio":"radio" };

const labelRules = [
  // IDs & documents
  [/cnic|nic|national.?id|identity.?number|id.?number/, "cnic"],
  [/ssn|social.?security/, "ssn"],
  [/passport/, "passport"],
  [/pan.?number|pan.?card|pan.?no/, "pan"],
  [/aadhaar|aadhar|uid/, "aadhaar"],
  [/tax.?id|taxid|tin|e.?in/, "taxid"],
  [/driver.?lic|dl.?number|lic.?number|driving.?lic/, "drivers"],
  [/vin|vehicle.?id|chassis.?no/, "vin"],
  // Financial
  [/credit.?card|debit.?card|cc.?number|card.?number/, "ccnum"],
  [/cvv|cvc|csc|security.?code|secure.?code/, "cvv"],
  [/expir|exp\.?|valid.?thru|valid.?till|mm.?yy/, "ccexp"],
  [/account.?no|account.?number|acc.?no|iban/, "acct"],
  [/routing|aba.?number|sort.?code/, "routing"],
  [/swift|bic|bank.?code/, "swift"],
  // Location
  [/pincode|postal|postcode|zip/, "zip"],
  [/country|nation/, "country"],
  [/city|town/, "city"],
  [/state|province|region/, "state"],
  [/address|street|addr/, "street"],
  [/apt|unit|suite|flat/, "apt"],
  [/room|floor|level|building.?no/, "room"],
  // Personal
  [/birth|dob|born|date.?of.?birth/, "date"],
  [/gender|sex/, "gender"],
  [/age/, "age"],
  [/full.?name|your.?name|enter.?name/, "name"],
  [/first.?name|fname|given/, "first"],
  [/last.?name|lname|family|surname/, "last"],
  [/prefix|honorific|title.?mr|mr.?ms|salutation/, "prefix"],
  [/suffix|jr|sr|ii|iii|iv/, "suffix"],
  [/username|user.?name|login|nick/, "username"],
  [/nationality|citizen/, "nationality"],
  [/status(?!.*(?:family|marital))/, "genstatus"],
  [/marital|married|single/, "marital"],
  [/education|degree|school|university|college|major|qualification/, "edulevel"],
  // Work
  [/company|organization|org|employer|firm|works? at|department/, "company"],
  [/job.?title|position|designation|occupation|role/, "job"],
  // Contact
  [/website|web.?site|homepage|blog.?url/, "url"],
  [/fax/, "phone"],
  [/mobile|cell|cellular|phone|telephone|tel|contact.?no|contact.?number|whatsapp/, "phone"],
  // Products & orders
  [/sku|product.?id|item.?no|part.?no|model.?no/, "sku"],
  [/order.?no|order.?id|ref.?no|invoice|ticket.?no/, "order"],
  [/coupon|promo|discount.?code|voucher/, "coupon"],
  [/qty|quantity|count|total.?items/, "qty"],
  [/weight|mass|kg|lbs|pounds/, "weight"],
  [/height|ft|inches|cm/, "height"],
  [/temp|temperature|celsius|fahrenheit/, "temp"],
  [/color|colour|hue|shade/, "colorword"],
  [/plate.?no|license.?plate|reg.?no/, "plate"],
  // Text content
  [/subject|title/, "text"],
  [/message|comment|enquiry|inquiry|feedback|description|details|note/, "lorem"],
  [/search/, "empty"],
  // Catch-all (low priority)
  [/name/, "name"],
  [/email|e-?mail/, "email"],
  [/phone|telephone|mobile|cell|contact/, "phone"],
];

const acDetect = (f) => acMap[(f.autocomplete || "").toLowerCase()] || null;
const typeStrict = (f) => typeStrictMap[f.type || ""] || null;
const typeLoose = (f) => { if (f.tag === "textarea") return "lorem"; return typeLooseMap[f.type || ""] || null; };
const labelDetect = (f) => {
  const l = ((f.label||"") + " " + (f.name||"") + " " + (f.id||"") + " " + (f.placeholder||"") + " " + (f.autocomplete||"")).toLowerCase();
  for (const [re, key] of labelRules) { if (re.test(l)) return key; }
  return null;
};

const detectors = [acDetect, typeStrict, typeLoose, labelDetect];

const generators = {
  "first":   () => genFirst(),
  "last":    () => genLast(),
  "name":    () => genFirst() + " " + genLast(),
  "username":() => genFirst().toLowerCase() + genLast().toLowerCase() + randInt(10, 999),
  "email":   () => genEmail(),
  "phone":   () => genPhone(),
  "country": () => genCountry(),
  "state":   () => genState(),
  "city":    () => genCity(),
  "zip":     () => genZip(),
  "street":  () => genStreet(),
  "apt":     () => "Apt " + randInt(1, 20),
  "date":    () => genDate(),
  "month":   () => "2026-" + pad(randInt(1, 12), 2),
  "year":    () => String(randInt(1970, 2010)),
  "time":    () => pad(randInt(8, 19), 2) + ":" + pad(randInt(0, 3) * 15, 2),
  "datetime":() => "2026-" + pad(randInt(1, 12), 2) + "-" + pad(randInt(1, 28), 2) + "T" + pad(randInt(8, 19), 2) + ":00",
  "week":    () => "2026-W" + pad(randInt(1, 52), 2),
  "color":   () => "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0"),
  "number":  (f) => String(randInt(Number(f && f.min) || 1, Number(f && f.max) || 9999)),
  "gender":  () => randFrom(["Male", "Female", "Other"]),
  "company": () => genCompany(),
  "job":     () => genJob(),
  "age":     () => String(randInt(18, 75)),
  "url":     () => genUrl(),
  "password":() => genPassword(),
  "lorem":   () => genLorem(),
  "text":    () => genWord() + " " + genWord() + " " + genWord(),
  "cnic":    () => pad(randInt(10000, 99999), 5) + "-" + pad(randInt(1000000, 9999999), 7) + "-" + randInt(0, 9),
  "ssn":     () => pad(randInt(100, 999), 3) + "-" + pad(randInt(10, 99), 2) + "-" + pad(randInt(1000, 9999), 4),
  "passport":() => String.fromCharCode(randInt(65, 90)) + String.fromCharCode(randInt(65, 90)) + pad(randInt(1000000, 9999999), 7),
  "pan":     () => "A" + String.fromCharCode(randInt(66, 90)) + String.fromCharCode(randInt(66, 90)) + String.fromCharCode(randInt(66, 90)) + "P" + String.fromCharCode(randInt(65, 90)) + pad(randInt(1000, 9999), 4),
  "aadhaar": () => pad(randInt(1000, 9999), 4) + " " + pad(randInt(1000, 9999), 4) + " " + pad(randInt(1000, 9999), 4),
  "ccnum":   () => "4111-1111-1111-" + pad(randInt(1000, 9999), 4),
  "cvv":     () => pad(randInt(100, 999), 3),
  "ccexp":   () => pad(randInt(1, 12), 2) + "/" + (new Date().getFullYear() + randInt(1, 5)),
  "cctype":  () => randFrom(["Visa", "MasterCard", "AmEx", "Discover"]),
  "currency":() => "USD",
  "amount":  () => (Math.random() * 500 + 10).toFixed(2),
  "otp":     () => pad(randInt(100000, 999999), 6),
  "lang":    () => "English",
  "options": (f) => randFrom(f.options),
  "checkbox":() => "on",
  "radio":   (f) => f.options && f.options.length ? randFrom(f.options) : "Yes",
  "empty":   () => "",
  "taxid":   () => pad(randInt(10, 99), 2) + "-" + pad(randInt(1000000, 9999999), 7),
  "drivers": () => "D" + pad(randInt(100, 999), 3) + "-" + pad(randInt(1000, 9999), 4) + "-" + pad(randInt(1000, 9999), 4),
  "vin":     () => { const c="ABCDEFGHJKLMNPRSTUVWXYZ0123456789"; return Array.from({length:17},()=>c[randInt(0,c.length-1)]).join(""); },
  "acct":    () => pad(randInt(10000000, 99999999), 8),
  "routing": () => pad(randInt(10000000, 99999999), 8),
  "swift":   () => String.fromCharCode(randInt(65,90),randInt(65,90),randInt(65,90),randInt(65,90)) + "US" + String.fromCharCode(randInt(65,90),randInt(65,90)) + "XXX",
  "room":    () => "Room " + randInt(100, 9999),
  "qty":     () => String(randInt(1, 100)),
  "weight":  () => randInt(50, 350) + " lbs",
  "height":  () => randInt(4, 6) + "'" + randInt(0, 11) + '"',
  "temp":    () => randInt(60, 100) + "\u00B0F",
  "colorword":() => randFrom(["Red","Blue","Green","Black","White","Silver","Gold","Navy","Teal","Purple","Orange","Pink","Brown","Gray","Coral","Indigo","Violet","Cyan","Lime","Maroon"]),
  "sku":     () => "SKU-" + pad(randInt(10000, 99999), 5),
  "order":   () => "ORD-" + pad(randInt(100000, 999999), 6),
  "coupon":  () => genWord().toUpperCase() + randInt(10, 99),
  "edulevel":() => randFrom(["High School","Associate's","Bachelor's","Master's","PhD","Certificate","Diploma","MBA","MD","JD"]),
  "marital": () => randFrom(["Single","Married","Divorced","Widowed","Separated"]),
  "prefix":  () => randFrom(["Mr.","Ms.","Mrs.","Dr.","Prof.","Capt.","Col.","Hon."]),
  "suffix":  () => randFrom(["Jr.","Sr.","II","III","IV","PhD","MD","Esq.","CPA"]),
  "nationality":() => randFrom(["American","Canadian","British","Australian","German","French","Japanese","Brazilian","Indian","Mexican","Italian","Spanish","Dutch","Swedish","South Korean","Chinese","Russian","Swiss"]),
};

function applyConstraints(val, field) {
  if (typeof val === 'string') {
    if (field.maxLength > 0 && val.length > field.maxLength) val = val.substring(0, field.maxLength);
    if (field.minLength > 0 && val.length < field.minLength) val = val.padEnd(field.minLength, 'x').substring(0, field.maxLength > 0 ? field.maxLength : val.length + field.minLength);
  }
  if (field.type === 'number' || field.type === 'range') {
    var num = Number(val);
    if (field.min !== '' && num < Number(field.min)) val = String(field.min);
    if (field.max !== '' && num > Number(field.max)) val = String(field.max);
    if (field.step !== '') { var st = Number(field.step); if (st > 0) val = String(Math.round(num / st) * st); }
  }
  return val;
}

function generateRandomValue(field) {
  if (field.options && field.options.length > 0) return applyConstraints(randFrom(field.options), field);
  for (const detect of detectors) {
    const key = detect(field);
    if (key && generators[key]) return applyConstraints(generators[key](field), field);
  }
  return applyConstraints(generators["text"](field), field);
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
    showStatus("Auto filled & submitted!");
  } catch {
    showStatus("Auto filled (no submit button found)", "warning");
  }
}

async function doFill(idx) {
  const f = fields[idx];
  const res = await execInMainWorld("fill", [{ selector: f.selector, index: f.index, value: f.fillValue || "", isCustomSelect: f.isCustomSelect, hiddenSelectSelector: f.hiddenSelectSelector }]);
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
  var allIdxs = [];
  fields.forEach(function(f, i) {
    if (f.fillValue === undefined || f.fillValue === null) return;
    allIdxs.push(i);
  });
  var filled = 0;
  for (var i = 0; i < allIdxs.length; i++) {
    var fi = allIdxs[i];
    var f = fields[fi];
    var item = { selector: f.selector, index: f.index, value: f.fillValue, isCustomSelect: f.isCustomSelect, hiddenSelectSelector: f.hiddenSelectSelector };
    var res = await execInMainWorld("fill", [item]);
    if (res && res.success) { markFilled(fi); filled++; }
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

async function fillAll() {
  autoGenerateValues();
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
