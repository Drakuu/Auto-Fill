# Quick Fill — Improvement Plan

## P0 — Architecture: Replace inject.js with world:"MAIN" executeScript ✓
- [x] Remove `content_scripts` from manifest.json (kept — still needed for DOM scanning)
- [x] Remove `inject.js` and `web_accessible_resources`
- [x] Use `chrome.scripting.executeScript` with `world: "MAIN"` directly from popup.js
- [x] Eliminate hidden div bridge (`__qf_action`)
- [x] Simplify two-way messaging (content.js only handles ping + getFormFields)

## P1 — GUI: Modernize popup UI ✓
- [x] Dark mode + light mode toggle (persisted in storage)
- [x] Replace emoji icons with inline SVGs
- [x] Collapsible sections grouped by `<form>`
- [x] Tab-style toggle: "Fields" | "Buttons"
- [x] Color-coded field types (text=blue, email=green, password=red)
- [x] Search/filter bar for fields
- [x] Inline value previews with green checkmark on filled
- [x] Dynamic height (remove `max-height: 520px` lock)
- [x] Loading spinner instead of text

## P1 — Performance: Cache and reduce DOM thrash ✓
- [x] Cache `Object.getOwnPropertyDescriptor` once in main-world script
- [x] ~Reuse single hidden element~ (eliminated by P0 — inject.js removed)
- [x] Use index-based fallback instead of long CSS paths (selector simplified to id/name only)
- [x] ~Replace setTimeout waits~ (eliminated by P0 — direct executeScript)

## P2 — Features: Named profiles + Import/Export ✓
- [x] Save multiple named profiles per domain (not just auto-save)
- [x] Profile picker dropdown in popup
- [x] Export profiles as JSON file
- [x] Import profiles from JSON file
- [x] Delete profile button

## P2 — Features: Better form detection ✓
- [x] Shadow DOM field recursion
- [x] Handle iframe forms (if same origin)
- [x] Detect and show form groups (`<form>` boundaries)

## P2 — Features: Fill improvements ✓
- [x] Multiple submit strategies (click / form.submit / dispatch submit event)
- [x] Progress indicator: "X fields filled" instead of just "All filled"
- [x] Handle `input[type="number"]` React wart (number vs string value)
- [x] Auto-fill on page load for whitelisted domains (via background.js + content.js init)

## P0 — Fix: Checkbox / Radio — `field.checked` never set ✓
**Fix in `popup.js:95-104`, `background.js:130-139`**

Both `mainWorldFill` and `autoFillFields` call the native `.value` setter for all input types,
but checkboxes and radios are controlled by `field.checked`, not `field.value`. The value
setter (`HTMLInputElement.prototype.value` setter) does NOT change `checked`.

When fill runs:
- Checkbox gets `.value = "on"` but stays unchecked → form thinks user didn't agree
- Radio gets `.value = "Yes"` but stays unselected → no option chosen in group
- Green checkmark appears in popup but DOM never changed

**Fix**: Detect `type="checkbox"` / `type="radio"` in the fill functions. For checkboxes,
set `field.checked = true` (or toggle based on value `"on"/"off"`). For radios, find the
matching radio button in the group and set `radio.checked = true`. Dispatch `click` + `change`
events afterward so frameworks detect the state change.

----

## P0 — Fix: Chained dropdowns (country→state→city) — all-at-once fill ✓
**Fix in `popup.js:373-450`**

`fillAll()` sends every field value in a single synchronous batch to `mainWorldFill`,
which iterates with `forEach` — no `await` or delay between each dropdown. But chained
dropdowns require sequentially filling the first, waiting for the page JS to fetch
and populate the next dropdown's options, then filling the next.

Three sub-problems:

1. **Empty options at scan time** (`content.js:80-83`): If a dropdown hasn't been
   populated (because its parent hasn't been selected), `el.options` is empty. The
   `options` array in scanned data is `[]`, so `generateRandomValue` falls through
   to label-based detection — returning a friendly name like "United States" instead
   of an actual `<option value="US">`.

2. **No sequencing** (`popup.js:53-75`): `mainWorldFill` processes all fields in one
   synchronous tick. The `change` event fires on the first dropdown, but the very next
   iteration of `forEach` runs immediately — before the page's JS has had any chance
   to process the change and populate the next dropdown's options.

3. **No re-scan after fill**: After setting a dropdown value and dispatching `change`,
   the code never re-reads the downstream dropdown's current options before setting its
   value. So even if the page responded synchronously, the fill value for the second
   dropdown was computed against the old (empty) options.

**Fix**: Replace the synchronous batch fill with a sequential pipeline. For each field,
set the value → dispatch the event → `await new Promise(r => setTimeout(r, wait))` →
re-read the next field's `options` from the live DOM → repeat. The wait time should
be configurable (default ~500ms). Only fields within the same `<form>` or same
'parent chain' need sequencing; independent fields can still be batched.

----

## P0 — Fix: Shadow DOM / iframe — index mismatch between scan and fill ✓
**Fix in `content.js:74-139`, `popup.js:59-85`, `background.js:94-120`**

`content.js` scans into shadow roots and iframes, assigning sequential global indices
across all DOM trees. But both fill functions use `document.querySelectorAll(...)`,
which cannot reach into shadow roots or iframe documents.

Scenario: main document has 3 fields (indices 0,1,2), a shadow root has 2 fields
(indices 3,4) — `document.querySelectorAll(...).length` is 3, so `all[3]` is `undefined`.

The selector fallback also fails: `document.querySelector("#myId")` cannot match
elements inside a shadow root (shadow DOM isolates its subtree from the main document's
selector queries).

**Fix (option A — simpler)**: Skip filling shadow DOM / iframe fields from the popup.
When the user clicks "Fill", detect if a field came from a shadow root or iframe and
inject a separate `executeScript` call with a function that can reach those elements
(e.g., store a reference to the shadow root by ID or use the field's unique path).

**Fix (option B — more complex)**: Instead of index-based lookup, generate a unique
path array (e.g., `['document', 'querySelector("#host")', 'shadowRoot', 'querySelector("#input")']`)
and traverse it in the fill function. This would work across any DOM boundary.

**Fix (option C — pragmatic)**: Store all fillable elements by iterating the page once
inside the main world, building an array that includes shadow DOM content. Then the fill
function just indexes into this pre-built array.

----

## P2 — Fix: Select value mismatch — `change` fires even when no value was set ✓
**Fix in `popup.js:89-94`, `background.js:124-129`**

When a user-entered or auto-generated value doesn't match any `<option>` in a `<select>`,
no value is assigned (correct), but a `change` event IS dispatched anyway (wrong).
This can trigger the page's JS with an unchanged value, causing side effects like
spurious validation, API calls, or UI glitches.

Currently:
```js
if (match) field.value = item.value;
field.dispatchEvent(new Event('change', { bubbles: true }));  // runs even when !match
```

Additionally, there's no user feedback when the value is silently rejected — the popup
shows a green checkmark (fill "succeeded") but the DOM element was never touched.

**Fix**: Guard the `dispatchEvent` behind the same `if (match)` condition. Only fire
`change` when a value was actually assigned. Optionally show a warning for fields
where the value didn't match any option.

----

## P3 — Quality of life
- [ ] Keyboard shortcut `Ctrl+Shift+F` to open popup (manifest `"commands"`)
- [ ] Toolbar badge shows field count (e.g. "5")
- [ ] Right-click context menu on forms
- [ ] Remove all `console.log` from inject/main-world code
- [ ] Error toast instead of silent failure
