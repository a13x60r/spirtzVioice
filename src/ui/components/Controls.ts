export class Controls {
    private container: HTMLElement;
    private onPlayPause: () => void;
    private onSeek: (offset: number) => void;
    private onSpeedChange: (wpm: number) => void;

    private playBtn!: HTMLButtonElement;
    private progressBar!: HTMLDivElement;
    private speedInput!: HTMLInputElement;

    constructor(
        container: HTMLElement,
        callbacks: {
            onPlayPause: () => void;
            onSeek: (offset: number) => void;
            onSpeedChange: (wpm: number) => void;
        }
    ) {
        this.container = container;
        this.onPlayPause = callbacks.onPlayPause;
        this.onSeek = callbacks.onSeek;
        this.onSpeedChange = callbacks.onSpeedChange;

        this.render();
        this.bindEvents();
    }

    private render() {
        this.container.innerHTML = `
            <div class="controls-layout">
                <div class="progress-bar-container" id="progress-container">
                    <div class="progress-bar-fill" id="progress-fill" style="width: 0%"></div>
                </div>
                
                <div class="controls-row">
                    <div class="speed-control">
                        <label for="speed-input">WPM</label>
                        <input type="number" id="speed-input" class="input" value="250" step="10" min="50" max="1000" style="width: 80px">
                    </div>

                    <div class="playback-buttons">
                        <button class="btn btn-secondary" id="seek-back">-10s</button>
                        <button class="btn" id="play-pause">Play</button>
                        <button class="btn btn-secondary" id="seek-fwd">+10s</button>
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

        this.speedInput.addEventListener('change', (e) => {
            const val = parseInt((e.target as HTMLInputElement).value, 10);
            if (!isNaN(val)) this.onSpeedChange(val);
        });
    }

    setPlaying(isPlaying: boolean) {
        this.playBtn.textContent = isPlaying ? 'Pause' : 'Play';
        this.playBtn.classList.toggle('btn-primary', !isPlaying);
        this.playBtn.classList.toggle('btn-secondary', isPlaying); // Optional style toggle
    }

    setProgress(percent: number) {
        this.progressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    }

    setTime(current: string, total: string) {
        const el = this.container.querySelector('#time-display');
        if (el) el.textContent = `${current} / ${total}`;
    }
}
