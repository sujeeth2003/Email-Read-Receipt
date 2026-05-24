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

