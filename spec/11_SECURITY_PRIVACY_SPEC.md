# Security & Privacy Spec

## Local-first
- No network calls required after assets installed.
- No telemetry in MVP.
- Documents stored locally (IndexedDB). Provide "Delete document" action.

## Content handling
- Treat imported text as sensitive. Do not send off-device.

## Service Worker
- Cache only static assets and voice models.
- Ensure proper cache versioning to avoid stale runtime incompatibilities.
