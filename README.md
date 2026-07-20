# Quick Fill — Chrome Extension

Scan any webpage for form fields and buttons, fill them with generated or imported data, and submit — all from a single popup. **29 features** built across 6 priority tiers. Manifest V3.

---

## Features at a Glance

### P0 — Core Reliability

| # | Feature | What |
|---|---------|------|
| 1 | **Validation detection** | Detects `aria-invalid`, `:invalid`, error elements 800ms after submit |
| 2 | **Password confirm sync** | Copies password to confirm/verify/retype fields automatically |
| 3 | **Dialog/modal fill** | Clicks Add/Create/Edit → waits for modal → fills → saves |
| 4 | **Value retention** | Custom values survive Refresh — `_valueCache` restores on re-scan |
| 5 | **File upload awareness** | File inputs shown with purple badge, safely skipped during auto-fill |

### P1 — Workflow

| # | Feature | What |
|---|---------|------|
| 6 | **Multi-step forms** | Finds Next/Continue → fills → proceeds up to 10 wizard steps |
| 7 | **Post-submit state** | Checks success/error/confirmation after submit, reports result |
| 8 | **Debug overlay** | Green/red/yellow field outlines + floating value labels on the page |
| 9 | **Right-click menu** | "Fill all fields" / "Fill & Submit" without opening the popup |
| 10 | **Undo fill** | Captures originals before fill, restores all fields in one click |

### P2 — Power User

| # | Feature | What |
|---|---------|------|
| 11 | **Rich text support** | Detects Quill, Slate, ProseMirror, TinyMCE, `[contenteditable]` |
| 12 | **Smart profiles** | Save/load by field `name` or `id` — survives page structure changes |
| 13 | **Keyboard shortcuts** | Ctrl+Shift+F (fill), Ctrl+Shift+S (fill & submit) |
| 14 | **Section grouping** | Fields grouped by `<fieldset>` legends, collapsible sections |
| 15 | **Conditional fields** | Re-scans up to 5× for dynamically appearing fields after fill |

### P3 — Intelligence

| # | Feature | What |
|---|---------|------|
| 16 | **Auto-learning** | Remembers typed values per domain, suggests them next visit (📌 badge) |
| 17 | **Export JSON** | Download all filled values as `domain-timestamp.json` |
| 18 | **OTP detection** | Scans for one-time code fields 1.5s after submit |
| 19 | **Auto-repair** | Re-checks fields 2s after fill — re-fills if JS cleared them (3 retries) |
| 20 | **Batch fill** | Save template → paste URLs → fill matching fields across tabs |

### P4 — Automation

| # | Feature | What |
|---|---------|------|
| 21 | **Custom generators** | Define regex→generator rules in settings panel — no code changes |
| 22 | **Import CSV/JSON** | Upload a file → values matched by field name/id/label → filled |
| 23 | **Field hover highlight** | Hover a card → page scrolls to that field with orange outline |
| 24 | **Macro recorder** | Record fill/click sequences with timing → save → replay |

### P5-P6 — Specialized

| # | Feature | What |
|---|---------|------|
| 25 | **Profile sync** | `chrome.storage.sync` keeps profiles across Chrome devices (☁️) |
| 26 | **Deterministic seed** | Same seed → same values every time (mulberry32 PRNG) |
| 27 | **Template marketplace** | Export/Import templates as `.json` files — share with anyone |
| 28 | **Workflow builder** | Drag-and-drop step reordering + wait/navigate/screenshot steps |
| 29 | **Per-field undo** | ↩ button on each filled card — revert one field at a time |

---

## Quick Start

```bash
git clone https://github.com/Drakuu/Auto-Fill.git
```

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load Unpacked** → select the `form-filler-extension` folder
4. Pin the extension in your toolbar

### Keyboard shortcuts
- `Ctrl+Shift+F` — Fill all fields
- `Ctrl+Shift+S` — Fill & submit
- Customize at `chrome://extensions/shortcuts`

---

## Architecture

```
Popup ──executeScript({world:"MAIN"})──> Page (fill/clicks)
Popup ──tabs.sendMessage ──> Content Script (field scanning)
Content Script ──runtime.sendMessage ──> Background (auto-fill trigger)
Background ──executeScript({world:"MAIN"}) ──> Page (auto-fill, shortcuts, context menu)
```

- **No inject.js, no web_accessible_resources.** Fill logic runs via `chrome.scripting.executeScript({ world: "MAIN" })` — CSP-safe.
- Content script is isolated from page JS — handles only `ping` + `getFormFields` (recursive DOM scan with Shadow DOM + same-origin iframe support).

---

## Project Structure

```
form-filler-extension/
├── manifest.json              # v1.2.0, MV3
├── version.json               # {"version":"1.2.0"}
├── background.js              # Service worker — updates, context menus, shortcuts
├── content.js                 # Content script — field/button scanning
├── popup.html                 # Popup UI — loads 7 scripts
├── popup-state.js             # State, sendMsg, execInMainWorld, learning, batch, macros
├── popup-generators.js        # 55+ generators, detection pipeline, customDetect, seed PRNG
├── popup-main-world.js        # All mainWorld* functions (injected into page)
├── popup-fill.js              # Fill orchestration, import, export, replay, repair, diff
├── popup-profiles.js          # Profile CRUD + export/import
├── popup-settings.js          # Custom generator rules settings panel
├── popup-ui.js                # UI rendering, event listeners, init
├── styles.css                 # Light/dark CSS custom properties
├── icons/                     # icon16.png, icon48.png, icon128.png
├── watcher.ps1                # Windows auto-updater
├── watcher.sh                 # Linux/Mac auto-updater
└── analysis.md                # Full priority matrix (all 29 features)
```

---

## Auto-Update (Team Use)

Polls GitHub every 2 minutes. Auto-pulls, auto-reloads.

### Windows
```powershell
.\watcher.ps1
```

### Linux / Mac
```bash
chmod +x watcher.sh && ./watcher.sh
```

### Manual
```bash
git pull origin main
```
Then click **Reload** in the popup footer.

---

## Permissions

| Permission | Why |
|-----------|-----|
| `storage` | Profiles, learning, templates, theme, custom rules |
| `activeTab` | Access the current page |
| `scripting` | Execute fill logic in page context (`world: "MAIN"`) |
| `alarms` | Periodic update checks |
| `contextMenus` | Right-click menu items |

---

## Known Limitations

| Limitation | Why |
|-----------|-----|
| Closed Shadow DOM | `shadowRoot` is `null` — fields inside are invisible |
| Cross-origin iframes | Blocked by browser security policy |
| React synthetic events | Some React 18+ handlers may miss the native dispatch chain |
| Batch fill automation | Some sites detect background tab automation |

---

## License

MIT
