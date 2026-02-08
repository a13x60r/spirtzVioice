# Offline-first Reader with Exact Text↔Voice Sync — Spec Package

## Objective

Build a web offline-first reader app that supports:

- Exact sync between spoken voice audio and displayed "current token"
- Two display modes: RSVP and Paragraph highlight (instant switching)
- Two synthesis strategies: TOKEN and CHUNK (runtime switching)
- Content import via direct text entry, file upload, or **Web Clipper bookmarklet**
- Runs in contemporary Android, iOS, and Windows browsers

## Key invariants

1. Audio clock is the single source of truth: Web Audio API AudioContext time.
2. UI mode switching MUST NOT restart audio; it is a pure presentation change.
3. Strategy switching (TOKEN↔CHUNK) MUST preserve reading position (token index), achieved by pausing, rebuilding plan, and resuming from same token.
4. Offline-first: after first install, app loads and functions without network.

## Implementation constraints

- Use a Web Worker for TTS synthesis.
- Use IndexedDB for documents, settings, audio cache, and plan/timeline metadata.
- Use a Service Worker for caching app shell + voice models + runtime assets.

## Deliverables expected from implementation

- PWA installable
- Functional playback with seek/pause/resume
- Instant mode switch RSVP↔Paragraph
- Strategy switch TOKEN↔CHUNK with position preservation
- Cache management and quota-aware eviction
