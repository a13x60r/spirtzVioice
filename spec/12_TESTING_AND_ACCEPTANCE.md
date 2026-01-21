# Testing & Acceptance

## Unit tests
- Tokenizer determinism: same input => same tokens & tokenIds
- Plan builder: TOKEN => chunkSize=1; CHUNK => correct chunk ranges
- Timeline builder:
  - TOKEN: durations accumulate correctly
  - CHUNK: weights sum to chunk duration; deterministic boundaries

## Integration tests
- Playback:
  - start/pause/resume maintains position within ±1 token
  - seek by time and token works
- Mode switch:
  - RSVP<->Paragraph during playback does not interrupt audio
- Strategy switch:
  - TOKEN->CHUNK->TOKEN preserves current token index after rebuild

## Offline tests
- First install online, then airplane mode:
  - app loads
  - existing documents playable
  - voice model available
- Cache eviction:
  - artificially constrain quota, verify eviction and continued playback

## Acceptance criteria
1. Exact cursor mapping: displayed token index equals timeline-derived token for current audio time.
2. No UI freeze during synthesis (worker usage verified).
3. Works on:
   - Android Chrome
   - iOS Safari (and PWA add-to-home where feasible)
   - Windows Edge/Chrome
