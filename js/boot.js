/* ==========================================================================
   EVACROUTE — js/boot.js
   Boot sequence + error-guarded initialisation.
   ========================================================================== */
'use strict';

function boot() {
  loadZones();
  initMap();
  wireUI();
  renderAllZones();
  setMode(START_MODE);
  updatePanel();

  if (START_MODE === 'admin') {
    // with no zones stored yet, try a quiet fix so the admin starts near themselves
    if (!state.zones.length && 'geolocation' in navigator) {
      try {
        navigator.geolocation.getCurrentPosition(function (pos) {
          if (!state.user && state.map && !state.zones.length) {
            setUserLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, 'gps');
          }
        }, function () {}, { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 });
      } catch (e) { /* ignore */ }
    }
  } else {
    startUserFlow();
  }

  requestAnimationFrame(function () { syncControlOffset(); });
  setTimeout(function () { syncControlOffset(); if (state.map) state.map.invalidateSize(); }, 500);
}

function init() {
  try {
    boot();
  } catch (err) {
    hideBoot();
    const msg = err && err.message ? err.message : String(err);
    toast('EVACROUTE failed to start: ' + msg, 'err');
    const pre = document.createElement('pre');
    pre.id = 'boot-error';
    pre.textContent = 'BOOT ERROR: ' + (err && err.stack ? err.stack : msg);
    pre.hidden = true;
    document.body.appendChild(pre);
  }
  if (RUN_SELFTEST) scheduleSelfTest();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
