// Injects a "📍 Track" toggle button into Gmail compose windows.
// When enabled for that compose, an invisible 1x1 pixel pointing at the
// local tracker server (via ngrok) is inserted into the message body
// right before it's sent.

const PROCESSED = new WeakSet();

function findComposeBodies() {
  // Gmail compose editable body
  return document.querySelectorAll('div[aria-label="Message Body"][contenteditable="true"]');
}

function getSubjectFromCompose(composeRoot) {
  const subjInput = composeRoot.querySelector('input[name="subjectbox"]');
  return subjInput ? subjInput.value : '(no subject)';
}

function getRecipientFromCompose(composeRoot) {
  const chips = composeRoot.querySelectorAll('.vN, [email]');
  for (const c of chips) {
    const email = c.getAttribute('email');
    if (email) return email;
  }
  return '';
}

function makeTrackButton(bodyEl) {
  const btn = document.createElement('div');
  btn.textContent = '📍 Track: OFF';
  btn.title = 'Toggle open-tracking for this email';
  btn.style.cssText = `
    display:inline-block; margin:6px 8px; padding:4px 10px; font-size:12px;
    border-radius:14px; background:#eee; color:#555; cursor:pointer;
    user-select:none; font-family:Arial,sans-serif; border:1px solid #ccc;
  `;
  let tracked = false;
  btn.addEventListener('click', () => {
    tracked = !tracked;
    btn.textContent = tracked ? '📍 Track: ON' : '📍 Track: OFF';
    btn.style.background = tracked ? '#d2f8d2' : '#eee';
    btn.style.color = tracked ? '#1a7a1a' : '#555';
    bodyEl.dataset.trackEnabled = tracked ? '1' : '0';
    if (tracked) {
      injectPixelIfNeeded(bodyEl);
    }
  });
  return btn;
}

processComposeWindows();