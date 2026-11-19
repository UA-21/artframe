# ArtFrame

Turn an LG webOS TV into an art frame, controlled from a phone or laptop browser.

- **Control UI** (Next.js): upload photos, build playlists, search museum collections, set framing, schedule and brightness.
- **TV page** (`/frame`): a plain-JavaScript slideshow that runs in the TV's browser engine and polls the server for changes.
- **webOS wrapper** (`webos/`): a tiny TV app that opens the TV page full-screen.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000 and sign in with the password `artframe` (development default).
Local data lives in `.data/` (embedded Postgres + uploaded files); no cloud accounts are needed.

Tests:

```bash
npm test
```

```bash
npm run build && npm run e2e
```

## Deploy to Vercel

1. Push this repository to GitHub and import it as a Vercel project.
2. In the project's **Storage** tab, add a **Neon Postgres** database and a **Blob** store (Private is fine). They set the connection variables automatically.
3. Add the environment variable `ADMIN_PASSWORD` (see `.env.example` for the optional ones).
4. Deploy, sign in, and upload some images.

## Put it on the TV

**Quick way (no install):** open the TV's web browser and go to `https://YOUR-SITE/frame`. The TV shows a 6-character code; sign in on your phone, open **Settings → Connect a TV**, and enter it. (Settings also shows a full TV link you can open instead of using a code.)

**LG app (full-screen, with a home-screen icon):** a ready-built package is in `tv-app/`. It only contains the site address from `webos/config.js`; the TV pairs with a code the first time it starts.

1. On the TV, install the **Developer Mode** app from the LG Content Store, sign in with an LG developer account (free, from webostv.developer.lge.com), turn **Dev Mode Status** on (the TV restarts), then turn **Key Server** on.
2. On a computer on the same network, install the LG CLI:

```bash
npm install -g @webos-tools/cli
```

3. Register the TV (use the IP address and passphrase shown in the Developer Mode app; port 9922, user `prisoner`):

```bash
ares-setup-device
```

```bash
ares-novacom --device tv --getkey
```

4. Install and start the app:

```bash
ares-install --device tv tv-app/com.artframe.tv_1.0.0_all.ipk
```

```bash
ares-launch --device tv com.artframe.tv
```

To point the app at a different site, edit `webos/config.js` and rebuild with `ares-package webos -o tv-app`.

Developer Mode sessions expire; extend the session in the Developer Mode app on the TV, or the app is removed and has to be installed again.

Add `?debug=1` to the frame address to show screen size, frame rate and connection status on the TV. On TVs whose browser supports it, pressing OK toggles full-screen.

## OLED care

Images drift slowly, captions change side and height between images, and the schedule blacks the screen outside set hours. A bright mat is a static border: keep it dark or off on OLED panels. LG's own screen saver may still appear over slow-moving content on some models.

## Notes

- Uploads are downscaled in the browser to at most 3840 px before upload.
- Museum works (Art Institute of Chicago, The Met; public domain only) are linked, not copied.
- Uploaded images are private (works with a Private Blob store): they are served only to the signed-in owner and to the TV holding the device token. The TV link grants view access, so keep it private.
