import type { ReaderMode, Strategy, Settings } from "./types";

export type ControllerState =
    | "IDLE"
    | "READY"
    | "PREPARING"
    | "PLAYING"
    | "PAUSED"
    | "BUFFERING"
    | "ERROR";

export type ControllerEvent =
    | { type: "LOAD_DOCUMENT"; docId: string }
    | { type: "UPDATE_SETTINGS"; patch: Partial<Settings> }
    | { type: "PLAY" }
    | { type: "PAUSE" }
    | { type: "RESUME" }
    | { type: "SEEK_TOKEN"; tokenIndex: number }
    | { type: "SEEK_TIME"; offsetSec: number }
    | { type: "SWITCH_MODE"; mode: ReaderMode }
    | { type: "SWITCH_STRATEGY"; strategy: Strategy }
    | { type: "SCHEDULER_UNDERRUN"; atOffsetSec: number }
    | { type: "SCHEDULER_RECOVERED" }
    | { type: "TTS_ERROR"; message: string; code: string };

export interface PlaybackSnapshot {
    state: ControllerState;
    docId?: string;
    planId?: string;
    mode?: ReaderMode;
    strategy?: Strategy;
    speedWpm?: number;
    voiceId?: string;
    chunkSize?: number;
    offsetSec?: number;
    cursorTokenIndex?: number;
    buffering?: boolean;
    error?: { message: string; code?: string };
}
