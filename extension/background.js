// Handles creating new tracking IDs by calling the local server's /api/new
// (content script messages this because content scripts on mail.google.com
// may run under stricter CSP for direct fetches in some setups)

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'CREATE_TRACKING_PIXEL') {
    chrome.storage.local.get(['serverUrl', 'enabled'], async (data) => {
      if (!data.enabled || !data.serverUrl) {
        sendResponse({ ok: false, error: 'Tracking disabled or server URL not set' });
        return;
      }
      try {
        const resp = await fetch(`${data.serverUrl}/api/new`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label: msg.label, recipient: msg.recipient })
        });
        const json = await resp.json();
        sendResponse({ ok: true, pixelUrl: `${data.serverUrl}/pixel/${json.id}.png` });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    });
    return true; // keep channel open for async sendResponse
  }
});
