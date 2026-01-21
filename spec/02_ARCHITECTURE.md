# Architecture

## Layers
1. UI Layer
   - ReaderShell (controls, toggles, status)
   - RSVPView
   - ParagraphView

2. Domain Layer
   - TextPipeline: normalize + tokenize
   - PlanEngine: RenderPlan generation
   - TimelineEngine: token-level timing

3. Speech & Audio Layer
   - TTSEngine (Worker): offline TTS -> PCM
   - AudioScheduler: schedules AudioBuffers on AudioContext timeline
   - PlaybackCursor: derives current token from AudioContext time

4. Offline & Storage
   - Service Worker: app shell + assets + models
   - IndexedDB: documents, settings, audio cache, plan/timeline metadata
   - Cache eviction policy (LRU + quota aware)

## Core "truth" model
- AudioContext time drives playback; cursor is derived from time against Timeline.
- Timeline is a token-level array of [tStart,tEnd] in seconds relative to playback start t0.

## Two strategy modes
- TOKEN: generate audio per token; timeline boundaries come directly from per-token durations.
- CHUNK: generate audio per chunk of N tokens; timeline boundaries are computed by distributing chunk duration across contained tokens deterministically.

## Mode switching
- RSVP vs Paragraph is pure rendering switch; no changes to audio graph.

## Strategy switching
- Pause -> build new RenderPlan -> ensure minimal audio available -> seek to same token index -> resume.
