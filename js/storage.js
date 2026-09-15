/* ==========================================================================
   EVACROUTE — js/storage.js
   Persistence (localStorage) + GeoJSON serialisation / parsing + demo seeding.
   ========================================================================== */
'use strict';

function readStorage(key) {
  try { return window.localStorage.getItem(key); }
  catch (e) { state.storageOk = false; return null; }
}
function writeStorage(key, value) {
  try { window.localStorage.setItem(key, value); return true; }
  catch (e) {
    state.storageOk = false;
    toast('Storage is unavailable in this browser — zones will not persist.', 'warn');
    return false;
  }
}
function removeStorage(key) {
  try { window.localStorage.removeItem(key); return true; }
  catch (e) { state.storageOk = false; return false; }
}

/** Internal zones -> spec-compliant GeoJSON (coordinates are [lng, lat]). */
function zonesToFeatureCollection() {
  const features = state.zones.map(function (z) {
    const props = { zoneId: z.id, kind: z.kind, name: z.name, createdAt: z.createdAt || null };
    if (z.kind === 'safe') {
      return {
        type: 'Feature', properties: props,
        geometry: { type: 'Point', coordinates: [z.vertices[0][1], z.vertices[0][0]] }
      };
    }
    const ring = z.vertices.map(function (v) { return [v[1], v[0]]; });
    if (ring.length) ring.push(ring[0].slice());   // GeoJSON rings must be closed
    return {
      type: 'Feature', properties: props,
      geometry: { type: 'Polygon', coordinates: [ring] }
    };
  });
  return {
    type: 'FeatureCollection',
    properties: {
      app: 'EVACROUTE', version: 1, exportedAt: new Date().toISOString(),
      coordinateOrder: 'RFC 7946 [lng, lat]'
    },
    features: features
  };
}

/** A single GeoJSON Feature -> internal zone (or null when unusable). */
function featureToZone(f) {
  if (!f || f.type !== 'Feature' || !f.geometry) return null;
  const p = f.properties || {};
  const kind = (p.kind === 'safe' || p.type === 'safe') ? 'safe' : 'danger';
  const g = f.geometry;
  const id = typeof p.zoneId === 'string' && p.zoneId ? p.zoneId : uid();
  const name = typeof p.name === 'string' && p.name.trim() ? p.name.trim() : null;

  if (kind === 'safe') {
    let pair = null;
    if (g.type === 'Point') pair = coordPairToLatLng(g.coordinates);
    else if (g.type === 'Polygon' && g.coordinates && g.coordinates[0]) pair = coordPairToLatLng(g.coordinates[0][0]);
    if (!pair) return null;
    return { id: id, kind: 'safe', name: name || 'Safe Zone', vertices: [pair], createdAt: p.createdAt || null };
  }

  if (g.type !== 'Polygon' || !Array.isArray(g.coordinates) || !g.coordinates.length) return null;
  const ring = g.coordinates[0].map(coordPairToLatLng).filter(Boolean);
  if (ring.length > 2 && haversineMeters(ring[0], ring[ring.length - 1]) < 1) ring.pop();
  if (ring.length < 3) return null;
  return { id: id, kind: 'danger', name: name || 'Danger Zone', vertices: ring, createdAt: p.createdAt || null };
}

/** Accepts a FeatureCollection, Feature[], or an internal-format array. */
function parseZonePayload(data) {
  const out = [];
  let feats = [];
  if (!data) return out;
  if (data.type === 'FeatureCollection' && Array.isArray(data.features)) feats = data.features;
  else if (data.type === 'Feature') feats = [data];
  else if (Array.isArray(data)) feats = data;

  feats.forEach(function (f) {
    if (f && f.type === 'Feature') {
      const z = featureToZone(f);
      if (z) out.push(z);
      return;
    }
    // internal shape produced by an older version of this app
    if (f && Array.isArray(f.vertices) && f.vertices.length) {
      const kind = f.kind === 'safe' ? 'safe' : 'danger';
      const verts = f.vertices.filter(function (v) { return isFiniteLatLng(v[0], v[1]); }).map(function (v) { return [v[0], v[1]]; });
      if (kind === 'danger' && verts.length < 3) return;
      if (kind === 'safe' && verts.length < 1) return;
      out.push({ id: f.id || uid(), kind: kind, name: f.name || (kind === 'safe' ? 'Safe Zone' : 'Danger Zone'), vertices: verts, createdAt: f.createdAt || null });
    }
  });
  return out;
}

function saveZones() {
  return writeStorage(STORAGE_KEY, JSON.stringify(zonesToFeatureCollection()));
}

function seedDemoZones() {
  state.zones = DEMO_ZONES.map(function (z) {
    return { id: uid(), kind: z.kind, name: z.name, vertices: z.vertices.map(function (v) { return [v[0], v[1]]; }), createdAt: new Date().toISOString() };
  });
  state.seededDemo = true;
  writeStorage(SEED_FLAG_KEY, new Date().toISOString());
  saveZones();
}

function loadZones() {
  if (RESET_STORAGE) { removeStorage(STORAGE_KEY); removeStorage(SEED_FLAG_KEY); }
  let loaded = [];
  const raw = readStorage(STORAGE_KEY);
  if (raw) {
    try { loaded = parseZonePayload(JSON.parse(raw)); }
    catch (e) { loaded = []; toast('Saved zones were unreadable and have been reset.', 'warn'); }
  }
  const alreadySeeded = !!readStorage(SEED_FLAG_KEY);
  if (!loaded.length && !START_EMPTY && !alreadySeeded) {
    seedDemoZones();
    toast('Demo zones loaded (' + DEMO_ZONES.filter(function (z) { return z.kind === 'danger'; }).length +
          ' danger, ' + DEMO_ZONES.filter(function (z) { return z.kind === 'safe'; }).length +
          ' safe) — use Admin Panel to clear or edit them.', 'ok');
  } else {
    state.zones = loaded;
  }
  if (!state.storageOk && !state.zones.length) {
    toast('Storage is blocked — zones work for this session only.', 'warn');
  }
}
