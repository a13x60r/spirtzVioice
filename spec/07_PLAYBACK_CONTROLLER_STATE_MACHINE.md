# Playback Controller State Machine

## State variables
- docId
- planId
- settings (voiceId, speedWpm, strategy, chunkSize, lookaheadSec, mode)
- cursorTokenIndex
- offsetSec
- isPlaying
- buffering (boolean)

## States
1. IDLE (no document)
2. READY (document loaded, plan may be stale)
3. PREPARING (building plan / ensuring initial audio)
4. PLAYING
5. PAUSED
6. BUFFERING (playing requested but underrun)
7. ERROR

## Events
- LOAD_DOCUMENT(docId)
- UPDATE_SETTINGS(partial settings)
- BUILD_PLAN(strategy, chunkSize, voiceId, speedWpm)
- PLAY
- PAUSE
- RESUME
- SEEK_TOKEN(index)
- SEEK_TIME(offsetSec)
- SWITCH_MODE(RSVP|PARAGRAPH)  // UI only
- SWITCH_STRATEGY(TOKEN|CHUNK) // requires plan rebuild
- SCHEDULER_UNDERRUN
- SCHEDULER_RECOVERED
- TTS_ERROR

## Transition rules (high level)
- READY + PLAY => PREPARING
- PREPARING + initial audio ready => PLAYING
- PLAYING + PAUSE => PAUSED
- PAUSED + RESUME => PLAYING (reschedule)
- PLAYING + SEEK_* => PREPARING (stop + reschedule)
- PLAYING + SWITCH_MODE => PLAYING (no audio changes)
- PLAYING + SWITCH_STRATEGY => PREPARING (pause, rebuild plan, seek same token, resume)
- PLAYING + SCHEDULER_UNDERRUN => BUFFERING
- BUFFERING + SCHEDULER_RECOVERED => PLAYING

## Position preservation on strategy change
Given current cursorTokenIndex:
1. pause scheduler -> get offsetSec
2. rebuild plan with new strategy
3. compute newOffsetSec by locating tokenIndex in new timeline (by token order; same tokenization)
4. start scheduler from newOffsetSec
5. continue cursor from same tokenIndex
