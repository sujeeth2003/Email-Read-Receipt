# Mail Open Tracker

A self-hosted email open tracker for Gmail — see when someone opens an email
you sent, with desktop notifications, running entirely on your own machine.
No third-party service, no data leaving your control.

## How it works

1. A small Node.js server on your computer generates a unique, invisible
   1x1 tracking pixel for each email you choose to track, and logs + notifies
   you when that pixel is fetched (i.e. loaded by the recipient's mail client).
2. Since the recipient isn't on your local network, the pixel needs a
   publicly reachable URL. This is done via **port forwarding** on your
   router (or use a online DB) pointing at the local server.
3. A Brave/Chrome extension adds a **Track: ON/OFF** button inside Gmail's
   compose window. Turning it on embeds the invisible pixel into that
   specific email before you send it.

## Architecture

```
 ┌────────────────────┐        ┌──────────────────────┐
 │   Brave Extension   │        │   Local Node Server   │
 │  (content.js runs    │──────▶│  server.js            │
 │   inside Gmail tab)  │ fetch │  - generates unique id │
 │                      │ /api/ │  - serves 1x1 PNG      │
 │  Adds Track button;  │ new   │  - logs opens          │
 │  injects <img> tag   │       │  - fires notification  │
 │  into email body     │       │  - dashboard UI        │
 └────────────────────┘        └───────────┬──────────┘
                                             │ port forward
                                             ▼
                                   ┌───────────────────┐
                                   │  Your router       │
                                   │  external port →   │
                                   │  your PC's port     │
                                   └─────────┬─────────┘
                                             │ internet
                                             ▼
                                   ┌───────────────────┐
                                   │  Recipient opens    │
                                   │  the email; Gmail   │
                                   │  fetches the        │
                                   │  <img> pixel URL     │
                                   └───────────────────┘
```

## Where the pixel comes from

The image is a single, hardcoded 1x1 transparent PNG stored as base64 in
`server.js`. It never changes — what changes per email is the **URL**, which
includes a randomly generated ID:

```js
const id = crypto.randomBytes(8).toString('hex');
// -> e.g. "a3f9e21c88b7d401"
```

That ID becomes part of the pixel's URL:

```
http://<your-ip>:<port>/pixel/a3f9e21c88b7d401.png
```

The server keeps a small JSON database mapping each ID to metadata (subject,
recipient, timestamp, list of opens). When that specific URL is requested,
the server knows exactly which email it belongs to.

## Why it looks like a picture, not a link

The extension inserts a normal HTML `<img>` tag into the Gmail compose body:

```js
const img = document.createElement('img');
img.src = pixelUrl;
img.style.cssText = 'width:1px;height:1px;opacity:0;';
```

Any HTML renderer — Gmail included — automatically fetches whatever URL is
in an `<img src="...">` tag and displays it as an image, rather than showing
the raw URL as text. That's standard behavior for every image on the web.
We just make it 1 pixel wide/tall and fully transparent, so nothing visible
appears, while the network request (which is all we actually need) still
fires.

## Setup

### 1. Start the local server
```bash
cd server
npm install
node server.js
```
Runs at `http://localhost:3939` by default (override with `PORT=xxxx`).
Dashboard: `http://localhost:3939/dashboard`

### 2. Make it reachable from the internet
Either:
- **Port forward** in your router: external port → your PC's local IP on the
  same port the server is listening on, or
- **Tunnel** with `ngrok http 3939` for a temporary public URL without
  touching your router or URl of your online DB.

### 3. Load the extension
1. `brave://extensions` → enable Developer mode → **Load unpacked**
2. Select the `extension/` folder
3. Click the extension icon → enter your public IP + port (or ngrok URL) →
   **Test connection** → enable → Save

### 4. Track an email
Open Gmail, compose or reply, click **Track: ON**, write and send as normal.
Opens show up on the dashboard and trigger a desktop notification.

## Limitations & honesty section

- **Gmail proxies remote images through its own servers.** This means the
  IP address logged for an "open" is usually Google's proxy IP, not the
  recipient's real IP — for both you and them. IP logging is more useful
  for non-Gmail providers that fetch images directly.
- **Gmail (and some other clients) may prefetch/cache the image immediately
  after sending**, before anyone has read anything. The server includes a
  60-second grace period after sending during which opens are logged but
  not treated as "real" — this cuts down false positives but isn't perfect.
- **Clients that block remote images by default** (many desktop/corporate
  clients) will never trigger the pixel even if the recipient reads the
  email — this will falsely show as "not opened."
- **Multiple opens** (recipient re-reading, forwarding, viewing on another
  device) show up as multiple timestamps, not one.
- **Security note:** forwarding a port on your home router exposes it to
  the entire internet, not just your email recipients — anyone can hit it
  during the window it's open. The server only returns a static image and
  logs a line, so the practical risk is low, but only forward the port
  while you actually intend to track something, and close the rule when
  you're done.
- **Privacy/legal note:** tracking email opens without disclosure is
  restricted or requires consent in some jurisdictions (e.g. under GDPR in
  the EU). Check your local rules before using this on real recipients.

## License
MIT — do whatever you want with it, no warranty.
