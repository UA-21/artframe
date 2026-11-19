/* ArtFrame TV display page.
 * Written in plain ES5 on purpose: webOS TVs ship old Chromium engines.
 * The slideshow runs locally; the server is only polled for changes and commands. */
(function () {
  'use strict';

  var FADE_MS = 2500;

  function parseQuery() {
    var out = {};
    var parts = window.location.search.replace(/^\?/, '').split('&');
    for (var i = 0; i < parts.length; i++) {
      var kv = parts[i].split('=');
      if (kv[0]) out[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
    }
    return out;
  }

  function store(key, value) {
    try {
      if (value === undefined) return window.localStorage.getItem(key);
      window.localStorage.setItem(key, value);
    } catch (e) { /* storage unavailable */ }
    return null;
  }

  var query = parseQuery();
  var device = query.device || store('artframe_device') || '';
  if (query.device) store('artframe_device', query.device);
  var debugOn = query.debug === '1';
  var pollMs = Math.max(2, parseInt(query.poll, 10) || 10) * 1000;

  var el = function (id) { return document.getElementById(id); };
  var slides = [el('s0'), el('s1')];
  var front = 1;            // index of the slide currently visible
  var items = [];           // playlist from the server
  var order = [];           // indexes into items, possibly shuffled
  var pos = -1;             // position in order
  var settings = {};
  var version = null;
  var lastCmdSeq = null;
  var paused = false;
  var off = false;
  var currentId = null;
  var timer = null;
  var shown = 0;            // number of images shown, used to alternate motion and caption side
  var lastPoll = 'never';
  var loading = false;

  function getJSON(url, cb, method) {
    var xhr = new XMLHttpRequest();
    xhr.open(method || 'GET', url, true);
    xhr.timeout = 15000;
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var data = null;
      try { data = JSON.parse(xhr.responseText); } catch (e) { /* not JSON */ }
      cb(xhr.status, data);
    };
    xhr.send();
  }

  function message(html) {
    var m = el('msg');
    m.innerHTML = html || '';
    m.style.display = html ? 'block' : 'none';
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function buildOrder() {
    order = [];
    for (var i = 0; i < items.length; i++) order.push(i);
    if (settings.shuffle) {
      for (var j = order.length - 1; j > 0; j--) {
        var k = Math.floor(Math.random() * (j + 1));
        var t = order[j]; order[j] = order[k]; order[k] = t;
      }
    }
  }

  function arm() {
    clearTimeout(timer);
    if (paused || off || items.length < 2) return;
    timer = setTimeout(function () { step(1); }, (settings.intervalSec || 120) * 1000);
  }

  function step(dir) {
    if (!items.length) return;
    show(pos + dir);
  }

  function show(index) {
    if (!items.length) return;
    pos = ((index % order.length) + order.length) % order.length;
    var item = items[order[pos]];
    var loader = new Image();
    loader.onload = function () { present(item); };
    loader.onerror = function () {
      // Skip images that fail to load; try the next one shortly.
      clearTimeout(timer);
      if (items.length > 1) timer = setTimeout(function () { step(1); }, 5000);
    };
    loader.src = item.url;
  }

  function present(item) {
    var back = slides[1 - front];
    var img = back.getElementsByTagName('img')[0];
    var mat = back.querySelector('.mat');
    var cap = back.querySelector('.caption');
    var fit = item.fit || settings.fit || 'contain';
    var matPx = Math.round((settings.matWidth || 0) / 100 * window.innerHeight);

    mat.style.padding = matPx + 'px';
    mat.style.background = matPx ? settings.matColor : '#000';
    img.className = fit === 'cover' ? 'cover' : '';
    img.src = item.url;

    // Restart the drift animation, alternating direction each image.
    var seconds = (settings.intervalSec || 120) + FADE_MS / 1000 * 2;
    var name = fit === 'cover' ? (shown % 2 ? 'zoom-out' : 'zoom-in') : (shown % 2 ? 'drift-out' : 'drift-in');
    var anim = settings.motion === false ? 'none' : name + ' ' + seconds + 's linear forwards';
    img.style.webkitAnimation = 'none';
    img.style.animation = 'none';
    void img.offsetWidth;
    img.style.webkitAnimation = anim;
    img.style.animation = anim;

    var lines = [];
    if (item.title) lines.push('<span class="t">' + escapeHtml(item.title) + '</span>');
    var by = [item.artist, item.date].filter(function (x) { return x; }).join(', ');
    if (by) lines.push(escapeHtml(by));
    if (settings.showCaption && lines.length) {
      cap.innerHTML = lines.join('<br>');
      // Alternate sides and nudge the height so the text never rests on the same pixels.
      cap.className = 'caption ' + (shown % 2 ? 'left' : 'right');
      cap.style.bottom = (matPx + window.innerHeight * (0.03 + 0.02 * (shown % 3))) + 'px';
      cap.style.display = 'block';
    } else {
      cap.style.display = 'none';
    }

    back.className = 'slide show';
    slides[front].className = 'slide';
    front = 1 - front;
    currentId = item.id;
    shown++;
    message('');
    arm();
  }

  function applyGlobal() {
    var b = settings.brightness === undefined ? 100 : settings.brightness;
    el('dim').style.opacity = String(1 - Math.max(20, Math.min(100, b)) / 100);
  }

  function loadPlaylist() {
    if (loading) return;
    loading = true;
    getJSON('/api/frame/playlist?device=' + encodeURIComponent(device), function (status, data) {
      loading = false;
      if (status === 401) return unpaired();
      if (status !== 200 || !data) return; // keep showing what we have
      items = data.items || [];
      settings = data.settings || {};
      version = data.version;
      applyGlobal();
      buildOrder();
      if (!items.length) {
        clearTimeout(timer);
        currentId = null;
        slides[0].className = 'slide';
        slides[1].className = 'slide';
        message('ArtFrame<br>Add artwork from the web interface');
        return;
      }
      // Stay on the current image if it is still in the playlist (re-shown to apply new settings).
      var keep = 0;
      for (var i = 0; i < order.length; i++) {
        if (items[order[i]].id === currentId) { keep = i; break; }
      }
      show(keep);
    });
  }

  // --- Pairing: a TV without a (valid) device token shows a short code to enter in Settings.
  var pairing = false;
  function unpaired() {
    if (pairing) return;
    pairing = true;
    device = '';
    store('artframe_device', '');
    clearTimeout(timer);
    items = [];
    currentId = null;
    slides[0].className = 'slide';
    slides[1].className = 'slide';
    message('ArtFrame<br>Connecting\u2026');
    getJSON('/api/frame/pair', function (status, data) {
      if (status !== 200 || !data) {
        pairing = false;
        message('ArtFrame<br>Cannot reach the server. Retrying\u2026');
        setTimeout(unpaired, 10000);
        return;
      }
      message('To connect this TV, open<br><span class="host">' + escapeHtml(window.location.host) +
        '</span><br>go to Settings \u2192 Connect a TV and enter<br><span class="code">' + escapeHtml(data.code) + '</span>');
      waitForApproval(data.id);
    }, 'POST');
  }

  function waitForApproval(id) {
    setTimeout(function () {
      getJSON('/api/frame/pair?id=' + encodeURIComponent(id), function (status, data) {
        if (status === 200 && data && data.state === 'approved') {
          device = data.device;
          store('artframe_device', device);
          pairing = false;
          version = null;
          lastCmdSeq = null;
          message('');
          loadPlaylist();
        } else if (status === 200 && data && data.state === 'expired') {
          pairing = false;
          unpaired(); // get a fresh code
        } else {
          waitForApproval(id);
        }
      });
    }, 3000);
  }

  function poll() {
    if (!device || pairing) return;
    var url = '/api/frame/state?device=' + encodeURIComponent(device) +
      (currentId ? '&current=' + encodeURIComponent(currentId) : '');
    getJSON(url, function (status, s) {
      lastPoll = status + ' at ' + new Date().toTimeString().slice(0, 8);
      if (status === 401) return unpaired();
      if (status !== 200 || !s) return; // offline: keep cycling the cached playlist

      if (s.off !== off) {
        off = s.off;
        el('off').className = off ? 'on' : '';
      }
      if (s.paused !== paused) {
        paused = s.paused;
      }
      arm_if_idle();

      if (lastCmdSeq === null) {
        lastCmdSeq = s.cmdSeq; // first poll: do not replay old commands
      } else if (s.cmdSeq !== lastCmdSeq) {
        lastCmdSeq = s.cmdSeq;
        step(s.cmdType === 'prev' ? -1 : 1);
      }
      if (version !== null && s.version !== version) loadPlaylist();
    });
  }

  var armedFor = '';
  function arm_if_idle() {
    // Re-arm the timer only when the paused/off state actually changed.
    var key = paused + '/' + off;
    if (key !== armedFor) { armedFor = key; arm(); }
  }

  function startDebug() {
    var frames = 0, fps = 0, last = Date.now();
    el('debug').style.display = 'block';
    (function tick() {
      frames++;
      var now = Date.now();
      if (now - last >= 1000) { fps = frames; frames = 0; last = now; render(); }
      (window.requestAnimationFrame || function (f) { setTimeout(f, 16); })(tick);
    })();
    function render() {
      el('debug').textContent =
        'ArtFrame debug\n' +
        'screen   ' + window.innerWidth + ' x ' + window.innerHeight + ' @' + (window.devicePixelRatio || 1) + 'x\n' +
        'fps      ' + fps + '\n' +
        'images   ' + items.length + '  version ' + version + '\n' +
        'state    ' + (off ? 'scheduled off' : paused ? 'paused' : 'playing') + '\n' +
        'poll     ' + lastPoll + '\n' +
        'awake    ' + wakeState + '   fullscreen ' + (isFullscreen() ? 'yes' : 'no (press OK)') + '\n' +
        'agent    ' + navigator.userAgent;
    }
  }

  // --- Keep the screen awake and allow full-screen (modern engines only; older TVs skip this).
  var wakeState = 'unsupported';
  var wakeLock = null;
  function keepAwake() {
    if (!navigator.wakeLock || !navigator.wakeLock.request || wakeLock) return;
    try {
      navigator.wakeLock.request('screen').then(function (lock) {
        wakeLock = lock;
        wakeState = 'held';
        lock.addEventListener('release', function () { wakeLock = null; wakeState = 'released'; });
      }, function (e) { wakeState = 'denied (' + (e && e.name) + ')'; });
    } catch (e) { wakeState = 'error'; }
  }
  function isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }
  function toggleFullscreen() {
    var root = document.documentElement;
    try {
      if (isFullscreen()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
    } catch (e) { /* not supported */ }
  }
  // OK / Enter on the remote (or a click) toggles full-screen and re-requests the wake lock.
  document.addEventListener('keydown', function (e) {
    if (e.keyCode === 13) { toggleFullscreen(); keepAwake(); }
  });
  document.addEventListener('click', function () { toggleFullscreen(); keepAwake(); });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') keepAwake();
  });
  keepAwake();

  if (debugOn) startDebug();
  if (device) loadPlaylist();
  else unpaired();
  setInterval(poll, pollMs);
  setTimeout(poll, 1500);
  window.addEventListener('resize', function () { if (items.length) show(pos); });
})();
