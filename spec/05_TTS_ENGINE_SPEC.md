# TTS Engine (Offline) Spec

## Requirements
- Must run in browser without network once assets are cached.
- Must operate in a Web Worker.
- Must accept text and output PCM audio for a chunk.

## Worker API
Request:
- type: "SYNTHESIZE"
- requestId: string
- voiceId: string
- speedWpm: number
- text: string
- format: "PCM_F32"
- sampleRate: 22050 | 24000 | 16000 (engine dependent; expose actual)

Response:
- type: "SYNTHESIZED"
- requestId: string
- voiceId: string
- sampleRate: number
- pcm: Float32Array (transferable)
- durationSec: number

Error:
- type: "TTS_ERROR"
- requestId: string
- message: string
- code: string

## Performance targets
- First audio from cached voice within 1s (device dependent).
- Subsequent chunk synthesis should run ahead using lookahead window.

## Voice package management
- Voice assets must be downloadable and cacheable by SW.
- Worker must load voice model from Cache Storage / fetch() (which SW serves offline).
