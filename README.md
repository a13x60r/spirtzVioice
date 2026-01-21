# Spirtz Voice

An offline-first reader app with exact text-to-speech synchronization supporting RSVP and Paragraph display modes.

## Features

- ✨ **Exact Text↔Voice Sync**: Audio clock drives precise token highlighting
- 📖 **Dual Display Modes**: RSVP (single token) and Paragraph (full text) with instant switching
- 🎯 **Two Synthesis Strategies**: TOKEN (per-word) and CHUNK (multi-word) with runtime switching
- 📱 **Offline-First PWA**: Works completely offline after initial install
- 🎨 **Modern UI**: Responsive design with dark mode support
- ⚡ **Web Worker TTS**: Non-blocking synthesis for smooth UI

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

## Architecture

See [spec/00_README.md](./spec/00_README.md) for detailed architecture documentation.

### Core Layers

1. **UI Layer**: ReaderShell, RSVPView, ParagraphView
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

```
spirtz-voice/
├── spec/              # Complete specifications
├── src/
│   ├── domain/        # Core business logic
│   ├── audio/         # Audio scheduling & playback
│   ├── storage/       # IndexedDB persistence
│   ├── ui/            # UI components
│   ├── workers/       # Web Workers (TTS)
│   └── main.ts        # Entry point
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
