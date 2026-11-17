// End-to-end check: control UI (phone viewport) + TV frame page (1080p) against a real server.
// Usage: npm run build && npm run e2e   (optional: SHOTS=/some/dir to keep screenshots)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const PORT = 3111;
const BASE = `http://localhost:${PORT}`;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'artframe-e2e-'));
const shots = process.env.SHOTS || tmp;
fs.mkdirSync(shots, { recursive: true });

const server = spawn('npx', ['next', 'start', '-p', String(PORT)], {
  env: { ...process.env, ADMIN_PASSWORD: 'test-pass', ARTFRAME_DATA_DIR: path.join(tmp, 'data'), ARTFRAME_INSECURE_COOKIE: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: true,
});
let serverLog = '';
server.stdout.on('data', (d) => (serverLog += d));
server.stderr.on('data', (d) => (serverLog += d));

let passed = 0;
const ok = (cond, name) => {
  if (!cond) throw new Error('FAILED: ' + name);
  passed++;
  console.log('  ok  ' + name);
};

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(BASE + '/login')).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('server did not start\n' + serverLog);
}

const visibleSrc = (page) => page.evaluate(() => document.querySelector('.slide.show img')?.getAttribute('src') || null);

async function run() {
  await waitForServer();
  const browser = await chromium.launch();

  // Test artwork: three flat-colour "paintings" rendered by the browser itself.
  const maker = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const files = [];
  for (const [name, color] of [['Red study', '#8c2f2f'], ['Green study', '#2f6b45'], ['Blue study', '#2f4a8c']]) {
    await maker.setContent(`<body style="margin:0;background:${color};color:#fff;font:120px Georgia;display:flex;align-items:center;justify-content:center;height:100vh">${name}</body>`);
    const file = path.join(tmp, name.replace(' ', '_') + '.png');
    await maker.screenshot({ path: file });
    files.push(file);
  }
  await maker.close();

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const ui = await phone.newPage();

  // --- Login
  await ui.goto(BASE + '/');
  ok(ui.url().endsWith('/login'), 'unauthenticated visit redirects to login');
  ok((await ui.request.get(BASE + '/api/images')).status() === 401, 'API rejects unauthenticated requests');
  await ui.fill('#pw', 'wrong');
  await ui.click('button.primary');
  await ui.waitForSelector('.error');
  ok(true, 'wrong password is rejected');
  await ui.fill('#pw', 'test-pass');
  await ui.click('button.primary');
  await ui.waitForSelector('[data-testid=tv-status]');
  ok(true, 'correct password signs in');

  // --- Upload
  await ui.goto(BASE + '/library');
  await ui.setInputFiles('[data-testid=file]', files);
  await ui.waitForFunction(() => document.querySelectorAll('.tile').length === 3, null, { timeout: 30000 });
  ok(true, 'three images uploaded and listed');
  await ui.screenshot({ path: path.join(shots, 'library.png') });
  const images = await (await ui.request.get(BASE + '/api/images')).json();
  ok(images.every((i) => i.title.endsWith('study') && i.thumbUrl), 'titles derived from file names');

  // --- TV frame page
  await ui.goto(BASE + '/settings');
  const frameUrl = (await ui.textContent('[data-testid=frame-url]')).trim();
  await ui.screenshot({ path: path.join(shots, 'settings.png'), fullPage: true });
  const tvCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const tv = await tvCtx.newPage();
  const tvErrors = [];
  tv.on('pageerror', (e) => tvErrors.push(e.message));
  await tv.goto(frameUrl + '&poll=2');
  await tv.waitForSelector('.slide.show img');
  const first = await visibleSrc(tv);
  ok(first && first.includes('/art/'), 'frame shows an image');

  await ui.goto(BASE + '/');
  await ui.waitForFunction(() => document.querySelector('[data-testid=tv-status]')?.textContent.includes('TV connected'), null, { timeout: 15000 });
  await ui.waitForSelector('[data-testid=current]');
  ok(true, 'control UI sees the TV and what it shows');

  // --- Next command
  await ui.click('text=Next');
  await tv.waitForFunction((prev) => document.querySelector('.slide.show img')?.getAttribute('src') !== prev, first, { timeout: 12000 });
  const second = await visibleSrc(tv);
  ok(second !== first, 'Next changes the image on the TV');
  await ui.screenshot({ path: path.join(shots, 'now.png') });

  // --- Playlist
  const pl = await (await ui.request.post(BASE + '/api/playlists', { data: { name: 'Blue period' } })).json();
  const blue = images.find((i) => i.title === 'Blue study');
  await ui.request.post(`${BASE}/api/playlists/${pl.id}`, { data: { imageId: blue.id } });
  await ui.selectOption('#pl', pl.id);
  await tv.waitForFunction((want) => document.querySelector('.slide.show img')?.getAttribute('src').split('?')[0] === want, blue.url, { timeout: 12000 });
  ok(true, 'activating a playlist switches the TV to its images');

  // --- Framing: caption and mat
  await ui.request.patch(`${BASE}/api/images/${blue.id}`, { data: { artist: 'Test Painter', date: '1901' } });
  await ui.request.patch(BASE + '/api/settings', { data: { matWidth: 8, matColor: '#3a3833' } });
  await tv.waitForFunction(
    () => {
      const s = document.querySelector('.slide.show');
      return s && s.querySelector('.caption').textContent.includes('Test Painter') && parseInt(s.querySelector('.mat').style.padding, 10) === 86;
    },
    null,
    { timeout: 12000 },
  );
  ok(true, 'caption and mat are applied on the TV');
  await tv.waitForTimeout(3000);
  await tv.screenshot({ path: path.join(shots, 'frame.png') });

  // --- Schedule: an "on" window that excludes the current minute
  const now = new Date();
  const hh = (d) => String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0');
  await ui.request.patch(BASE + '/api/settings', {
    data: { scheduleEnabled: true, timezone: 'UTC', onTime: hh(new Date(+now + 2 * 3600e3)), offTime: hh(new Date(+now + 3 * 3600e3)) },
  });
  await tv.waitForSelector('#off.on', { timeout: 12000 });
  ok(true, 'schedule blacks out the screen outside set hours');
  await ui.request.patch(BASE + '/api/settings', { data: { scheduleEnabled: false } });
  await tv.waitForSelector('#off:not(.on)', { timeout: 12000 });
  ok(true, 'screen comes back when the schedule allows');

  // --- Delete and pairing
  await ui.request.delete(`${BASE}/api/playlists/${pl.id}`);
  for (const i of images) await ui.request.delete(`${BASE}/api/images/${i.id}`);
  await tv.waitForFunction(() => document.getElementById('msg').textContent.includes('Add artwork'), null, { timeout: 12000 });
  ok(true, 'empty library shows a hint on the TV');
  ok(fs.readdirSync(path.join(tmp, 'data', 'blobs', 'art')).length === 0, 'deleting images removes their files');

  const anon = await browser.newContext();
  ok((await anon.request.get(BASE + blue.url)).status() === 401, 'images are not readable without a session or device token');
  const stranger = await tvCtx.newPage();
  await stranger.goto(BASE + '/frame?device=wrong-token');
  await stranger.waitForFunction(() => document.getElementById('msg').textContent.includes('not paired'));
  ok((await stranger.request.get(BASE + '/api/frame/playlist?device=wrong-token')).status() === 401, 'wrong device token is refused');
  ok(tvErrors.length === 0, 'no script errors on the TV page' + (tvErrors.length ? ': ' + tvErrors.join('; ') : ''));

  await browser.close();
}

run()
  .then(() => console.log(`\n${passed} checks passed. Screenshots: ${shots}`))
  .catch((e) => {
    console.error('\n' + e.message + '\n--- server log ---\n' + serverLog.slice(-2000));
    process.exitCode = 1;
  })
  .finally(() => {
    try { process.kill(-server.pid); } catch {}
    setTimeout(() => process.exit(), 500);
  });
