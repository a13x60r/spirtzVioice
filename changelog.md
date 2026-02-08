# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Info & Help Modal**: Dedicated modal for keyboard shortcuts, about information, and Web Clipper setup.
- **Web Clipper**: Dynamically generated bookmarklet for one-click content import from any website.
- Language flags in the library and localized welcome documents (German/Russian).
- Voice install warning with download action and clearer messaging.
- **Documentation Overhaul**: Comprehensive update to `README.md` with visual badges, Mermaid architecture diagrams, Reading Science section (RSVP/ORP), and expanded roadmap.

### Fixed

- **README**: Corrected Mermaid diagram syntax by quoting node labels and edge text, preventing parsing errors in various Markdown renderers.
- **Test Infrastructure**:
  - Resolved `ParagraphView` test failures by providing mandatory `ttsText` arguments.
  - Optimized Vitest configuration to explicitly exclude Playwright E2E tests, avoiding cross-environment conflicts.
  - Corrected Vitest path aliases to ensure consistent module resolution during tests.
  - Updated visual regression snapshots for consistent E2E baseline.

### Changed

- Moved Web Clipper functionality from Settings panel to the new Info & Help modal to declutter the UI.

### Fixed

- Resolved duplicate imports and event listener scoping issues in `ReaderShell.ts`.
- **End-to-End Testing**:
  - Implemented Playwright test infrastructure for reliable release verification.
  - Added **Visual Regression Tests** covering Library, Reader (all modes), and Settings UI.
  - Added documentation for running E2E tests and updating snapshots.

### Fixed

- Language-specific chunking rules for better non-English alignment.
- Voice matching now respects base language and forces resynthesis after downloads.

### Security

- Conducted comprehensive security audit.
- Fixed **Critical Stored XSS** vulnerability in `ParagraphView.ts` by implementing `dompurify` sanitization for all rendered content.

### Fixed

- Fixed build errors in `ReaderShell.ts`:
  - Resolved `InstallPrompt` naming conflict by renaming to `AppInstaller`.
  - Added explicit type for `available` parameter to fix implicit `any` error.
  - Fixed constructor argument mismatch and missing property errors in `ReaderShell`.

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
