# Storage and Cache Spec

## IndexedDB databases/stores
DB: "reader-db" version 1

Stores:
1. documents
   - key: docId
   - value: Document

2. tokens
   - key: [docId, index]
   - value: Token

3. settings
   - key: "global"
   - value: Settings

4. plans
   - key: planId
   - value: RenderPlan metadata (without full chunkText if large; store chunk ranges + hashes)

5. audioChunks
   - key: chunkHash
   - value:
     - sampleRate
     - durationSec
     - encoding ("PCM_F32" or "WAV")
     - data (ArrayBuffer)
     - lastAccessMs
     - sizeBytes

6. timelines (optional in MVP; can rebuild)
   - key: planId
   - value: Timeline (entries compressed) + duration

## Cache policy
- Audio chunk cache uses LRU eviction:
  - Maintain lastAccessMs in audioChunks.
  - Evict oldest until under target size or quota pressure.

## Quota handling
- If put() fails due to quota:
  - Evict LRU batch, retry once
  - If still fails, disable caching and continue streaming-only synthesis.

## Determinism
- All hashes must be stable across sessions.
- Tokenization version must be included in planId inputs (tokenizerVersion = "1").
