import type { Token, Settings, RenderPlan, Chunk, Strategy } from '@spec/types';
import { generateChunkHash } from './utils/hashing';
import { v4 as uuidv4 } from 'uuid';

/**
 * PlanEngine: Generate RenderPlan from tokens and settings
 * 
 * Handles two strategies:
 * - TOKEN: one chunk per token (chunkSize=1 enforced)
 * - CHUNK: group tokens into configurable chunk sizes
 */

export class PlanEngine {
  /**
   * Generate a RenderPlan from tokens and settings
   */
  static async generatePlan(
    docId: string,
    tokens: Token[],
    settings: Settings
  ): Promise<RenderPlan> {
    const { strategy, voiceId, speedWpm, pauseRules } = settings;

    // Enforce chunkSize=1 for TOKEN strategy
    const chunkSize = strategy === 'TOKEN' ? 1 : settings.chunkSize;

    // Generate chunks based on strategy
    const chunks = await this.generateChunks(
      tokens,
      strategy,
      chunkSize,
      voiceId,
      speedWpm
    );

    const plan: RenderPlan = {
      planId: uuidv4(),
      docId,
      voiceId,
      speedWpm,
      strategy,
      chunkSize,
      pauseRules,
      tokenizerVersion: '1',
      chunks,
    };

    return plan;
  }

  /**
   * Generate chunks from tokens
   */
  private static async generateChunks(
    tokens: Token[],
    strategy: Strategy,
    chunkSize: number,
    voiceId: string,
    speedWpm: number
  ): Promise<Chunk[]> {
    const chunks: Chunk[] = [];

    if (strategy === 'TOKEN') {
      // One chunk per token
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const chunkText = token.normText;

        // Skip empty normalized text (e.g., punctuation)
        if (!chunkText || chunkText.trim().length === 0) {
          continue;
        }

        const chunkHash = await generateChunkHash(chunkText, voiceId, speedWpm);

        const chunk: Chunk = {
          chunkId: chunkHash,
          startTokenIndex: i,
          endTokenIndex: i + 1, // exclusive
          chunkText,
          tokenIds: [token.tokenId],
          chunkHash,
        };

        chunks.push(chunk);
      }
    } else {
      // CHUNK strategy: group tokens into chunks
      for (let i = 0; i < tokens.length; i += chunkSize) {
        const chunkTokens = tokens.slice(i, i + chunkSize);

        // Build chunk text from normalized tokens
        const chunkText = chunkTokens
          .map(t => t.normText)
          .filter(t => t && t.trim().length > 0)
          .join(' ');

        // Skip if no valid text
        if (!chunkText || chunkText.trim().length === 0) {
          continue;
        }

        const chunkHash = await generateChunkHash(chunkText, voiceId, speedWpm);

        const chunk: Chunk = {
          chunkId: chunkHash,
          startTokenIndex: i,
          endTokenIndex: Math.min(i + chunkSize, tokens.length),
          chunkText,
          tokenIds: chunkTokens.map(t => t.tokenId),
          chunkHash,
        };

        chunks.push(chunk);
      }
    }

    return chunks;
  }

  /**
   * Check if two plans are compatible (can reuse audio cache)
   */
  static arePlansCompatible(plan1: RenderPlan, plan2: RenderPlan): boolean {
    return (
      plan1.voiceId === plan2.voiceId &&
      plan1.speedWpm === plan2.speedWpm &&
      plan1.strategy === plan2.strategy &&
      plan1.chunkSize === plan2.chunkSize
    );
  }
}


