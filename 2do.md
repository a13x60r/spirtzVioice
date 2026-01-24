# TODO
- [ ] add import from url
- [ ] add import from share
- [ ] make progress bar of currently playing text to seeker bar to navigate text like in video player
# High Priority

- [x] make it use whole screen dynamically (responsive layout)
    - *Note: Removed hardcoded max-width.*
- [x] feature: text size control
- [x] feature: dark mode

- [ ] save setting for each stored text
- [ ] add multifile upload


# UX / UI Improvements


# Features (Todo)
- [x] add multimedia button(physical like on headphones) support (play/pause, skip, etc.)
- [x] add keyboard shortcuts
- [ ] replace text UI with icons, where applicable 
- [ ] add language detection, save language for each stored text
- [ ] add import from url

# Rejected / Obsolete
- [x] sync settings wpm to main screen wpm (Decided: Strict separation of default vs active WPM)

# Done
- [x] add language selection in settings
- [x] add voice selection in settings
- [x] Debug Play/Pause and Seek issues.
- [x] Fix responsiveness of Play/Pause button (removed await on resume context).
- [x] rename buttons to use icons instead of text (Play, Pause, Library, etc.)
- [x] add abort "Synthesizing chunk" button (Added in loading overlay)
- [x] add audio level (volume) control
- [x] make it use multimedia keys for controls (play/pause, skip)
- [x] fix: save wpm setting for each stored text (via `updateProgress`)
- [x] display rendered md or html in text view
- [x] fix reading progress bar (in main view)
- [x] fix progress bar in library view
- [x] fix: separate wpm (synthesis speed) and playback speed
- [x] Multimedia: Multiselect and Bulk Delete in Library
- [x] PWA: Verify offline capability and installability
- [x] File Support: Import .html, .md, .txt files directly
- [x] add overview of stored texts
- [x] add delete stored texts
- [x] Fix `manifest.webmanifest` syntax error.
- [x] feature: add Optimal Recognition Point (ORP) display
