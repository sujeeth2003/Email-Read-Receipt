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

