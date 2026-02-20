// Material Symbols Icons
const icon = (name: string) => `<span class="material-symbols-outlined" aria-hidden="true">${name}</span>`;
const ICONS = {
    play: icon('play_arrow'),
    pause: icon('pause'),
    skipWordBack: icon('chevron_left'),
    skipWordFwd: icon('chevron_right'),
    skipSentBack: icon('fast_rewind'),
    skipSentFwd: icon('fast_forward'),
    skipParaBack: icon('skip_previous'),
    skipParaFwd: icon('skip_next'),
    skipChunkBack: icon('first_page'),
    highlight: icon('star'),
    note: icon('note_add'),
    copy: icon('content_copy'),
    seekBack: icon('replay_10'),
    seekFwd: icon('forward_10'),
    volume: icon('volume_up'),
    tune: icon('tune')
};

const WPM_PRESETS = [180, 240, 300, 360];
const DEFAULT_WPM_RANGE = { min: 200, max: 1400 };

export class Controls {
    private container: HTMLElement;
    private onPlayPause: () => void;
    private onSeek: (offset: number) => void;
    private onSkip: (type: 'word' | 'sentence' | 'paragraph' | 'chunk', direction: 1 | -1) => void;
    private onHighlight: () => void;
    private onNote: () => void;
    private onCopySentence: () => void;
    private onViewChange: (mode: 'RSVP' | 'FOCUS' | 'PARAGRAPH') => void;
    private onSpeedChange: (rate: number) => void;
    private onWpmChange: (wpm: number) => void;
    private onVolumeChange: (volume: number) => void;

    private playBtn!: HTMLButtonElement;
    private progressBar!: HTMLDivElement;
    private speedInput!: HTMLInputElement;
    private wpmInput!: HTMLInputElement;
    private volumeInput!: HTMLInputElement;
    private speedDisplay!: HTMLSpanElement;
    private wpmNumberInput!: HTMLInputElement;
    private timeDisplay!: HTMLDivElement;
    private wpmPresetButtons: HTMLButtonElement[] = [];
    private drawerEl!: HTMLElement;
    private backdropEl!: HTMLElement;

    // State tracking for efficient updates
    private lastIsPlaying: boolean | null = null;
    private lastProgress: number | null = null;
    private lastTimeCurrent: string | null = null;
    private lastTimeTotal: string | null = null;
    private isDrawerOpen = false;

    constructor(
        container: HTMLElement,
        callbacks: {
            onPlayPause: () => void;
            onSeek: (offset: number) => void;
            onSkip: (type: 'word' | 'sentence' | 'paragraph' | 'chunk', direction: 1 | -1) => void;
            onHighlight: () => void;
            onNote: () => void;
            onCopySentence: () => void;
            onViewChange: (mode: 'RSVP' | 'FOCUS' | 'PARAGRAPH') => void;
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
        this.onHighlight = callbacks.onHighlight;
        this.onNote = callbacks.onNote;
        this.onCopySentence = callbacks.onCopySentence;
        this.onViewChange = callbacks.onViewChange;
        this.onSpeedChange = callbacks.onSpeedChange;
        this.onWpmChange = callbacks.onWpmChange;
        this.onVolumeChange = callbacks.onVolumeChange;

        this.render(initialRate, initialWpm, initialVolume);
        this.bindEvents();
        this.setWpm(initialWpm);
    }

    private render(initialRate: number, initialWpm: number, initialVolume: number) {
        this.container.innerHTML = `
            <!-- Progress bar at top of controls area -->
            <div class="progress-bar-container" id="progress-container">
                <div class="progress-bar-fill" id="progress-fill" style="width: 0%"></div>
            </div>

            <!-- Compact transport bar (always visible) -->
            <div class="controls-transport">
                <div class="time-display" id="time-display">0:00 / 0:00</div>
                <div class="transport-nav">
                    <button class="btn btn-secondary btn-icon btn-sm" id="skip-sent-back" title="Prev Sentence" aria-label="Previous sentence">${ICONS.skipSentBack}</button>
                    <button class="btn btn-secondary btn-icon btn-sm" id="seek-back" title="Rewind 10s" aria-label="Rewind 10 seconds">${ICONS.seekBack}</button>
                </div>

                <button class="btn btn-primary btn-icon btn-lg" id="play-pause" title="Play/Pause" aria-label="Play or pause">${ICONS.play}</button>

                <div class="transport-nav">
                    <button class="btn btn-secondary btn-icon btn-sm" id="seek-fwd" title="Forward 10s" aria-label="Forward 10 seconds">${ICONS.seekFwd}</button>
                    <button class="btn btn-secondary btn-icon btn-sm" id="skip-sent-fwd" title="Next Sentence" aria-label="Next sentence">${ICONS.skipSentFwd}</button>
                </div>

            </div>

            <!-- Drawer Handle -->
            <div class="drawer-handle" id="drawer-handle">
                <div class="drawer-handle-inner">
                    ${icon('expand_less')}
                    <span class="drawer-handle-label">CONTROLS</span>
                </div>
            </div>

            <!-- Drawer Backdrop -->
            <div class="drawer-backdrop" id="drawer-backdrop"></div>

            <!-- Drawer Panel -->
            <div class="drawer-panel" id="drawer-panel">
                <!-- Drawer header with close handle -->
                <div class="drawer-panel-handle" id="drawer-close">
                    <div class="drawer-handle-inner">
                        ${icon('keyboard_arrow_down')}
                        <span class="drawer-handle-label">CONTROLS</span>
                    </div>
                </div>

                <div class="drawer-content">
                    <!-- SPEED Section -->
                    <section class="drawer-section">
                        <div class="drawer-section-header">
                            <label class="drawer-section-title">SPEED</label>
                            <span class="drawer-section-meta" id="speed-val-display">${initialRate.toFixed(1)}x</span>
                        </div>
                        <div class="drawer-section-body">
                            <input type="range" id="speed-input" min="0.5" max="2.0" step="0.1" value="${initialRate}" aria-label="Playback rate">
                            <div class="range-labels">
                                <span>0.5x</span>
                                <span>Rate</span>
                                <span>2.0x</span>
                            </div>
                        </div>
                    </section>

                    <!-- WPM Section -->
                    <section class="drawer-section">
                        <div class="drawer-section-header">
                            <label class="drawer-section-title">WPM</label>
                            <span class="drawer-section-meta"><input type="number" id="wpm-input-number" min="${DEFAULT_WPM_RANGE.min}" max="${DEFAULT_WPM_RANGE.max}" step="10" value="${initialWpm}" class="wpm-number-input" aria-label="Words per minute"></span>
                        </div>
                        <div class="drawer-section-body">
                            <input type="range" id="wpm-input" min="${DEFAULT_WPM_RANGE.min}" max="${DEFAULT_WPM_RANGE.max}" step="10" value="${initialWpm}" aria-label="Words per minute">
                            <div class="range-labels">
                                <span>${DEFAULT_WPM_RANGE.min}</span>
                                <span>Words/Min</span>
                                <span>${DEFAULT_WPM_RANGE.max}</span>
                            </div>
                            <div class="wpm-presets" id="wpm-presets">
                                ${WPM_PRESETS.map(value => `<button class="btn btn-secondary btn-sm wpm-preset" data-wpm="${value}">[${value}]</button>`).join('')}
                                <button class="btn btn-secondary btn-sm wpm-preset" data-wpm="custom">[Custom]</button>
                            </div>
                        </div>
                    </section>

                    <!-- MODE Section -->
                    <section class="drawer-section">
                        <div class="drawer-section-header">
                            <label class="drawer-section-title">MODE</label>
                            <span class="drawer-section-meta">ENGINE</span>
                        </div>
                        <div class="drawer-radio-group" id="view-switch-group" aria-label="View mode">
                            <label class="drawer-radio-option">
                                <input type="radio" name="view-mode" value="RSVP" class="sr-only" data-view="RSVP">
                                <span class="drawer-radio-label">[RSVP]</span>
                            </label>
                            <label class="drawer-radio-option">
                                <input type="radio" name="view-mode" value="FOCUS" class="sr-only" data-view="FOCUS">
                                <span class="drawer-radio-label">[FOCUS]</span>
                            </label>
                            <label class="drawer-radio-option">
                                <input type="radio" name="view-mode" value="PARAGRAPH" class="sr-only" data-view="PARAGRAPH">
                                <span class="drawer-radio-label">[PARA]</span>
                            </label>
                        </div>
                    </section>

                    <!-- VOLUME Section -->
                    <section class="drawer-section">
                        <div class="drawer-section-header">
                            <label class="drawer-section-title">VOLUME</label>
                            <span class="drawer-section-meta">${icon('volume_up')}</span>
                        </div>
                        <div class="drawer-section-body">
                            <input type="range" id="volume-input" min="0" max="1" step="0.05" value="${initialVolume}" aria-label="Volume">
                        </div>
                    </section>

                    <!-- NAVIGATION Section -->
                    <section class="drawer-section">
                        <div class="drawer-section-header">
                            <label class="drawer-section-title">NAVIGATION</label>
                            <span class="drawer-section-meta">SKIP</span>
                        </div>
                        <div class="drawer-nav-grid">
                            <button class="btn btn-secondary btn-icon" id="skip-chunk-back" title="Prev Chunk" aria-label="Previous chunk">${ICONS.skipChunkBack}</button>
                            <button class="btn btn-secondary btn-icon" id="skip-para-back" title="Prev §" aria-label="Previous paragraph">${ICONS.skipParaBack}</button>
                            <button class="btn btn-secondary btn-icon" id="skip-word-back" title="Prev Word" aria-label="Previous word">${ICONS.skipWordBack}</button>
                            <button class="btn btn-secondary btn-icon" id="skip-word-fwd" title="Next Word" aria-label="Next word">${ICONS.skipWordFwd}</button>
                            <button class="btn btn-secondary btn-icon" id="skip-para-fwd" title="Next §" aria-label="Next paragraph">${ICONS.skipParaFwd}</button>
                        </div>
                    </section>

                    <!-- TOOLS Section -->
                    <section class="drawer-section">
                        <div class="drawer-section-header">
                            <label class="drawer-section-title">TOOLS</label>
                            <span class="drawer-section-meta">ACTIONS</span>
                        </div>
                        <div class="drawer-nav-grid">
                            <button class="btn btn-secondary btn-icon" id="highlight-buffer" title="Highlight" aria-label="Highlight buffer">${ICONS.highlight}</button>
                            <button class="btn btn-secondary btn-icon" id="note-sentence" title="Note" aria-label="Add note">${ICONS.note}</button>
                            <button class="btn btn-secondary btn-icon" id="copy-sentence" title="Copy" aria-label="Copy sentence">${ICONS.copy}</button>
                        </div>
                    </section>
                </div>
            </div>
        `;

        this.playBtn = this.container.querySelector('#play-pause')!;
        this.speedInput = this.container.querySelector('#speed-input')!;
        this.wpmInput = this.container.querySelector('#wpm-input')!;
        this.wpmNumberInput = this.container.querySelector('#wpm-input-number')!;
        this.volumeInput = this.container.querySelector('#volume-input')!;
        this.progressBar = this.container.querySelector('#progress-fill')!;
        this.timeDisplay = this.container.querySelector('#time-display')!;
        this.speedDisplay = this.container.querySelector('#speed-val-display')!;
        this.wpmPresetButtons = Array.from(this.container.querySelectorAll('.wpm-preset')) as HTMLButtonElement[];
        this.drawerEl = this.container.querySelector('#drawer-panel')!;
        this.backdropEl = this.container.querySelector('#drawer-backdrop')!;
    }

    private bindEvents() {
        this.playBtn.addEventListener('click', () => {
            this.onPlayPause();
        });

        // Drawer open/close
        this.container.querySelector('#drawer-handle')?.addEventListener('click', () => this.toggleDrawer(true));
        this.container.querySelector('#drawer-close')?.addEventListener('click', () => this.toggleDrawer(false));
        this.backdropEl.addEventListener('click', () => this.toggleDrawer(false));

        this.container.querySelector('#seek-back')?.addEventListener('click', () => this.onSeek(-10));
        this.container.querySelector('#seek-fwd')?.addEventListener('click', () => this.onSeek(10));

        this.container.querySelector('#skip-word-back')?.addEventListener('click', () => this.onSkip('word', -1));
        this.container.querySelector('#skip-word-fwd')?.addEventListener('click', () => this.onSkip('word', 1));
        this.container.querySelector('#skip-sent-back')?.addEventListener('click', () => this.onSkip('sentence', -1));
        this.container.querySelector('#skip-sent-fwd')?.addEventListener('click', () => this.onSkip('sentence', 1));
        this.container.querySelector('#skip-chunk-back')?.addEventListener('click', () => this.onSkip('chunk', -1));
        this.container.querySelector('#skip-para-back')?.addEventListener('click', () => this.onSkip('paragraph', -1));
        this.container.querySelector('#skip-para-fwd')?.addEventListener('click', () => this.onSkip('paragraph', 1));
        this.container.querySelector('#highlight-buffer')?.addEventListener('click', () => this.onHighlight());
        this.container.querySelector('#note-sentence')?.addEventListener('click', () => this.onNote());
        this.container.querySelector('#copy-sentence')?.addEventListener('click', () => this.onCopySentence());

        // View mode radio buttons
        this.container.querySelectorAll('#view-switch-group input[type="radio"]').forEach(radio => {
            radio.addEventListener('change', () => {
                const input = radio as HTMLInputElement;
                const mode = input.value as 'RSVP' | 'FOCUS' | 'PARAGRAPH';
                this.onViewChange(mode);
            });
        });

        this.speedInput.addEventListener('input', (e) => {
            const val = parseFloat((e.target as HTMLInputElement).value);
            this.speedDisplay.textContent = `[${val.toFixed(1)}x]`;
            this.onSpeedChange(val);
        });

        this.wpmInput.addEventListener('change', (e) => {
            const val = parseInt((e.target as HTMLInputElement).value, 10);
            this.updateWpmInputs(val, false);
            this.onWpmChange(val);
        });

        this.wpmInput.addEventListener('input', (e) => {
            const val = parseInt((e.target as HTMLInputElement).value, 10);
            this.updateWpmInputs(val, false);
        });

        this.wpmNumberInput.addEventListener('input', (e) => {
            const val = parseInt((e.target as HTMLInputElement).value, 10);
            if (Number.isNaN(val)) return;
            this.updateWpmInputs(val, false);
        });

        this.wpmNumberInput.addEventListener('change', (e) => {
            const val = parseInt((e.target as HTMLInputElement).value, 10);
            if (Number.isNaN(val)) return;
            const clamped = this.clampWpm(val);
            this.updateWpmInputs(clamped, false);
            this.onWpmChange(clamped);
        });

        this.wpmPresetButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLButtonElement;
                const value = target.dataset.wpm || '';
                if (value === 'custom') {
                    this.wpmNumberInput.focus();
                    this.setPresetActive(null);
                    return;
                }
                const presetValue = parseInt(value, 10);
                if (Number.isNaN(presetValue)) return;
                const clamped = this.clampWpm(presetValue);
                this.updateWpmInputs(clamped, true);
                this.onWpmChange(clamped);
            });
        });

        this.volumeInput.addEventListener('input', (e) => {
            const val = parseFloat((e.target as HTMLInputElement).value);
            this.onVolumeChange(val);
        });
    }

    private toggleDrawer(open: boolean) {
        this.isDrawerOpen = open;
        this.drawerEl.classList.toggle('open', open);
        this.backdropEl.classList.toggle('open', open);
        document.body.classList.toggle('drawer-open', open);
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
        if (this.speedDisplay) this.speedDisplay.textContent = `[${rate.toFixed(1)}x]`;
    }

    setWpm(wpm: number) {
        this.updateWpmInputs(wpm, false);
    }

    updateSpeed(rate: number, wpm: number) {
        this.setPlaybackRate(rate);
        this.setWpm(wpm);
    }

    setActiveView(mode: 'RSVP' | 'FOCUS' | 'PARAGRAPH') {
        this.container.querySelectorAll('#view-switch-group input[type="radio"]').forEach(radio => {
            const input = radio as HTMLInputElement;
            input.checked = input.value === mode;
        });
    }

    setWpmRange(min: number, max: number): number {
        this.wpmInput.min = min.toString();
        this.wpmInput.max = max.toString();
        this.wpmNumberInput.min = min.toString();
        this.wpmNumberInput.max = max.toString();

        const current = parseInt(this.wpmNumberInput.value, 10);
        const clamped = this.clampWpm(Number.isNaN(current) ? min : current);
        this.updateWpmInputs(clamped, false);
        return clamped;
    }

    private updateWpmInputs(value: number, userInitiated: boolean) {
        const clamped = this.clampWpm(value);
        this.wpmInput.value = clamped.toString();
        this.wpmNumberInput.value = clamped.toString();
        this.setPresetActive(userInitiated ? clamped : this.getPresetMatch(clamped));
    }

    private clampWpm(value: number): number {
        const min = parseInt(this.wpmInput.min, 10);
        const max = parseInt(this.wpmInput.max, 10);
        const safeMin = Number.isNaN(min) ? DEFAULT_WPM_RANGE.min : min;
        const safeMax = Number.isNaN(max) ? DEFAULT_WPM_RANGE.max : max;
        return Math.min(safeMax, Math.max(safeMin, value));
    }

    private setPresetActive(value: number | null) {
        const presetMatch = this.getPresetMatch(value ?? null);
        this.wpmPresetButtons.forEach(btn => {
            const dataValue = btn.dataset.wpm || '';
            const isCustom = dataValue === 'custom';
            const isActive = presetMatch === null ? isCustom : dataValue === presetMatch.toString();
            btn.classList.toggle('active', isActive);
        });
    }

    private getPresetMatch(value: number | null): number | null {
        if (value === null) return null;
        return WPM_PRESETS.includes(value) ? value : null;
    }
}
