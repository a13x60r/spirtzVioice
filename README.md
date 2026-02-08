# Spirtz Voice

An offline-first reader app with exact text-to-speech synchronization supporting RSVP, Focus, and Paragraph display modes.

## Features

- ✨ **Exact Text↔Voice Sync**: Audio clock drives precise token highlighting
- 📖 **Three Display Modes**: RSVP (single token), Focus (chunked phrases), and Paragraph (full text) with instant switching
- 🧭 **Orientation Layer**: Ghost context lines, structural progress (chapter/section), and panic exit to paging for precise jumps
- 🎯 **Two Synthesis Strategies**: TOKEN (per-word) and CHUNK (multi-word) with runtime switching
- 📱 **Offline-First PWA**: Works completely offline after initial install with service worker caching
- 🎨 **Comfort Controls**: Calm theme, typography controls, and ORP intensity toggle for RSVP + Focus
- ⚡ **Web Worker TTS**: Non-blocking synthesis for smooth UI
- 🔊 **Enhanced Controls**: WPM presets, numeric input, rewind granularity, and direct view buttons
- ⌨️ **Keyboard Shortcuts**: Playback, chunk/sentence navigation, and help overlay
- 📝 **Study Affordances**: Highlight buffer, sentence notes, and one-click copy/cite with notes sidebar
- 🌍 **Language Aware**: Library flags, localized welcome docs, and language-based voice selection
- ⚠️ **Voice Install Alerts**: Clear prompts when a voice needs downloading
- ✂️ **Web Clipper**: Bookmarklet to import selected text or full pages from any website in one click
- ℹ️ **Info & Help**: Dedicated modal for keyboard shortcuts, about info, and clipper setup

## Quick Start

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Testing

```bash
# Run unit tests
npm test

# Run tests with coverage
npm run test:coverage
```

### End-to-End Testing (Visual)

```bash
# Run visual regression tests
npx playwright test visual-regression.spec.ts

# Update baseline screenshots
npx playwright test visual-regression.spec.ts --update-snapshots
```

## Architecture

See [spec/00_README.md](./spec/00_README.md) for detailed architecture documentation.

### Core Layers

1. **UI Layer**: ReaderShell, RSVPView, FocusView, ParagraphView
2. **Domain Layer**: TextPipeline, PlanEngine, TimelineEngine
3. **Audio Layer**: TTSEngine (Worker), AudioScheduler, PlaybackController
4. **Storage Layer**: IndexedDB for documents, settings, audio cache

## Key Invariants

1. **Audio Clock**: Web Audio API AudioContext time is single source of truth
2. **Mode Switching**: UI mode changes MUST NOT restart audio
3. **Strategy Switching**: Preserves reading position (token index)
4. **Offline-First**: App functions without network after install

## Development

### Project Structure

```text
spirtz-voice/
├── spec/              # Complete specifications
├── src/
├── domain/        # Core business logic
├── audio/         # Audio scheduling & playback
├── storage/       # IndexedDB persistence
├── ui/            # UI components
├── workers/       # Web Workers (TTS)
└── main.ts        # Entry point
├── public/            # Static assets
└── dist/              # Build output
```

### Technology Stack

- **TypeScript**: Type-safe development
- **Vite**: Fast build tooling with HMR
- **Dexie.js**: IndexedDB wrapper
- **Web Audio API**: Precise audio scheduling
- **Web Speech API**: Offline TTS (MVP)
- **Workbox**: Service Worker & PWA support

## Browser Support

- Chrome/Edge 90+ (Windows, Android)
- Safari 14.5+ (iOS, macOS)

## License

MIT
