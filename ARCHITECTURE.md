# Architecture

## Overview
- Spirtz Voice is an offline-first, client-side reader with precise TTS-to-text synchronization across RSVP, Focus, and Paragraph views.
- The app is a Vite PWA that stores documents, settings, and audio in IndexedDB and synthesizes audio in a Web Worker.

## Tech Stack
- Language: TypeScript (`src/`)
- Build: Vite (`vite.config.ts`)
- PWA: vite-plugin-pwa + Workbox (`vite.config.ts`)
- Storage: IndexedDB via Dexie (`src/storage/Database.ts`)
- Audio: Web Audio API + Piper WASM (worker) (`src/audio`, `src/workers`)
- Tests: Vitest + Playwright (`vitest.config.ts`, `playwright.config.ts`)

## Directory Structure
```
src/
  audio/            Audio scheduling, playback, and synthesis orchestration
  domain/           Tokenization, plan generation, and timeline construction
  lib/              Text segmentation, structure mapping, timing utilities
  storage/          IndexedDB schema and data access stores
  ui/               UI shell, components, and reading views
  utils/            Seeding and helper utilities
  workers/          TTS worker and Piper WASM integration
spec/               Shared types
tests/e2e/           Playwright end-to-end tests
```

## Core Components
- App bootstrap: `src/main.ts` creates `ReaderShell` and registers the PWA service worker.
- UI shell: `src/ui/ReaderShell.ts` owns app state, components, and view switching.
- Audio pipeline: `src/audio/AudioEngine.ts` generates plans, loads voices, synthesizes chunks, and schedules playback.
- Domain pipeline: `src/domain/TextPipeline.ts` -> `src/domain/PlanEngine.ts` -> `src/domain/TimelineEngine.ts`.
- Storage: `src/storage/Database.ts` defines IndexedDB schema; store classes in `src/storage/*` provide CRUD.
- Worker: `src/workers/tts-worker.ts` synthesizes audio chunks via `src/workers/tts/OfflineVoice.ts`.

## Data Flow
- Text ingestion: `TextInput`/import -> `TextPipeline.tokenize` -> document create (`src/ui/components/TextInput.ts`, `src/domain/TextPipeline.ts`, `src/storage/DocumentStore.ts`).
- Plan and audio: tokens + settings -> `PlanEngine.generatePlan` -> TTS worker -> audio chunks cached -> timeline built (`src/domain/PlanEngine.ts`, `src/workers/tts-worker.ts`, `src/audio/AudioEngine.ts`).
- Playback: `AudioScheduler` drives timeline time -> `PlaybackController` updates token index -> views render highlights (`src/audio/AudioScheduler.ts`, `src/audio/PlaybackController.ts`, `src/ui/views/*`).
- Progress and annotations: offsets update -> `Progress` and `AnnotationStore` (`src/ui/components/Progress.ts`, `src/storage/AnnotationStore.ts`).

## External Integrations
- Web Audio API: scheduling and playback (`src/audio/AudioScheduler.ts`).
- Web Worker + Piper WASM: offline TTS synthesis (`src/workers/tts-worker.ts`, `src/workers/tts/OfflineVoice.ts`).
- PWA/Service Worker: offline caching and share target (`vite.config.ts`).
- IndexedDB: Dexie-based storage (`src/storage/Database.ts`).
- Media Session API: playback controls (`src/ui/ReaderShell.ts`).

## Configuration
- Vite config and PWA manifest: `vite.config.ts`.
- TypeScript paths and strictness: `tsconfig.json`.
- Lint rules: `.eslintrc.json`.
- Test configs: `vitest.config.ts`, `playwright.config.ts`.
- Base URL: `VITE_BASE` (defaults to `/spirtzVioice/`) (`vite.config.ts`).

## Build & Deploy
- Install: `npm install`
- Dev server: `npm run dev`
- Type check: `npm run type-check`
- Unit tests: `npm test` (Vitest)
- E2E tests: `npx playwright test` (uses `playwright.config.ts`)
- Build: `npm run build` (TypeScript + Vite)
