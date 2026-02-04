export interface SettingsCallbacks {
    onClose: () => void;
    onVoiceChange: (voiceId: string) => void;
    onLanguageChange: (lang: string) => void;
    onInstallVoice: (voiceId: string) => Promise<void>;
    onSpeedChange: (wpm: number) => void;
    onStrategyChange: (strategy: 'TOKEN' | 'CHUNK') => void;
    onTextSizeChange: (scale: number) => void;
    onDarkModeChange: (enabled: boolean) => void;
    onSkipSettingsChange: (settings: { seekSec: number, wordCount: number, sentenceCount: number, paragraphCount: number, mediaSkipBackUnit: 'word' | 'sentence' | 'paragraph' | 'seek', mediaSkipFwdUnit: 'word' | 'sentence' | 'paragraph' | 'seek' }) => void;
}

const CLOSE_ICON = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M18.3 5.71 12 12l6.3 6.29-1.41 1.42L10.59 13.4 4.29 19.71 2.88 18.3 9.17 12 2.88 5.71 4.29 4.29 10.59 10.6l6.3-6.3z"/></svg>`;

export class SettingsPanel {
    private container: HTMLElement;
    private callbacks: SettingsCallbacks;
    private voices: { id: string, name: string, lang: string, isInstalled: boolean }[] = [];
    private currentSettings: {
        voiceId: string,
        speedWpm: number,
        strategy: string,
        language: string,
        textSize?: number,
        darkMode?: boolean,
        skipSettings?: {
            seekSec: number;
            wordCount: number;
            sentenceCount: number;
            paragraphCount: number;
            mediaSkipBackUnit?: 'word' | 'sentence' | 'paragraph' | 'seek';
            mediaSkipFwdUnit?: 'word' | 'sentence' | 'paragraph' | 'seek';
        }
    };
    private isInstalling: boolean = false;

    constructor(
        container: HTMLElement,
        callbacks: SettingsCallbacks,
        initialSettings: {
            voiceId: string,
            speedWpm: number,
            strategy: string,
            language: string,
            textSize?: number,
            darkMode?: boolean,
            skipSettings?: {
                seekSec: number;
                wordCount: number;
                sentenceCount: number;
                paragraphCount: number;
                mediaSkipBackUnit?: 'word' | 'sentence' | 'paragraph' | 'seek';
                mediaSkipFwdUnit?: 'word' | 'sentence' | 'paragraph' | 'seek';
            }
        }
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
                        <button class="btn btn-secondary btn-icon" id="close-settings" title="Close" aria-label="Close">${CLOSE_ICON}</button>
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
                                <input type="range" min="100" max="1300" step="10" id="speed-range" value="${this.currentSettings.speedWpm}">
                                <span id="speed-value">${this.currentSettings.speedWpm} WPM</span>
                            </div>
                        </section>

                        <section class="settings-group">
                            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                <h3>Strategy</h3>
                                <span class="info-badge" title="Determines how the text is divided for synthesis and highlighting.">i</span>
                            </div>
                            <div class="radio-group" style="display: flex; gap: 1rem; flex-wrap: wrap;">
                                <label>
                                    <input type="radio" name="strategy" value="TOKEN" ${this.currentSettings.strategy === 'TOKEN' ? 'checked' : ''}> 
                                    Word by Word
                                </label>
                                <label>
                                    <input type="radio" name="strategy" value="CHUNK" ${this.currentSettings.strategy === 'CHUNK' ? 'checked' : ''}> 
                                    Chunked (Natural)
                                </label>
                            </div>
                            <p class="info-text">
                                <strong>Word by Word:</strong> Highlights each word as it's spoken. Best for focus.
                                <br>
                                <strong>Chunked:</strong> Groups words into phrases. Better for natural speech rhythm.
                            </p>
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

                        <section class="settings-group">
                            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                <h3>Skip Intervals</h3>
                                <span class="info-badge" title="Configure how much text is skipped when using previous/next controls.">i</span>
                            </div>
                            <div class="range-control">
                                <label style="font-size: 0.8rem; color: var(--color-text-secondary);">Seek (Seconds)</label>
                                <input type="range" min="5" max="60" step="5" id="skip-seek" value="${this.currentSettings.skipSettings?.seekSec || 10}">
                                <span id="skip-seek-value">${this.currentSettings.skipSettings?.seekSec || 10}s</span>
                            </div>
                            <div class="range-control">
                                <label style="font-size: 0.8rem; color: var(--color-text-secondary);">Words</label>
                                <input type="range" min="1" max="20" step="1" id="skip-words" value="${this.currentSettings.skipSettings?.wordCount || 1}">
                                <span id="skip-words-value">${this.currentSettings.skipSettings?.wordCount || 1}</span>
                            </div>
                            <div class="range-control">
                                <label style="font-size: 0.8rem; color: var(--color-text-secondary);">Sentences</label>
                                <input type="range" min="1" max="10" step="1" id="skip-sentences" value="${this.currentSettings.skipSettings?.sentenceCount || 1}">
                                <span id="skip-sentences-value">${this.currentSettings.skipSettings?.sentenceCount || 1}</span>
                            </div>
                            <div class="range-control">
                                <label style="font-size: 0.8rem; color: var(--color-text-secondary);">Paragraphs</label>
                                <input type="range" min="1" max="5" step="1" id="skip-paragraphs" value="${this.currentSettings.skipSettings?.paragraphCount || 1}">
                                <span id="skip-paragraphs-value">${this.currentSettings.skipSettings?.paragraphCount || 1}</span>
                            </div>

                            <div style="margin-top: 1rem;">
                                <label style="font-size: 0.8rem; color: var(--color-text-secondary); display: block; margin-bottom: 0.5rem;">Headset Previous Action</label>
                                <select id="media-skip-back-unit" class="input" style="width: 100%;">
                                    <option value="word" ${this.currentSettings.skipSettings?.mediaSkipBackUnit === 'word' ? 'selected' : ''}>Skip Word Back</option>
                                    <option value="sentence" ${this.currentSettings.skipSettings?.mediaSkipBackUnit === 'sentence' ? 'selected' : ''}>Skip Sentence Back</option>
                                    <option value="paragraph" ${(!this.currentSettings.skipSettings?.mediaSkipBackUnit || this.currentSettings.skipSettings?.mediaSkipBackUnit === 'paragraph') ? 'selected' : ''}>Skip Paragraph Back</option>
                                    <option value="seek" ${this.currentSettings.skipSettings?.mediaSkipBackUnit === 'seek' ? 'selected' : ''}>Seek Time Back</option>
                                </select>
                            </div>
                            <div style="margin-top: 0.5rem;">
                                <label style="font-size: 0.8rem; color: var(--color-text-secondary); display: block; margin-bottom: 0.5rem;">Headset Next Action</label>
                                <select id="media-skip-fwd-unit" class="input" style="width: 100%;">
                                    <option value="word" ${this.currentSettings.skipSettings?.mediaSkipFwdUnit === 'word' ? 'selected' : ''}>Skip Word Forward</option>
                                    <option value="sentence" ${this.currentSettings.skipSettings?.mediaSkipFwdUnit === 'sentence' ? 'selected' : ''}>Skip Sentence Forward</option>
                                    <option value="paragraph" ${(!this.currentSettings.skipSettings?.mediaSkipFwdUnit || this.currentSettings.skipSettings?.mediaSkipFwdUnit === 'paragraph') ? 'selected' : ''}>Skip Paragraph Forward</option>
                                    <option value="seek" ${this.currentSettings.skipSettings?.mediaSkipFwdUnit === 'seek' ? 'selected' : ''}>Seek Time Forward</option>
                                </select>
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

            // Auto-select first voice of new language
            const firstVoice = this.voices.find(v => v.lang === val);
            if (firstVoice) {
                this.currentSettings.voiceId = firstVoice.id;
                this.callbacks.onVoiceChange(firstVoice.id);
            }

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
        darkModeToggle?.addEventListener('change', () => {
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

        // Skip Intervals
        const skipSeek = this.container.querySelector('#skip-seek') as HTMLInputElement;
        const skipWords = this.container.querySelector('#skip-words') as HTMLInputElement;
        const skipSentences = this.container.querySelector('#skip-sentences') as HTMLInputElement;
        const skipParagraphs = this.container.querySelector('#skip-paragraphs') as HTMLInputElement;
        const mediaSkipBackUnit = this.container.querySelector('#media-skip-back-unit') as HTMLSelectElement;
        const mediaSkipFwdUnit = this.container.querySelector('#media-skip-fwd-unit') as HTMLSelectElement;

        const updateSkip = () => {
            const settings = {
                seekSec: parseInt(skipSeek.value),
                wordCount: parseInt(skipWords.value),
                sentenceCount: parseInt(skipSentences.value),
                paragraphCount: parseInt(skipParagraphs.value),
                mediaSkipBackUnit: mediaSkipBackUnit.value as 'word' | 'sentence' | 'paragraph' | 'seek',
                mediaSkipFwdUnit: mediaSkipFwdUnit.value as 'word' | 'sentence' | 'paragraph' | 'seek'
            };
            this.currentSettings.skipSettings = settings;
            this.callbacks.onSkipSettingsChange(settings);

            // Update labels
            this.container.querySelector('#skip-seek-value')!.textContent = `${settings.seekSec}s`;
            this.container.querySelector('#skip-words-value')!.textContent = `${settings.wordCount}`;
            this.container.querySelector('#skip-sentences-value')!.textContent = `${settings.sentenceCount}`;
            this.container.querySelector('#skip-paragraphs-value')!.textContent = `${settings.paragraphCount}`;
        };

        skipSeek?.addEventListener('input', updateSkip);
        skipWords?.addEventListener('input', updateSkip);
        skipSentences?.addEventListener('input', updateSkip);
        skipParagraphs?.addEventListener('input', updateSkip);
        mediaSkipBackUnit?.addEventListener('change', updateSkip);
        mediaSkipFwdUnit?.addEventListener('change', updateSkip);
    }

    unmount() {
        this.container.innerHTML = '';
    }
}
