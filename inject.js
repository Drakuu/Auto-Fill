(function() {
  var el = document.getElementById('__qf_action');
  if (!el) return;
  var action = JSON.parse(el.textContent);
  el.remove();

  if (action.type === 'fill') {
    var filled = 0;
    (action.data || []).forEach(function(item) {
      try {
        var field = null;
        if (item.selector) try { field = document.querySelector(item.selector); } catch(e) {}
        if (!field) {
          var all = document.querySelectorAll('input:not([type=submit]):not([type=button]):not([type=reset]):not([type=hidden]):not([type=file]):not([type=image]), textarea, select');
          field = all[item.index];
        }
        if (!field) { console.log('QF[' + item.index + '] NOT FOUND'); return; }

        var tag = field.tagName.toLowerCase();
        console.log('QF[' + item.index + '] <' + tag + '> val="' + field.value + '" -> "' + item.value + '"');

        if (tag === 'select') {
          var match = Array.from(field.options).some(function(o) { return o.value === item.value; });
          if (match) field.value = item.value;
          field.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          var ns = (Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value') || {}).set
                || (Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value') || {}).set;
          if (ns) ns.call(field, item.value);
          field.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        }
        console.log('QF[' + item.index + '] after: "' + field.value + '"');
        filled++;
      } catch(e) { console.error('QF[' + item.index + '] ERROR:', e); }
    });
    console.log('QF: filled ' + filled + '/' + action.data.length + ' fields');
  }

  if (action.type === 'click') {
    try {
      var btn = null;
      if (action.selector) try { btn = document.querySelector(action.selector); } catch(e) {}
      if (!btn) {
        var all = document.querySelectorAll('button, input[type=submit], input[type=button], input[type=reset]');
        btn = all[action.index];
      }
      if (!btn) { console.log('QF: btn NOT FOUND'); return; }
      console.log('QF: clicking button "' + (btn.textContent || btn.value || '').trim() + '"');
      btn.click();
      btn.dispatchEvent(new Event('click', { bubbles: true }));
      var form = btn.closest('form');
      if (form) form.dispatchEvent(new Event('submit', { bubbles: true }));
      console.log('QF: clicked');
    } catch(e) { console.error('QF click ERROR:', e); }
  }
})();
