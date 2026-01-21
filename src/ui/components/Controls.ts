export class Controls {
    private container: HTMLElement;
    private onPlayPause: () => void;
    private onSeek: (offset: number) => void;
    private onSkip: (type: 'word' | 'sentence' | 'paragraph', direction: 1 | -1) => void;
    private onSpeedChange: (wpm: number) => void;

    private playBtn!: HTMLButtonElement;
    private progressBar!: HTMLDivElement;
    private speedInput!: HTMLInputElement;

    constructor(
        container: HTMLElement,
        callbacks: {
            onPlayPause: () => void;
            onSeek: (offset: number) => void;
            onSkip: (type: 'word' | 'sentence' | 'paragraph', direction: 1 | -1) => void;
            onSpeedChange: (wpm: number) => void;
        },
        initialWpm?: number
    ) {
        this.container = container;
        this.onPlayPause = callbacks.onPlayPause;
        this.onSeek = callbacks.onSeek;
        this.onSkip = callbacks.onSkip;
        this.onSpeedChange = callbacks.onSpeedChange;

        this.render(initialWpm || 250);
        this.bindEvents();
    }

    private render(initialWpm: number) {
        this.container.innerHTML = `
            <div class="controls-layout">
                <div class="progress-bar-container" id="progress-container">
                    <div class="progress-bar-fill" id="progress-fill" style="width: 0%"></div>
                </div>
                
                <div class="controls-row">
                    <div class="speed-control">
                        <label for="speed-input">WPM</label>
                        <input type="range" id="speed-input" min="100" max="800" step="10" value="${initialWpm}" style="width: 120px">
                        <span id="speed-val-display" style="min-width: 32px; font-weight: 600; color: var(--color-primary);">${initialWpm}</span>
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
            const val = parseInt((e.target as HTMLInputElement).value, 10);
            const display = this.container.querySelector('#speed-val-display');
            if (display) display.textContent = val.toString();
            if (!isNaN(val)) this.onSpeedChange(val);
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
        const el = this.container.querySelector('#time-display');
        if (el) el.textContent = `${current} / ${total}`;
    }

    setSpeed(wpm: number) {
        if (this.speedInput) {
            this.speedInput.value = wpm.toString();
            const display = this.container.querySelector('#speed-val-display');
            if (display) display.textContent = wpm.toString();
        }
    }
}
