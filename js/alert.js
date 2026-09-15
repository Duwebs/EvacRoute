/* ==========================================================================
   EVACROUTE — js/alert.js
   Emergency danger-zone alert: a government-style attention siren
   (EAS-like two-tone: 853 Hz + 960 Hz square waves) synthesised with the
   Web Audio API — no audio file needed. Includes an autoplay unlock so the
   sound works on mobile browsers that require a user gesture first.
   ========================================================================== */
'use strict';

const ALERT_TONE_HZ_A = 853;    // EAS attention-signal frequencies
const ALERT_TONE_HZ_B = 960;
const ALERT_BURSTS     = 4;     // on/off bursts per alert
const ALERT_BURST_ON   = 0.42;  // seconds of tone per burst
const ALERT_BURST_OFF  = 0.22;  // seconds of silence per burst
const ALERT_REPEAT_MS  = 30000; // re-alert while the user stays inside a zone
const ALERT_VOLUME     = 0.25;

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

/** Play the emergency attention tone (about 2.5 s of 4 bursts). */
function playDangerAlert() {
  const ctx = getAudioContext();
  if (!ctx || ctx.state !== 'running') return;   // blocked until first gesture
  try {
    const t0 = ctx.currentTime + 0.05;
    const total = ALERT_BURSTS * (ALERT_BURST_ON + ALERT_BURST_OFF) + 0.3;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, t0);
    master.connect(ctx.destination);

    // two detuned square oscillators = harsh, attention-grabbing siren
    const oscA = ctx.createOscillator();
    const oscB = ctx.createOscillator();
    oscA.type = 'square';
    oscB.type = 'square';
    oscA.frequency.setValueAtTime(ALERT_TONE_HZ_A, t0);
    oscB.frequency.setValueAtTime(ALERT_TONE_HZ_B, t0);
    oscA.connect(master);
    oscB.connect(master);
    oscA.start(t0);
    oscB.start(t0);
    oscA.stop(t0 + total);
    oscB.stop(t0 + total);

    // schedule the burst envelope (on/off pattern)
    for (let i = 0; i < ALERT_BURSTS; i++) {
      const on = t0 + i * (ALERT_BURST_ON + ALERT_BURST_OFF);
      const off = on + ALERT_BURST_ON;
      master.gain.setValueAtTime(0.0001, on);
      master.gain.exponentialRampToValueAtTime(ALERT_VOLUME, on + 0.015);
      master.gain.setValueAtTime(ALERT_VOLUME, off - 0.02);
      master.gain.exponentialRampToValueAtTime(0.0001, off);
    }
  } catch (e) { /* audio is best-effort — never break the app over it */ }
}

/** Called after every user re-evaluation: sound the alert on entering a
    danger zone, and repeat every ALERT_REPEAT_MS while still inside. */
function maybeDangerAlert() {
  if (RUN_SELFTEST) return;   // keep the self-test suite silent
  if (!state.inside.length) {
    state.lastDangerAlert = 0;
    return;
  }
  const now = Date.now();
  if (!state.lastDangerAlert || now - state.lastDangerAlert > ALERT_REPEAT_MS) {
    state.lastDangerAlert = now;
    playDangerAlert();
    // vibration fallback + attention (also fires on browsers without audio)
    if (navigator.vibrate) { try { navigator.vibrate([200, 100, 200, 100, 400]); } catch (e) {} }
  }
}

wireAlertUnlock();
