export interface SettingsCallbacks {
    onClose: () => void;
    onVoiceChange: (voiceId: string) => void;
    onLanguageChange: (lang: string) => void;
    onInstallVoice: (voiceId: string) => Promise<void>;
    onSpeedChange: (wpm: number) => void;
    onStrategyChange: (strategy: 'TOKEN' | 'CHUNK') => void;
    onTextSizeChange: (scale: number) => void;
    onDarkModeChange: (enabled: boolean) => void;
}

export class SettingsPanel {
    private container: HTMLElement;
    private callbacks: SettingsCallbacks;
    private voices: { id: string, name: string, lang: string, isInstalled: boolean }[] = [];
    private currentSettings: { voiceId: string, speedWpm: number, strategy: string, language: string, textSize?: number, darkMode?: boolean };
    private isInstalling: boolean = false;

    constructor(
        container: HTMLElement,
        callbacks: SettingsCallbacks,
        initialSettings: { voiceId: string, speedWpm: number, strategy: string, language: string, textSize?: number, darkMode?: boolean }
    ) {
        this.container = container;
        this.callbacks = callbacks;
        this.currentSettings = initialSettings;
    }

    setVoices(voices: { id: string, name: string, lang: string, isInstalled: boolean }[]) {
        this.voices = voices;
        if (this.container.innerHTML) this.mount(); // Re-render if open
    }

    mount() {
        // Generate options
        // Generate options
        const languages = Array.from(new Set(this.voices.map(v => v.lang))).sort();

        const getLangName = (code: string) => {
            const names: Record<string, string> = {
                'en-US': 'English (US)',
                'es-ES': 'Spanish (ES)',
                'fr-FR': 'French (FR)',
                'de-DE': 'German (DE)',
                'ru-RU': 'Russian (RU)'
            };
            return names[code] || code;
        };

        const langOptions = languages.map(l =>
            `<option value="${l}" ${l === this.currentSettings.language ? 'selected' : ''}>${getLangName(l)}</option>`
        ).join('');

        const filteredVoices = this.voices.filter(v => v.lang === this.currentSettings.language);
        const voiceOptions = filteredVoices.map(v =>
            `<option value="${v.id}" ${v.id === this.currentSettings.voiceId ? 'selected' : ''}>${v.name}${v.isInstalled ? '' : ' (Download)'}</option>`
        ).join('');

        const selectedVoice = this.voices.find(v => v.id === this.currentSettings.voiceId);
        const needsDownload = selectedVoice && !selectedVoice.isInstalled;

        this.container.innerHTML = `
            <div class="settings-modal-overlay">
                <div class="settings-modal">
                    <header class="settings-header">
                        <h2>Settings</h2>
                        <button class="btn btn-secondary" id="close-settings">Close</button>
                    </header>
                    
                    <div class="settings-content">
                        <section class="settings-group">
                            <h3>Language</h3>
                            <select id="lang-select" class="input">
                                ${langOptions}
                            </select>
                        </section>

                        <section class="settings-group">
                            <h3>Voice</h3>
                            <div style="display: flex; gap: 0.5rem; flex-direction: column;">
                                <select id="voice-select" class="input">
                                    ${voiceOptions}
                                </select>
                                ${needsDownload ? `
                                    <button class="btn btn-primary" id="install-voice" ${this.isInstalling ? 'disabled' : ''}>
                                        ${this.isInstalling ? 'Downloading...' : 'Download Voice'}
                                    </button>
                                ` : ''}
                            </div>
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

                        <section class="settings-group">
                            <h3>Display</h3>
                            <div style="margin-bottom: 1rem;">
                                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                    <input type="checkbox" id="dark-mode-toggle" ${this.currentSettings.darkMode ? 'checked' : ''}>
                                    Dark Mode
                                </label>
                            </div>
                            <div class="range-control">
                                <label for="text-size-range" style="font-size: 0.9rem; color: var(--color-text-secondary);">Text Size</label>
                                <input type="range" min="0.5" max="2.0" step="0.1" id="text-size-range" value="${this.currentSettings.textSize || 1.0}">
                                <span id="text-size-value">${this.currentSettings.textSize || 1.0}x</span>
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

        const langSelect = this.container.querySelector('#lang-select') as HTMLSelectElement;
        langSelect?.addEventListener('change', (e) => {
            const val = (e.currentTarget as HTMLSelectElement).value;
            this.currentSettings.language = val;
            this.callbacks.onLanguageChange(val);
            this.mount(); // Refresh voice list
        });

        const voiceSelect = this.container.querySelector('#voice-select') as HTMLSelectElement;
        voiceSelect?.addEventListener('change', (e) => {
            const val = (e.target as HTMLSelectElement).value;
            this.callbacks.onVoiceChange(val);
            this.mount(); // Refresh to show download button if needed
        });

        const installBtn = this.container.querySelector('#install-voice') as HTMLButtonElement;
        installBtn?.addEventListener('click', async () => {
            this.isInstalling = true;
            this.mount();
            try {
                await this.callbacks.onInstallVoice(this.currentSettings.voiceId);
            } finally {
                this.isInstalling = false;
                this.mount();
            }
        });

        const speedRange = this.container.querySelector('#speed-range') as HTMLInputElement;
        const speedValue = this.container.querySelector('#speed-value');
        speedRange?.addEventListener('input', () => {
            const val = parseInt(speedRange.value);
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

        // Dark Mode
        const darkModeToggle = this.container.querySelector('#dark-mode-toggle') as HTMLInputElement;
        darkModeToggle?.addEventListener('change', (e) => {
            this.callbacks.onDarkModeChange(darkModeToggle.checked);
        });

        // Text Size
        const textSizeRange = this.container.querySelector('#text-size-range') as HTMLInputElement;
        const textSizeValue = this.container.querySelector('#text-size-value');
        textSizeRange?.addEventListener('input', () => {
            const val = parseFloat(textSizeRange.value);
            if (textSizeValue) textSizeValue.textContent = `${val}x`;
            this.callbacks.onTextSizeChange(val);
        });
    }

    unmount() {
        this.container.innerHTML = '';
    }
}
