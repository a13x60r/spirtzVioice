export interface SettingsCallbacks {
    onClose: () => void;
    onVoiceChange: (voiceId: string) => void;
    onSpeedChange: (wpm: number) => void;
    onStrategyChange: (strategy: 'TOKEN' | 'CHUNK') => void;
}

export class SettingsPanel {
    private container: HTMLElement;
    private callbacks: SettingsCallbacks;
    private voices: { id: string, name: string }[] = [];
    private currentSettings: { voiceId: string, speedWpm: number, strategy: string };

    constructor(
        container: HTMLElement,
        callbacks: SettingsCallbacks,
        initialSettings: { voiceId: string, speedWpm: number, strategy: string }
    ) {
        this.container = container;
        this.callbacks = callbacks;
        this.currentSettings = initialSettings;
    }

    setVoices(voices: { id: string, name: string }[]) {
        this.voices = voices;
        // If mounted, re-render logic could go here, but usually set before mount
    }

    mount() {
        // Generate options
        const voiceOptions = this.voices.map(v =>
            `<option value="${v.id}" ${v.id === this.currentSettings.voiceId ? 'selected' : ''}>${v.name}</option>`
        ).join('');

        this.container.innerHTML = `
            <div class="settings-modal-overlay">
                <div class="settings-modal">
                    <header class="settings-header">
                        <h2>Settings</h2>
                        <button class="btn btn-secondary" id="close-settings">Close</button>
                    </header>
                    
                    <div class="settings-content">
                        <section class="settings-group">
                            <h3>Voice</h3>
                            <select id="voice-select" class="input">
                                ${voiceOptions}
                            </select>
                        </section>

                        <section class="settings-group">
                            <h3>Reading Speed</h3>
                            <div class="range-control">
                                <input type="range" min="100" max="800" step="10" id="speed-range" value="${this.currentSettings.speedWpm}">
                                <span id="speed-value">${this.currentSettings.speedWpm} WPM</span>
                            </div>
                        </section>

                        <section class="settings-group">
                            <h3>Strategy</h3>
                            <div class="radio-group">
                                <label>
                                    <input type="radio" name="strategy" value="TOKEN" ${this.currentSettings.strategy === 'TOKEN' ? 'checked' : ''}> 
                                    Word by Word
                                </label>
                                <label>
                                    <input type="radio" name="strategy" value="CHUNK" ${this.currentSettings.strategy === 'CHUNK' ? 'checked' : ''}> 
                                    Chunked (Natural)
                                </label>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        `;

        this.bindEvents();
    }

    private bindEvents() {
        this.container.querySelector('#close-settings')?.addEventListener('click', () => this.callbacks.onClose());

        const voiceSelect = this.container.querySelector('#voice-select') as HTMLSelectElement;
        voiceSelect?.addEventListener('change', (e) => {
            const val = (e.target as HTMLSelectElement).value;
            this.callbacks.onVoiceChange(val);
        });

        const speedRange = this.container.querySelector('#speed-range') as HTMLInputElement;
        const speedValue = this.container.querySelector('#speed-value');
        speedRange?.addEventListener('input', (e) => {
            const val = parseInt((e.target as HTMLInputElement).value);
            if (speedValue) speedValue.textContent = `${val} WPM`;
            this.callbacks.onSpeedChange(val);
        });

        const strategyRadios = this.container.querySelectorAll('input[name="strategy"]');
        strategyRadios.forEach(r => {
            r.addEventListener('change', (e) => {
                const val = (e.target as HTMLInputElement).value as 'TOKEN' | 'CHUNK';
                this.callbacks.onStrategyChange(val);
            });
        });
    }

    unmount() {
        this.container.innerHTML = '';
    }
}
