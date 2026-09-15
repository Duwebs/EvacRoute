/* ==========================================================================
   EVACROUTE — js/alert.js
   Emergency danger-zone alerting, three parts:
     1. a loud, frantic government-style siren — a fast 400<->1200 Hz wail
        over the EAS-like 853 + 960 Hz two-tone bursts, synthesised with the
        Web Audio API (no audio file needed) plus a panic vibration pattern,
        repeated every 10 s while the user stays inside a danger zone;
     2. a full-screen DANGER POPUP naming the NEAREST safe zone, its distance
        and the heading to follow;
     3. a 10 s countdown that hands the user over to Google Maps walking
        directions from their position to that nearest safe zone.
   Also keeps the phone screen awake while the user is in danger.
   Includes an autoplay unlock so the sound works on mobile browsers that
   require a user gesture first.
   ========================================================================== */
'use strict';

const ALERT_TONE_HZ_A   = 853;     // EAS attention-signal frequencies (harsh pair)
const ALERT_TONE_HZ_B   = 960;
const ALERT_WAIL_LOW    = 400;     // fast wailing sweep, low end (Hz)
const ALERT_WAIL_HIGH   = 1200;    // fast wailing sweep, high end (Hz)
const ALERT_WAIL_RATE   = 2.1;     // sweeps per second — deliberately frantic
const ALERT_BURSTS      = 6;       // on/off bursts per siren call
const ALERT_BURST_ON    = 0.25;    // seconds of tone per burst
const ALERT_BURST_OFF   = 0.10;    // seconds of silence per burst
const ALERT_VOLUME      = 0.62;    // loud — a limiter stops it from clipping
const ALERT_REPEAT_MS   = 10000;   // re-siren every 10 s while still in danger
const ALERT_REDIRECT_MS = 10000;   // auto-open Google Maps 10 s after the popup
const ALERT_VIBRATE     = [300, 120, 300, 120, 300, 120, 600];

let _audioCtx = null;
let _unlockWired = false;

/** Create/resume the shared AudioContext (mobile browsers suspend it until
    the user interacts with the page at least once). */
function getAudioContext() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!_audioCtx) _audioCtx = new AC();
    if (_audioCtx.state === 'suspended') { try { _audioCtx.resume(); } catch (e) { /* ignore */ } }
    return _audioCtx;
  } catch (e) { return null; }
}

/** Warm the audio context on the first user gesture so alerts can play later
    (geolocation events are not user gestures, so browsers would block us). */
function wireAlertUnlock() {
  if (_unlockWired) return;
  _unlockWired = true;
  const unlock = function () {
    getAudioContext();
    if (_audioCtx && _audioCtx.state === 'running') {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('keydown', unlock);
    }
  };
  document.addEventListener('pointerdown', unlock, { passive: true });
  document.addEventListener('touchstart', unlock, { passive: true });
  document.addEventListener('keydown', unlock);
}

/** Loud, frantic emergency siren (~2.1 s): a fast wailing sweep layered under
    the harsh two-tone EAS bursts. A compressor/limiter chain keeps it as loud
    as a phone speaker will go without digital clipping. */
function playDangerAlert() {
  const ctx = getAudioContext();
  if (!ctx || ctx.state !== 'running') return;   // blocked until first gesture
  try {
    const t0 = ctx.currentTime + 0.04;
    const cycle = ALERT_BURST_ON + ALERT_BURST_OFF;
    const total = ALERT_BURSTS * cycle + 0.25;

    /* loudest-safe chain: master -> limiter -> speaker */
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.setValueAtTime(-8, t0);
    limiter.knee.setValueAtTime(6, t0);
    limiter.ratio.setValueAtTime(14, t0);
    limiter.attack.setValueAtTime(0.002, t0);
    limiter.release.setValueAtTime(0.2, t0);
    limiter.connect(ctx.destination);

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, t0);
    master.connect(limiter);

    /* 1. wailing sweep — sawtooth swept 400<->1200 Hz by a triangle LFO */
    const wail = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoDepth = ctx.createGain();
    const wailGain = ctx.createGain();
    wail.type = 'sawtooth';
    wail.frequency.setValueAtTime((ALERT_WAIL_LOW + ALERT_WAIL_HIGH) / 2, t0);
    lfo.type = 'triangle';
    lfo.frequency.setValueAtTime(ALERT_WAIL_RATE, t0);
    lfoDepth.gain.setValueAtTime((ALERT_WAIL_HIGH - ALERT_WAIL_LOW) / 2, t0);
    lfo.connect(lfoDepth);
    lfoDepth.connect(wail.frequency);
    wailGain.gain.value = 0.8;
    wail.connect(wailGain);
    wailGain.connect(master);

    /* 2. harsh EAS two-tone (853 + 960 Hz square waves) */
    const oscA = ctx.createOscillator();
    const oscB = ctx.createOscillator();
    const toneGain = ctx.createGain();
    oscA.type = 'square';
    oscB.type = 'square';
    oscA.frequency.setValueAtTime(ALERT_TONE_HZ_A, t0);
    oscB.frequency.setValueAtTime(ALERT_TONE_HZ_B, t0);
    toneGain.gain.value = 0.45;
    oscA.connect(toneGain);
    oscB.connect(toneGain);
    toneGain.connect(master);

    wail.start(t0); lfo.start(t0); oscA.start(t0); oscB.start(t0);
    wail.stop(t0 + total); lfo.stop(t0 + total);
    oscA.stop(t0 + total); oscB.stop(t0 + total);

    /* fast on/off burst envelope (rasping, impossible to ignore) */
    for (let i = 0; i < ALERT_BURSTS; i++) {
      const on = t0 + i * cycle;
      const off = on + ALERT_BURST_ON;
      master.gain.setValueAtTime(0.0001, on);
      master.gain.exponentialRampToValueAtTime(ALERT_VOLUME, on + 0.012);
      master.gain.setValueAtTime(ALERT_VOLUME, off - 0.015);
      master.gain.exponentialRampToValueAtTime(0.0001, off);
    }
  } catch (e) { /* audio is best-effort — never break the app over it */ }
}

/** Vibration is the fallback channel on phones with the sound muted. */
function vibrate(pattern) {
  if (!navigator.vibrate) return;
  try { navigator.vibrate(pattern); } catch (e) { /* ignore */ }
}

/** Called after every user re-evaluation (from js/user.js): on entering a
    danger zone it sounds the siren, opens the full-screen DANGER POPUP and
    arms the 10 s auto-redirect into Google Maps; while the user stays inside
    it keeps re-sirening every ALERT_REPEAT_MS. Also keeps the phone screen
    awake — a dimming/black screen is the last thing needed in a panic. */
function maybeDangerAlert() {
  if (RUN_SELFTEST) return;   // keep the self-test suite silent and popup-free
  updateDangerWakeLock();

  if (!state.inside.length) {
    if (state.dangerEpisode) endDangerEpisode();   // back to safety — full reset
    return;
  }

  const now = Date.now();
  const withinRepeatWindow = state.lastDangerAlert && (now - state.lastDangerAlert) <= ALERT_REPEAT_MS;

  if (!state.dangerEpisode) {
    state.dangerEpisode = true;
    showDangerPopup();          // warning + countdown to the Google Maps redirect
  }
  if (!withinRepeatWindow) {
    state.lastDangerAlert = now;
    playDangerAlert();
    vibrate(ALERT_VIBRATE);
  } else if (state.dangerPopupOpen) {
    syncDangerPopup();          // keep the target/direction live while visible
  }
}

/** Danger zone left: silence the alarm and disarm the whole alert episode. */
function endDangerEpisode() {
  state.dangerEpisode = false;
  state.lastDangerAlert = 0;
  state.dangerAutoRedirect = true;
  hideDangerPopup();
}

/* ---------------- keep the screen awake while in danger ----------------- */
let _wakeLock = null;
function updateDangerWakeLock() {
  try {
    if (!('wakeLock' in navigator)) return;   // unsupported — ignore silently
    if (state.inside.length && !_wakeLock) {
      navigator.wakeLock.request('screen').then(function (lock) {
        _wakeLock = lock;
        lock.addEventListener('release', function () { _wakeLock = null; });
      }).catch(function () { _wakeLock = null; });
    } else if (!state.inside.length && _wakeLock) {
      const lock = _wakeLock;
      _wakeLock = null;
      try { lock.release(); } catch (e) { /* already released */ }
    }
  } catch (e) { /* wake lock is best-effort — never break the app */ }
}

/* ==================== full-screen DANGER POPUP + redirect ================ */
let _countdownTimer = null;
let _redirectDeadline = 0;

/** Google Maps walking directions from the user to the NEAREST safe zone.
    js/user.js guarantees state.nearest is the closest safe zone. */
function dangerMapsUrl() {
  if (!state.user || !state.nearest || !state.nearest.zone || !state.nearest.zone.vertices.length) return null;
  return mapsDirectionsUrl([state.user.lat, state.user.lng], state.nearest.zone.vertices[0]);
}

/** Open the warning popup and start the ALERT_REDIRECT_MS countdown that
    hands the user over to Google Maps walking directions automatically. */
function showDangerPopup() {
  const modal = $('dangerModal');
  state.dangerAutoRedirect = true;
  syncDangerPopup();
  if (modal) modal.classList.add('open');
  state.dangerPopupOpen = !!modal;
  if (!state.dangerPopupOpen) return;
  _redirectDeadline = Date.now() + ALERT_REDIRECT_MS;
  stopDangerCountdown();
  _countdownTimer = setInterval(tickDangerCountdown, 250);
  tickDangerCountdown();
}

/** Refresh the popup texts — also called on every GPS update while it is open,
    so a switch to a closer safe zone is reflected immediately. */
function syncDangerPopup() {
  const target = state.nearest;
  const url = dangerMapsUrl();
  const msg = $('dangerMsg'), name = $('dangerTargetName'), meta = $('dangerTargetMeta');
  const dirText = $('dangerDirText'), arrow = $('dangerArrow'), maps = $('btnDangerMaps');

  if (msg) {
    msg.textContent = state.inside.length > 1
      ? 'You are inside ' + state.inside.length + ' danger zones. Evacuate immediately.'
      : 'You are inside a danger zone. Evacuate immediately.';
  }
  if (name) name.textContent = target ? target.zone.name : 'No safe zone defined';
  if (meta) {
    meta.textContent = target
      ? 'Nearest safe zone — ' + formatDistance(target.distance) + ' away · ' + directionText(target.bearing)
      : 'Move away from the danger area and call for help.';
  }
  if (dirText) dirText.textContent = target ? directionText(target.bearing) : 'Head away from the danger';
  if (arrow) arrow.style.transform = 'rotate(' + (target ? target.bearing.toFixed(1) : 0) + 'deg)';
  if (maps) {
    maps.disabled = !url;
    if (url) maps.setAttribute('data-url', url);
    else maps.removeAttribute('data-url');
  }
}

/** 1 s countdown text + the hand-off when it reaches zero. */
function tickDangerCountdown() {
  const el = $('dangerCountdown');
  if (!state.dangerAutoRedirect) {
    if (el) el.textContent = 'Automatic redirect stopped — tap the Google Maps button when you are ready.';
    return;
  }
  const left = Math.max(0, Math.ceil((_redirectDeadline - Date.now()) / 1000));
  if (el) el.textContent = 'Opening Google Maps in ' + left + ' s…';
  if (left <= 0) openDangerRoute();
}

/** Hand the user over to Google Maps. A new tab is preferred so EVACROUTE keeps
    tracking them, but automatic window.open() calls are often popup-blocked, so
    a same-tab navigation is the never-blocked fallback. */
function openDangerRoute() {
  stopDangerCountdown();
  const url = dangerMapsUrl();
  if (!url) return;
  let opened = null;
  try { opened = window.open(url, '_blank', 'noopener'); } catch (e) { opened = null; }
  if (!opened) { try { window.location.href = url; } catch (e) { /* ignore */ } }
}

function stopDangerCountdown() {
  if (_countdownTimer) { clearInterval(_countdownTimer); _countdownTimer = null; }
}

/** "Stay on this screen": keep the warning visible but stop the hand-off. */
function cancelDangerAutoRedirect() {
  state.dangerAutoRedirect = false;
  stopDangerCountdown();
  tickDangerCountdown();
}

function hideDangerPopup() {
  stopDangerCountdown();
  const modal = $('dangerModal');
  if (modal) modal.classList.remove('open');
  state.dangerPopupOpen = false;
}

wireAlertUnlock();
