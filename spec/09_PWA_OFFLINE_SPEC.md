# PWA Offline Spec

## Service Worker strategies
1. Precache (install):
   - app shell: index.html, main JS/CSS, icons, manifest
   - WASM/ONNX runtime assets
2. Runtime cache:
   - voice model assets (cache-first)
   - chunk fetches not used (audio is in IDB)

## Update strategy
- Stale-while-revalidate for app shell (optional)
- Versioned cache names: "app-vX", "voices-vY"

## iOS considerations
- Must handle AudioContext resume on user gesture.
- Storage may be purged by OS; app should detect missing assets and re-download when online.

## Manifest
- display: standalone
- start_url: /
- scope: /
- icons: required sizes
