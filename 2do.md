# Features (Todo)

## High Priority
- [x] **PWA**: Verify offline capability and installability ✅ Fixed config, verified caching

## Document Management (via `DocumentStore`)
- [ ] add overview of stored texts
- [ ] add delete stored texts

## Settings Persistence (per document)
- [ ] save wpm setting for each stored text (via `updateProgress`)
- [ ] save mode setting for each stored text (via `updateProgress`)
- [ ] sync settings wpm to main wpm

## Completed
- [x] **File Support**: Import .html, .md, .txt files directly (Implemented in `TextInput`)

# Done
- [x] Fix `manifest.webmanifest` syntax error. (Enabled PWA dev options)
- [x] Fix `env.wasm.numThreads` warning. (Added COOP/COEP headers)
- [x] wpm setting doesnt work (Fixed)
- [x] progress bar for text processing (Implemented in `LoadingOverlay` / `ReaderShell`)
- [x] calculate total time and display it (Implemented in `Controls`)
- [x] fix app name to SpritzVoice (Done in `index.html` / `vite.config.ts`)
- [x] way to create new text (via `TextInput`)
- [x] store processed texts locally (via `DocumentStore` / Dexie)
- [x] save reading position for each stored text (via `updateProgress`)
