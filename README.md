# ArtFrame

Turn a TV into an art frame, controlled from your phone.

The TV shows a slow, full-screen slideshow of your own photos and public-domain museum art. You manage everything from a web page: upload images, build playlists, choose framing, and set the hours it runs. No extra hardware is needed; the TV only has to open a web page or a small app.

## Features

- **Your own images:** upload from a phone or laptop. Photos are downscaled in the browser (max 3840 px) before upload and stored privately.
- **Museum art:** search the Art Institute of Chicago and The Metropolitan Museum of Art (public-domain works only) and add them to your library.
- **Playlists:** group images, reorder them, and choose which playlist is playing.
- **Framing:** fit or fill per image, optional mat with a colour of your choice, title and artist caption.
- **Remote control:** previous / pause / next from the phone. Commands reach the TV within about 10 seconds.
- **Schedule:** show art only during set hours; outside them the screen goes black.
- **Screen care:** slow drift on every image, captions that change position, adjustable brightness.
- **Easy TV setup:** the TV shows a 6-character code that you enter on your phone. Nothing to type on the TV.

## How it works

```
Phone browser ──> Control site ─┐
                                ├─ Next.js app ──> Postgres (library, playlists, settings)
TV (browser or app) ─> /frame ──┘             └──> Blob storage (uploaded images, private)
```

- **Control site** (`app/`): the pages you use on your phone, plus the JSON API.
- **TV page** (`public/frame/`): a plain-JavaScript slideshow written for old TV browser engines. It runs the slideshow on its own and asks the server every 10 seconds whether anything changed, so it keeps cycling if the connection drops.
- **LG app** (`webos/`, prebuilt in `tv-app/`): a tiny wrapper that opens the TV page full-screen. All logic stays on the server, so updates never need a reinstall.

Museum images are linked from the museums' servers, not copied. Uploaded images are served only to the signed-in owner and to a connected TV.

## Deploy to Vercel

1. Fork or push this repository to GitHub and import it at vercel.com/new.
2. Add the environment variable `ADMIN_PASSWORD` (your sign-in password).
3. In the project's **Storage** tab, create a **Neon Postgres** database and a **Blob** store (Private is fine) and connect both to the project. They add their own variables.
4. Redeploy so the variables take effect.
5. Open `https://YOUR-SITE/api/health`. It should report the password, database and blob storage as configured, and `"database": "ok"`.

| Variable | Required | Purpose |
|---|---|---|
| `ADMIN_PASSWORD` | yes | Password for the control site |
| `DATABASE_URL` or `POSTGRES_URL` | yes | Set by the Neon integration |
| `BLOB_READ_WRITE_TOKEN` or `BLOB_STORE_ID` | yes | Set by the Blob store |
| `AUTH_SECRET` | no | Secret for signing login cookies (defaults to a hash of the password) |
| `MAX_STORAGE_MB` | no | Upload storage cap, default 900 |

**Changing the password:** edit `ADMIN_PASSWORD` in Vercel and redeploy. This signs out existing browser sessions; connected TVs are not affected. After five wrong attempts, sign-in is locked for five minutes.

## Connect a TV

### Any TV with a web browser

1. On the TV, open the web browser and go to `https://YOUR-SITE/frame`.
2. The TV shows a 6-character code. On your phone, sign in and enter it under **Settings → Connect a TV**.

The TV remembers the connection. Settings also shows a full **TV link** you can open instead of using a code.

This has been tried on an LG webOS TV and a Xiaomi Android TV. Samsung and other brands should work the same way but are untested.

### LG TVs: install the app

The browser on LG TVs keeps its toolbar on screen, so the app is the better choice there. A ready-built package is in `tv-app/`. It contains only the site address from `webos/config.js`.

1. On the TV, install the **Developer Mode** app from the LG Content Store and sign in with a free LG developer account (webostv.developer.lge.com). Turn **Dev Mode Status** on (the TV restarts), then turn **Key Server** on.
2. On a computer on the same network, with Node.js installed:

```bash
npm install -g @webos-tools/cli
```

3. Register the TV. Add a device (for example named `tv`) with the IP address shown in the Developer Mode app, port `9922`, user `prisoner`:

```bash
ares-setup-device
```

4. Fetch the TV's key. Enter the passphrase exactly as the TV shows it; it is case-sensitive:

```bash
ares-novacom --device tv --getkey
```

5. Install and start the app:

```bash
ares-install --device tv tv-app/com.artframe.tv_1.0.0_all.ipk
```

```bash
ares-launch --device tv com.artframe.tv
```

6. Enter the code the TV shows under **Settings → Connect a TV**.

Developer Mode sessions expire. Extend the session in the Developer Mode app now and then, or the app is removed and step 5 has to be repeated.

To point the app at a different site, edit `webos/config.js` and rebuild:

```bash
ares-package webos -o tv-app
```

### Android TV / Google TV

The built-in browser shows a toolbar. For a full-screen frame that starts with the TV, install a kiosk browser from the Play Store (for example Fully Kiosk Browser), set its start URL to `https://YOUR-SITE/frame`, and enable full-screen, keep-screen-on and start-on-boot.

### On the TV remote

| Key | Action |
|---|---|
| OK | Toggle full-screen (where the browser allows it) |
| Red button (or `D` on a keyboard) | Show or hide diagnostics |

Adding `?debug=1` to the frame address shows the diagnostics from the start: screen size, frame rate, connection status and whether the screen is being kept awake.

## Screen saver and burn-in

The TV page keeps the TV's screen saver away in three ways, using whichever the TV supports: a screen wake lock, a tiny silent looping video, and (in the LG app) a direct request to the TV. All three stand down outside scheduled hours.

With the screen saver held off, the slow drift and the image interval are the only burn-in protection. On OLED panels keep the interval to a few minutes, keep the mat dark or off, and use the schedule so the screen is black overnight.

## Troubleshooting

| Problem | Likely cause |
|---|---|
| Sign-in says "ADMIN_PASSWORD is not configured" | The variable is missing, or the project was not redeployed after adding it |
| Server errors on every page | No database connected; check `/api/health` |
| Upload fails | No Blob store connected, or storage cap reached (see Settings → Storage) |
| TV shows "Add artwork from the web interface" | The library or the active playlist is empty |
| `ares-novacom`: "Failed to get ssh private key" | Key Server is off (it turns off when the TV restarts), or the computer and TV are on different networks |
| `ares-install`: "Malformed OpenSSH private key. Bad passphrase?" | Passphrase typed in the wrong case; run the `--getkey` step again |
| `ares-install`: "The specified path does not exist" | Give the full path to the `.ipk` file |

## Run locally

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:3000 and sign in with the password `artframe` (development default). Local data lives in `.data/` (an embedded Postgres database and uploaded files), so no cloud accounts are needed.

Unit tests:

```bash
npm test
```

End-to-end test (drives the control site and a TV page in a headless browser; needs Playwright with Chromium):

```bash
npm run build && npm run e2e
```

## Project layout

```
app/              control site pages and API routes
components/       shared UI
lib/              database, storage, auth, settings and schedule logic, museum sources, TV pairing
public/frame/     TV display page (plain JavaScript)
webos/            LG app source
tv-app/           prebuilt LG app package
tests/            unit tests and the end-to-end script
```

## Limitations

- The TV needs an internet connection; images are stored in the cloud.
- The app cannot turn the TV on or off. The schedule only blacks the screen.
- One sign-in password, one library: there are no separate user accounts.
- The "Now showing" page tracks a single TV, even if several are connected.
