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

function findComposeBodyFor(sendBtn) {
  let node = sendBtn.parentElement;
  while (node && node !== document.body) {
    const body = node.querySelector('div[aria-label="Message Body"][contenteditable="true"]');
    if (body) return body;
    node = node.parentElement;
  }
  return null;
}

function getComposeContext(bodyEl) {
  // Best-effort container for reading subject/recipient; works whether or
  // not there's a dialog wrapper (reply boxes don't have one).
  return bodyEl.closest('[role="dialog"]') || bodyEl.parentElement.parentElement.parentElement || document;
}

function injectPixelIfNeeded(bodyEl) {
  if (bodyEl.dataset.trackEnabled !== '1') return;
  if (bodyEl.dataset.pixelInjected === '1') return; // avoid double-insert

  const composeRoot = getComposeContext(bodyEl);
  const label = getSubjectFromCompose(composeRoot);
  const recipient = getRecipientFromCompose(composeRoot);

  chrome.runtime.sendMessage(
    { type: 'CREATE_TRACKING_PIXEL', label, recipient },
    (resp) => {
      if (resp && resp.ok) {
        const img = document.createElement('img');
        img.src = resp.pixelUrl;
        img.width = 1;
        img.height = 1;
        img.style.cssText = 'width:1px;height:1px;border:0;display:block;opacity:0;';
        img.alt = '';
        bodyEl.appendChild(img);
        bodyEl.dataset.pixelInjected = '1';
        console.log('[MailTracker] pixel injected:', resp.pixelUrl);
      } else {
        console.warn('[MailTracker] failed to create pixel:', resp && resp.error);
      }
    }
  );
}

function hookSendButtons() {
  // Gmail send buttons have role="button" and data-tooltip starting with "Send"
  const sendButtons = document.querySelectorAll('div[role="button"][data-tooltip^="Send"]');
  sendButtons.forEach((btn) => {
    if (PROCESSED.has(btn)) return;
    PROCESSED.add(btn);
    btn.addEventListener('click', () => {
      const body = findComposeBodyFor(btn);
      if (body) injectPixelIfNeeded(body);
    }, true); // capture phase so pixel is inserted before Gmail reads the body
  });
}

function findSendButtonFor(bodyEl) {
  let node = bodyEl.parentElement;
  while (node && node !== document.body) {
    let btn = node.querySelector('div[role="button"][data-tooltip^="Send"]');
    if (!btn) {
      btn = Array.from(node.querySelectorAll('div[role="button"], [aria-label]'))
        .find(el => {
          const label = (el.getAttribute('aria-label') || el.textContent || '').trim().toLowerCase();
          return label === 'send' || label.startsWith('send ');
        });
    }
    if (btn) return btn;
    node = node.parentElement;
  }
  return null;
}

function processComposeWindows() {
  const bodies = findComposeBodies();
  console.log(`[MailTracker] found ${bodies.length} compose body element(s)`);

  bodies.forEach((bodyEl) => {
    if (PROCESSED.has(bodyEl)) return;

    const sendBtn = findSendButtonFor(bodyEl);
    if (!sendBtn) {
      console.log('[MailTracker] send button not found yet for this compose window');
      return; // send button not rendered yet, try again on next mutation
    }

    PROCESSED.add(bodyEl);

    // Insert our pill right before the send button's parent container, so it
    // sits in the same row without depending on any generated toolbar class.
    const anchor = sendBtn.parentElement || sendBtn;
    if (!anchor.parentElement.querySelector('.mailtracker-btn')) {
      const btn = makeTrackButton(bodyEl);
      btn.classList.add('mailtracker-btn');
      anchor.parentElement.insertBefore(btn, anchor);
    }
  });
  hookSendButtons();
}

// Gmail is a SPA; observe DOM mutations to catch new compose windows
const observer = new MutationObserver(() => processComposeWindows());
observer.observe(document.body, { childList: true, subtree: true });

processComposeWindows();