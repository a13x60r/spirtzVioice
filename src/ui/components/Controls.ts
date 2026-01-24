// SVG Icons
const ICONS = {
    play: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`,
    pause: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`,
    skipWordBack: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>`, // Chevron Left
    skipWordFwd: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>`, // Chevron Right
    skipSentBack: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>`, // Fast Rewind
    skipSentFwd: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>`, // Fast Forward
    skipParaBack: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>`, // Skip Previous
    skipParaFwd: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>`, // Skip Next
    seekBack: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/><text x="12" y="18" font-size="6" text-anchor="middle" fill="currentColor">10</text></svg>`, // Replay 10 (Custom approx)
    seekFwd: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M18.4 10.6C16.55 9 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"/><text x="12" y="18" font-size="6" text-anchor="middle" fill="currentColor">10</text></svg>`, // Fwd 10
    volume: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`
};

export class Controls {
    private container: HTMLElement;
    private onPlayPause: () => void;
    private onSeek: (offset: number) => void;
    private onSkip: (type: 'word' | 'sentence' | 'paragraph', direction: 1 | -1) => void;
    private onSpeedChange: (rate: number) => void;
    private onWpmChange: (wpm: number) => void;
    private onVolumeChange: (volume: number) => void;

    private playBtn!: HTMLButtonElement;
    private progressBar!: HTMLDivElement;
    private speedInput!: HTMLInputElement;     // Rate
    private wpmInput!: HTMLInputElement;       // WPM
    private volumeInput!: HTMLInputElement;    // Volume
    private speedDisplay!: HTMLSpanElement;    // Rate Display
    private wpmDisplay!: HTMLSpanElement;      // WPM Display
    private timeDisplay!: HTMLDivElement;

    // State tracking for efficient updates
    private lastIsPlaying: boolean | null = null;
    private lastProgress: number | null = null;
    private lastTimeCurrent: string | null = null;
    private lastTimeTotal: string | null = null;

    constructor(
        container: HTMLElement,
        callbacks: {
            onPlayPause: () => void;
            onSeek: (offset: number) => void;
            onSkip: (type: 'word' | 'sentence' | 'paragraph', direction: 1 | -1) => void;
            onSpeedChange: (rate: number) => void;
            onWpmChange: (wpm: number) => void;
            onVolumeChange: (volume: number) => void;
        },
        initialRate: number = 1.0,
        initialWpm: number = 250,
        initialVolume: number = 1.0
    ) {
        this.container = container;
        this.onPlayPause = callbacks.onPlayPause;
        this.onSeek = callbacks.onSeek;
        this.onSkip = callbacks.onSkip;
        this.onSpeedChange = callbacks.onSpeedChange;
        this.onWpmChange = callbacks.onWpmChange;
        this.onVolumeChange = callbacks.onVolumeChange;

        this.render(initialRate, initialWpm, initialVolume);
        this.bindEvents();
    }

    private render(initialRate: number, initialWpm: number, initialVolume: number) {
        this.container.innerHTML = `
            <div class="controls-layout">
                <div class="progress-bar-container" id="progress-container">
                    <div class="progress-bar-fill" id="progress-fill" style="width: 0%"></div>
                </div>
                
                <div class="controls-row">
                    <div class="speed-control-group">
                        <div class="speed-control">
                            <label for="speed-input" title="Playback Rate (Instant)">R</label>
                            <input type="range" id="speed-input" min="0.5" max="2.0" step="0.1" value="${initialRate}">
                            <span id="speed-val-display">${initialRate.toFixed(1)}x</span>
                        </div>
                        <div class="speed-control">
                            <label for="wpm-input" title="Synthesis WPM (Re-generates Audio)">W</label>
                            <input type="range" id="wpm-input" min="200" max="600" step="10" value="${initialWpm}">
                            <span id="wpm-val-display">${initialWpm}</span>
                        </div>
                         <div class="speed-control">
                            <div title="Volume" class="icon-label">${ICONS.volume}</div>
                            <input type="range" id="volume-input" min="0" max="1" step="0.05" value="${initialVolume}">
                        </div>
                    </div>

                    <div class="playback-buttons">
                        <button class="btn btn-secondary btn-icon" id="skip-para-back" title="Prev Paragraph">${ICONS.skipParaBack}</button>
                        <button class="btn btn-secondary btn-icon" id="skip-sent-back" title="Prev Sentence">${ICONS.skipSentBack}</button>
                        <button class="btn btn-secondary btn-icon" id="skip-word-back" title="Prev Word">${ICONS.skipWordBack}</button>
                        
                        <button class="btn btn-secondary btn-icon" id="seek-back" title="Rewind 10s">${ICONS.seekBack}</button>
                        <button class="btn btn-icon btn-lg" id="play-pause" title="Play/Pause">${ICONS.play}</button>
                        <button class="btn btn-secondary btn-icon" id="seek-fwd" title="Forward 10s">${ICONS.seekFwd}</button>

                        <button class="btn btn-secondary btn-icon" id="skip-word-fwd" title="Next Word">${ICONS.skipWordFwd}</button>
                        <button class="btn btn-secondary btn-icon" id="skip-sent-fwd" title="Next Sentence">${ICONS.skipSentFwd}</button>
                        <button class="btn btn-secondary btn-icon" id="skip-para-fwd" title="Next Paragraph">${ICONS.skipParaFwd}</button>
                    </div>

                    <div class="time-display" id="time-display">0:00 / 0:00</div>
                </div>
            </div>
            <style>
                .btn-icon {
                    padding: 6px;
                    line-height: 0;
                    border-radius: 50%;
                    width: 36px;
                    height: 36px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                }
                .btn-lg {
                    width: 48px;
                    height: 48px;
                }
                .playback-buttons {
                    align-items: center;
                }
            </style>
        `;

        this.playBtn = this.container.querySelector('#play-pause')!;
        this.speedInput = this.container.querySelector('#speed-input')!;
        this.wpmInput = this.container.querySelector('#wpm-input')!;
        this.volumeInput = this.container.querySelector('#volume-input')!;
        this.progressBar = this.container.querySelector('#progress-fill')!;
        this.timeDisplay = this.container.querySelector('#time-display')!;
        this.speedDisplay = this.container.querySelector('#speed-val-display')!;
        this.wpmDisplay = this.container.querySelector('#wpm-val-display')!;
    }

    private bindEvents() {
        this.playBtn.addEventListener('click', () => {
            this.onPlayPause();
        });

        this.container.querySelector('#seek-back')?.addEventListener('click', () => this.onSeek(-10));
        this.container.querySelector('#seek-fwd')?.addEventListener('click', () => this.onSeek(10));

        this.container.querySelector('#skip-word-back')?.addEventListener('click', () => this.onSkip('word', -1));
        this.container.querySelector('#skip-word-fwd')?.addEventListener('click', () => this.onSkip('word', 1));
        this.container.querySelector('#skip-sent-back')?.addEventListener('click', () => this.onSkip('sentence', -1));
        this.container.querySelector('#skip-sent-fwd')?.addEventListener('click', () => this.onSkip('sentence', 1));
        this.container.querySelector('#skip-para-back')?.addEventListener('click', () => this.onSkip('paragraph', -1));
        this.container.querySelector('#skip-para-fwd')?.addEventListener('click', () => this.onSkip('paragraph', 1));

        this.speedInput.addEventListener('input', (e) => {
            const val = parseFloat((e.target as HTMLInputElement).value);
            this.speedDisplay.textContent = `${val.toFixed(1)}x`;
            this.onSpeedChange(val);
        });

        this.wpmInput.addEventListener('change', (e) => {
            const val = parseInt((e.target as HTMLInputElement).value, 10);
            this.wpmDisplay.textContent = val.toString();
            this.onWpmChange(val);
        });

        this.wpmInput.addEventListener('input', (e) => {
            const val = parseInt((e.target as HTMLInputElement).value, 10);
            this.wpmDisplay.textContent = val.toString();
        });

        this.volumeInput.addEventListener('input', (e) => {
            const val = parseFloat((e.target as HTMLInputElement).value);
            this.onVolumeChange(val);
        });
    }

    setPlaying(isPlaying: boolean) {
        if (this.lastIsPlaying === isPlaying) return;
        this.lastIsPlaying = isPlaying;

        this.playBtn.innerHTML = isPlaying ? ICONS.pause : ICONS.play;
        this.playBtn.title = isPlaying ? "Pause" : "Play";
        this.playBtn.classList.toggle('btn-primary', !isPlaying);
        this.playBtn.classList.toggle('btn-secondary', isPlaying);
    }

    setProgress(percent: number) {
        if (Math.abs((this.lastProgress || 0) - percent) < 0.1) return;
        this.lastProgress = percent;
        this.progressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    }

    setTime(current: string, total: string) {
        if (this.lastTimeCurrent === current && this.lastTimeTotal === total) return;
        this.lastTimeCurrent = current;
        this.lastTimeTotal = total;
        this.timeDisplay.textContent = `${current} / ${total}`;
    }

    setPlaybackRate(rate: number) {
        if (this.speedInput) this.speedInput.value = rate.toString();
        if (this.speedDisplay) this.speedDisplay.textContent = `${rate.toFixed(1)}x`;
    }

    setWpm(wpm: number) {
        if (this.wpmInput) this.wpmInput.value = wpm.toString();
        if (this.wpmDisplay) this.wpmDisplay.textContent = wpm.toString();
    }

    updateSpeed(rate: number, wpm: number) {
        this.setPlaybackRate(rate);
        this.setWpm(wpm);
    }
}
