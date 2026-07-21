const ipInput = document.getElementById('ip');
const portInput = document.getElementById('port');
const enabledInput = document.getElementById('enabled');
const status = document.getElementById('status');

function buildServerUrl() {
  const ip = ipInput.value.trim();
  const port = portInput.value.trim() || '3939';
  if (!ip) return null;
  return `http://${ip}:${port}`;
}

chrome.storage.local.get(['ip', 'port', 'enabled'], (data) => {
  ipInput.value = data.ip || '';
  portInput.value = data.port || '3939';
  enabledInput.checked = !!data.enabled;
});

document.getElementById('save').addEventListener('click', () => {
  const ip = ipInput.value.trim();
  const port = portInput.value.trim() || '3939';
  const enabled = enabledInput.checked;
  const serverUrl = buildServerUrl();
  chrome.storage.local.set({ ip, port, enabled, serverUrl }, () => {
    status.textContent = 'Saved!';
    status.className = 'status ok';
    setTimeout(() => (status.textContent = ''), 1500);
  });
});

document.getElementById('test').addEventListener('click', async () => {
  const serverUrl = buildServerUrl();
  if (!serverUrl) {
    status.textContent = 'Enter an IP first';
    status.className = 'status err';
    return;
  }
  status.textContent = 'Testing...';
  status.className = 'status';
  try {
    const resp = await fetch(`${serverUrl}/api/opens`, { method: 'GET' });
    if (resp.ok) {
      status.textContent = '✅ Server reachable!';
      status.className = 'status ok';
    } else {
      status.textContent = `Server responded with ${resp.status}`;
      status.className = 'status err';
    }
  } catch (e) {
    status.textContent = '❌ Could not reach server (check IP/port, router forwarding, server running)';
    status.className = 'status err';
  }
});
