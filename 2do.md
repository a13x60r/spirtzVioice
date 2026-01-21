# Features (Todo)
- [ ] add language selection in settings
- [ ] add language detection
- [ ] WPM change as slider
- [ ] add playback speed controll(x0.5, x0.75, x1, x1.25, x1.5, x2) separate from wpm
- [ ] fix reading progress bar 
- [ ] add audio level control
- [ ] make it use whole screen dynamically
- [ ] add abbort Synthesizing chunk button
- [ ] fix progress bar for text processing om library view
- [ ] rename buttons to use icons instead of text
- [ ] make it use multimedia keys for controls (play/pause, skip forward/backward, stop)

## High Priority
- [x] **PWA**: Verify offline capability and installability ✅ Fixed config, verified caching

## Document Management (via `DocumentStore`)
- [x] add overview of stored texts ✅ Implemented Library view
- [x] add delete stored texts ✅ Delete with confirmation

## Settings Persistence (per document)
- [ ] save wpm setting for each stored text (via `updateProgress`)
- [ ] save mode setting for each stored text (via `updateProgress`)
- [ ] sync settings wpm to main screen wpm

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
