## P0 - Make it usable for students (core behavior)

- [x] Add chunked Focus mode (phrase/clause RSVP)
  - [x] src/lib/segment.ts: implement segmentTextToChunks(text: string): Chunk[]
  - [x] rules: split on .?!;: + comma before conjunctions (and|but|or|so|because|however|therefore|although|while)
  - [x] merge chunks <3 words into next
  - [x] cap chunk length 12-15 words (split at nearest punctuation/space)
  - [x] src/lib/readerModel.ts: represent reading units as Chunk { id, text, startOffset, endOffset, sentenceId, paraId }
- [x] Replace constant WPM delay with adaptive timing
  - [x] src/lib/timing.ts: computeDelayMs(chunkText, baseWpm, opts)
  - [x] baseMsPerWord = 60000 / baseWpm
  - [x] delay = baseMsPerWord*words + punctPause + sentenceEndPause + longWordBonus
  - [x] punct: comma +120ms, ;: +200ms, .?! +450ms
  - [x] longWordBonus: +35ms per word length >=9
- [x] Add panic exit to Paging view at exact location
  - [x] src/routes/reader/PagingView.tsx (or equivalent)
  - [x] src/routes/reader/FocusView.tsx: button + long-press on center to open paging at paraId + startOffset
  - [x] ensure bidirectional: paging -> resume focus at nearest chunk

## P1 - Orientation layer (fix "where am I?")

- [x] Ghost context lines
  - [x] FocusView: render previous chunk (faint), current chunk (primary), next chunk (faint)
  - [x] keep anchor fixed; no motion; only opacity transition <=100ms
  - [x] tests: FocusView ghost lines
- [x] Structural progress
  - [x] src/components/Progress.tsx
  - [x] show Chapter -> Section label
  - [x] progress within chapter (0-100%)
  - [x] derive chapter/section from document model metadata

## P2 - Controls that work (mobile + desktop)

- [x] Speed controls: presets + numeric
  - [x] presets: 180 / 240 / 300 / 360 (+ "Custom")
  - [x] show WPM value next to control
  - [x] hard cap slider range (e.g., 120-450) for Focus mode
- [x] Rewind granularity
  - [x] controls: back 1 chunk, back 1 sentence, back 10 seconds (fallback)
  - [x] src/lib/navigation.ts: prevChunk(), prevSentence(), rewindByMs(ms)
- [x] Keyboard shortcuts + help overlay
  - [x] ? opens overlay
  - [x] Space: play/pause
  - [x] Left/Right: prev/next chunk
  - [x] Shift+Left/Right: prev/next sentence
  - [x] +/-: speed
  - [x] Esc: open paging

## P3 - Adaptivity (behavior-driven, no eye tracking)

- [x] Auto-slowdown on struggle
  - [x] src/lib/adapt.ts
  - [x] track rewindsLast30s
  - [x] if >=2: baseWpm *= 0.9 (min floor 140)
  - [x] if stable 2 mins with 0 rewinds: baseWpm *= 1.03 (cap 360)
- [x] Fatigue nudges
  - [x] if session > 20 min: suggest break OR switch to paging
  - [x] never block reading

## P4 - Persistence + offline (PWA-grade)

- [x] Persist exact reading state (every page/chunk)
  - [x] src/storage/db.ts (IndexedDB via Dexie or native)
  - [x] store: docId, mode, paraId, chunkIndex, offset, scrollTop
  - [x] baseWpm, theme, lastUpdated
  - [x] resume reliably
- [x] Cache segmentation results
  - [x] store per docId+paraId -> chunks[]
  - [x] avoid re-segmenting on every open
- [x] Service worker caching
  - [x] cache app shell + document text + user prefs
  - [x] ensure offline open last book works

## P5 - Student study affordances (minimal but high ROI)

- [x] Mark/highlight buffer from Focus mode
  - [x] tap star -> save current chunk range
  - [x] paging view renders highlights from saved ranges
- [x] Quick note at current sentence
  - [x] note anchored to paraId + offsetRange
  - [x] searchable later
- [x] Copy current sentence / cite
  - [x] one-click copy with surrounding context (prev+next sentence optional)

## P6 - Accessibility & comfort

- [x] Typography controls
  - [x] font size, line height, font family
- [x] ORP highlight toggle + intensity
- [x] Theme
  - [x] calm low-contrast theme option
  - [x] reduce glare, keep contrast AA+
