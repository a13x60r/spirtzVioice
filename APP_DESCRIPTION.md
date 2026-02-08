# Spirtz Voice

**Spirtz Voice** is an offline-first web application designed to provide a high-performance reading experience by synchronizing text with synthesized speech (TTS). It combines **RSVP (Rapid Serial Visual Presentation)** technology with exact audio alignment to help users read faster and retain information better.

## Key Features

* **Exact Synchronization**: The visual text (words or chunks) is perfectly aligned with the audio output, highlighting exactly what is being spoken in real-time.
* **RSVP Reading**: Uses the "Rapid Serial Visual Presentation" method (flashing words one by one) to minimize eye movement and increase reading speed.
* **Offline-First**: Built as a Progressive Web App (PWA). It works entirely offline using client-side technologies.
* **High-Quality Local TTS**: Utilizes **Piper WASM** for high-quality, neural network-based text-to-speech that runs directly in the browser (no server required), with a fallback to the Web Speech API.
* **Web Clipper**: Includes a specialized bookmarklet that allows users to "clip" selected text or entire articles from any website directly into Spirtz Voice.
* **Library Management**: Users can import texts, which are stored locally using **Dexie.js** (IndexedDB wrapper).

## Technical Stack

* **Frameworkless**: Built with **Vanilla TypeScript** and **Vite** for maximum performance and zero framework overhead (no React, Vue, etc.).
* **Architecture**:
  * **Event-Driven**: Custom event bus manages state and communication between components.
  * **Audio Clock is King**: The `AudioContext.currentTime` is the single source of truth; the UI updates reactively to the audio playback position, ensuring drift-free sync.
* **Storage**: **Dexie.js** handles persistent storage for books, settings, and reading progress.
* **Web Workers**: Heavy computations (like TTS audio generation) are offloaded to Web Workers to keep the main UI thread buttery smooth.

## Core Capabilities

* **Cross-Platform**: Designed to work on mobile and desktop via standard web browsers.
* **Share Target**: Can receive shared text/URLs from other apps (on Android/mobile) to immediately start reading.
* **Customizable**: Supports different reading strategies (Token-based vs. Chunk-based) and view modes.

In short, it is a **fast, private, and powerful tool for speed-reading with your ears and eyes simultaneously.**
