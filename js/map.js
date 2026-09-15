/* ==========================================================================
   EVACROUTE — js/map.js
   Leaflet setup, zone layer rendering, popups, route drawing,
   admin panel UI and user/admin mode switching.
   ========================================================================== */
'use strict';

/* ===================== 5. MAP + RENDERING =============================== */
function userIcon() {
  return L.divIcon({
    className: 'user-marker',
    html: '<div class="user-dot"><span class="user-pulse"></span></div>',
    iconSize: [18, 18], iconAnchor: [9, 9]
  });
}

function safeIcon(isNearest) {
  return L.divIcon({
    className: 'safe-marker-wrap',
    html: '<div class="safe-pin' + (isNearest ? ' nearest' : '') + '">✓</div>',
    iconSize: [26, 26], iconAnchor: [13, 13], popupAnchor: [0, -14]
  });
}

function initMap() {
  const map = L.map('map', {
    zoomControl: false, minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM,
    worldCopyJump: false, fadeAnimation: true, markerZoomAnimation: true
  });
  state.map = map;

  state.tileLayer = L.tileLayer(TILE_URL, {
    minZoom: MIN_ZOOM, maxZoom: 19, attribution: TILE_ATTR, crossOrigin: true
  }).addTo(map);
  state.tileLayer.on('tileerror', function () {
    if (state.tileErrorShown) return;
    state.tileErrorShown = true;
    toast('Map tiles could not be loaded — check your internet connection.', 'warn');
  });

  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.control.scale({ position: 'bottomleft', imperial: false, maxWidth: 130 }).addTo(map);
  map.setView(FALLBACK_CENTER, FALLBACK_ZOOM);

  map.on('click', onMapClick);
  map.on('dblclick', onMapDblClick);
  map.on('mousemove', onMapMouseMove);
  map.on('moveend', saveViewLater);
  return map;
}

function saveViewLater() {
  clearTimeout(state.viewTimer);
  state.viewTimer = setTimeout(function () {
    try {
      const c = state.map.getCenter();
      window.localStorage.setItem(VIEW_KEY, JSON.stringify({ lat: c.lat, lng: c.lng, zoom: state.map.getZoom() }));
    } catch (e) { /* storage unavailable — view persistence is optional */ }
  }, 700);
}

function restoreView() {
  const raw = readStorage(VIEW_KEY);
  if (!raw) return false;
  try {
    const v = JSON.parse(raw);
    if (!isFiniteLatLng(v.lat, v.lng)) return false;
    state.map.setView([v.lat, v.lng], clamp(Number(v.zoom) || FALLBACK_ZOOM, MIN_ZOOM, MAX_ZOOM));
    return true;
  } catch (e) { return false; }
}

function zonePopupHtml(zone) {
  let meta;
  if (zone.kind === 'danger') {
    meta = zone.vertices.length + ' points · ' + (polygonAreaMeters2(zone.vertices) / 1e6).toFixed(2) + ' km²';
  } else {
    meta = zone.vertices[0][0].toFixed(5) + ', ' + zone.vertices[0][1].toFixed(5);
  }
  let html = '<b>' + escapeHtml(zone.name) + '</b>' +
    '<div class="pop-meta">' + (zone.kind === 'danger' ? 'Danger zone · ' : 'Safe zone · ') + meta + '</div>';
  if (state.mode === 'admin') {
    html += '<div class="pop-actions">' +
      '<button class="btn" type="button" data-action="zoom-zone" data-id="' + zone.id + '">🎯 Zoom</button>' +
      '<button class="btn" type="button" data-action="rename-zone" data-id="' + zone.id + '">✎ Rename</button>' +
      '<button class="btn btn-ghost" type="button" data-action="delete-zone" data-id="' + zone.id + '">🗑 Delete</button>' +
      '</div>';
  }
  return html;
}

function addZoneLayer(zone) {
  const map = state.map;
  if (!map) return;
  if (zone.kind === 'danger') {
    const layer = L.polygon(zone.vertices, DANGER_STYLE).addTo(map);
    layer.bindPopup(zonePopupHtml(zone));
    state.layers.danger.set(zone.id, layer);
  } else {
    const layer = L.marker(zone.vertices[0], { icon: safeIcon(false), riseOnHover: true, title: zone.name }).addTo(map);
    layer.bindPopup(zonePopupHtml(zone));
    layer.bindTooltip(zone.name, { direction: 'top', offset: [0, -14] });
    state.layers.safe.set(zone.id, layer);
  }
}

/** Redraw every zone layer from state (after any zone mutation). */
function renderAllZones() {
  const map = state.map;
  if (!map) return;
  state.layers.danger.forEach(function (layer) { map.removeLayer(layer); });
  state.layers.safe.forEach(function (layer) { map.removeLayer(layer); });
  state.layers.danger.clear();
  state.layers.safe.clear();
  state.zones.forEach(addZoneLayer);
  // keep references fresh when a reload/import replaced the zone objects
  state.inside = state.inside.map(function (z) { return findZone(z.id); }).filter(Boolean);
  if (state.nearest) {
    const fresh = findZone(state.nearest.zone.id);
    if (fresh) state.nearest.zone = fresh; else state.nearest = null;
  }
  applyZoneStyles();
}

/** Highlight the danger polygon(s) containing the user and the nearest exit. */
function applyZoneStyles() {
  state.layers.danger.forEach(function (layer, id) {
    const isInside = state.inside.some(function (z) { return z.id === id; });
    layer.setStyle(isInside ? Object.assign({}, DANGER_STYLE, DANGER_ALERT_STYLE) : DANGER_STYLE);
    const el = layer.getElement && layer.getElement();
    if (el && el.classList) {
      el.classList.add('dz-poly');
      el.classList.toggle('dz-alert', isInside);
    }
  });
  state.layers.safe.forEach(function (layer, id) {
    const isNearest = !!(state.nearest && state.nearest.zone && state.nearest.zone.id === id);
    const el = layer.getElement && layer.getElement();
    if (el) {
      const pin = el.querySelector('.safe-pin');
      if (pin) pin.classList.toggle('nearest', isNearest);
    }
    if (layer.setZIndexOffset) layer.setZIndexOffset(isNearest ? 600 : 0);
  });
}

function updateUserMarker() {
  if (!state.map || !state.user) return;
  const ll = [state.user.lat, state.user.lng];
  if (!state.userMarker) {
    state.userMarker = L.marker(ll, { icon: userIcon(), interactive: false, keyboard: false, zIndexOffset: 1000 }).addTo(state.map);
  } else {
    state.userMarker.setLatLng(ll);
  }
}
function drawRoute(from, to) {
  clearRoute();
  if (!state.map) return;
  state.routeLine = L.polyline([from, to], ROUTE_STYLE).addTo(state.map);
  state.routeEnd = L.circleMarker(to, {
    radius: 7, color: '#ffffff', weight: 2, fillColor: '#22c55e', fillOpacity: 1
  }).addTo(state.map);
}

function clearRoute() {
  if (state.routeLine && state.map) state.map.removeLayer(state.routeLine);
  if (state.routeEnd && state.map) state.map.removeLayer(state.routeEnd);
  state.routeLine = null;
  state.routeEnd = null;
}

function fitAllZones(animate) {
  if (!state.map || !state.zones.length) return false;
  const pts = [];
  state.zones.forEach(function (z) { z.vertices.forEach(function (v) { pts.push(v); }); });
  if (!pts.length) return false;
  state.map.fitBounds(L.latLngBounds(pts), { padding: [70, 70], maxZoom: 16, animate: animate !== false });
  return true;
}

function focusZone(id) {
  const zone = findZone(id);
  if (!zone || !state.map) return;
  if (zone.kind === 'safe') {
    state.map.setView(zone.vertices[0], Math.max(state.map.getZoom(), 15), { animate: true });
    return;
  }
  state.map.fitBounds(L.latLngBounds(zone.vertices), { padding: [80, 80], maxZoom: 16, animate: true });
}

/** Keep Leaflet's bottom controls clear of the floating action panel. */
function syncControlOffset() {
  const panel = $('bottomPanel');
  const h = panel ? panel.offsetHeight : 0;
  const offset = window.innerWidth <= 640 ? (h + 18) : 0;
  document.documentElement.style.setProperty('--ctrl-offset', offset + 'px');
}

/* --------------------------- admin panel UI ----------------------------- */
function refreshAdminUI() {
  const dangers = state.zones.filter(function (z) { return z.kind === 'danger'; }).length;
  const safes = state.zones.filter(function (z) { return z.kind === 'safe'; }).length;
  const counts = $('zoneCounts');
  if (counts) {
    counts.textContent = dangers + ' danger zone' + (dangers === 1 ? '' : 's') + ', ' +
                         safes + ' safe zone' + (safes === 1 ? '' : 's') + ' active';
  }
  renderAdminList();
}

function renderAdminList() {
  const host = $('adminList');
  if (!host) return;
  if (!state.zones.length) {
    host.innerHTML = '<div class="hint">No zones yet. Draw a danger zone or place a safe zone.</div>';
    return;
  }
  host.innerHTML = state.zones.map(function (z) {
    const isNearest = !!(z.kind === 'safe' && state.nearest && state.nearest.zone.id === z.id);
    const meta = z.kind === 'danger'
      ? z.vertices.length + ' pts'
      : (isNearest ? 'nearest' : z.vertices[0][0].toFixed(4) + ', ' + z.vertices[0][1].toFixed(4));
    return '<div class="admin-row">' +
      '<span class="dot ' + z.kind + '"></span>' +
      '<span class="name">' + escapeHtml(z.name) + '</span>' +
      '<span class="meta">' + escapeHtml(meta) + '</span>' +
      '<button class="icon-btn" type="button" title="Zoom to zone" data-action="zoom-zone" data-id="' + z.id + '">🎯</button>' +
      '<button class="icon-btn" type="button" title="Rename zone" data-action="rename-zone" data-id="' + z.id + '">✎</button>' +
      '<button class="icon-btn" type="button" title="Delete zone" data-action="delete-zone" data-id="' + z.id + '">🗑</button>' +
      '</div>';
  }).join('');
}

/* ------------------------------- mode ---------------------------------- */
function setMode(mode) {
  const next = mode === 'admin' ? 'admin' : 'user';
  if (next === 'user' && state.mode === 'admin') {
    cancelDrawing();
    state.placingSafe = false;
  }
  state.mode = next;

  const panel = $('adminPanel');
  if (panel) panel.hidden = state.mode !== 'admin';
  const adminBtn = $('btnAdmin');
  if (adminBtn) adminBtn.textContent = state.mode === 'admin' ? '👤 User view' : '🛠 Admin panel';

  try {
    const url = new URL(window.location.href);
    if (state.mode === 'admin') url.searchParams.set('mode', 'admin');
    else url.searchParams.delete('mode');
    window.history.replaceState({}, '', url.toString());
  } catch (e) { /* history API unavailable — harmless */ }

  renderAllZones();
  refreshAdminUI();
  syncControlOffset();

  if (state.mode === 'admin') {
    hideBoot();
    if (!fitAllZones(true) && !restoreView()) {
      if (state.user) state.map.setView([state.user.lat, state.user.lng], Math.max(state.map.getZoom(), 14));
    }
    updateDrawState();
  } else if (state.user) {
    evaluateUser(false);
  }
}
