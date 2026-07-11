# Quick Fill — Improvement Plan

## P0 — Architecture: Replace inject.js with world:"MAIN" executeScript
- [ ] Remove `content_scripts` from manifest.json
- [ ] Remove `inject.js` and `web_accessible_resources`
- [ ] Use `chrome.scripting.executeScript` with `world: "MAIN"` directly from content.js
- [ ] Eliminate hidden div bridge (`__qf_action`)
- [ ] Simplify two-way messaging

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

## P1 — Performance: Cache and reduce DOM thrash
- [ ] Cache `Object.getOwnPropertyDescriptor` once in main-world script
- [ ] Reuse single hidden element instead of create+remove each action
- [ ] Use XPath or data-attribute selectors instead of long CSS paths
- [ ] Replace `setTimeout` waits with promise-based resolution

## P2 — Features: Named profiles + Import/Export
- [ ] Save multiple named profiles per domain (not just auto-save)
- [ ] Profile picker dropdown in popup
- [ ] Export profiles as JSON file
- [ ] Import profiles from JSON file
- [ ] Delete profile button

## P2 — Features: Better form detection
- [ ] Shadow DOM field recursion
- [ ] Handle iframe forms (if same origin)
- [x] Detect and show form groups (`<form>` boundaries)

## P2 — Features: Fill improvements
- [ ] Multiple submit strategies (click / form.submit / dispatch submit event)
- [ ] Progress indicator: "3/5 filled" instead of just "All filled"
- [ ] Handle `input[type="number"]` React wart (number vs string value)
- [ ] Pre-fill on page load for whitelisted domains

## P3 — Quality of life
- [ ] Keyboard shortcut `Ctrl+Shift+F` to open popup (manifest `"commands"`)
- [ ] Toolbar badge shows field count (e.g. "5")
- [ ] Right-click context menu on forms
- [ ] Remove all `console.log` from inject/main-world code
- [ ] Error toast instead of silent failure
