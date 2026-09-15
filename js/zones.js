/* ==========================================================================
   EVACROUTE — js/zones.js
   Zone CRUD (add / rename / delete / clear) + GeoJSON export & import.
   ========================================================================== */
'use strict';

/* ---------------------------- admin CRUD -------------------------------- */
function uniqueZoneName(base, existing) {
  if (existing.indexOf(base) < 0) return base;
  let i = 2;
  while (existing.indexOf(base + ' ' + i) > -1) i++;
  return base + ' ' + i;
}

function nextZoneName(kind) {
  const existing = state.zones.filter(function (z) { return z.kind === kind; }).map(function (z) { return z.name; });
  if (kind === 'danger') {
    let n = 1;
    while (existing.indexOf('Danger Zone ' + n) > -1) n++;
    return 'Danger Zone ' + n;
  }
  for (let i = 0; i < 26; i++) {
    const label = 'Safe Zone ' + String.fromCharCode(65 + i);
    if (existing.indexOf(label) < 0) return label;
  }
  let n = 1;
  while (existing.indexOf('Safe Zone ' + n) > -1) n++;
  return 'Safe Zone ' + n;
}

function addZone(kind, name, vertices) {
  const zone = {
    id: uid(),
    kind: kind === 'safe' ? 'safe' : 'danger',
    name: name && name.trim() ? name.trim() : nextZoneName(kind),
    vertices: vertices.map(function (v) { return [v[0], v[1]]; }),
    createdAt: new Date().toISOString()
  };
  if (zone.kind === 'safe') zone.name = uniqueZoneName(zone.name, state.zones.map(function (z) { return z.name; }));
  else zone.name = uniqueZoneName(zone.name, state.zones.map(function (z) { return z.name; }));
  state.zones.push(zone);
  return zone;
}

function findZone(id) {
  for (let i = 0; i < state.zones.length; i++) if (state.zones[i].id === id) return state.zones[i];
  return null;
}

function deleteZone(id) {
  const zone = findZone(id);
  if (!zone) return;
  state.zones = state.zones.filter(function (z) { return z.id !== id; });
  state.layers.danger.delete(id);
  state.layers.safe.delete(id);
  commitZones('Deleted "' + zone.name + '".');
}

function renameZone(id) {
  const zone = findZone(id);
  if (!zone) return;
  const input = window.prompt('Zone label', zone.name);
  if (input === null) return;
  const name = input.trim();
  if (!name || name === zone.name) return;
  zone.name = name;
  commitZones('Renamed to "' + name + '".');
}

function clearAllZones() {
  if (!state.zones.length) { toast('There are no zones to clear.', 'warn'); return; }
  if (!window.confirm('Remove all ' + state.zones.length + ' zones (danger + safe)?')) return;
  state.zones = [];
  state.layers.danger.clear();
  state.layers.safe.clear();
  commitZones('All zones cleared.');
}

/** Persist, redraw, refresh admin UI and re-evaluate the user's safety. */
function commitZones(message) {
  saveZones();
  renderAllZones();
  refreshAdminUI();
  if (state.user) evaluateUser(false);
  if (message) toast(message, 'ok');
}

/* --------------------------- export / import ---------------------------- */
function stamp() {
  const d = new Date(), p = function (n) { return String(n).padStart(2, '0'); };
  return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
}

function exportZones() {
  if (!state.zones.length) { toast('Nothing to export yet — draw a zone first.', 'warn'); return; }
  try {
    const json = JSON.stringify(zonesToFeatureCollection(), null, 2);
    const blob = new Blob([json], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'evacroute-zones-' + stamp() + '.geojson';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    toast('Exported ' + state.zones.length + ' zone(s) as GeoJSON.', 'ok');
  } catch (e) {
    toast('Export failed: ' + (e && e.message ? e.message : 'unknown error'), 'err');
  }
}

function importZonesFromText(text) {
  let data = null;
  try { data = JSON.parse(text); }
  catch (e) { toast('That file is not valid JSON.', 'err'); return; }
  const parsed = parseZonePayload(data);
  if (!parsed.length) { toast('No usable zones found in that file.', 'err'); return; }
  const existingIds = state.zones.map(function (z) { return z.id; });
  const merged = [];
  parsed.forEach(function (z) {
    if (existingIds.indexOf(z.id) > -1) z.id = uid();
    existingIds.push(z.id);
    merged.push(z);
  });
  state.zones = state.zones.concat(merged);
  commitZones('Imported ' + merged.length + ' zone(s).');
}

function handleImportFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function () { importZonesFromText(String(reader.result)); };
  reader.onerror = function () { toast('Could not read that file.', 'err'); };
  reader.readAsText(file);
}
