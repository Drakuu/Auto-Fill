async function getAllProfiles() {
  const host = getHostname(currentUrl);
  const key = getProfileKey(host);
  const res = await chrome.storage.sync.get([key]);
  let profiles = res[key];
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

function profileKey(f) { return f.name ? "n_" + f.name : f.id ? "id_" + f.id : "i" + f.index; }

async function saveProfile() {
  const host = getHostname(currentUrl);
  const key = getProfileKey(host);
  const name = document.getElementById("profileName").value.trim() || "Default";
  const profiles = await getAllProfiles();
  const p = {};
  fields.forEach(f => { p[profileKey(f)] = f.fillValue || ""; });
  profiles[name] = p;
  await chrome.storage.sync.set({ [key]: profiles });
  populateProfileSelect(profiles, name);
  showStatus("Saved \"" + name + "\"");
}

function profileMatch(p, f) {
  var key = f.name ? "n_" + f.name : f.id ? "id_" + f.id : null;
  if (key && p.hasOwnProperty(key)) return p[key];
  return p["i" + f.index];
}

async function loadProfile(name) {
  const host = getHostname(currentUrl);
  const key = getProfileKey(host);
  const profiles = await getAllProfiles();
  const p = profiles[name];
  if (!p) { showStatus("Profile not found", "error"); return; }
  fields.forEach(f => { var v = profileMatch(p, f); if (v !== undefined) f.fillValue = v; });
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
  fields.forEach(f => { var v = profileMatch(p, f); if (v !== undefined) f.fillValue = v; });
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
