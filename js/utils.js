/* ==========================================================================
   EVACROUTE — js/utils.js
   Shared helpers: DOM lookup, ids, math, geometry, formatting, toasts.
   Loaded first (config.js depends on isFiniteLatLng at parse time).
   ========================================================================== */
'use strict';

function $(id) { return document.getElementById(id); }
function uid() { return 'z' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function toRad(d) { return d * Math.PI / 180; }
function toDeg(r) { return r * 180 / Math.PI; }
function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

function isFiniteLatLng(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Point-in-polygon by ray casting (even-odd rule).
 * A horizontal ray is fired from the point along +x (longitude); every edge
 * crossing toggles the inside flag.
 * @param {number[]} point      [lat, lng]
 * @param {number[][]} polygon  [[lat, lng], ...] (ring is closed implicitly)
 * @returns {boolean} true when the point lies inside the ring
 */
function isPointInPolygon(point, polygon) {
  if (!Array.isArray(point) || point.length < 2) return false;
  if (!Array.isArray(polygon) || polygon.length < 3) return false;
  const y = point[0];      // latitude  -> y
  const x = point[1];      // longitude -> x
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const yi = polygon[i][0], xi = polygon[i][1];
    const yj = polygon[j][0], xj = polygon[j][1];
    if ((yi > y) !== (yj > y)) {
      const xAtY = ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi;
      if (x < xAtY) inside = !inside;
    }
  }
  return inside;
}

/** Great-circle distance in metres between two [lat,lng] points. */
function haversineMeters(a, b) {
  const R = 6371000;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial great-circle bearing from a to b in degrees (0 = north, clockwise). */
function bearingDegrees(a, b) {
  const lat1 = toRad(a[0]), lat2 = toRad(b[0]);
  const dLng = toRad(b[1] - a[1]);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** 8-wind compass label, e.g. 315 -> "NORTH-WEST". */
function bearingToCompass8(deg) {
  const names = ['NORTH','NORTH-EAST','EAST','SOUTH-EAST','SOUTH','SOUTH-WEST','WEST','NORTH-WEST'];
  const d = ((Number(deg) % 360) + 360) % 360;
  return names[Math.round(d / 45) % 8];
}

function directionText(deg) { return 'Head ' + bearingToCompass8(deg); }

/** "420 m" / "1.2 km" */
function formatDistance(m) {
  if (!Number.isFinite(m) || m < 0) return '—';
  if (m < 1000) return Math.round(m) + ' m';
  return (m / 1000).toFixed(1) + ' km';
}

/** Planar polygon area in square metres (local equirectangular projection). */
function polygonAreaMeters2(vertices) {
  if (!Array.isArray(vertices) || vertices.length < 3) return 0;
  const latSum = vertices.reduce(function (s, v) { return s + v[0]; }, 0);
  const originLat = vertices[0][0], originLng = vertices[0][1];
  const mPerLat = 111194.93;
  const mPerLng = 111194.93 * Math.cos(toRad(latSum / vertices.length));
  const pts = vertices.map(function (v) {
    return { x: (v[1] - originLng) * mPerLng, y: (v[0] - originLat) * mPerLat };
  });
  let sum = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    sum += (pts[j].x * pts[i].y - pts[i].x * pts[j].y);
  }
  return Math.abs(sum / 2);
}

/** GeoJSON coordinate pair -> our [lat, lng]; tolerates either ordering. */
function coordPairToLatLng(c) {
  if (!Array.isArray(c) || c.length < 2) return null;
  const a = Number(c[0]), b = Number(c[1]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  // RFC 7946 puts longitude first, so |x| > 90 can only be a latitude.
  if (Math.abs(a) > 90) return [a, b];   // already [lat, lng]
  return [b, a];                          // [lng, lat] -> [lat, lng]
}

/** Drop duplicated trailing vertices (double-click fires click twice). */
function dedupeTrailingVertices(points) {
  const out = points.slice();
  while (out.length >= 2 && haversineMeters(out[out.length - 1], out[out.length - 2]) < 8) {
    out.pop();
  }
  return out;
}

/* ------------------------------- toasts --------------------------------- */
function toast(message, kind) {
  const host = $('toastHost');
  if (!host) return;
  const el = document.createElement('div');
  el.className = 'toast' + (kind ? ' ' + kind : '');
  el.textContent = message;
  host.appendChild(el);
  while (host.children.length > 3) host.removeChild(host.firstChild);
  setTimeout(function () {
    el.classList.add('out');
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 400);
  }, 3400);
}
