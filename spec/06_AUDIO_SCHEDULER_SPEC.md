# Audio Scheduler Spec

## Objective
Schedule chunk AudioBuffers on an AudioContext timeline and maintain playback continuity.

## Concepts
- t0: AudioContext time at which playback starts (plus a small offset, e.g., 0.05s).
- offsetSec: position in timeline relative to start (0..duration).

## Scheduler responsibilities
1. Maintain a rolling buffer of scheduled audio (lookaheadSec).
2. Request/generate upcoming chunks as needed.
3. Convert PCM to AudioBuffer and schedule at precise times.
4. Handle pause/resume/seek by stopping sources and rescheduling.

## Scheduler API
- init(audioContext)
- start(planId, fromOffsetSec)
- pause() -> returns currentOffsetSec
- resume(fromOffsetSec)
- seek(toOffsetSec)
- stop()

Events emitted:
- "SCHEDULE_PROGRESS": { scheduledThroughSec }
- "UNDERRUN": { atOffsetSec }
- "ERROR": { message }

## Scheduling algorithm (rolling window)
On start/resume:
- set baseTime = audioContext.currentTime + 0.05
- map timelineOffsetSec -> absoluteTime = baseTime + (timelineOffsetSec - fromOffsetSec)
- schedule chunks sequentially until scheduledThroughSec >= fromOffsetSec + lookaheadSec
- keep a list of AudioBufferSourceNodes, stop/disconnect on pause/seek

## Underrun handling
If synthesis lags and scheduled audio ends:
- emit UNDERRUN
- pause playback cursor and UI indicates buffering
- resume scheduling when audio becomes available
