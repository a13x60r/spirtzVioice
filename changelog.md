# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Mobile UI**:
    - Full mobile responsiveness with `100dvh` layout.
    - Touch-optimized controls (min 44px target).
    - Adaptive RSVP font sizes for smaller screens.
    - Improved header and controls layout for mobile devices.

### Fixed
- Fixed `AudioCacheStore` iteration bug preventing efficient cache cleanup.
- Resolved visual overlaps in Controls component on small screens.

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

