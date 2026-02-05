# Spirtz Voice Context for AI

## Project Overview

**Spirtz Voice** is an offline-first web application that provides a reading experience synchronized with Text-to-Speech (TTS). It focuses on:

- **Exact Synchronization**: Aligning visual tokens (words/chunks) exactly with the audio output.
- **RSVP Reading**: Rapid Serial Visual Presentation for speed reading.
- **Offline Capability**: Fully functional without internet connection using PWA standards and Client-side TTS (Piper WASM / Web Speech API).

## Technical Architecture

- **Frameworkless**: Built with **Vanilla TypeScript** on **Vite**. No heavy UI frameworks (React, Vue, etc.) – direct DOM manipulation for performance and control.
- **State Management**: Custom event-driven architecture.
- **Data Persistence**: **Dexie.js** (IndexedDB wrapper) for storing library texts, settings, and reading progress.
- **Audio**: **Web Audio API** for scheduling and synchronization. **Piper WASM** for high-quality local TTS.

## Key Directories (Map)

- **`spec/`**: *Source of Truth*. Detailed specifications for all modules.
  - `00_README.md`: Architecture overview.
  - `types.ts` & `events.ts`: Core interfaces and domain events.
- **`src/domain/`**: Pure business logic (Text parsing, Planning, Timeline generation).
- **`src/audio/`**: Audio scheduling, playback control context.
- **`src/ui/`**: Visual components (`ReaderShell`, `RSVPView`, etc.).
- **`src/workers/`**: Web Workers for heavy compute (TTS generation) to keep the main thread smooth.
- **`src/storage/`**: Database schema and access patterns.

## Development Patterns

1. **Audio Clock is King**: The `AudioContext.currentTime` is the single source of truth for "where we are" in the timeline. The UI reacts to the audio clock, not the other way around.
2. **Strategy Pattern**: Different TTS strategies (Token-based vs Chunk-based) and View modes (RSVP vs Paragraph) are interchangeable strategies.
3. **No Framework**: Do not introduce React/Vue. Use native web APIs and the existing component patterns in `src/ui`.

## Workflow

- **Tasks**: Check `2do.md` for the current backlog and active tasks.
- **Testing**:
  - `vitest` for unit and integration testing. `npm test`.
  - `playwright` for visual regression/E2E. `npx playwright test`.

## Current Focus

Refer to `2do.md` for the latest "High Priority" items.
