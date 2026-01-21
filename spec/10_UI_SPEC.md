# UI Spec

## Screens
1. Library
   - list documents
   - new document (paste/import)
2. Reader
   - top: title + status (playing/buffering)
   - main: RSVPView or ParagraphView (toggle)
   - bottom controls:
     - Play/Pause
     - Seek back/forward 10s
     - Speed WPM
     - Voice selector
     - Mode toggle: RSVP / Paragraph (instant)
     - Strategy toggle: TOKEN / CHUNK
     - Chunk size slider (enabled in CHUNK)
     - Lookahead seconds slider (advanced)

## RSVPView requirements
- Show current token centered
- Optional ORP alignment is allowed but not required in MVP
- Display previous/next token optionally (not required)

## ParagraphView requirements
- Render full text
- Highlight current token
- Auto-scroll to keep current token in view (toggle)

## UX requirements
- Strategy switch triggers brief “Rebuilding…” state; resumes at same word.
- If buffering, show “Buffering…” and continue once recovered.
