/* ==========================================================================
   EVACROUTE — js/user.js
   User flow: GPS acquisition + live tracking, danger evaluation,
   status panel rendering and the GPS-fallback modal.
   ========================================================================== */
'use strict';

/* ======================== 7. USER FLOW ================================== */
function showBootOverlay() {
  const boot = $('boot');
  if (boot) boot.classList.remove('hidden');
}

function hideBoot() {
  const boot = $('boot');
  state.bootHidden = true;
  if (!boot) return;
  boot.classList.add('hidden');
  setTimeout(function () { if (state.map) state.map.invalidateSize(); }, 460);
}

function setBootMsg(msg, sub) {
  const a = $('bootMsg'), b = $('bootSub2');
  if (a && msg) a.textContent = msg;
  if (b && sub) b.textContent = sub;
}

/** Closest safe zone to a [lat,lng] point, with distance + bearing. */
function findNearestSafe(point) {
  let best = null;
  state.zones.forEach(function (z) {
    if (z.kind !== 'safe' || !z.vertices.length) return;
    const target = z.vertices[0];
    const distance = haversineMeters(point, target);
    if (!best || distance < best.distance) {
      best = { zone: z, distance: distance, bearing: bearingDegrees(point, target) };
    }
  });
  return best;
}

/** Core decision logic: which zones contain the user, and where to evacuate. */
function evaluateUser(moveMap) {
  if (!state.user) { updatePanel(); return; }
  const p = [state.user.lat, state.user.lng];

  state.inside = state.zones.filter(function (z) {
    return z.kind === 'danger' && isPointInPolygon(p, z.vertices);
  });
  state.nearest = findNearestSafe(p);

  // government-style siren when the user is inside a danger zone
  maybeDangerAlert();

  applyZoneStyles();
  if (state.inside.length && state.nearest) drawRoute(p, state.nearest.zone.vertices[0]);
  else clearRoute();

  updatePanel();
  renderAdminList();
  focusIfNeeded(moveMap);
}

/** Frame the user together with the relevant zones (only when that changes). */
function focusIfNeeded(moveMap) {
  if (!state.map) return;
  const key = (state.inside.length ? state.inside.map(function (z) { return z.id; }).sort().join(',') : 'safe') +
    '|' + (state.nearest ? state.nearest.zone.id : 'none');
  if (!moveMap || key === state.lastFitKey) return;
  state.lastFitKey = key;

  const pts = [[state.user.lat, state.user.lng]];
  if (state.nearest) pts.push(state.nearest.zone.vertices[0]);
  state.inside.forEach(function (z) { z.vertices.forEach(function (v) { pts.push(v); }); });

  if (pts.length > 1) {
    state.map.fitBounds(L.latLngBounds(pts), {
      paddingTopLeft: [40, 160], paddingBottomRight: [40, 170], maxZoom: 16, animate: true
    });
  } else {
    state.map.setView(pts[0], Math.max(state.map.getZoom(), 14), { animate: true });
  }
}

/* ---------------------- Google Maps deep links -------------------------- */
function mapsDirectionsUrl(from, to) {
  return 'https://www.google.com/maps/dir/?api=1' +
    '&origin=' + from[0].toFixed(6) + ',' + from[1].toFixed(6) +
    '&destination=' + to[0].toFixed(6) + ',' + to[1].toFixed(6) +
    '&travelmode=walking&dir_action=navigate';
}
function mapsSearchUrl(p) {
  return 'https://www.google.com/maps/search/?api=1&query=' + p[0].toFixed(6) + ',' + p[1].toFixed(6);
}
/* --------------------------- status panel ------------------------------- */
function updatePanel() {
  const badge = $('statusBadge'), line = $('statusLine'), summary = $('routeSummary');
  const dirText = $('dirText'), dirDeg = $('dirDeg'), arrow = $('dirArrow'), coords = $('coordsLine');
  if (!badge || !line) return;

  const hasUser = !!state.user;
  const inDanger = state.inside.length > 0;
  const safeCount = state.zones.filter(function (z) { return z.kind === 'safe'; }).length;
  const dangerCount = state.zones.filter(function (z) { return z.kind === 'danger'; }).length;

  badge.className = 'badge';
  line.className = '';
  if (arrow) arrow.classList.remove('danger');

  if (!hasUser) {
    badge.classList.add('badge-neutral');
    badge.textContent = 'LOCATING';
    line.textContent = 'Detecting your location…';
  } else if (inDanger) {
    badge.classList.add('badge-danger');
    badge.textContent = 'DANGER';
    line.classList.add('danger');
    line.textContent = '⚠️ YOU ARE IN A DANGER ZONE';
    if (arrow) arrow.classList.add('danger');
  } else {
    badge.classList.add('badge-safe');
    badge.textContent = 'SAFE';
    line.classList.add('safe');
    line.textContent = '✅ YOU ARE IN A SAFE AREA';
  }

  let text;
  if (!hasUser) text = 'Waiting for your location…';
  else if (!state.zones.length) text = 'No zones configured yet — open the Admin panel to mark danger and safe zones.';
  else if (state.nearest) text = 'Nearest safe zone: <b>' + escapeHtml(state.nearest.zone.name) + '</b> — ' + formatDistance(state.nearest.distance) + ' away';
  else if (inDanger) text = '⚠️ No safe zones defined — move away from the danger area and call for help.';
  else text = 'No safe zones defined yet — ask your admin to add one.';
  summary.innerHTML = text;

  if (state.nearest) {
    dirText.textContent = directionText(state.nearest.bearing);
    dirDeg.textContent = Math.round(state.nearest.bearing) + '° true north';
    arrow.style.transform = 'rotate(' + state.nearest.bearing.toFixed(1) + 'deg)';
  } else {
    dirText.textContent = '—';
    dirDeg.textContent = '';
    arrow.style.transform = 'rotate(0deg)';
  }

  const source = !state.user ? '' :
    state.user.source === 'gps' ? 'GPS' :
    state.user.source === 'manual' ? 'manual entry' :
    state.user.source === 'url' ? 'URL parameters' :
    state.user.source === 'demo' ? 'demo point' : 'position';
  coords.textContent = (hasUser
    ? state.user.lat.toFixed(5) + ', ' + state.user.lng.toFixed(5) +
      (state.user.accuracy ? ' · ±' + Math.round(state.user.accuracy) + ' m' : '') + ' · ' + source
    : 'No position yet') + ' · ' + dangerCount + ' danger / ' + safeCount + ' safe zones';

  const mapsBtn = $('btnMaps');
  if (mapsBtn) {
    if (inDanger && state.nearest) {
      mapsBtn.hidden = false;
      mapsBtn.textContent = '🧭 Open route in Google Maps';
      mapsBtn.setAttribute('href', mapsDirectionsUrl([state.user.lat, state.user.lng], state.nearest.zone.vertices[0]));
    } else if (inDanger) {
      mapsBtn.hidden = false;
      mapsBtn.textContent = '📍 Open my location in Google Maps';
      mapsBtn.setAttribute('href', mapsSearchUrl([state.user.lat, state.user.lng]));
    } else {
      mapsBtn.hidden = true;
      mapsBtn.setAttribute('href', '#');
    }
  }
  syncControlOffset();
}
/* ------------------------- location acquisition -------------------------- */
function setUserLocation(lat, lng, accuracy, source) {
  state.user = { lat: lat, lng: lng, accuracy: accuracy || null, source: source || 'position' };
  updateUserMarker();
  hideBoot();
  evaluateUser(true);
  state.lastEval = Date.now();
}

function startUserFlow() {
  if (HAS_PARAM_LOC) {
    setUserLocation(PARAM_LAT, PARAM_LNG, null, 'url');
    updatePanel();
    return;
  }
  if (!('geolocation' in navigator)) {
    showGeoModal('This browser does not support geolocation. Enter coordinates manually or use the demo location.');
    hideBoot();
    return;
  }
  requestGps();
}

function requestGps(fromButton) {
  const btn = $('btnLocate');
  if (btn) { btn.disabled = true; btn.textContent = '📡 Locating…'; }
  setBootMsg('Detecting your location…', 'Please allow location access');
  if (!state.user) showBootOverlay();
  state.locating = true;
  try {
    navigator.geolocation.getCurrentPosition(onGeoOk, onGeoErr, {
      enableHighAccuracy: true, timeout: 12000, maximumAge: 0
    });
  } catch (e) {
    onGeoErr({ code: 0, message: e && e.message ? e.message : 'geolocation threw' });
  }
  if (fromButton) toast('Requesting a fresh GPS fix…');
}

function restoreLocateButton() {
  const btn = $('btnLocate');
  if (btn) { btn.disabled = false; btn.textContent = '📍 Locate me again'; }
}

function onGeoOk(pos) {
  state.locating = false;
  restoreLocateButton();
  hideGeoModal();
  const hadFix = !!state.user;
  setUserLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, 'gps');
  startWatch();
  if (hadFix) toast('Location updated ✓', 'ok');
}

function onGeoErr(err) {
  state.locating = false;
  restoreLocateButton();
  hideBoot();
  let msg = 'Could not get your location.';
  if (window.isSecureContext === false) {
    msg = 'Geolocation only works on https:// or localhost. This page is not a secure origin, so GPS is blocked — enter coordinates below or use the demo location.';
  } else if (err && err.code === 1) {
    msg = 'Location permission denied. Allow access in your browser settings, or enter coordinates below.';
  } else if (err && err.code === 2) {
    msg = 'Your position is unavailable right now (no GPS or network fix).';
  } else if (err && err.code === 3) {
    msg = 'The location request timed out. Move somewhere with a clearer signal and try again.';
  }
  showGeoModal(msg);
}

/** Live tracking so the guidance stays current while the user moves. */
function startWatch() {
  stopWatch();
  if (!('geolocation' in navigator)) return;
  try {
    state.watchId = navigator.geolocation.watchPosition(onWatch, function () {}, {
      enableHighAccuracy: true, timeout: 20000, maximumAge: 5000
    });
  } catch (e) { state.watchId = null; }
}

function stopWatch() {
  if (state.watchId !== null && 'geolocation' in navigator) {
    try { navigator.geolocation.clearWatch(state.watchId); } catch (e) {}
  }
  state.watchId = null;
}

function onWatch(pos) {
  if (!pos || !pos.coords) return;
  const lat = pos.coords.latitude, lng = pos.coords.longitude;
  const moved = state.user ? haversineMeters([state.user.lat, state.user.lng], [lat, lng]) : Infinity;
  const wasInside = state.inside.length > 0;
  state.user = { lat: lat, lng: lng, accuracy: pos.coords.accuracy, source: 'gps' };
  updateUserMarker();

  const now = Date.now();
  if (moved > 20 || now - state.lastEval > 3000) {
    state.lastEval = now;
    evaluateUser(moved > 60);
    const isInside = state.inside.length > 0;
    if (isInside !== wasInside) {
      toast(isInside ? '⚠️ You just entered a danger zone.' : '✅ You have left the danger zone.', isInside ? 'err' : 'ok');
      if (isInside && navigator.vibrate) { try { navigator.vibrate([120, 60, 120]); } catch (e) {} }
    }
  }
}

/* ---------------------------- fallback modal ---------------------------- */
function showGeoModal(msg) {
  const m = $('geoModalMsg');
  if (m && msg) m.textContent = msg;
  const modal = $('geoModal');
  if (modal) modal.classList.add('open');
  const lat = $('manualLat');
  if (lat && window.innerWidth > 640) setTimeout(function () { lat.focus(); }, 220);
}

function hideGeoModal() {
  const modal = $('geoModal');
  if (modal) modal.classList.remove('open');
}

function useManualCoords() {
  const latEl = $('manualLat'), lngEl = $('manualLng');
  const lat = Number.parseFloat(latEl && latEl.value);
  const lng = Number.parseFloat(lngEl && lngEl.value);
  if (!isFiniteLatLng(lat, lng)) {
    toast('Enter a valid latitude (-90…90) and longitude (-180…180).', 'err');
    return;
  }
  stopWatch();
  hideGeoModal();
  setUserLocation(lat, lng, null, 'manual');
  toast('Using manually entered coordinates.', 'ok');
}

function useDemoLocation() {
  stopWatch();
  hideGeoModal();
  setUserLocation(DEMO_LOCATION.lat, DEMO_LOCATION.lng, null, 'demo');
  toast(state.zones.length
    ? 'Demo location loaded — you are inside a demo danger zone.'
    : 'Demo location loaded (no zones configured yet).', 'ok');
}
