/* ==========================================================================
   EVACROUTE — js/config.js
   URL parameters, storage keys, map bounds, demo dataset and layer styles.
   ========================================================================== */
'use strict';

const params = new URLSearchParams(window.location.search);
/* Admin access gate: the panel is not exposed to normal users. Admins open
   the app with ?mode=admin OR the /admin path (Vercel rewrites it) and must
   enter this passcode (change it here). */
const ADMIN_PASSCODE = '1234';
const ADMIN_PATH     = '/admin';   // URL path that opens the admin panel
const IS_ADMIN_PATH  = window.location.pathname.replace(/\/+$/, '') === ADMIN_PATH;
const START_MODE    = ((params.get('mode') || '').toLowerCase() === 'admin' || IS_ADMIN_PATH) ? 'admin' : 'user';
const START_EMPTY   = params.get('empty') === '1';     // skip demo seeding
const RESET_STORAGE = params.get('reset') === '1';     // wipe storage, then seed
const RUN_SELFTEST  = params.get('selftest') === '1';  // render assertion report
const PARAM_LAT     = Number.parseFloat(params.get('lat'));
const PARAM_LNG     = Number.parseFloat(params.get('lng'));
const HAS_PARAM_LOC = isFiniteLatLng(PARAM_LAT, PARAM_LNG);

const STORAGE_KEY   = 'evacroute.zones.v1';
const SEED_FLAG_KEY = 'evacroute.seeded.v1';
const VIEW_KEY      = 'evacroute.view.v2';

const MIN_ZOOM = 10;
const MAX_ZOOM = 18;
const FALLBACK_CENTER = [28.6315, 77.2197];   // Connaught Place, New Delhi
const FALLBACK_ZOOM   = 13;
const DEMO_LOCATION   = { lat: 28.6330, lng: 77.2140 };  // inside "Danger Zone 1"
const SAFE_TEST_POINT = { lat: 28.6100, lng: 77.2500 };  // outside every demo zone

/* Demo dataset: 3 danger zones + 2 safe zones around Connaught Place,
   positioned so the demo location reproduces the reference UX copy exactly
   (nearest "Safe Zone A", 1.2 km away, heading NORTH-WEST). */
const DEMO_ZONES = [
  { kind:'danger', name:'Danger Zone 1', vertices:[[28.6352,77.2102],[28.6358,77.2178],[28.6312,77.2186],[28.6306,77.2108]] },
  { kind:'danger', name:'Danger Zone 2', vertices:[[28.6270,77.2240],[28.6274,77.2320],[28.6230,77.2326],[28.6224,77.2246]] },
  { kind:'danger', name:'Danger Zone 3', vertices:[[28.6420,77.2310],[28.6424,77.2392],[28.6380,77.2398],[28.6374,77.2318]] },
  { kind:'safe',   name:'Safe Zone A',   vertices:[[28.6407,77.2053]] },
  { kind:'safe',   name:'Safe Zone B',   vertices:[[28.6200,77.2350]] }
];

const DANGER_STYLE = { color:'#ff3b30', weight:2, opacity:1, fillColor:'#ff3b30', fillOpacity:0.4, className:'dz-poly' };
const DANGER_ALERT_STYLE = { color:'#ff0d0d', weight:4, opacity:1, fillColor:'#ff2d2d', fillOpacity:0.5 };
const ROUTE_STYLE = { color:'#3b9dff', weight:5, opacity:0.95, dashArray:'12 10', className:'route-dash', lineCap:'round' };
/* live drawing preview (admin): dashed guide polygon, rubber band, vertex dots */
const DRAW_GUIDE_STYLE  = { color:'#ff3b30', weight:2, opacity:0.9, dashArray:'6 6', fillColor:'#ff3b30', fillOpacity:0.18 };
const DRAW_RUBBER_STYLE = { color:'#ffd166', weight:2, opacity:0.95, dashArray:'4 6' };
const VERTEX_STYLE      = { radius:6, color:'#ffffff', weight:2, fillColor:'#ff3b30', fillOpacity:1 };
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const REQUIRED_IDS = ['map','uiLayer','topWrap','bottomPanel','topPanel','statusBadge','statusLine',
  'routeSummary','dirArrow','dirText','dirDeg','coordsLine','adminPanel','zoneCounts','btnDrawDanger',
  'btnPlaceSafe','safeLabel','drawState','drawActions','btnFinishPoly','btnUndoVertex','btnCancelDraw',
  'btnExport','btnImport','btnFitZones','btnClearAll','adminList','importFile','toastHost','btnLocate',
  'btnMaps','geoModal','geoModalMsg','manualLat','manualLng','btnUseManual','btnUseDemo',
  'btnRetryGeo','boot','bootMsg','bootSub2','btnHideAdmin'];
