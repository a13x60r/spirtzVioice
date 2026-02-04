# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security

- Conducted comprehensive security audit.
- Fixed **Critical Stored XSS** vulnerability in `ParagraphView.ts` by implementing `dompurify` sanitization for all rendered content.

### Fixed

- Fixed build error in `InstallPrompt.ts` (type mismatch for `beforeinstallprompt` event handling).

### Fixed (Previous)

- **TTS Synchronization**:
  - Implemented character-weighted duration distribution for precise word-level timing.
  - Resolved cumulative clock drift by synchronizing timeline with audio buffer boundaries.
  - Added 25ms hardware latency compensation fallback for smoother audio-visual sync.
  - Included punctuation and whitespace in timing distribution to maintain natural rhythm.
- **Audio Quality**:
  - Switched default strategy to `CHUNK` (8-word segments) for better neural prosody.
  - Preserved prosody-relevant punctuation in TTS input for natural intonation and pauses.
  - Unified sample rate handling in decoder to reduce resorption artifacts.

### Changed

- **Defaults**:
  - Set default TTS strategy to `CHUNK` with a default size of 8 tokens.

### Added

- **PWA Share Target**:
  - Added `share_target` configuration to `vite.config.ts` to allow receiving shared text/URLs from other apps.
  - Implemented handling of shared content in `ReaderShell` on startup.

### Fixed (Previous)

- Fixed `AudioCacheStore` iteration bug preventing efficient cache cleanup.
- Resolved visual overlaps in Controls component on small screens.
- Fixed settings panel responsiveness: added max-height and scrolling for small screens.
- Fixed visibility of "Start Reading" button on mobile by enabling scrolling in "New Document" view.
- **Controls Visibility**:
  - Auto-collapse controls when not in reading mode (Library/New Document).
  - Ensure controls remain visible when paused during active reading sessions.
- **TTS Engine**:
  - Fixed Piper TTS hang in non-cross-origin-isolated environments by forcing single-threaded mode.
- Fixed `#toggle-speed` button visibility issue on mobile by increasing container `max-height`.

### Added (Previous)

- **Language Support**:
  - Automatic language detection for imported texts.
  - Manual language selection in settings.
  - Voice selection in settings.
- **UI/UX**:
  - Responsive layout leveraging the whole screen.
  - Dark mode support.
  - Text size control.
  - Optimal Recognition Point (ORP) display for RSVP reading.
  - Rendered Markdown and HTML preview in text view.
  - Volume audio level control.
  - Abort button for "Synthesizing chunk" state.
  - Icons replacing text buttons for cleaner UI.
- **Library Management**:
  - Multi-file upload support.
  - Import support for `.html`, `.md`, and `.txt` files.
  - Overview of stored texts.
  - Bulk delete functionality in Library.
  - Persistence of settings (Speed, Voice, Mode) per individual text.
- **Controls**:
  - Multimedia keyboard support (Play/Pause, Seek).
  - Keyboard shortcuts.

### Fixed (Previous)

- Critical TTS warm-up freeze (Worker path resolution).
- Play/Pause button responsiveness.
- Reading progress bar accuracy.
- Library progress bar display.
- Separation of WPM and playback speed settings.
- `manifest.webmanifest` syntax error.

### Infrastructure

- GitHub Pages deployment action.
- PWA offline capability verification.
