/* ==========================================================================
   EVACROUTE — js/selftest.js
   Self-test harness (?selftest=1): geometry unit tests, scenario suites
   (danger / safe / admin flows) and the rendered report.
   ========================================================================== */
'use strict';

/* ======================== 9. SELF TEST ================================= */
function runSelfTest() {
  const results = [];
  const failed = [];
  function check(name, cond, extra) {
    const ok = !!cond;
    results.push({ name: name, ok: ok, extra: extra === undefined ? '' : String(extra) });
    if (!ok) failed.push(name);
  }
  function near(a, b, tol) { return Math.abs(a - b) <= tol; }

  /* ---- ray casting ---- */
  const square = [[0, 0], [0, 10], [10, 10], [10, 0]];
  const lShape = [[0, 0], [0, 10], [4, 10], [4, 4], [10, 4], [10, 0]];
  const realZone = [[28.6352, 77.2102], [28.6358, 77.2178], [28.6312, 77.2186], [28.6306, 77.2108]];
  check('isPointInPolygon: centre of square is inside', isPointInPolygon([5, 5], square) === true);
  check('isPointInPolygon: east of square is outside', isPointInPolygon([5, 15], square) === false);
  check('isPointInPolygon: west of square is outside', isPointInPolygon([5, -1], square) === false);
  check('isPointInPolygon: north of square is outside', isPointInPolygon([11, 5], square) === false);
  check('isPointInPolygon: south of square is outside', isPointInPolygon([-1, 5], square) === false);
  check('isPointInPolygon: just inside an edge is inside', isPointInPolygon([5, 0.001], square) === true);
  check('isPointInPolygon: concave arm is inside', isPointInPolygon([2, 8], lShape) === true);
  check('isPointInPolygon: concave notch is outside', isPointInPolygon([8, 8], lShape) === false);
  check('isPointInPolygon: fewer than 3 vertices returns false', isPointInPolygon([0, 0], [[0, 0], [1, 1]]) === false);
  check('isPointInPolygon: null polygon is handled', isPointInPolygon([0, 0], null) === false);
  check('isPointInPolygon: reversed winding still matches', isPointInPolygon([5, 5], square.slice().reverse()) === true);
  check('isPointInPolygon: respects [lat,lng] order (real zone)', isPointInPolygon([28.6330, 77.2140], realZone) === true);
  check('isPointInPolygon: swapped [lng,lat] would be outside', isPointInPolygon([77.2140, 28.6330], realZone) === false);

  /* ---- distance ---- */
  const delhiMumbai = haversineMeters([28.6139, 77.2090], [19.0760, 72.8777]);
  check('haversine: identical points are 0 m', haversineMeters([28.6, 77.2], [28.6, 77.2]) === 0);
  check('haversine: Delhi→Mumbai ≈ 1150 km', near(delhiMumbai / 1000, 1150, 25), Math.round(delhiMumbai / 1000) + ' km');
  check('haversine: symmetric between endpoints',
    near(haversineMeters([28.6139, 77.2090], [19.0760, 72.8777]) - haversineMeters([19.0760, 72.8777], [28.6139, 77.2090]), 0, 0.01));
  check('haversine: 0.009° of latitude ≈ 1 km', near(haversineMeters([0, 0], [0.009, 0]), 1000.75, 5));

  /* ---- bearing + compass ---- */
  check('bearing: due north ≈ 0°', near(bearingDegrees([0, 0], [1, 0]), 0, 0.01));
  check('bearing: due east ≈ 90°', near(bearingDegrees([0, 0], [0, 1]), 90, 0.05));
  check('bearing: due south ≈ 180°', near(bearingDegrees([0, 0], [-1, 0]), 180, 0.05));
  check('bearing: due west ≈ 270°', near(bearingDegrees([0, 1], [0, 0]), 270, 0.05));
  check('compass: 0 → NORTH', bearingToCompass8(0) === 'NORTH');
  check('compass: 45 → NORTH-EAST', bearingToCompass8(45) === 'NORTH-EAST');
  check('compass: 90 → EAST', bearingToCompass8(90) === 'EAST');
  check('compass: 135 → SOUTH-EAST', bearingToCompass8(135) === 'SOUTH-EAST');
  check('compass: 180 → SOUTH', bearingToCompass8(180) === 'SOUTH');
  check('compass: 225 → SOUTH-WEST', bearingToCompass8(225) === 'SOUTH-WEST');
  check('compass: 270 → WEST', bearingToCompass8(270) === 'WEST');
  check('compass: 315 → NORTH-WEST', bearingToCompass8(315) === 'NORTH-WEST');
  check('compass: 337 → NORTH-WEST (bucket edge)', bearingToCompass8(337) === 'NORTH-WEST');
  check('compass: 350 → NORTH (wrap-around)', bearingToCompass8(350) === 'NORTH');
  check('compass: -45 → NORTH-WEST (negative input)', bearingToCompass8(-45) === 'NORTH-WEST');
  check('directionText: "Head NORTH-WEST"', directionText(315) === 'Head NORTH-WEST');
  /* ---- formatting + misc helpers ---- */
  check('formatDistance: 0 → "0 m"', formatDistance(0) === '0 m');
  check('formatDistance: 999 → "999 m"', formatDistance(999) === '999 m');
  check('formatDistance: 1000 → "1.0 km"', formatDistance(1000) === '1.0 km');
  check('formatDistance: 1206 → "1.2 km"', formatDistance(1206) === '1.2 km');
  check('formatDistance: NaN → "—"', formatDistance(NaN) === '—');
  check('polygonAreaMeters2: 1 km square ≈ 1e6 m²',
    near(polygonAreaMeters2([[0, 0], [0, 0.009], [0.009, 0.009], [0.009, 0]]), 1001500, 4000));
  check('polygonAreaMeters2: degenerate ring is 0', polygonAreaMeters2([[0, 0], [1, 1]]) === 0);
  check('isFiniteLatLng: rejects out-of-range values',
    !isFiniteLatLng(91, 0) && !isFiniteLatLng(0, 181) && isFiniteLatLng(-90, 180));
  check('escapeHtml: escapes markup', escapeHtml('<b>&"\'') === '&lt;b&gt;&amp;&quot;&#39;');
  check('dedupeTrailingVertices: drops the double-click duplicate',
    dedupeTrailingVertices([[0, 0], [0, 1], [0, 1]]).length === 2);
  check('coordPairToLatLng: converts [lng,lat] → [lat,lng]',
    JSON.stringify(coordPairToLatLng([77.214, 28.633])) === JSON.stringify([28.633, 77.214]));
  check('coordPairToLatLng: detects an existing [lat,lng] pair',
    JSON.stringify(coordPairToLatLng([28.633, 77.214])) === JSON.stringify([28.633, 77.214]));

  /* ---- environment + DOM wiring ---- */
  const missingIds = REQUIRED_IDS.filter(function (id) { return !$(id); });
  check('DOM: every required id exists', missingIds.length === 0, missingIds.join(', '));
  check('Leaflet is loaded', typeof L !== 'undefined' && !!L.version, typeof L !== 'undefined' ? L.version : 'missing');
  check('map instance created', !!state.map);
  check('tile layer attached to the map', !!state.tileLayer && !!state.map && state.map.hasLayer(state.tileLayer));
  check('zoom control sits bottom-right', !!document.querySelector('.leaflet-bottom.leaflet-right .leaflet-control-zoom'));
  check('scale control sits bottom-left', !!document.querySelector('.leaflet-bottom.leaflet-left .leaflet-control-scale'));
  check('zoom range is 10…18', state.map.getMinZoom() === MIN_ZOOM && state.map.getMaxZoom() === MAX_ZOOM,
    state.map.getMinZoom() + '…' + state.map.getMaxZoom());
  check('CSS: dashMove keyframes present', hasCssKeyframe('dashMove'));
  check('CSS: dotPulse keyframes present', hasCssKeyframe('dotPulse'));
  check('CSS: badgePulse keyframes present', hasCssKeyframe('badgePulse'));
  check('bottom action panel wired', !!$('btnLocate') && !!$('btnMaps'));
  check('Google Maps control is a link styled as a button',
    !!$('btnMaps') && $('btnMaps').tagName === 'A' && $('btnMaps').classList.contains('btn'));
  check('boot overlay exists and is hidden after boot', !!$('boot') && $('boot').classList.contains('hidden') === !!state.bootHidden);
  return { results: results, failed: failed };
}

/** The stylesheet now lives in an external file, so keyframes are looked up
    through document.styleSheets instead of inline <style> elements. */
function hasCssKeyframe(name) {
  try {
    for (let i = 0; i < document.styleSheets.length; i++) {
      let rules;
      try { rules = document.styleSheets[i].cssRules; } catch (e) { continue; } // cross-origin sheet
      if (!rules) continue;
      for (let j = 0; j < rules.length; j++) {
        if (rules[j].type === CSSRule.KEYFRAMES_RULE && rules[j].name === name) return true;
      }
    }
  } catch (e) { /* fall through */ }
  return false;
}

/* ---------------- scenario + integration assertions --------------------- */
function runScenarioTests() {
  const out = [];
  function check(name, cond, extra) {
    out.push({ name: name, ok: !!cond, extra: extra === undefined ? '' : String(extra) });
  }
  function withLocation(lat, lng, fn) {
    const prev = state.user;
    state.user = { lat: lat, lng: lng, accuracy: null, source: 'selftest' };
    updateUserMarker();
    evaluateUser(false);
    fn();
    state.user = prev;
    if (prev) { updateUserMarker(); evaluateUser(false); }
  }
  function textOf(id) { const el = $(id); return el ? el.textContent : ''; }

  const dangers = state.zones.filter(function (z) { return z.kind === 'danger'; }).length;
  const safes = state.zones.filter(function (z) { return z.kind === 'safe'; }).length;
  const demoDanger = state.zones.filter(function (z) { return z.name === 'Danger Zone 1'; })[0];

  /* ---- zone rendering ---- */
  check('zones render as polygons/markers', state.layers.danger.size === dangers && state.layers.safe.size === safes,
    state.layers.danger.size + ' polys / ' + state.layers.safe.size + ' markers');
  check('danger polygons carry .dz-poly class', document.querySelectorAll('path.dz-poly').length === dangers,
    document.querySelectorAll('path.dz-poly').length);
  check('safe markers render ✓ pins', document.querySelectorAll('.safe-pin').length === safes);
  check('admin counts line matches zones', textOf('zoneCounts').indexOf(dangers + ' danger zone') === 0, textOf('zoneCounts'));
  check('admin list has one row per zone',
    document.querySelectorAll('#adminList .admin-row').length === state.zones.length,
    document.querySelectorAll('#adminList .admin-row').length);

  /* ---- danger scenario ---- */
  if (demoDanger) {
    withLocation(DEMO_LOCATION.lat, DEMO_LOCATION.lng, function () {
      check('danger: exactly one polygon contains the demo point', state.inside.length === 1,
        state.inside.map(function (z) { return z.name; }).join(' | '));
      check('danger: containing zone is "Danger Zone 1"', !!state.inside[0] && state.inside[0].name === 'Danger Zone 1');
      check('danger: nearest safe zone is "Safe Zone A"', !!state.nearest && state.nearest.zone.name === 'Safe Zone A',
        state.nearest ? state.nearest.zone.name : 'none');
      check('danger: distance ≈ 1.2 km', !!state.nearest && state.nearest.distance > 1100 && state.nearest.distance < 1300,
        state.nearest ? Math.round(state.nearest.distance) + ' m' : '');
      check('danger: heading is NORTH-WEST', !!state.nearest && bearingToCompass8(state.nearest.bearing) === 'NORTH-WEST',
        state.nearest ? Math.round(state.nearest.bearing) + '°' : '');
      check('danger: badge reads DANGER', textOf('statusBadge') === 'DANGER', textOf('statusBadge'));
      check('danger: badge uses the pulsing red class', $('statusBadge').classList.contains('badge-danger'));
      check('danger: banner text', textOf('statusLine').indexOf('YOU ARE IN A DANGER ZONE') > -1, textOf('statusLine'));
      check('danger: summary text matches the spec wording',
        textOf('routeSummary') === 'Nearest safe zone: Safe Zone A — 1.2 km away', textOf('routeSummary'));
      check('danger: direction text', textOf('dirText') === 'Head NORTH-WEST', textOf('dirText'));
      check('danger: arrow rotated to the bearing', /rotate\(-?\d+(\.\d+)?deg\)/.test($('dirArrow').style.transform),
        $('dirArrow').style.transform);
      check('danger: route polyline drawn', !!state.routeLine && state.routeLine.getLatLngs().length >= 2);
      check('danger: route uses the animated dash class', document.querySelectorAll('path.route-dash').length >= 1);
      check('danger: containing polygon highlighted (.dz-alert)',
        document.querySelectorAll('path.dz-poly.dz-alert').length === 1,
        document.querySelectorAll('path.dz-poly.dz-alert').length);
      check('danger: nearest safe marker scaled up', document.querySelectorAll('.safe-pin.nearest').length === 1);
      check('danger: Google Maps button visible', $('btnMaps').hidden === false);
      check('danger: Google Maps href is a walking-directions link',
        /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1/.test($('btnMaps').getAttribute('href')) &&
        $('btnMaps').getAttribute('href').indexOf('travelmode=walking') > -1 &&
        $('btnMaps').getAttribute('href').indexOf('destination=28.640700,77.205300') > -1,
        $('btnMaps').getAttribute('href'));
    });
  } else {
    check('danger scenario skipped (no demo zones loaded)', true, 'empty dataset run');
  }
  return out;
}
/* ---------------- scenario part 2: safe path, admin, GeoJSON ------------ */
function runScenarioTests2() {
  const out = [];
  function check(name, cond, extra) {
    out.push({ name: name, ok: !!cond, extra: extra === undefined ? '' : String(extra) });
  }
  function withLocation(lat, lng, fn) {
    const prev = state.user;
    state.user = { lat: lat, lng: lng, accuracy: null, source: 'selftest' };
    updateUserMarker();
    evaluateUser(false);
    fn();
    state.user = prev;
    if (prev) { updateUserMarker(); evaluateUser(false); }
  }
  function textOf(id) { const el = $(id); return el ? el.textContent : ''; }

  const dangers = state.zones.filter(function (z) { return z.kind === 'danger'; }).length;
  const safes = state.zones.filter(function (z) { return z.kind === 'safe'; }).length;

  /* ---- safe scenario ---- */
  withLocation(SAFE_TEST_POINT.lat, SAFE_TEST_POINT.lng, function () {
    check('safe: no polygon contains the user', state.inside.length === 0,
      state.inside.map(function (z) { return z.name; }).join(' | '));
    check('safe: badge reads SAFE', textOf('statusBadge') === 'SAFE', textOf('statusBadge'));
    check('safe: green banner text', textOf('statusLine').indexOf('YOU ARE IN A SAFE AREA') > -1, textOf('statusLine'));
    check('safe: nearest safe zone is still reported', !!state.nearest && state.nearest.distance > 0,
      state.nearest ? state.nearest.zone.name + ' @ ' + formatDistance(state.nearest.distance) : 'none');
    check('safe: no route line drawn', !state.routeLine);
    check('safe: no highlighted polygon', document.querySelectorAll('path.dz-poly.dz-alert').length === 0);
    check('safe: no scaled-up safe pin', document.querySelectorAll('.safe-pin.nearest').length === 0);
    check('safe: Google Maps link hidden', $('btnMaps').hidden === true);
    check('safe: danger zones still drawn for awareness', document.querySelectorAll('path.dz-poly').length === dangers);
  });

  /* ---- admin flow: drawing, persistence, export shape ---- */
  const modeBefore = state.mode;
  setMode('admin');
  check('admin: panel becomes visible', $('adminPanel').hidden === false);
  check('admin: URL records ?mode=admin or the /admin path',
    window.location.search.indexOf('mode=admin') > -1 ||
    window.location.pathname.replace(/\/+$/, '') === ADMIN_PATH,
    window.location.search + ' ' + window.location.pathname);
  check('admin: no admin button shown to normal users', !$('btnAdmin'));

  const before = state.zones.length;
  beginDrawDanger();
  check('admin: drawing mode active', state.drawing.active === true);
  addDrawVertex({ lat: 28.6500, lng: 77.2000 });
  addDrawVertex({ lat: 28.6520, lng: 77.2040 });
  addDrawVertex({ lat: 28.6480, lng: 77.2060 });
  check('admin: three vertices captured', state.drawing.points.length === 3, state.drawing.points.length);
  check('admin: finish button enabled at 3 points', $('btnFinishPoly').disabled === false);
  check('admin: live preview polygon + rubber band exist', !!state.drawing.guide && !!state.drawing.rubber);
  finishPolygon();
  const drawn = state.zones[state.zones.length - 1];
  check('admin: finishing saved a new zone', state.zones.length === before + 1, state.zones.length);
  check('admin: the new zone is a danger zone', !!drawn && drawn.kind === 'danger');
  check('admin: auto-named as a danger zone', !!drawn && /^Danger Zone \d+$/.test(drawn.name), drawn ? drawn.name : '');
  check('admin: drawing mode ended cleanly', state.drawing.active === false && state.drawing.points.length === 0);
  check('admin: preview layers removed', !state.drawing.guide && !state.drawing.rubber);
  check('admin: new polygon rendered', document.querySelectorAll('path.dz-poly').length === dangers + 1,
    document.querySelectorAll('path.dz-poly').length);

  $('safeLabel').value = 'Safe Zone Z';
  placeSafeZone({ lat: 28.6460, lng: 77.1980 });
  const placed = state.zones[state.zones.length - 1];
  check('admin: safe zone placed with the typed label', placed.kind === 'safe' && placed.name === 'Safe Zone Z', placed.name);
  check('admin: safe marker added to the map', document.querySelectorAll('.safe-pin').length === safes + 1,
    document.querySelectorAll('.safe-pin').length);
  check('admin: label field cleared after placing', $('safeLabel').value === '');
  check('persistence: localStorage holds a matching FeatureCollection', (function () {
    const raw = readStorage(STORAGE_KEY);
    if (!raw) return false;
    try {
      const parsed = JSON.parse(raw);
      return parsed.type === 'FeatureCollection' && parsed.features.length === state.zones.length;
    } catch (e) { return false; }
  })());

  const fc = zonesToFeatureCollection();
  const dangerFeature = fc.features.filter(function (f) { return f.properties.kind === 'danger'; })[0];
  const safeFeature = fc.features.filter(function (f) { return f.properties.kind === 'safe'; })[0];
  const ring = dangerFeature.geometry.coordinates[0];
  check('GeoJSON: FeatureCollection covering every zone',
    fc.type === 'FeatureCollection' && fc.features.length === state.zones.length);
  check('GeoJSON: danger geometry is a Polygon', dangerFeature.geometry.type === 'Polygon');
  check('GeoJSON: safe geometry is a Point', safeFeature.geometry.type === 'Point');
  check('GeoJSON: coordinates written as RFC 7946 [lng, lat]',
    Math.abs(ring[0][0]) > 50 && Math.abs(ring[0][1]) < 50, ring[0].join(','));
  check('GeoJSON: polygon ring is closed',
    ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]);
  const roundTrip = featureToZone(dangerFeature);
  check('GeoJSON: round-trip keeps every vertex', roundTrip.vertices.length === ring.length - 1,
    roundTrip.vertices.length + ' vs ' + (ring.length - 1));
  check('GeoJSON: round-trip keeps coordinates within 1 m',
    haversineMeters(roundTrip.vertices[0], drawn.vertices[0]) < 1);
  check('GeoJSON: round-trip keeps kind + name',
    roundTrip.kind === 'danger' && roundTrip.name === dangerFeature.properties.name);
  const safeTrip = featureToZone(safeFeature);
  check('GeoJSON: safe point round-trips', safeTrip.kind === 'safe' && !!safeTrip.vertices[0]);
  check('import: parseZonePayload accepts a FeatureCollection', parseZonePayload(fc).length === state.zones.length,
    parseZonePayload(fc).length);

  deleteZone(drawn.id);
  check('admin: deleting a zone updates state', state.zones.length === before + 1, state.zones.length);
  check('admin: deleting a zone redraws the polygons', document.querySelectorAll('path.dz-poly').length === dangers);
  deleteZone(placed.id);
  check('admin: storage returns to the starting set', state.zones.length === before, state.zones.length);

  setMode(modeBefore);
  check('mode: restored to "' + modeBefore + '"', state.mode === modeBefore, state.mode);
  if (modeBefore !== 'admin') check('user mode: admin panel hidden again', $('adminPanel').hidden === true);
  return out;
}

/* ------------------- report + boot sequence ---------------------------- */
function finishSelfTest() {
  if (state.selfTestDone) return;
  state.selfTestDone = true;

  let all = [];
  function suite(label, fn) {
    try { all = all.concat(fn()); }
    catch (e) { all.push({ name: label + ' threw: ' + (e && e.message ? e.message : e), ok: false, extra: '' }); }
  }
  suite('geometry suite', function () { return runSelfTest().results; });
  suite('scenario suite 1', runScenarioTests);
  suite('scenario suite 2', runScenarioTests2);

  const passed = all.filter(function (r) { return r.ok; }).length;
  const lines = ['EVACROUTE SELFTEST', '===================', ''];
  all.forEach(function (r) {
    lines.push((r.ok ? 'PASS  ' : 'FAIL  ') + r.name + (r.extra ? '   [' + r.extra + ']' : ''));
  });
  lines.push('');
  lines.push('RESULT: ' + passed + '/' + all.length + ' passed');
  if (passed !== all.length) {
    lines.push('FAILURES: ' + all.filter(function (r) { return !r.ok; }).map(function (r) { return r.name; }).join(' ; '));
  }

  const pre = document.createElement('pre');
  pre.id = 'selftest-report';
  pre.textContent = lines.join('\n');
  document.body.appendChild(pre);

  window.__EVACROUTE_SELFTEST__ = {
    total: all.length, passed: passed, failed: all.length - passed,
    failures: all.filter(function (r) { return !r.ok; }).map(function (r) {
      return r.name + (r.extra ? ' — ' + r.extra : '');
    }),
    results: all
  };
  document.title = 'EVACROUTE selftest ' + passed + '/' + all.length;
}

function scheduleSelfTest() {
  if (HAS_PARAM_LOC || START_MODE === 'admin') { setTimeout(finishSelfTest, 450); return; }
  let waited = 0;
  const timer = setInterval(function () {
    waited += 250;
    if (state.user || waited > 3200) {
      clearInterval(timer);
      if (!state.user) hideBoot();
      finishSelfTest();
    }
  }, 250);
}
