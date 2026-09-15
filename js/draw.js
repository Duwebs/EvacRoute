/* ==========================================================================
   EVACROUTE — js/draw.js
   Admin draw / place tools: polygon drawing with live preview, safe-zone
   placement, map click handlers and keyboard shortcuts.
   ========================================================================== */
'use strict';

/* ================== 6. ADMIN DRAW / PLACE TOOLS ========================= */
/** Remove every live-preview layer (guide polygon, rubber band, vertex dots). */
function clearDrawLayers() {
  const map = state.map;
  const d = state.drawing;
  if (map) {
    if (d.guide) map.removeLayer(d.guide);
    if (d.rubber) map.removeLayer(d.rubber);
    d.vertexLayers.forEach(function (layer) { map.removeLayer(layer); });
  }
  d.guide = null;
  d.rubber = null;
  d.vertexLayers = [];
}

/** Redraw the preview polygon + rubber band; `cursor` is an optional L.LatLng. */
function updateDrawPreview(cursor) {
  const map = state.map;
  const d = state.drawing;
  if (!map) return;

  if (d.points.length >= 3) {
    if (!d.guide) d.guide = L.polygon(d.points, DRAW_GUIDE_STYLE).addTo(map);
    else d.guide.setLatLngs(d.points);
  } else if (d.guide) {
    map.removeLayer(d.guide);
    d.guide = null;
  }

  if (!d.points.length) {
    if (d.rubber) { map.removeLayer(d.rubber); d.rubber = null; }
    return;
  }

  const last = d.points[d.points.length - 1];
  const tip = cursor ? [cursor.lat, cursor.lng]
    : (d.points.length > 1 ? d.points[d.points.length - 2] : last);
  const line = [last, tip];
  if (cursor && d.points.length >= 3) line.push(d.points[0]);   // preview the closing edge
  if (!d.rubber) d.rubber = L.polyline(line, DRAW_RUBBER_STYLE).addTo(map);
  else d.rubber.setLatLngs(line);
}

/** Throw away the in-progress polygon and every preview layer. */
function resetDrawing() {
  clearDrawLayers();
  state.drawing.active = false;
  state.drawing.points = [];
  if (state.map && state.map.doubleClickZoom) {
    try { state.map.doubleClickZoom.enable(); } catch (e) { /* optional */ }
  }
}

function beginDrawDanger() {
  if (state.mode !== 'admin') return;
  state.placingSafe = false;
  resetDrawing();
  state.drawing.active = true;
  // a double-click ends the polygon, so it must not also zoom the map
  if (state.map && state.map.doubleClickZoom) {
    try { state.map.doubleClickZoom.disable(); } catch (e) { /* optional */ }
  }
  updateDrawState();
  toast('Draw mode on — tap the map for each corner, then Finish polygon.');
}

function addDrawVertex(latlng) {
  if (!latlng || !isFiniteLatLng(latlng.lat, latlng.lng)) return;
  const d = state.drawing;
  if (!d.active) return;
  const point = [latlng.lat, latlng.lng];
  d.points.push(point);
  if (state.map) d.vertexLayers.push(L.circleMarker(point, VERTEX_STYLE).addTo(state.map));
  updateDrawPreview(null);
  updateDrawState();
}

function undoVertex() {
  const d = state.drawing;
  if (!d.active || !d.points.length) return;
  d.points.pop();
  const layer = d.vertexLayers.pop();
  if (layer && state.map) state.map.removeLayer(layer);
  updateDrawPreview(null);
  updateDrawState();
}

function finishPolygon() {
  const d = state.drawing;
  if (!d.active) return;
  // a double-click fires click twice, so trailing duplicates are dropped here
  const points = dedupeTrailingVertices(d.points);
  if (points.length < 3) {
    toast('A danger zone needs at least 3 corners — tap the map to add more.', 'warn');
    return;
  }
  const zone = addZone('danger', null, points);
  resetDrawing();
  commitZones('Danger zone "' + zone.name + '" saved.');
  updateDrawState();
}

function cancelDrawing(silent) {
  const wasActive = state.drawing.active;
  resetDrawing();
  updateDrawState();
  if (wasActive && !silent) toast('Drawing cancelled.', 'warn');
}

function togglePlaceSafe() {
  if (state.mode !== 'admin') return;
  if (state.drawing.active) cancelDrawing(true);
  state.placingSafe = !state.placingSafe;
  updateDrawState();
  if (state.placingSafe) toast('Safe-zone mode on — tap the map to drop a marker.');
}

function placeSafeZone(latlng) {
  if (!latlng || !isFiniteLatLng(latlng.lat, latlng.lng)) return;
  const labelEl = $('safeLabel');
  const label = labelEl ? labelEl.value : '';
  const zone = addZone('safe', label, [[latlng.lat, latlng.lng]]);
  if (labelEl) labelEl.value = '';
  commitZones('Safe zone "' + zone.name + '" placed.');
}

/* ------------------- collapsible admin panel ---------------------------- */
let adminManualCollapsed = false;

/** Manual minimise/expand (the ▾ button in the header, used while idle). */
function setAdminCollapsed(collapsed) {
  adminManualCollapsed = !!collapsed;
  applyAdminPanelState();
}

/** Keep the panel in the right visual state:
    - tool active  → compact mode: bulky parts hidden, Finish/Undo/Cancel + hint stay
    - tool idle    → full panel, unless the admin manually minimised it */
function applyAdminPanelState() {
  const panel = $('adminPanel');
  if (!panel) return;
  const toolActive = !!state.drawing.active || !!state.placingSafe;
  panel.classList.toggle('tool-active', toolActive);
  panel.classList.toggle('collapsed', toolActive ? false : adminManualCollapsed);
  const btn = $('btnCollapseAdmin');
  if (btn) btn.hidden = toolActive;
  syncAdminPanelChrome();
}

/** Keep the header status (mini hint + drawing glow) in sync with the tools. */
function syncAdminPanelChrome() {
  const panel = $('adminPanel');
  if (!panel) return;
  const active = !!state.drawing.active || !!state.placingSafe;
  panel.classList.toggle('drawing-active', active);

  const mini = $('adminMiniHint');
  if (!mini) return;
  if (state.drawing.active) {
    mini.textContent = state.drawing.points.length
      ? '✏️ ' + state.drawing.points.length + (state.drawing.points.length === 1 ? ' corner' : ' corners')
      : '✏️ tap map to start';
  } else if (state.placingSafe) {
    mini.textContent = '✚ tap map → safe zone';
  } else {
    mini.textContent = '';
  }
  mini.hidden = !active;
}

/** Reflect the active admin tool in the panel (hint text, buttons, highlights).
    Also auto-minimises the panel while an admin tool is active so the map gets
    the screen (critical on phones), and expands it again when the tool ends. */
function updateDrawState() {
  const d = state.drawing;
  const hint = $('drawState'), actions = $('drawActions');
  const finish = $('btnFinishPoly'), undo = $('btnUndoVertex');
  const drawBtn = $('btnDrawDanger'), placeBtn = $('btnPlaceSafe');

  if (hint) {
    if (d.active) {
      hint.textContent = d.points.length
        ? d.points.length + ' corner' + (d.points.length === 1 ? '' : 's') + ' placed — ' +
          (d.points.length >= 3 ? 'finish, undo or keep tapping the map.' : 'add at least ' + (3 - d.points.length) + ' more.')
        : 'Tap the map to add the first corner of the danger zone.';
    } else if (state.placingSafe) {
      hint.textContent = 'Tap the map to drop a safe zone (the label above is optional).';
    } else {
      hint.textContent = 'Tap the map to start drawing a danger zone.';
    }
  }
  if (actions) actions.hidden = !d.active;
  if (finish) finish.disabled = d.points.length < 3;
  if (undo) undo.disabled = d.points.length === 0;
  if (drawBtn) drawBtn.classList.toggle('active', !!d.active);
  if (placeBtn) placeBtn.classList.toggle('active', !!state.placingSafe);

  // auto-compaction: while a tool is active the bulky parts of the panel
  // fold away so the map gets the screen (Finish/Undo stay available)
  applyAdminPanelState();
  syncAdminPanelChrome();
}

/* --------------------------- map event handlers ------------------------- */
function onMapClick(e) {
  if (state.mode !== 'admin' || !e || !e.latlng) return;
  if (state.drawing.active) addDrawVertex(e.latlng);
  else if (state.placingSafe) placeSafeZone(e.latlng);
}

function onMapDblClick() {
  if (state.mode !== 'admin' || !state.drawing.active) return;
  if (state.drawing.points.length >= 3) finishPolygon();
}

function onMapMouseMove(e) {
  if (!state.drawing.active || !e || !e.latlng) return;
  updateDrawPreview(e.latlng);
}

/** Keyboard shortcuts: Esc cancels/closes, Enter finishes, Backspace or Z undoes. */
function handleKeydown(e) {
  if (!e || e.altKey || e.ctrlKey || e.metaKey) return;
  const tag = e.target && e.target.tagName;
  const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

  if (e.key === 'Escape') {
    if (state.drawing.active) { cancelDrawing(false); return; }
    if (state.placingSafe) { state.placingSafe = false; updateDrawState(); return; }
    const modal = $('geoModal');
    if (modal && modal.classList.contains('open')) { hideGeoModal(); return; }
    if (state.map) state.map.closePopup();
    return;
  }
  if (typing || !state.drawing.active) return;
  if (e.key === 'Enter') { e.preventDefault(); finishPolygon(); }
  else if (e.key === 'Backspace' || e.key === 'z' || e.key === 'Z') { e.preventDefault(); undoVertex(); }
}
