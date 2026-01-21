import { describe, it, expect, beforeEach } from 'vitest';
import { PlaybackCursor } from '../PlaybackCursor';
import type { Timeline } from '@spec/types';

describe('PlaybackCursor', () => {
    let timeline: Timeline;
    let cursor: PlaybackCursor;

    beforeEach(() => {
        timeline = {
            planId: 'p1',
            durationSec: 10,
            entries: [
                { tokenId: 't1', tokenIndex: 0, tStartSec: 0, tEndSec: 1 },
                { tokenId: 't2', tokenIndex: 1, tStartSec: 1, tEndSec: 5 },
                { tokenId: 't3', tokenIndex: 2, tStartSec: 5, tEndSec: 10 }
            ]
        };
        cursor = new PlaybackCursor();
        cursor.setTimeline(timeline);
    });

    it('should map time to token', () => {
        expect(cursor.getCurrentTokenIndex(0)).toBe(0);
        expect(cursor.getCurrentTokenIndex(0.5)).toBe(0);
        expect(cursor.getCurrentTokenIndex(1)).toBe(1); // Boundary inclusive start
        expect(cursor.getCurrentTokenIndex(4.9)).toBe(1);
        expect(cursor.getCurrentTokenIndex(5)).toBe(2);
    });

    it('should handle out of bounds', () => {
        expect(cursor.getCurrentTokenIndex(-1)).toBe(0); // Clamped to start
        expect(cursor.getCurrentTokenIndex(10)).toBe(2); // Clamped to end
        expect(cursor.getCurrentTokenIndex(100)).toBe(2);
    });

    it('should return undefined for invalid token index', () => {
        expect(cursor.getTokenTiming(0)).toBeDefined();
        expect(cursor.getTokenTiming(99)).toBeUndefined();
    });
});
