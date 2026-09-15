/* ==========================================================================
   EVACROUTE — js/ui.js
   Event wiring: buttons, delegated clicks, keyboard, viewport changes.
   ========================================================================== */
'use strict';

/* ======================== 8. WIRING ==================================== */
function handleDelegatedClick(e) {
  const target = e.target;
  if (!target || !target.closest) return;
  const el = target.closest('[data-action]');
  if (!el) return;
  const action = el.getAttribute('data-action');
  const id = el.getAttribute('data-id');
  if (!action || !id) return;
  if (action === 'delete-zone') {
    if (state.map) state.map.closePopup();
    deleteZone(id);
  } else if (action === 'rename-zone') {
    renameZone(id);
  } else if (action === 'zoom-zone') {
    if (state.map) state.map.closePopup();
    focusZone(id);
  }
}

function handleViewportChange() {
  syncControlOffset();
  setTimeout(syncControlOffset, 280);
  if (state.map) state.map.invalidateSize();
}

function wireUI() {
  function on(id, evt, fn) { const el = $(id); if (el) el.addEventListener(evt, fn); }

  on('btnLocate', 'click', function () { requestGps(true); });
  on('btnHideAdmin', 'click', function () { setMode('user'); });

  on('btnDrawDanger', 'click', beginDrawDanger);
  on('btnPlaceSafe', 'click', togglePlaceSafe);
  on('btnFinishPoly', 'click', function () { finishPolygon(); });
  on('btnUndoVertex', 'click', undoVertex);
  on('btnCancelDraw', 'click', function () { cancelDrawing(false); });
  on('btnCollapseAdmin', 'click', function () {
    const panel = $('adminPanel');
    if (panel) setAdminCollapsed(!panel.classList.contains('collapsed'));
  });

  on('btnExport', 'click', exportZones);
  on('btnImport', 'click', function () { const f = $('importFile'); if (f) f.click(); });
  on('importFile', 'change', function (e) {
    const file = e.target.files && e.target.files[0];
    handleImportFile(file);
    e.target.value = '';
  });
  on('btnClearAll', 'click', clearAllZones);
  on('btnFitZones', 'click', function () { if (!fitAllZones(true)) toast('No zones to fit.', 'warn'); });

  /* ---- emergency danger popup (js/alert.js) ---- */
  on('btnTestAlarm', 'click', function () {
    playDangerAlert();
    vibrate(ALERT_VIBRATE);
    toast('Emergency alarm test — turn your volume up to hear it.', 'warn');
  });
  on('btnDangerMaps', 'click', openDangerRoute);
  on('btnDangerStay', 'click', cancelDangerAutoRedirect);
  on('btnDangerClose', 'click', function () { cancelDangerAutoRedirect(); hideDangerPopup(); });

  on('btnUseManual', 'click', useManualCoords);
  on('btnUseDemo', 'click', useDemoLocation);
  on('btnRetryGeo', 'click', function () { hideGeoModal(); requestGps(true); });
  on('manualLat', 'keydown', function (e) { if (e.key === 'Enter') useManualCoords(); });
  on('manualLng', 'keydown', function (e) { if (e.key === 'Enter') useManualCoords(); });

  /* Esc dismisses the emergency warning and stops the auto-redirect */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && state.dangerPopupOpen) {
      cancelDangerAutoRedirect();
      hideDangerPopup();
    }
  });

  document.addEventListener('click', handleDelegatedClick);
  document.addEventListener('keydown', handleKeydown);
  window.addEventListener('resize', handleViewportChange);
  window.addEventListener('orientationchange', handleViewportChange);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && state.user) evaluateUser(false);
  });
  if (window.ResizeObserver) {
    try { new ResizeObserver(function () { syncControlOffset(); }).observe($('bottomPanel')); } catch (e) {}
  }
  if (state.map) state.map.on('resize', syncControlOffset);
  updateDrawState();
  syncControlOffset();
}
