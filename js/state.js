/* ==========================================================================
   EVACROUTE — js/state.js
   Single shared application state object.
   ========================================================================== */
'use strict';

const state = {
  mode: START_MODE,
  zones: [],              // [{id, kind:'danger'|'safe', name, vertices:[[lat,lng]...], createdAt}]
  user: null,             // {lat, lng, accuracy, source}
  inside: [],             // danger zones containing the user
  nearest: null,          // {zone, distance, bearing}
  watchId: null,
  locating: false,
  storageOk: true,
  bootHidden: false,
  seededDemo: false,
  map: null,
  tileLayer: null,
  tileErrorShown: false,
  userMarker: null,
  routeLine: null,
  routeEnd: null,
  lastEval: 0,
  lastDangerAlert: 0,
  lastFitKey: '',
  layers: { danger: new Map(), safe: new Map() },
  drawing: { active: false, points: [], vertexLayers: [], guide: null, rubber: null },
  placingSafe: false,
  selfTestDone: false
};

window.__EVACROUTE_STATE__ = state;   // handy for debugging / tests
