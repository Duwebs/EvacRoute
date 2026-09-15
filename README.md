# EvacRoute

**EVACROUTE** — real-time disaster evacuation guidance, now split across **separate files**
(no more single monolithic `index.html`).
An admin marks danger zones on the map; users get their live position, a danger/safe verdict, the
nearest safe zone, the compass heading and an animated route to it.

No build step, no package manager, no server code — Leaflet 1.9.4 (CDN) + OpenStreetMap tiles.

## Project structure

```
EvacRoute/
├── index.html            markup only: DOM + <script>/<link> includes (load order matters)
├── css/
│   └── styles.css        all styling (dark glass UI, Leaflet theming, keyframes)
└── js/
    ├── errors.js         early error capture (must load first)
    ├── utils.js          helpers: $, geometry math, formatting, toast()
    ├── config.js         URL params, storage keys, demo dataset, layer styles
    ├── state.js          single shared `state` object
    ├── alert.js          danger-zone emergency siren (Web Audio, EAS-style two-tone)
    ├── storage.js        localStorage persistence + GeoJSON parse/serialise + demo seeding
    ├── zones.js          zone CRUD + GeoJSON export/import
    ├── map.js            Leaflet init, zone/route rendering, admin list UI, mode switching
    ├── draw.js           admin draw/place tools + keyboard shortcuts
    ├── user.js           GPS flow, live tracking, status panel, GPS-fallback modal
    ├── ui.js             button/event wiring
    ├── selftest.js       ?selftest=1 assertion suites + report
    └── boot.js           boot() + init() entry point (loads last)
```

The modules are plain (non-module) scripts that share top-level declarations; `js/utils.js`
must load before `js/config.js`, and `js/config.js` before `js/state.js` — the order in
`index.html` already takes care of this.

## Run it

```bash
# from this folder — a local origin is required for GPS
python -m http.server 8000
# then open http://localhost:8000/
```

> Browsers only expose `navigator.geolocation` on **`https://`** or **`localhost`**. Opening
> `index.html` directly as `file://` blocks GPS — the app detects this and offers manual
> coordinates or a demo location instead.

Map tiles need an internet connection (OpenStreetMap); everything else works offline.

## Using the app

**User view (default)**
1. Allow location access (or enter coordinates / use the demo location in the fallback dialog).
2. The top card shows the verdict — **DANGER** (red, pulsing) or **SAFE** (green) — plus
   `Nearest safe zone: <name> — <distance> away`, the heading (`Head NORTH-WEST`), the rotating
   compass arrow, your coordinates/accuracy and the active zone counts.
3. When a route is available, **🧭 Open route in Google Maps** opens walking directions.
   Position updates live via `watchPosition`; entering or leaving a danger zone raises a toast.
   Entering a danger zone also sounds a government-style emergency siren (EAS-like two-tone,
   synthesised in `js/alert.js` — no audio file) plus a strong vibration pattern; it repeats
   every 30 s while the user remains inside. Mobile browsers require one tap on the page
   before audio can play, so the app unlocks audio on the first touch automatically.
   While inside a danger zone the screen is also kept awake (Screen Wake Lock API, where
   supported) so a dimming display never hides the guidance.

**Admin view** (hidden from normal users — open `/admin` on either domain —
`https://evacrouteweb.vercel.app/admin` or `https://evac-route.vercel.app/admin` (or `?mode=admin`)
— and enter the admin passcode, default `1234`, set in `js/config.js` → `ADMIN_PASSCODE`; there is
no admin button in the UI. The `/admin` path is served via the rewrite in `vercel.json`, so it
works on any domain the app is deployed to.)
- **＋ Draw danger zone** → tap the map to add corners (dashed live preview + rubber band),
  then **✓ Finish polygon**. Names are auto-assigned (`Danger Zone 1`, `Danger Zone 2`, …).
- **＋ Place safe zone** → type an optional label, then tap the map. The label is cleared after
  each placement so you can drop several; unnamed zones become `Safe Zone A`, `Safe Zone B`, …
- **Zone list** — every zone with 🎯 zoom, ✎ rename and 🗑 delete.
- **⬇ Export zones (JSON)** / **⬆ Import JSON** — GeoJSON `FeatureCollection`
  (`Polygon` = danger, `Point` = safe), RFC 7946 coordinate order `[lng, lat]`.
  Imports accept GeoJSON or the older internal array shape, and coordinates in either order.
- **🎯 Fit all zones**, **🗑 Clear all zones**.
- The panel **auto-compacts while a tool is active** (draw / place safe): zone list, counts and
  export rows fold away so the map gets the screen — the Finish / Undo / Cancel buttons and the
  hint stay visible (double-tap the map also finishes a polygon). It expands again when the tool
  ends. The **▾** button in the header minimises/expands the panel manually; a mini status
  (`✏️ 3 corners`, `✚ tap map → safe zone`) shows in the header during compaction.

**Keyboard shortcuts (admin)**

| Key | Action |
| --- | --- |
| `Enter` | finish the polygon being drawn (needs 3+ corners) |
| `Backspace` / `Z` | undo the last corner |
| `Esc` | cancel drawing → leave safe-zone mode → close the GPS dialog → close a popup |

## URL parameters

| Parameter | Effect |
| --- | --- |
| `?mode=admin` | start directly in admin view |
| `?selftest=1` | run the built-in assertion suite and print a PASS/FAIL report |
| `?lat=<lat>&lng=<lng>` | start at these coordinates, skipping GPS |
| `?empty=1` | do not seed the demo zones |
| `?reset=1` | wipe stored zones (then seed again unless `empty=1`) |

Example: `http://localhost:8000/?mode=admin&reset=1`

## Self-test

```bash
python -m http.server 8000
# open http://localhost:8000/?selftest=1
```

The page runs its own suite (ray-casting containment, haversine distance, bearings/compass,
distance formatting, GeoJSON round-trips, DOM wiring, plus danger/safe/admin scenario tests) and
renders a `PASS`/`FAIL` report, sets the title to `EVACROUTE selftest <passed>/<total>` and exposes
`window.__EVACROUTE_SELFTEST__` for inspection.

## Implementation notes

- **State & data**: zones are normalised to
  `{ id, kind:'danger'|'safe', name, vertices:[[lat,lng]…], createdAt }`.
  Persisted in `localStorage` under `evacroute.zones.v1` (view position: `evacroute.view.v2`,
  demo-seeded flag: `evacroute.seeded.v1`).
- **Containment** uses an odd/even ray-casting test on `[lat, lng]` pairs; distances are haversine
  metres, so the app never needs a routing/geometry service.
- **Demo dataset** (3 danger + 2 safe zones around Connaught Place, New Delhi) is seeded on first
  run so the danger/safe scenarios are reproducible. Append `?reset=1` to restore it.
- **Bootstrap safety**: an early script block records uncaught errors and unhandled rejections
  (`window.__EVACROUTE_ERRORS__`, plus a hidden `#js-error` node), and `init()` reports boot
  failures in a toast instead of failing silently.
- **Panic-friendly / device-friendly UI**: `css/styles.css` ends with a dedicated responsive
  section — larger touch targets, louder status text, a flashing danger banner and a pulsing
  route button on phones, a compact landscape layout, tablet/desktop sizing, and no accidental
  zooms (`touch-action: manipulation`, 16px inputs, `user-select` guards).
- Debugging hooks: `window.__EVACROUTE_STATE__`, `window.__EVACROUTE_ERRORS__`,
  `window.__EVACROUTE_SELFTEST__`.