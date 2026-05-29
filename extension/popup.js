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

