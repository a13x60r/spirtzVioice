export interface AdaptState {
    rewindTimestamps: number[];
    lastAdjustTime: number;
    stableSince: number | null;
}

export interface AdaptResult {
    nextWpm: number;
    reason: 'slowdown' | 'speedup';
}

const REWIND_WINDOW_MS = 30_000;
const SLOWDOWN_THRESHOLD = 2;
const STABLE_WINDOW_MS = 120_000;
const ADJUST_COOLDOWN_MS = 60_000;
const MIN_WPM = 140;
const MAX_WPM = 360;

export function createAdaptState(): AdaptState {
    return {
        rewindTimestamps: [],
        lastAdjustTime: 0,
        stableSince: null
    };
}

export function recordRewind(nowMs: number, state: AdaptState) {
    state.rewindTimestamps.push(nowMs);
    pruneRewinds(nowMs, state);
    state.stableSince = null;
}

export function evaluateAdaptation(nowMs: number, currentWpm: number, state: AdaptState): AdaptResult | null {
    pruneRewinds(nowMs, state);
    const rewindsLast30s = state.rewindTimestamps.length;

    if (rewindsLast30s >= SLOWDOWN_THRESHOLD && canAdjust(nowMs, state)) {
        const nextWpm = clampWpm(Math.floor(currentWpm * 0.9));
        if (nextWpm !== currentWpm) {
            state.lastAdjustTime = nowMs;
            state.stableSince = null;
            return { nextWpm, reason: 'slowdown' };
        }
    }

    if (rewindsLast30s === 0) {
        if (state.stableSince === null) state.stableSince = nowMs;
        if ((nowMs - state.stableSince) >= STABLE_WINDOW_MS && canAdjust(nowMs, state)) {
            const nextWpm = clampWpm(Math.ceil(currentWpm * 1.03));
            if (nextWpm !== currentWpm) {
                state.lastAdjustTime = nowMs;
                state.stableSince = nowMs;
                return { nextWpm, reason: 'speedup' };
            }
        }
    }

    return null;
}

function pruneRewinds(nowMs: number, state: AdaptState) {
    const cutoff = nowMs - REWIND_WINDOW_MS;
    state.rewindTimestamps = state.rewindTimestamps.filter(ts => ts >= cutoff);
}

function canAdjust(nowMs: number, state: AdaptState) {
    return nowMs - state.lastAdjustTime >= ADJUST_COOLDOWN_MS;
}

function clampWpm(value: number) {
    return Math.min(MAX_WPM, Math.max(MIN_WPM, value));
}
