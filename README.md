# Spirtz Voice 🎙️📖

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Offline First](https://img.shields.io/badge/Offline--First-enabled-success?style=flat-square)](#-key-features)
[![PWA](https://img.shields.io/badge/PWA-ready-orange?style=flat-square)](#-pwa--offline-capability)
[![Security Audited](https://img.shields.io/badge/Security-Audited-blueviolet?style=flat-square)](#-security--privacy)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg?style=flat-square)](https://github.com/a13x60r/spirtzVioice/graphs/commit-activity)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)

An offline-first reader app with **exact text-to-speech synchronization**. Supporting RSVP, Focus, and Paragraph display modes, Spirtz Voice turns reading into an immersive, auditory-visual experience.

> **Why Spirtz Voice?** Most speed readers separate audio from visual. We treat them as one. By using the high-resolution Web Audio clock to drive the UI, we achieve a level of synchronization where the highlight doesn't just "follow" the voice—it *is* the voice.

---

## 🧠 The Science of Speed Reading

Spirtz Voice isn't just a reader; it's a cognitive performance tool designed for maximum ingestion efficiency.

### RSVP & ORP (Optimal Recognition Point)

**Rapid Serial Visual Presentation (RSVP)** minimizes "saccades"—the jerky eye movements used when scanning lines of text. By centering words at the **Optimal Recognition Point (ORP)**, we leverage your brain's natural ability to recognize words instantly.

- **Visual Anchor**: Look at the highlighted red character. This is the ORP where your brain processes the word fastest.
- **Zero Saccades**: Your eyes stay still; the information flows to you.

### Auditory-Visual Reinforcement

By syncing neural-quality TTS with visual tokens, we create a dual-channel learning effect. This improves:

1. **Comprehension**: Subvocalization is externalized and reinforced.
2. **Retention**: Multi-sensory input creates stronger memory pathways.
3. **Speed**: Use the audio as a "pacer" to safely push your reading speed past 500+ WPM.

---

## ✨ Key Features

### 📖 Immersive Reading Modes

- **RSVP (Rapid Serial Visual Presentation)**: Speed-read one word at a time with **ORP** highlighting.
- **Focus Mode**: Read in chunked phrases for better comprehension at speed. High-quality neural prosody for natural intonation.
- **Paragraph View**: Traditional reading with real-time highlighting synchronized precisely with the audio clock.

### 🔊 Advanced Audio Control

- **Exact Sync**: Character-weighted duration distribution ensures the visual highlight never drifts from the spoken word.
- **25ms Latency Compensation**: Hardware-aware timing for a professional, glitch-free experience.
- **WPM & Speed Controls**: Deep control over reading pace with separate WPM and playback speed settings.
- **Multimedia Support**: Control playback via keyboard shortcuts or system multimedia keys (Play/Pause/Seek).

### 🌐 Smart Content Management

- **Universal Import**: Direct support for `.md`, `.html`, and `.txt` files with bulk upload capability.
- **Web Clipper**: A one-click bookmarklet to import selected text or full pages from any website instantly.
- **Language Aware**: Automatic language detection and dedicated voice selection per document.

---

## 🏗️ Architecture

The **Audio Clock is King**. Everything in Spirtz Voice flows from the high-precision timeline of the Web Audio API.

```mermaid
graph TD
    A[Text Input (.txt, .md, .html)] --> B[TextPipeline]
    B --> C[PlanEngine]
    C --> D[TimelineEngine]
    D --> E[AudioScheduler]
    E --> F[AudioContext Timeline]
    F --> G{UI Synchronizer}
    G --> H[RSVP View]
    G --> I[Focus View]
    G --> J[Paragraph View]
    K[TTSEngine Worker] -- Synth Audio --> E
```

### Core Engine Layers

1. **Audio Layer**: Manages the `AudioContext` timeline, providing the high-resolution pulses that drive the UI.
2. **Domain Layer**: Processes text through a pipeline (`TextPipeline` → `PlanEngine` → `TimelineEngine`) to create a perfectly timed playback schedule.
3. **UI Layer**: Vanilla TypeScript components that react to audio ticks to update views with zero framework overhead.
4. **Storage Layer**: IndexedDB (via Dexie.js) stores documents, individual settings (WPM/Voice per text), and reading progress.

---

## 📱 PWA & Offline Capability

Spirtz Voice is designed to be a permanent part of your device's reading toolkit.

- **Offline-First**: Uses Service Workers (Workbox) to cache the app shell and Piper WASM models.
- **Share Target**: On Android and Windows, you can "Share" text or URLs directly to Spirtz Voice from other apps.
- **Web Clipper**: A specialized bookmarklet helps bypass paywalls and distills web content into clean text for focused reading. Setup it via the **Info & Help (?)** modal.

---

## 🛠️ Technology Stack

| Component | Technology |
| :--- | :--- |
| **Language** | ![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white) |
| **Bundler** | ![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white) |
| **Database** | ![Dexie](https://img.shields.io/badge/Dexie.js-IndexedDB-blue?style=for-the-badge) |
| **Audio** | **Web Audio API** (Scheduling) & **Piper WASM** / **Web Speech API** (TTS) |
| **PWA** | Vite PWA Plugin & Workbox |
| **Testing** | ![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white) ![Playwright](https://img.shields.io/badge/Playwright-2EAD33?style=for-the-badge&logo=playwright&logoColor=white) |

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
| :--- | :--- |
| `Space` | Play / Pause |
| `←` / `→` | Rewind / Forward (Sentence/Chunk) |
| `M` | Cycle Reading Mode |
| `S` | Open Settings |
| `L` | Go to Library |
| `?` | Show Keyboard Help |

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
# Clone and Install
git clone https://github.com/a13x60r/spirtzVioice.git
cd spirtzVioice
npm install

# Start development server
npm run dev
```

---

## 🗺️ Roadmap

- [x] **Core Sync Engine**: Web Audio based token-level synchronization.
- [x] **PWA Support**: Offline capability and Installability.
- [x] **Web Clipper**: Cross-browser bookmarklet for easy imports.
- [ ] **Advanced Seek Bar**: Interactive progress bar with sentence-level scrubbing.
- [ ] **AI-Powered Summarization**: Optional local LLM support for executive summaries.
- [ ] **Deep PDF Support**: Using `pdf.js` for structural document analysis.
- [ ] **Cloud Sync (Opt-in)**: Optional encrypted sync across devices.

---

## 🔒 Security & Privacy

- **100% Client-Side**: Your text and audio never leave your device.
- **Sanitization**: All rendered content is sanitized via `dompurify` to prevent XSS.
- **No Cookies**: We use IndexedDB for local preferences only.

---

## 📄 License

[MIT](./LICENSE) © 2026 a13x60r
