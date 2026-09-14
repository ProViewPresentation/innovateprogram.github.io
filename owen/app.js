let dbUrl = localStorage.getItem("rc_dbUrl") || "https://innovateprogram-fd00c-default-rtdb.firebaseio.com";
let selectedDeviceId = null;
let selectedTabId = null;
let devicesPollTimer = null;
let tabsPollTimer = null;

const dbUrlInput = document.getElementById("dbUrl");
const deviceListEl = document.getElementById("deviceList");
const tabsPanel = document.getElementById("tabsPanel");
const tabListEl = document.getElementById("tabList");
const controlsPanel = document.getElementById("controlsPanel");
const toastEl = document.getElementById("toast");

dbUrlInput.value = dbUrl;

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 1800);
}

function cleanDbUrl(url) {
  return url.trim().replace(/\/$/, "");
}

dbUrlInput.addEventListener("change", () => {
  dbUrl = cleanDbUrl(dbUrlInput.value);
  localStorage.setItem("rc_dbUrl", dbUrl);
  restartDevicePolling();
});

async function fbGet(path) {
  if (!dbUrl) return null;
  const res = await fetch(`${dbUrl}/${path}.json`);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

async function fbPost(path, value) {
  const res = await fetch(`${dbUrl}/${path}.json`, {
    method: "POST",
    body: JSON.stringify(value),
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
  return res.json();
}

function timeAgo(ts) {
  if (!ts) return "never";
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

function isOnline(lastSeen) {
  return lastSeen && Date.now() - lastSeen < 30000; // seen in last 30s
}

async function loadDevices() {
  if (!dbUrl) {
    deviceListEl.innerHTML = `<p class="empty">Enter your Database URL above to load devices…</p>`;
    return;
  }
  try {
    const devices = await fbGet("devices");
    if (!devices) {
      deviceListEl.innerHTML = `<p class="empty">No devices registered yet. Install the extension on a browser to pair it.</p>`;
      return;
    }

    deviceListEl.innerHTML = "";
    for (const [deviceId, data] of Object.entries(devices)) {
      const info = data.info || {};
      const online = isOnline(info.lastSeen);
      const card = document.createElement("div");
      card.className = "device-card" + (deviceId === selectedDeviceId ? " selected" : "");
      card.innerHTML = `
        <div>
          <div class="device-name">${escapeHtml(info.name || deviceId)}</div>
          <div class="device-meta">${deviceId} · last seen ${timeAgo(info.lastSeen)}</div>
        </div>
        <span class="status-dot ${online ? "online" : "offline"}"></span>
      `;
      card.addEventListener("click", () => selectDevice(deviceId));
      deviceListEl.appendChild(card);
    }
  } catch (err) {
    deviceListEl.innerHTML = `<p class="empty">Couldn't reach Firebase. Check the Database URL and your security rules.</p>`;
    console.error(err);
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function selectDevice(deviceId) {
  selectedDeviceId = deviceId;
  selectedTabId = null;
  tabsPanel.style.display = "block";
  controlsPanel.style.display = "none";
  loadDevices();
  loadTabs();
  restartTabsPolling();
}

async function loadTabs() {
  if (!selectedDeviceId) return;
  try {
    const tabs = await fbGet(`devices/${selectedDeviceId}/tabs`);
    if (!tabs) {
      tabListEl.innerHTML = `<p class="empty">No open tabs reported yet.</p>`;
      return;
    }
    tabListEl.innerHTML = "";
    for (const [tabId, tab] of Object.entries(tabs)) {
      const item = document.createElement("div");
      item.className = "tab-item" + (String(tabId) === String(selectedTabId) ? " selected" : "");
      item.innerHTML = `
        ${tab.favIconUrl ? `<img src="${escapeHtml(tab.favIconUrl)}" onerror="this.style.display='none'" />` : `<div style="width:16px;height:16px;flex-shrink:0;"></div>`}
        <div class="tab-text">
          <div class="tab-title">${escapeHtml(tab.title || "(untitled)")}</div>
          <div class="tab-url">${escapeHtml(tab.url || "")}</div>
        </div>
        ${tab.active ? `<span class="active-pill">ACTIVE</span>` : ""}
      `;
      item.addEventListener("click", () => selectTab(tabId));
      tabListEl.appendChild(item);
    }
  } catch (err) {
    tabListEl.innerHTML = `<p class="empty">Couldn't load tabs.</p>`;
    console.error(err);
  }
}

function selectTab(tabId) {
  selectedTabId = tabId;
  controlsPanel.style.display = "block";
  loadTabs();
}

async function sendCommand(action) {
  if (!selectedDeviceId || !selectedTabId) return;
  try {
    await fbPost(`devices/${selectedDeviceId}/commands`, {
      action,
      tabId: Number(selectedTabId),
      ts: Date.now(),
    });
    showToast(`Sent: ${action}`);
    if (action === "close") {
      // Tab will disappear from the list shortly; clear selection
      selectedTabId = null;
      controlsPanel.style.display = "none";
      setTimeout(loadTabs, 1500);
    }
  } catch (err) {
    showToast("Failed to send command");
    console.error(err);
  }
}

document.getElementById("btnRefresh").addEventListener("click", () => sendCommand("refresh"));
document.getElementById("btnBack").addEventListener("click", () => sendCommand("back"));
document.getElementById("btnForward").addEventListener("click", () => sendCommand("forward"));
document.getElementById("btnClose").addEventListener("click", () => sendCommand("close"));

function restartDevicePolling() {
  if (devicesPollTimer) clearInterval(devicesPollTimer);
  loadDevices();
  devicesPollTimer = setInterval(loadDevices, 5000);
}

function restartTabsPolling() {
  if (tabsPollTimer) clearInterval(tabsPollTimer);
  loadTabs();
  tabsPollTimer = setInterval(loadTabs, 4000);
}

restartDevicePolling();
