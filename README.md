# Quick Fill — Chrome Extension

Scan any webpage for form fields and buttons, fill them with custom or auto-generated data, and submit forms — all from a single popup. Built with Manifest V3.

## Features

### Core
- **Instant field scan** — detects `<input>`, `<textarea>`, `<select>`, `<button>`, rich text editors, custom dropdowns (ARIA combobox), file uploads, and Shadow DOM/iframe fields
- **55+ smart generators** — email, phone, password, credit card, SSN, passport, address, company, job title, lorem ipsum, and more
- **Field constraints respected** — `maxLength`, `minLength`, `min`, `max`, `step` applied to all generated values
- **Detection pipeline** — `autocomplete` attribute → HTML type → loose type → 55 label regex rules → text fallback
- **Dark/light mode** — persisted to storage

### Workflow

| Feature | What |
|---------|------|
| **Fill All** | Auto-generate and fill every field with one click |
| **Fill & Submit** | Fill all fields + scored submit button finder |
| **Multi-step forms** | Detect "Next"/"Continue" buttons, fill up to 10 wizard steps |
| **Dialog/modal fill** | Click "Add/Create/Edit" buttons, wait for modal, fill, save |
| **Conditional fields** | Re-scan after fill up to 5× for dynamically appearing fields |
| **Undo fill** | Capture originals before fill, restore all fields in one click |
| **Auto-repair** | Re-check fields 2s after fill — if JS re-rendered them empty, re-fill (3 retries) |

### Intelligence

| Feature | What |
|---------|------|
| **Auto-learning** | Remembers values you type per domain → auto-suggests them next visit (📌 badge) |
| **Password sync** | Copies password to confirm/verify/retype fields automatically |
| **Smart profile matching** | Save/load by field `name` or `id` (not fragile index) — survives page changes |
| **Fieldset grouping** | Fields grouped by `<fieldset>` legends, collapsible sections in popup |

### Post-Submit

| Feature | What |
|---------|------|
| **Validation error detection** | Checks `aria-invalid`, `:invalid`, error elements 600ms after submit click |
| **Confirmation auto-click** | Detects "Yes/OK/Confirm/Proceed" dialogs and clicks them |
| **OTP/2FA detection** | Scans for one-time code fields after submit (autocomplete, inputmode, maxlength, label) |
| **Export JSON** | Download all filled values as `domain-timestamp.json` |

### Access

| Feature | What |
|---------|------|
| **Right-click context menu** | "Fill all fields" / "Fill & Submit" without opening popup |
| **Keyboard shortcuts** | Ctrl+Shift+F (fill all), Ctrl+Shift+S (fill & submit) — customizable at `chrome://extensions/shortcuts` |
| **Debug overlay** | Toggle green/red/yellow field outlines + floating value labels on the page |

### Batch

| Feature | What |
|---------|------|
| **Batch fill** | Save current form as template, paste a list of URLs, fill all matching fields across tabs |
| **Auto-fill on load** | Whitelist domains via toggle — auto-fills on page load |

## Installation

### From source

```bash
git clone https://github.com/Drakuu/Auto-Fill.git
```

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load Unpacked** → select the folder
4. Pin the extension in your toolbar

### From Chrome Web Store

<!-- Add link after publishing -->

## Auto-Update (Team Use)

Run once, stays in background. Polls GitHub every 2 minutes, auto-pulls, auto-reloads.

### Windows

```powershell
.\watcher.ps1
```

### Linux / Mac

```bash
chmod +x watcher.sh
./watcher.sh
```

### Manual update

```bash
cd /path/to/Auto-Fill && git pull
```

Then click **Reload** button in the popup.

## Project Structure

```
form-filler-extension/
├── manifest.json              # v1.1.0, MV3, commands, contextMenus
├── version.json               # {"version":"1.1.0"}
├── background.js              # Service worker — updates, context menus, keyboard shortcuts, auto-fill
├── content.js                 # Injected into pages — field/button scanning, rich text, fieldset grouping
├── popup.html                 # Popup UI — loads 6 scripts
├── popup-state.js             # State variables + utilities + learning + batch template
├── popup-generators.js        # 55+ generators + detection tables + 55 label rules
├── popup-main-world.js        # All mainWorld* functions (injected via executeScript)
├── popup-fill.js              # Fill orchestration: sequencing, multi-step, dialog, undo, export, batch
├── popup-profiles.js          # Profile save/load/delete/export/import
├── popup-ui.js                # UI rendering, event listeners, theme, batch UI
├── styles.css                 # Light/dark CSS custom properties
├── icons/                     # icon16.png, icon48.png, icon128.png
├── analysis.md                # Full priority matrix (P0-P4)
├── README.md                  # This file
├── watcher.ps1                # Windows auto-updater
└── watcher.sh                 # Linux/Mac auto-updater
```

## Architecture

```
Popup ──executeScript({world:"MAIN"})──> Page (fill/clicks)
Popup ──tabs.sendMessage ──> Content Script (field scanning)
Content Script ──runtime.sendMessage ──> Background (auto-fill trigger)
Background ──executeScript({world:"MAIN"}) ──> Page (auto-fill, context menu, keyboard shortcuts)
```

- **No `inject.js`, no `web_accessible_resources`, no hidden div bridge.** Fill logic serializes functions and runs them directly in the page's MAIN world via `chrome.scripting.executeScript`. CSP-safe.
- Content script is isolated from page JS — only handles ping + getFormFields (recursive DOM scan).

## Development

```bash
# Bump version
#   manifest.json: "version": "1.X.X"
#   version.json:  {"version":"1.X.X"}
git add . && git commit -m "v1.X.X" && git push
```

### Reload
- `chrome://extensions` → Reload, or click **Reload** in the popup

### View logs
- Popup: Right-click popup → Inspect
- Background: `chrome://extensions` → Service Worker link
- Content script: Right-click page → Inspect → Console

## Permissions

| Permission | Reason |
|-----------|--------|
| `storage` | Profiles, auto-fill domains, learning data, theme, batch templates |
| `activeTab` | Access current tab's content |
| `scripting` | Execute fill logic in page context (`world: "MAIN"`) |
| `alarms` | Periodic GitHub update checks |
| `contextMenus` | Right-click → Fill all fields / Fill & Submit |

## Known Limitations

- **Closed Shadow DOM** (`mode: "closed"`) — `shadowRoot` is `null`, fields inside are invisible
- **Cross-origin iframes** — Blocked by browser security; only same-origin iframes scanned
- **React onChange** — Some React 18+ synthetic event handlers may not catch the native dispatch chain
- **Batch fill** — Creates and closes background tabs; some sites may detect this as automation

## License

MIT
