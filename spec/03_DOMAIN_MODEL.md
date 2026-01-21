# Domain Model

## Document
- docId: string (UUID)
- title: string
- rawText: string
- createdAt: number (ms since epoch)

## Token
Tokens MUST be stable across sessions for a given rawText.
- tokenId: string (deterministic hash of docId + index + normText)
- index: number (0..N-1)
- text: string (original)
- normText: string (normalized for synthesis)
- type: "word" | "punct" | "space" | "newline"
- sentenceId: number

## ReaderMode
- "RSVP" | "PARAGRAPH"

## Strategy
- "TOKEN" | "CHUNK"

## VoicePackage
- voiceId: string
- name: string
- lang: string
- version: string
- sizeBytes: number
- assets: string[] (URLs/paths cached by SW)

## Settings
- voiceId: string
- speedWpm: number (e.g., 120..900)
- strategy: Strategy
- chunkSize: number (TOKEN => 1 enforced; CHUNK => 2..8)
- lookaheadSec: number (10..60)
- mode: ReaderMode
- pauseRules:
  - punctPauseMs: number
  - paragraphPauseMs: number

## Deterministic hashing
- planId = hash(docId + voiceId + speedWpm + strategy + chunkSize + pauseRules)
- chunkHash = hash(planId + startIndex + endIndex + chunkTextNorm)
