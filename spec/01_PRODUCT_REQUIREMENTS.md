# Product Requirements

## Primary user stories
1. As a user, I can paste or import text and listen while following the exact currently spoken word.
2. As a user, I can switch between RSVP and Paragraph view instantly during playback.
3. As a user, I can switch between TOKEN and CHUNK synthesis strategies without losing my place.
4. As a user, I can use the app offline after initial installation and voice download.
5. As a user, I can control speed (WPM or multiplier), voice, and chunk size.

## Non-functional requirements
- Responsiveness: UI stays interactive during synthesis (worker required).
- Stability: playback state recoverable after reload.
- Storage: cache is bounded and evictable.
- Cross-platform: Chrome/Edge on Windows, Chrome on Android, Safari on iOS.

## MVP scope
- Text input: paste + local .txt file import
- Tokenization: English + generic whitespace/punctuation rules (language-agnostic baseline)
- Voices: at least 1 offline voice package
- Playback: play/pause/resume/seek ±10s and by token index
- Views: RSVP + Paragraph
- Settings: speed, voice, strategy, chunk size, lookahead seconds
- Offline: service worker + model caching

## Out of scope (MVP)
- PDF/EPUB extraction
- Cloud TTS
- Accounts/sync across devices
