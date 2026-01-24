# Spirtz Voice - Codex Guidance

## Purpose
This document orients GPT-5.2 Codex (and similar assistants) to the Spirtz Voice repo.
Keep responses concise, high-signal, and consistent with existing specs.

## Project Overview (Short)
- Offline-first reader app with exact text-to-speech sync.
- Two display modes: RSVP (single token) and Paragraph highlighting.
- Two synthesis strategies: TOKEN and CHUNK, switchable at runtime.

## Key Invariants (Non-Negotiable)
1. Audio clock is the single source of truth: Web Audio API AudioContext time.
2. UI mode switching MUST NOT restart audio; it is purely presentational.
3. Strategy switching MUST preserve reading position (token index).
4. Offline-first after install; avoid network reliance for core flows.

## Architecture Pointers
- Source of truth specs live in `spec/` (start at `spec/00_README.md`).
- Domain logic: `src/domain/`.
- Audio scheduling and playback: `src/audio/`.
- UI components: `src/ui/` (no frameworks).
- Workers: `src/workers/` (TTS generation).
- Storage: `src/storage/` (Dexie/IndexedDB).

## Codex Operating Guidelines
- Prefer minimal, localized changes that follow existing patterns.
- Do not introduce UI frameworks (React/Vue/etc.).
- Event-driven architecture: UI dispatches events; logic consumes events.
- Audio scheduling must use AudioScheduler; avoid setTimeout for sync.
- Keep UI updates targeted; avoid full re-renders when a small update suffices.
- Use ASCII in new files unless a file already uses Unicode.
- Use separate git branches per task when making changes.

## Development Workflow
- Backlog and priorities: `2do.md`.
- Tests: `npm test` (Vitest).
- Dev server: `npm run dev`.
- Build: `npm run build`.

## When in Doubt
- Check `GEMINI.md` for AI-specific context and style.
- Check `SKILLS.md` for canonical patterns and workflows.
- Check `spec/` for behavioral requirements before changing logic.
