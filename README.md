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

