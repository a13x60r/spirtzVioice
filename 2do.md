# High Priority / Bugs
- [x] fix reading progress bar (in main view)
    - [ ] Create implementation plan
    - [ ] Update ReaderShell.ts to use token index
    - [ ] Verify progress calculation
- [ ] fix progress bar in library view
    - *Note: Ensure it reflects accurate completion percentage.*
- [ ] fix: separate wpm (synthesis speed) and playback speed (0.5x-2x)
    - *Note: Add playback rate slider (instant). Keep WPM for synthesis (slow).*
- [ ] fix: save wpm setting for each stored text (via `updateProgress`)

# UX / UI Improvements
- [ ] make it use whole screen dynamically (responsive layout)
    - *Note: Remove hardcoded max-width.*
- [ ] rename buttons to use icons instead of text (Play, Pause, Library, etc.)
- [ ] add abort "Synthesizing chunk" button
- [ ] add audio level (volume) control
- [ ] make it use multimedia keys for controls (play/pause, skip)

# Features (Todo)
- [ ] add language selection in settings
- [ ] add language detection
- [ ] save mode setting for each stored text
- [ ] sync settings wpm to main screen wpm

# Done
- [x] display rendered md or html in text view
- [x] **Multimedia**: Multiselect and Bulk Delete in Library (Implemented in `DocumentList`)
- [x] **PWA**: Verify offline capability and installability ✅ Fixed config, verified caching
- [x] **File Support**: Import .html, .md, .txt files directly (Implemented in `TextInput`)
- [x] add overview of stored texts ✅ Implemented Library view
- [x] add delete stored texts ✅ Delete with confirmation
- [x] Fix `manifest.webmanifest` syntax error. (Enabled PWA dev options)
- [x] Fix `env.wasm.numThreads` warning. (Added COOP/COEP headers)
- [x] wpm setting doesnt work (Fixed)
- [x] progress bar for text processing (Implemented in `LoadingOverlay` / `ReaderShell`)
- [x] calculate total time and display it (Implemented in `Controls`)
- [x] fix app name to SpritzVoice (Done in `index.html` / `vite.config.ts`)
- [x] way to create new text (via `TextInput`)
- [x] store processed texts locally (via `DocumentStore` / Dexie)
- [x] save reading position for each stored text (via `updateProgress`)
- [x] fix: resume button doesn't resume, starts from the beginning
- [x] feature: skip forward/backward by word
- [x] feature: skip forward/backward by sentence
- [x] feature: skip forward/backward by paragraph
- [x] WPM change as slider
