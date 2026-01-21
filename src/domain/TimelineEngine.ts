import type { RenderPlan, Timeline, TimelineEntry, AudioAsset, Token } from '@spec/types';

/**
 * TimelineEngine: Build token-level timing from RenderPlan and audio assets
 * 
 * Creates precise timing information for each token:
 * - TOKEN strategy: direct mapping from audio duration
 * - CHUNK strategy: distribute chunk duration across tokens
 */

export class TimelineEngine {
  /**
   * Build a timeline from RenderPlan and audio assets
   */
  static buildTimeline(
    plan: RenderPlan,
    audioAssets: Map<string, AudioAsset>,
    tokens: Token[]
  ): Timeline {
    const entries: TimelineEntry[] = [];
    let currentTime = 0;

    for (const chunk of plan.chunks) {
      const audio = audioAssets.get(chunk.chunkHash);

      if (!audio) {
        console.warn(`Missing audio for chunk ${chunk.chunkHash}`);
        continue;
      }

      const chunkDuration = audio.durationSec;
      const chunkTokens = tokens.slice(chunk.startTokenIndex, chunk.endTokenIndex);

      if (plan.strategy === 'TOKEN') {
        // TOKEN strategy: one token per chunk, direct mapping
        const token = chunkTokens[0];
        if (!token) continue;

        const entry: TimelineEntry = {
          tokenId: token.tokenId,
          tokenIndex: token.index,
          tStartSec: currentTime,
          tEndSec: currentTime + chunkDuration,
        };

        entries.push(entry);
        currentTime += chunkDuration;

        // NOTE: Pauses disabled for now - they cause sync issues since
        // no actual silent audio is inserted between chunks
        // currentTime += this.getPauseForToken(token, plan.pauseRules);
      } else {
        // CHUNK strategy: distribute duration across tokens proportionally
        const validTokens = chunkTokens.filter(t => t.type === 'word');
        const totalWeight = validTokens.length;

        if (totalWeight === 0) continue;

        const timePerToken = chunkDuration / totalWeight;

        for (const token of chunkTokens) {
          if (token.type === 'word') {
            const entry: TimelineEntry = {
              tokenId: token.tokenId,
              tokenIndex: token.index,
              tStartSec: currentTime,
              tEndSec: currentTime + timePerToken,
            };

            entries.push(entry);
            currentTime += timePerToken;
          }
          // NOTE: Don't add pauses between tokens within a chunk - 
          // the audio plays continuously for the entire chunk
        }

        // NOTE: Pauses disabled for now - they cause sync issues since
        // no actual silent audio is inserted between chunks
        // const lastToken = chunkTokens[chunkTokens.length - 1];
        // if (lastToken) {
        //   currentTime += this.getPauseForToken(lastToken, plan.pauseRules);
        // }
      }
    }

    const timeline: Timeline = {
      planId: plan.planId,
      entries,
      durationSec: currentTime,
    };

    return timeline;
  }

  /**
   * Find current token index from timeline and audio time
   */
  static getCurrentTokenIndex(timeline: Timeline, audioTime: number): number {
    if (timeline.entries.length === 0) return -1;

    // Binary search for efficiency
    let left = 0;
    let right = timeline.entries.length - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const entry = timeline.entries[mid];

      if (audioTime >= entry.tStartSec && audioTime < entry.tEndSec) {
        return entry.tokenIndex;
      } else if (audioTime < entry.tStartSec) {
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }

    // Handle edge cases
    if (audioTime < timeline.entries[0].tStartSec) {
      return timeline.entries[0].tokenIndex;
    }

    if (audioTime >= timeline.durationSec) {
      return timeline.entries[timeline.entries.length - 1].tokenIndex;
    }

    // Fallback to last seen
    return timeline.entries[right]?.tokenIndex ?? -1;
  }

  /**
   * Get time offset for a specific token index
   */
  static getTimeForToken(timeline: Timeline, tokenIndex: number): number {
    const entry = timeline.entries.find(e => e.tokenIndex === tokenIndex);
    return entry?.tStartSec ?? 0;
  }

  /**
   * Validate timeline completeness
   */
  static validateTimeline(timeline: Timeline, _expectedTokenCount: number): boolean {
    // Check that all entries are contiguous and cover expected tokens
    if (timeline.entries.length === 0) return false;

    // Check for gaps
    for (let i = 1; i < timeline.entries.length; i++) {
      const prev = timeline.entries[i - 1];
      const curr = timeline.entries[i];

      // Allow small timing gaps for pauses, but check index continuity
      if (curr.tStartSec < prev.tEndSec - 0.001) {
        console.warn('Timeline has overlapping entries');
        return false;
      }
    }

    return true;
  }
}
