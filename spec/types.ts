export type ReaderMode = "RSVP" | "PARAGRAPH";
export type Strategy = "TOKEN" | "CHUNK";

export type TokenType = "word" | "punct" | "space" | "newline";

export interface DocumentEntity {
    docId: string;
    title: string;
    rawText: string;
    createdAt: number;
}

export interface Token {
    tokenId: string;
    index: number;
    text: string;
    normText: string;
    type: TokenType;
    sentenceId: number;
}

export interface PauseRules {
    punctPauseMs: number;
    paragraphPauseMs: number;
}

export interface Settings {
    voiceId: string;
    speedWpm: number;
    strategy: Strategy;
    chunkSize: number;      // TOKEN => 1 enforced
    lookaheadSec: number;   // 10..60
    mode: ReaderMode;
    pauseRules: PauseRules;
    tokenizerVersion: "1";
}

export interface VoicePackage {
    voiceId: string;
    name: string;
    lang: string;
    version: string;
    sizeBytes: number;
    assets: string[];
}

export interface Chunk {
    chunkId: string; // = chunkHash
    startTokenIndex: number; // inclusive
    endTokenIndex: number;   // exclusive
    chunkText: string;
    tokenIds: string[];
    chunkHash: string;
}

export interface RenderPlan {
    planId: string;
    docId: string;
    voiceId: string;
    speedWpm: number;
    strategy: Strategy;
    chunkSize: number;
    pauseRules: PauseRules;
    tokenizerVersion: "1";
    chunks: Chunk[];
}

export interface TimelineEntry {
    tokenId: string;
    tokenIndex: number;
    tStartSec: number;
    tEndSec: number;
}

export interface Timeline {
    planId: string;
    entries: TimelineEntry[];
    durationSec: number;
}

export interface AudioAsset {
    chunkHash: string;
    sampleRate: number;
    durationSec: number;
    encoding: "PCM_F32" | "WAV";
    data: ArrayBuffer;
    lastAccessMs: number;
    sizeBytes: number;
}
