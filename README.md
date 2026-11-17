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

Sign in, open **Settings**, and copy the **TV link** (`https://…/frame?device=…`).

**Quick way (no install):** open the TV's Web Browser app and enter the TV link.

**As an app:**

1. On the TV, install the **Developer Mode** app from the LG Content Store, sign in with an LG developer account, and turn Dev Mode on.
2. On a computer, install the LG CLI: `npm install -g @webos-tools/cli`
3. Paste the TV link into `webos/config.js`.
4. Register the TV (`ares-setup-device`), then:

```bash
ares-package webos
```

```bash
ares-install com.artframe.tv_1.0.0_all.ipk
```

Developer Mode sessions expire; extend the session in the Developer Mode app on the TV, or the app is removed and has to be installed again.

Add `&debug=1` to the TV link to show screen size, frame rate and connection status on the TV.

## OLED care

Images drift slowly, captions change side and height between images, and the schedule blacks the screen outside set hours. A bright mat is a static border: keep it dark or off on OLED panels. LG's own screen saver may still appear over slow-moving content on some models.

## Notes

- Uploads are downscaled in the browser to at most 3840 px before upload.
- Museum works (Art Institute of Chicago, The Met; public domain only) are linked, not copied.
- Uploaded images are private (works with a Private Blob store): they are served only to the signed-in owner and to the TV holding the device token. The TV link grants view access, so keep it private.
