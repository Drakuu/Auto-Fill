# Quick Fill

Chrome extension that scans any webpage for form fields and buttons, lets you fill them with custom values or auto-generated random data, and submit the form — all from a popup.

## Features

- Scan any page for `<input>`, `<textarea>`, `<select>`, `<button>` elements
- Fill fields with custom values or auto-generated random data
- Smart field detection: autocomplete, HTML type, label text, name, placeholder
- Custom dropdown detection (React Select, shadcn/ui combobox, etc.) with hidden `<select>` sync
- Named profiles per domain — save/load/delete/export/import
- Auto-fill on page load for whitelisted domains
- Dark/light mode
- Field constraints respected (maxLength, min, max, step)
- Shadow DOM and same-origin iframe support
- 55+ intelligent generators (name, email, phone, address, company, etc.)
- Chained/cascading select support with 500ms sequencing

## Installation

### From source (for development / team use)

1. Clone the repo:
   ```bash
   git clone https://github.com/Drakuu/Auto-Fill.git
   ```
2. Open Chrome → `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load Unpacked** → select the cloned folder
5. Pin the extension in your toolbar

### From Chrome Web Store

<!-- Add link after publishing -->

## Auto-Update (Team Use)

After the initial clone, run the watcher script once. It stays in the background and auto-updates the extension whenever the developer pushes to GitHub.

### Windows

```powershell
# Double-click watcher.ps1, or run in terminal:
.\watcher.ps1
```

To make it start on every boot:
1. Press `Win + R`, type `shell:startup`, press Enter
2. Right-click → New → Shortcut
3. For location, enter: `powershell.exe -File "C:\path\to\watcher.ps1"`
4. Click Finish

### Linux / Mac

```bash
chmod +x watcher.sh
./watcher.sh
```

To make it start on every boot (crontab):
```bash
crontab -e
# Add this line:
@reboot cd /home/user/path/to/Auto-Fill && ./watcher.sh
```

### How it works

1. **Watcher script** polls GitHub every 2 minutes for new version
2. When new version detected → runs `git pull` → writes timestamp to `version.json`
3. **Background service worker** polls every 5 minutes, detects the timestamp
4. Calls `chrome.runtime.reload()` → extension updates instantly

No manual `git pull`, no clicking Reload — fully automatic.

### Without watcher (manual)

If you prefer not to run a background script, just run:
```bash
cd /path/to/Auto-Fill && git pull
```
Then click **Reload** button in the extension popup.

## Usage

1. Click the Quick Fill icon in the toolbar
2. The popup scans the current page and lists all fields and buttons
3. Fill individual fields by typing a value and clicking **Fill**
4. Click **Fill All** to auto-generate random values for every field
5. Click **Fill & Submit** to fill all fields and click the submit button
6. Use the **Buttons** tab to click individual buttons
7. Save field values as a named profile for the current domain

## Project Structure

```
form-filler-extension/
├── manifest.json           # Extension configuration (Manifest V3)
├── version.json            # Version for update checking
├── background.js           # Service worker — update checker + auto-fill
├── popup.html              # Popup UI
├── popup.js                # Popup logic — form detection, fill, profiles
├── content.js              # Injected into pages — field scanning
├── styles.css              # Popup styling (light/dark)
├── watcher.ps1             # Windows auto-updater
├── watcher.sh              # Linux/Mac auto-updater
├── update.ps1              # Manual git pull script (Windows)
├── plan.md                 # Development roadmap
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Development

### Making changes

```bash
# 1. Make your changes
# 2. Update version in manifest.json and version.json
# 3. Commit and push
git add .
git commit -m "v1.0.x"
git push
```

The next time the watcher script runs on team members' machines, they'll get the update automatically.

### Testing

1. Go to `chrome://extensions`
2. Click **Reload** on the extension card
3. Navigate to a page with a form
4. Click the Quick Fill icon
5. Check the console for logs (Right-click popup → Inspect)

## Permissions

| Permission | Reason |
|-----------|--------|
| `storage` | Save profiles, auto-fill domains, theme preference |
| `activeTab` | Access the current tab's content |
| `scripting` | Execute fill scripts in the page context (`world: "MAIN"`) |
| `alarms` | Periodic update checks |
| `host_permissions` | Access GitHub for version checking |

## Publishing to Chrome Web Store

1. Update version in `manifest.json` and `version.json`
2. Zip the folder (all files at root level)
3. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
4. Pay the one-time $5 registration fee
5. Upload the ZIP and fill in the details

## Notes

- Some pages (React, Vue, Angular) may not detect synthetic events. The extension runs fill logic in the **main world** via `chrome.scripting.executeScript({ world: "MAIN" })` and dispatches native + React event chains (`mousedown`, `mouseup`, `click`, `input`, `change`, `blur`, `pointerdown`, `pointerup`) plus direct React `onClick` invocation.
- Custom dropdown components are detected via ARIA attributes (`role="combobox"`, `aria-haspopup="listbox"`) and synced with hidden `<select>` elements when found.
- Field constraints (`maxLength`, `min`, `max`, `step`) are enforced on all generated values.
