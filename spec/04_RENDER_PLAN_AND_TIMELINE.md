# RenderPlan and Timeline

## RenderPlan
A plan is an ordered list of chunks, each chunk references a contiguous token range.

Chunk:
- chunkId: string (chunkHash)
- startTokenIndex: number (inclusive)
- endTokenIndex: number (exclusive)
- chunkText: string (for TTS input)
- tokenIds: string[] (for mapping)

RenderPlan:
- planId
- docId
- voiceId
- speedWpm
- strategy
- chunkSize
- chunks: Chunk[]

## Plan building rules
1. Token strategy:
   - chunkSize forced to 1.
   - Each chunk contains exactly one token of type "word" or "punct" that is speakable.
2. Chunk strategy:
   - chunkSize N tokens (2..8), but only count speakable tokens toward N.
   - Include punctuation tokens in chunkText where appropriate.
3. Speakable token definition:
   - type "word" always speakable.
   - type "punct" speakable only if it should produce a pause or spoken symbol (default: pause only; no spoken symbol).
   - spaces/newlines not speakable.

## Timeline
Timeline is token-level, even in CHUNK strategy.

TimelineEntry:
- tokenId
- tokenIndex
- tStartSec
- tEndSec

Timeline:
- planId
- entries: TimelineEntry[]
- durationSec

## TOKEN timeline derivation
Each token chunk produces audio duration Di.
- tStart[0]=0
- tEnd[i]=tStart[i]+Di
- tStart[i+1]=tEnd[i]

## CHUNK timeline derivation (deterministic distribution)
Given a chunk audio duration D and tokens inside the chunk:
- Compute weights per token:
  - base = max(1, countAlnum(normText))
  - punctuation tokens get weight = 1
- totalW = sum(weights)
- tokenDuration[i] = D * weight[i]/totalW
- tStart/tEnd accumulated in order.

This makes UI-to-audio mapping deterministic and reproducible across devices.

## Pause rules
Pause is implemented by inserting silent duration in timeline:
- punctPauseMs added after tokens matching punctuation set [.,!?;:]
- paragraphPauseMs after newline boundaries (if configured)
Pause is accounted by adding synthetic "pause" entries OR by extending token tEnd.
MVP: extend prior token tEnd by pause duration.
