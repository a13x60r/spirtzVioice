import type { Token, TokenType } from '@spec/types';
import { v4 as uuidv4 } from 'uuid';

/**
 * TextPipeline: Tokenize raw text into structured tokens
 * 
 * This module handles:
 * - Splitting text into tokens (words, punctuation, spaces, newlines)
 * - Classifying token types
 * - Assigning sentence IDs for pause insertion
 * - Normalizing text for TTS
 */

export class TextPipeline {
  /**
   * Tokenize raw text into structured Token array
   */
  static tokenize(rawText: string): Token[] {
    if (!rawText || rawText.trim().length === 0) {
      return [];
    }

    const tokens: Token[] = [];
    let currentIndex = 0;
    let sentenceId = 0;
    let position = 0;

    // Regex patterns for token classification
    const patterns = {
      word: /[a-zA-Z0-9''\u2019]+/,
      punct: /[.,!?;:—–\-"""''()[\]{}]/,
      space: / +/,
      newline: /\n+/,
    };

    while (position < rawText.length) {
      let matched = false;

      // Try each pattern in priority order
      for (const [type, pattern] of Object.entries(patterns)) {
        const regex = new RegExp(`^${pattern.source}`);
        const match = rawText.slice(position).match(regex);

        if (match) {
          const text = match[0];
          const tokenType = type as TokenType;

          // Create token
          const token: Token = {
            tokenId: uuidv4(),
            index: currentIndex++,
            text,
            normText: this.normalizeForTTS(text, tokenType),
            type: tokenType,
            sentenceId,
          };

          tokens.push(token);

          // Increment sentence ID on sentence-ending punctuation
          if (tokenType === 'punct' && /[.!?]/.test(text)) {
            sentenceId++;
          }

          // Paragraph break increments sentence ID
          if (tokenType === 'newline' && text.length > 1) {
            sentenceId++;
          }

          position += text.length;
          matched = true;
          break;
        }
      }

      // Skip unmatched character (fallback)
      if (!matched) {
        position++;
      }
    }

    return tokens;
  }

  /**
   * Normalize text for TTS synthesis
   */
  private static normalizeForTTS(text: string, type: TokenType): string {
    switch (type) {
      case 'word':
        return text.toLowerCase();

      case 'punct':
        // Map punctuation to spoken equivalents or silence
        const punctMap: Record<string, string> = {
          '.': '',
          ',': '',
          '!': '',
          '?': '',
          ';': '',
          ':': '',
          '-': '',
          '—': '',
          '–': '',
          '"': '',
          "'": '',
          '(': '',
          ')': '',
          '[': '',
          ']': '',
          '{': '',
          '}': '',
          '\u2018': '',
          '\u2019': '',
          '\u201C': '',
          '\u201D': '',
        };
        return punctMap[text] || '';

      case 'space':
        return ' ';

      case 'newline':
        return ' ';

      default:
        return text;
    }
  }

  /**
   * Get all words (non-punct, non-space) from tokens
   */
  static getWords(tokens: Token[]): Token[] {
    return tokens.filter(t => t.type === 'word');
  }

  /**
   * Get tokens for a sentence
   */
  static getTokensBySentence(tokens: Token[], sentenceId: number): Token[] {
    return tokens.filter(t => t.sentenceId === sentenceId);
  }

  /**
   * Count total sentences
   */
  static getSentenceCount(tokens: Token[]): number {
    if (tokens.length === 0) return 0;
    return Math.max(...tokens.map(t => t.sentenceId)) + 1;
  }
}


