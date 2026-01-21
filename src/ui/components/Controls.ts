export class Controls {
    private container: HTMLElement;
    private onPlayPause: () => void;
    private onSeek: (offset: number) => void;
    private onSkip: (type: 'word' | 'sentence' | 'paragraph', direction: 1 | -1) => void;
    private onSpeedChange: (rate: number) => void;

    private playBtn!: HTMLButtonElement;
    private progressBar!: HTMLDivElement;
    private speedInput!: HTMLInputElement;
    private speedDisplay!: HTMLSpanElement; // Added this based on usage in bindEvents
    private timeDisplay!: HTMLDivElement; // Added this based on usage in setTime

    constructor(
        container: HTMLElement,
        callbacks: {
            onPlayPause: () => void;
            onSeek: (offset: number) => void;
            onSkip: (type: 'word' | 'sentence' | 'paragraph', direction: 1 | -1) => void;
            onSpeedChange: (rate: number) => void;
        },
        initialRate: number = 1.0
    ) {
        this.container = container;
        this.onPlayPause = callbacks.onPlayPause;
        this.onSeek = callbacks.onSeek;
        this.onSkip = callbacks.onSkip;
        this.onSpeedChange = callbacks.onSpeedChange;

        this.render(initialRate);
        this.bindEvents();
    }

    private render(initialRate: number) {
        this.container.innerHTML = `
            <div class="controls-layout">
                <div class="progress-bar-container" id="progress-container">
                    <div class="progress-bar-fill" id="progress-fill" style="width: 0%"></div>
                </div>
                
                <div class="controls-row">
                    <div class="speed-control">
                        <label for="speed-input">Rate</label>
                        <input type="range" id="speed-input" min="0.5" max="2.0" step="0.1" value="${initialRate}" style="width: 100px">
                        <span id="speed-val-display" style="min-width: 32px; font-weight: 600; color: var(--color-primary);">${initialRate.toFixed(1)}x</span>
                    </div>

                    <div class="playback-buttons">
                        <button class="btn btn-secondary btn-sm" id="skip-word-back" title="Prev Word">|&lt;</button>
                        <button class="btn btn-secondary btn-sm" id="skip-sent-back" title="Prev Sentence">||&lt;</button>
                        <button class="btn btn-secondary btn-sm" id="skip-para-back" title="Prev Paragraph">|||&lt;</button>
                        
                        <button class="btn btn-secondary" id="seek-back">-10s</button>
                        <button class="btn" id="play-pause">Play</button>
                        <button class="btn btn-secondary" id="seek-fwd">+10s</button>

                        <button class="btn btn-secondary btn-sm" id="skip-para-fwd" title="Next Paragraph">&gt;|||</button>
                        <button class="btn btn-secondary btn-sm" id="skip-sent-fwd" title="Next Sentence">&gt;||</button>
                        <button class="btn btn-secondary btn-sm" id="skip-word-fwd" title="Next Word">&gt;|</button>
                    </div>

                    <div class="time-display" id="time-display">0:00 / 0:00</div>
                </div>
            </div>
        `;

        this.playBtn = this.container.querySelector('#play-pause')!;
        this.speedInput = this.container.querySelector('#speed-input')!;
        this.progressBar = this.container.querySelector('#progress-fill')!;
        this.timeDisplay = this.container.querySelector('#time-display')!;
        this.speedDisplay = this.container.querySelector('#speed-val-display')!;
    }

    private bindEvents() {
        this.playBtn.addEventListener('click', () => this.onPlayPause());

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
            this.onSpeedChange(val); // passes rate (0.5-2.0)
        });
    }

    setPlaying(isPlaying: boolean) {
        this.playBtn.textContent = isPlaying ? 'Pause' : 'Play';
        this.playBtn.classList.toggle('btn-primary', !isPlaying);
        this.playBtn.classList.toggle('btn-secondary', isPlaying);
    }

    setProgress(percent: number) {
        this.progressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    }

    setTime(current: string, total: string) {
        this.timeDisplay.textContent = `${current} / ${total}`;
    }

    setPlaybackRate(rate: number) {
        // Find slider and label
        const slider = this.container.querySelector('#speed-input') as HTMLInputElement;
        const label = this.container.querySelector('#speed-val-display');
        if (slider) slider.value = rate.toString();
        if (label) label.textContent = `${rate.toFixed(1)}x`;
    }


}
