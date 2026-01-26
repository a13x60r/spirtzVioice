import type { Token, Settings } from '@spec/types';
import './styles/main.css';
import { AudioEngine } from '../audio/AudioEngine';
import { seedMockVoices } from '../utils/seed_voices';
import { seedDocuments } from '../utils/seed_documents';

import { documentStore } from '../storage/DocumentStore';
import { settingsStore } from '../storage/SettingsStore';
import { Controls } from './components/Controls';
import { SettingsPanel } from './components/Settings';
import { TextInput } from './components/TextInput';
import { DocumentList } from './components/DocumentList';
import { RSVPView } from './views/RSVPView';
import { LoadingOverlay } from './components/LoadingOverlay';
import { ParagraphView } from './views/ParagraphView';
import type { ReaderView } from './views/ViewInterface';
import { TextPipeline } from '@domain/TextPipeline';
import { InstallPrompt } from './InstallPrompt';

const HEADER_ICONS = {
    library: `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M4 5c0-1.1.9-2 2-2h9c1.1 0 2 .9 2 2v15H6c-1.1 0-2-.9-2-2V5zm2 0v13h9V5H6z"/><path d="M18 6h2v14c0 1.1-.9 2-2 2H8v-2h10V6z"/></svg>`,
    newDoc: `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M13 3H6c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-9l-7-7zm0 2.5L19.5 12H13V5.5z"/><path d="M12 14h-2v-2H8v2H6v2h2v2h2v-2h2z"/></svg>`,
    switchView: `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M7 7h11l-3.5-3.5 1.4-1.4L22.8 9l-6.9 6.9-1.4-1.4L18 11H7V7zm10 10H6l3.5 3.5-1.4 1.4L1.2 15l6.9-6.9 1.4 1.4L6 13h11v4z"/></svg>`,
    settings: `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.03 7.03 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.59.23-1.13.54-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.82 14.52a.5.5 0 0 0-.12.64l1.92 3.32c.14.24.43.34.7.22l2.39-.96c.5.4 1.04.71 1.63.94l.36 2.54c.04.24.25.42.5.42h3.84c.25 0 .46-.18.5-.42l.36-2.54c.59-.23 1.13-.54 1.63-.94l2.39.96c.27.11.56.02.7-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5S10.07 8.5 12 8.5s3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/></svg>`,
    install: `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M5 20h14v-2H5v2z"/><path d="M12 2v12l4-4 1.4 1.4L12 17.8 6.6 11.4 8 10l4 4V2h0z"/></svg>`
};

export class ReaderShell {
    private container: HTMLElement;
    private audioEngine: AudioEngine;
    private controls!: Controls;
    private currentView!: ReaderView;
    private rsvpView: RSVPView;
    private paragraphView: ParagraphView;
    private settings!: Settings;
    private initialized: boolean = false;
    private destroyed: boolean = false;
    private installPrompt: InstallPrompt | null = null;

    // UI states
    private viewContainer!: HTMLElement;
    private uiLoopActive: boolean = false;
    private isReaderActive: boolean = false;
    private lastWpmLogTime: number = 0;

    // Components
    private settingsPanel!: SettingsPanel;
    private textInput!: TextInput;
    private loadingOverlay!: LoadingOverlay;
    private documentList!: DocumentList;
    private currentDocId: string | null = null;
    private currentTokens: Token[] = [];

    constructor(containerId: string) {
        const el = document.getElementById(containerId);
        if (!el) throw new Error(`Container #${containerId} not found`);
        this.container = el;

        this.audioEngine = new AudioEngine();
        this.rsvpView = new RSVPView();
        this.paragraphView = new ParagraphView();

        // Initial setup for TS - actually init in renderShell
        this.keepAliveAudio = new Audio();
    }

    async init() {
        if (this.initialized) return;
        this.initialized = true;
        this.renderShell();
        this.installPrompt = new InstallPrompt((available) => {
            const installBtn = this.container.querySelector('#btn-install-app') as HTMLElement | null;
            if (installBtn) installBtn.style.display = available ? 'inline-flex' : 'none';
        });

        // Handle Share Target API (must be before loading initial state to prioritize share)
        const params = new URLSearchParams(window.location.search);
        const title = params.get('title');
        const text = params.get('text');
        const url = params.get('url');

        if (title || text || url) {
            console.log('[ReaderShell] Received shared content:', { title, textLength: text?.length, url });

            // Construct body from text and url
            let body = text || '';
            if (url) {
                if (body) body += '\n\n';
                body += url;
            }

            // Clean up URL so we don't re-trigger on reload
            const cleanUrl = window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);

            // Wait for rest of init but skip storing "last read" as default for now...
            // Actually good to load initial settings, just defer document loading?
            // Let's load settings first so we have defaults for voice/etc.
            await this.loadInitialState();
            await seedMockVoices();
            await seedDocuments();
            await this.setupComponents();

            // Initialize loading overlay logic manualy since setupComponents does it too late/early?
            // setupComponents initializes specific UI components. LoadingOverlay is created below.
            // We need to initialize overlay and remove initial loader before processing new doc.
        } else {
            await this.loadInitialState();
        }

        // Seed voices if needed
        if (!title && !text && !url) {
            await seedMockVoices();
            await seedDocuments();
        }

        if (!title && !text && !url) await this.setupComponents();

        // Initialize loading overlay
        this.loadingOverlay = new LoadingOverlay();
        // Hide initial loading screen if present
        const initialLoader = document.querySelector('.loading');
        if (initialLoader) initialLoader.remove();

        // If we had shared content, process it now that UI is ready
        if (title || text || url) {
            // We need to ensure components are setup even in share mode
            if (!this.settingsPanel) await this.setupComponents(); // Ensure components exist

            let body = text || '';
            if (url) {
                if (body) body += '\n\n';
                body += url;
            }
            // Use default title if missing
            const docTitle = title || 'Shared Content';
            await this.handleNewDocument(docTitle, body, body, 'text');
        }

        this.startUiLoop();
        this.setupMediaSession();
        this.setupKeyboardShortcuts();
    }

    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;

        this.audioEngine.cancelSynthesis();
        this.audioEngine.getController().pause().catch(() => { });
        this.audioEngine.destroy();

        this.currentView?.unmount();
        this.textInput?.unmount();
        this.documentList?.unmount();
        this.settingsPanel?.unmount();

        const overlay = document.querySelector('.loading-overlay');
        if (overlay) overlay.remove();

        if (this.container) this.container.innerHTML = '';
    }

    // Media Session state
    private lastPlaybackState: 'playing' | 'paused' | 'none' = 'none';

    // HTML5 Audio anchor to hold system focus (stronger than Web Audio API)
    private keepAliveAudio: HTMLAudioElement;

    private renderShell() {
        // Initialize silent anchor
        this.keepAliveAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
        this.keepAliveAudio.loop = true;
        this.keepAliveAudio.volume = 0; // Ensure it's silent

        this.container.innerHTML = `
            <div class="shell-container">
                <header class="header">
                    <h1>Spritz Voice</h1>
                    <div>
                        <button class="btn btn-secondary btn-icon" id="btn-library" title="Library" aria-label="Library">${HEADER_ICONS.library}</button>
                        <button class="btn btn-secondary btn-icon" id="btn-new-text" title="New Document" aria-label="New Document">${HEADER_ICONS.newDoc}</button>
                        <button class="btn btn-secondary btn-icon" id="btn-toggle-view" title="Switch View" aria-label="Switch View">${HEADER_ICONS.switchView}</button>
                        <button class="btn btn-secondary btn-icon" id="btn-install-app" title="Install App" aria-label="Install App" style="display: none;">${HEADER_ICONS.install}</button>
                        <button class="btn btn-secondary btn-icon" id="btn-settings" title="Settings" aria-label="Settings">${HEADER_ICONS.settings}</button>
                    </div>
                </header>
                
                <main class="main-view" id="view-container">
                    <!-- Views or Text Input mounted here -->
                </main>
                
                <footer class="controls-area" id="controls-mount">
                </footer>
                
                <div id="settings-mount"></div>
            </div>
        `;

        this.viewContainer = this.container.querySelector('#view-container') as HTMLElement;

        // New Text
        this.container.querySelector('#btn-new-text')?.addEventListener('click', () => {
            this.showTextInput();
        });

        // Library
        this.container.querySelector('#btn-library')?.addEventListener('click', () => {
            this.showDocumentList();
        });

        // Settings toggle
        this.container.querySelector('#btn-settings')?.addEventListener('click', () => {
            this.settingsPanel.mount();
        });

        // Install app
        this.container.querySelector('#btn-install-app')?.addEventListener('click', async () => {
            await this.installPrompt?.promptInstall();
        });

        // View toggle
        this.container.querySelector('#btn-toggle-view')?.addEventListener('click', () => {
            const newMode = this.settings.mode === 'RSVP' ? 'PARAGRAPH' : 'RSVP';
            this.switchView(newMode);
        });
    }

    private async loadInitialState() {
        try {
            this.settings = await settingsStore.loadSettings();
        } catch (e) {
            console.error('Failed to load initial state:', e);
            this.settings = {
                voiceId: 'default',
                speedWpm: 250,
                strategy: 'TOKEN',
                chunkSize: 5,
                lookaheadSec: 20,
                mode: 'RSVP',
                pauseRules: { punctPauseMs: 400, paragraphPauseMs: 600 },
                tokenizerVersion: '1',
                language: 'en-US',
                skipSettings: {
                    seekSec: 10,
                    wordCount: 1,
                    sentenceCount: 1,
                    paragraphCount: 1,
                    mediaSkipBackUnit: 'paragraph',
                    mediaSkipFwdUnit: 'paragraph'
                }
            };
        }

        // Apply display settings
        // Apply display settings
        if (this.settings.darkMode) document.documentElement.classList.add('dark-mode');
        if (this.settings.textSize) document.documentElement.style.setProperty('--font-size-base', `${16 * this.settings.textSize}px`);
    }

    private async setupComponents() {
        // Controls
        const controlsMount = this.container.querySelector('#controls-mount') as HTMLElement;
        const controller = this.audioEngine.getController();

        this.controls = new Controls(controlsMount, {
            onPlayPause: () => {
                // Ensure context is resumed (fire and forget for responsiveness)
                this.audioEngine.getController().getScheduler().resumeContext();

                const controller = this.audioEngine.getController();
                const state = controller.getState();

                if (state === 'PLAYING') {
                    controller.pause();
                } else {
                    controller.play().catch(err => console.error("Play failed", err));
                }

                // Start Keep-Alive anchor
                this.keepAliveAudio.play().catch(() => { });
            },
            onSeek: (offset) => {
                const multiplier = offset > 0 ? 1 : -1;
                const seekVal = (this.settings.skipSettings?.seekSec || 10) * multiplier;
                controller.seek(seekVal);
            },
            onSkip: (type, direction) => {
                const tokens = this.currentTokens;
                if (!tokens.length) return;

                const count = (type === 'word' ? this.settings.skipSettings?.wordCount :
                    type === 'sentence' ? this.settings.skipSettings?.sentenceCount :
                        this.settings.skipSettings?.paragraphCount) || 1;

                const step = direction > 0 ? 1 : -1;

                for (let i = 0; i < count; i++) {
                    if (type === 'word') {
                        controller.skipWord(step, tokens);
                    } else if (type === 'sentence') {
                        controller.skipSentence(step, tokens);
                    } else if (type === 'paragraph') {
                        controller.skipParagraph(step, tokens);
                    }
                }
            },
            onSpeedChange: (rate) => this.handleRateChange(rate),
            onWpmChange: (wpm) => this.handleWpmChange(wpm),
            onVolumeChange: (vol) => this.audioEngine.setVolume(vol)
        }, this.settings.playbackRate || 1.0, this.settings.speedWpm || 250, 1.0);

        // Settings
        const settingsMount = this.container.querySelector('#settings-mount') as HTMLElement;

        // Load fresh defaults for the settings panel, separate from active settings
        const defaultSettings = await settingsStore.loadSettings();

        this.settingsPanel = new SettingsPanel(
            settingsMount,
            {
                onClose: () => this.settingsPanel.unmount(),
                onVoiceChange: async (voiceId) => {
                    console.log(`[ReaderShell] onVoiceChange: ${voiceId}`);
                    // Update default global
                    defaultSettings.voiceId = voiceId;
                    await settingsStore.saveSettings({ voiceId });

                    // Update active settings
                    this.settings.voiceId = voiceId;

                    // Update current document settings persistence
                    if (this.currentDocId) {
                        try {
                            await documentStore.updateSettings(this.currentDocId, voiceId, this.settings.speedWpm);
                            console.log(`[ReaderShell] Saved voice ${voiceId} to doc ${this.currentDocId}`);
                        } catch (e) {
                            console.warn("Failed to save doc settings", e);
                        }
                    }

                    const voice = (await this.audioEngine.getAvailableVoices()).find(v => v.id === voiceId);
                    if (voice && !voice.isInstalled) {
                        // Don't trigger synthesis if not installed
                        console.log(`[ReaderShell] Voice ${voiceId} not installed, skipping synthesis`);
                        return;
                    }

                    this.loadingOverlay.show('Loading Voice...', () => this.audioEngine.cancelSynthesis());
                    await this.audioEngine.updateSettings(this.settings, (p, msg) => {
                        this.loadingOverlay.setProgress(p);
                        if (msg) this.loadingOverlay.setText(msg);
                    });
                    this.loadingOverlay.hide();
                },
                onLanguageChange: async (lang) => {
                    defaultSettings.language = lang;
                    await settingsStore.saveSettings({ language: lang });
                },
                onInstallVoice: async (voiceId) => {
                    this.loadingOverlay.show('Downloading Voice components...', () => { });
                    try {
                        await this.audioEngine.installVoice(voiceId, (p) => {
                            this.loadingOverlay.setProgress(p);
                        });
                        // Refresh voices in settings
                        const voices = await this.audioEngine.getAvailableVoices();
                        this.settingsPanel.setVoices(voices);

                        // If it was the selected voice, trigger synthesis
                        if (this.settings.voiceId === voiceId) {
                            this.loadingOverlay.setText('Initializing voice...');
                            await this.audioEngine.updateSettings(this.settings, (p, msg) => {
                                this.loadingOverlay.setProgress(p);
                                if (msg) this.loadingOverlay.setText(msg);
                            });
                        }
                    } catch (e: any) {
                        alert("Failed to download voice: " + e.message);
                    } finally {
                        this.loadingOverlay.hide();
                    }
                },
                onSpeedChange: async (wpm) => {
                    defaultSettings.speedWpm = wpm;
                    settingsStore.saveSettings({ speedWpm: wpm });
                    console.log(`[Settings] Updated global default WPM to ${wpm}. Active doc remains at ${this.settings.speedWpm}`);
                },
                onStrategyChange: async (strategy) => {
                    this.settings.strategy = strategy;
                    settingsStore.saveSettings({ strategy });

                    this.loadingOverlay.show('Updating Strategy...', () => this.audioEngine.cancelSynthesis());
                    await this.audioEngine.updateSettings(this.settings, (p, msg) => {
                        this.loadingOverlay.setProgress(p);
                        if (msg) this.loadingOverlay.setText(msg);
                    });
                    this.loadingOverlay.hide();
                },
                onTextSizeChange: async (scale) => {
                    defaultSettings.textSize = scale;
                    this.settings.textSize = scale;
                    settingsStore.saveSettings({ textSize: scale });
                    document.documentElement.style.setProperty('--font-size-base', `${16 * scale}px`);
                },
                onDarkModeChange: async (enabled) => {
                    defaultSettings.darkMode = enabled;
                    this.settings.darkMode = enabled;
                    settingsStore.saveSettings({ darkMode: enabled });
                    if (enabled) document.documentElement.classList.add('dark-mode');
                    else document.documentElement.classList.remove('dark-mode');
                },
                onSkipSettingsChange: async (skipSettings) => {
                    this.settings.skipSettings = skipSettings;
                    await settingsStore.saveSettings({ skipSettings });
                }
            },
            defaultSettings
        );

        // Fetch available voices
        this.audioEngine.getAvailableVoices().then(voices => {
            this.settingsPanel.setVoices(voices);
        }).catch(err => console.error("Failed to fetch voices", err));

        // TextInput
        this.textInput = new TextInput(this.viewContainer, async (docs) => {
            if (docs.length === 1) {
                const { title, originalText, ttsText, contentType, language } = docs[0];
                await this.handleNewDocument(title, originalText, ttsText, contentType, language);
            } else if (docs.length > 1) {
                await this.handleBulkImport(docs);
            }
        });

        // DocumentList
        this.documentList = new DocumentList(this.viewContainer, {
            onResume: (docId) => this.resumeDocument(docId),
            onDelete: (docId) => {
                if (this.currentDocId === docId) {
                    this.currentDocId = null;
                    this.showDocumentList();
                }
            },
            onNewDocument: () => this.showTextInput()
        });

        // Initially show library if docs exist, otherwise show text input
        this.showDocumentList();
    }

    private async handleNewDocument(title: string, originalText: string, ttsText: string, contentType: 'text' | 'html' | 'markdown', language?: string) {
        this.loadingOverlay.show('Processing Document...', () => this.audioEngine.cancelSynthesis());

        const tokens = TextPipeline.tokenize(ttsText);
        this.currentTokens = tokens;

        const doc = await documentStore.createDocument(title, originalText, ttsText, contentType, tokens.length, language);
        this.currentDocId = doc.id;

        await documentStore.updateSettings(doc.id, this.settings.voiceId, this.settings.speedWpm);

        // Auto-select voice for language
        if (language) {
            const voiceId = await this.selectVoiceForLanguage(language);
            if (voiceId) {
                this.settings.voiceId = voiceId;
                await documentStore.updateSettings(doc.id, voiceId, this.settings.speedWpm);
            }
        }

        await this.audioEngine.loadDocument(doc.id, tokens, this.settings, 0, (p, msg) => {
            this.loadingOverlay.setProgress(p);
            if (msg) this.loadingOverlay.setText(msg);
        });

        this.paragraphView.setDocumentContext(originalText, contentType);

        this.loadingOverlay.hide();
        this.switchView(this.settings.mode);


        if (this.currentView) {
            this.currentView.update(0, tokens);
        }

        this.setupPlaybackListeners();
        this.updateMediaMetadata(title);
    }

    private async handleBulkImport(docs: { title: string, originalText: string, ttsText: string, contentType: 'text' | 'html' | 'markdown', language?: string }[]) {
        this.loadingOverlay.show(`Importing ${docs.length} documents...`, () => { });

        for (let i = 0; i < docs.length; i++) {
            const f = docs[i];
            const tokens = TextPipeline.tokenize(f.ttsText);

            this.loadingOverlay.setText(`Importing ${i + 1}/${docs.length}: ${f.title}`);
            this.loadingOverlay.setProgress((i / docs.length) * 100);

            await documentStore.createDocument(f.title, f.originalText, f.ttsText, f.contentType, tokens.length, f.language);
        }

        this.loadingOverlay.hide();
        await this.showDocumentList();
    }

    private showTextInput() {
        this.isReaderActive = false;
        this.audioEngine.getController().pause();
        if (this.currentView) this.currentView.unmount();
        this.documentList.unmount();
        this.textInput.mount();

        const toggleBtn = this.container.querySelector('#btn-toggle-view') as HTMLElement;
        if (toggleBtn) toggleBtn.style.display = 'none';
    }

    private async showDocumentList() {
        this.isReaderActive = false;
        this.audioEngine.getController().pause();
        if (this.currentView) this.currentView.unmount();
        this.textInput.unmount();
        await this.documentList.mount();

        const toggleBtn = this.container.querySelector('#btn-toggle-view') as HTMLElement;
        if (toggleBtn) toggleBtn.style.display = 'none';
    }

    private async resumeDocument(docId: string) {
        const doc = await documentStore.getDocument(docId);
        if (!doc) return;

        this.currentDocId = docId;
        this.paragraphView.setDocumentContext(doc.originalText, doc.contentType || 'text');
        this.loadingOverlay.show('Loading Document...', () => this.audioEngine.cancelSynthesis());

        const textForTts = doc.ttsText || doc.originalText;
        const tokens = TextPipeline.tokenize(textForTts);
        this.currentTokens = tokens;

        if (doc.voiceId && doc.voiceId !== 'default') {
            this.settings.voiceId = doc.voiceId;
        } else if (doc.language) {
            const voiceId = await this.selectVoiceForLanguage(doc.language);
            if (voiceId) {
                this.settings.voiceId = voiceId;
            }
        }

        if (doc.speedWpm) {
            this.settings.speedWpm = doc.speedWpm;
            this.controls.setWpm(doc.speedWpm);
        }

        await this.audioEngine.loadDocument(doc.id, tokens, this.settings, doc.progressTokenIndex, (p, msg) => {
            this.loadingOverlay.setProgress(p);
            if (msg) this.loadingOverlay.setText(msg);
        });

        this.loadingOverlay.hide();
        this.switchView(this.settings.mode);
        this.setupPlaybackListeners();
        this.updateMediaMetadata(doc.title);
    }

    private switchView(mode: 'RSVP' | 'PARAGRAPH') {
        this.isReaderActive = true;

        if (this.currentView) this.currentView.unmount();
        this.textInput.unmount();
        this.documentList.unmount();

        this.settings.mode = mode;
        settingsStore.saveSettings({ mode });

        if (this.currentDocId) {
            documentStore.updateProgress(this.currentDocId, this.audioEngine.getController().getCurrentTokenIndex(), this.settings.speedWpm, mode);
        }

        if (mode === 'RSVP') {
            this.currentView = this.rsvpView;
        } else {
            this.currentView = this.paragraphView;
        }

        this.currentView.mount(this.viewContainer);

        // Force update to render content
        const controller = this.audioEngine.getController();
        // If we have tokens, make sure we render them
        if (this.currentTokens.length > 0 || (this.currentView instanceof ParagraphView)) {
            this.currentView.update(controller.getCurrentTokenIndex(), this.currentTokens);
        }

        const toggleBtn = this.container.querySelector('#btn-toggle-view') as HTMLElement;
        if (toggleBtn) toggleBtn.style.display = 'inline-block';
    }

    private startUiLoop() {
        if (this.uiLoopActive) return;
        this.uiLoopActive = true;

        const loop = () => {
            const controller = this.audioEngine.getController();
            const scheduler = controller.getScheduler();

            const isPlaying = controller.getState() === 'PLAYING';

            const controlsMount = this.container.querySelector('#controls-mount');
            if (controlsMount) {
                if (this.isReaderActive) {
                    controlsMount.classList.remove('collapsed');
                } else {
                    controlsMount.classList.add('collapsed');
                }
            }

            this.controls.setPlaying(isPlaying);

            // Sync Media Session state & Position
            if ('mediaSession' in navigator) {
                const newState = isPlaying ? 'playing' : 'paused';
                if (this.lastPlaybackState !== newState) {
                    navigator.mediaSession.playbackState = newState;
                    this.lastPlaybackState = newState;
                }

                // Update position state occassionally (e.g. every second or on state change) reduces overhead
                // But simplified here to run often enough or check for drift
                const currentTime = scheduler.getCurrentTime();
                const duration = controller.getDuration();

                if (duration > 0 && currentTime <= duration) {
                    try {
                        navigator.mediaSession.setPositionState({
                            duration: duration,
                            playbackRate: this.settings.playbackRate || 1.0,
                            position: currentTime
                        });
                    } catch (e) {
                        // fast seeking can cause position > duration
                    }
                }
            }

            const currentTime = scheduler.getCurrentTime();
            const totalTime = controller.getDuration();
            this.controls.setTime(currentTime.toFixed(1), totalTime > 0 ? totalTime.toFixed(1) : "--:--");

            const currentIndex = controller.getCurrentTokenIndex();
            const totalTokens = this.currentTokens.length;
            const percentage = totalTokens > 0 ? (currentIndex / totalTokens) * 100 : 0;
            this.controls.setProgress(percentage);

            if (isPlaying) {
                const now = performance.now();
                if (now - this.lastWpmLogTime >= 1000) {
                    console.log(`[Playback] WPM (controls): ${this.settings.speedWpm}`);
                    this.lastWpmLogTime = now;
                }
            }

            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }
    private async handleRateChange(rate: number) {
        this.settings.playbackRate = rate;
        await settingsStore.saveSettings({ playbackRate: rate });
        // This is instant
        this.audioEngine.updateSettings(this.settings);
    }

    private async handleWpmChange(wpm: number) {
        this.settings.speedWpm = wpm;
        // Do NOT save to settingsStore here. That is for global defaults only.
        // settingsStore.saveSettings({ speedWpm: wpm });

        if (this.currentDocId) {
            await documentStore.updateProgress(this.currentDocId, this.audioEngine.getController().getCurrentTokenIndex(), wpm, this.settings.mode);
        }

        // This triggers re-synthesis
        this.loadingOverlay.show('Synthesizing...', () => this.audioEngine.cancelSynthesis());
        try {
            await this.audioEngine.updateSettings(this.settings, (p, msg) => {
                this.loadingOverlay.setProgress(p);
                if (msg) this.loadingOverlay.setText(msg);
            });
        } finally {
            this.loadingOverlay.hide();
        }
    }

    private setupPlaybackListeners() {
        const controller = this.audioEngine.getController();

        // Throttled save function
        let lastSaveTime = 0;
        const SAVE_INTERVAL = 2000; // Save every 2 seconds max

        controller.onTokenChanged = (index) => {
            if (this.currentView) {
                this.currentView.update(index, this.currentTokens);
            }

            // Auto-save progress
            if (this.currentDocId) {
                const now = Date.now();
                if (now - lastSaveTime > SAVE_INTERVAL) {
                    documentStore.updateProgress(this.currentDocId, index, this.settings.speedWpm, this.settings.mode);
                    lastSaveTime = now;
                }
            }
        };
    }
    private setupMediaSession() {
        if ('mediaSession' in navigator) {
            const controller = this.audioEngine.getController();

            const togglePlay = () => {
                controller.getScheduler().resumeContext();
                if (controller.getState() === 'PLAYING') controller.pause();
                else controller.play().catch(e => console.error(e));
            };

            const handleMediaSkip = (direction: 1 | -1) => {
                if (!this.currentTokens.length) return;

                // Select strategy based on direction
                const unit = direction === -1
                    ? (this.settings.skipSettings?.mediaSkipBackUnit || 'paragraph')
                    : (this.settings.skipSettings?.mediaSkipFwdUnit || 'paragraph');

                if (unit === 'seek') {
                    const val = (this.settings.skipSettings?.seekSec || 10);
                    controller.seek(direction * val);
                    return;
                }

                const count = (unit === 'word' ? this.settings.skipSettings?.wordCount :
                    unit === 'sentence' ? this.settings.skipSettings?.sentenceCount :
                        this.settings.skipSettings?.paragraphCount) || 1;

                for (let i = 0; i < count; i++) {
                    if (unit === 'word') controller.skipWord(direction, this.currentTokens);
                    else if (unit === 'sentence') controller.skipSentence(direction, this.currentTokens);
                    else controller.skipParagraph(direction, this.currentTokens);
                }
            };

            navigator.mediaSession.setActionHandler('play', togglePlay);
            navigator.mediaSession.setActionHandler('pause', togglePlay);
            navigator.mediaSession.setActionHandler('previoustrack', () => handleMediaSkip(-1)); // Back
            navigator.mediaSession.setActionHandler('nexttrack', () => handleMediaSkip(1));      // Forward

            // Optional: Seek
            navigator.mediaSession.setActionHandler('seekbackward', () => {
                const val = (this.settings.skipSettings?.seekSec || 10);
                controller.seek(-val);
            });
            navigator.mediaSession.setActionHandler('seekforward', () => {
                const val = (this.settings.skipSettings?.seekSec || 10);
                controller.seek(val);
            });
            // Stop
            navigator.mediaSession.setActionHandler('stop', () => {
                controller.pause();
                controller.seekByToken(0);
            });
        }
    }

    private updateMediaMetadata(title: string) {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: title,
                artist: 'Spritz Voice',
                album: 'Reader'
            });
        }
    }

    private setupKeyboardShortcuts() {
        window.addEventListener('keydown', (e) => {
            const controller = this.audioEngine.getController();

            // Ignore if in input field
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    // Toggle Play/Pause
                    controller.getScheduler().resumeContext();
                    if (controller.getState() === 'PLAYING') controller.pause();
                    else controller.play().catch(console.error);
                    break;
                case 'MediaPlayPause':
                    // e.preventDefault(); // Let default action occur if browser doesn't catch it
                    controller.getScheduler().resumeContext();
                    if (controller.getState() === 'PLAYING') controller.pause();
                    else controller.play().catch(console.error);
                    break;
                case 'MediaTrackNext':
                    if (navigator.mediaSession) {
                        // Let MediaSession handling take over if possible, but manual here:
                        // Or reuse handleMediaSkip logic if we extract it.
                        // For now, manual reuse of logic:
                        const unit = this.settings.skipSettings?.mediaSkipFwdUnit || 'paragraph';

                        if (unit === 'seek') {
                            const val = (this.settings.skipSettings?.seekSec || 10);
                            controller.seek(val);
                        } else {
                            const count = (unit === 'word' ? this.settings.skipSettings?.wordCount :
                                unit === 'sentence' ? this.settings.skipSettings?.sentenceCount :
                                    this.settings.skipSettings?.paragraphCount) || 1;
                            for (let i = 0; i < count; i++) {
                                if (unit === 'word') controller.skipWord(1, this.currentTokens);
                                else if (unit === 'sentence') controller.skipSentence(1, this.currentTokens);
                                else controller.skipParagraph(1, this.currentTokens);
                            }
                        }
                    }
                    break;
                case 'MediaTrackPrevious':
                    if (navigator.mediaSession) {
                        const unit = this.settings.skipSettings?.mediaSkipBackUnit || 'paragraph';

                        if (unit === 'seek') {
                            const val = (this.settings.skipSettings?.seekSec || 10);
                            controller.seek(-val);
                        } else {
                            const count = (unit === 'word' ? this.settings.skipSettings?.wordCount :
                                unit === 'sentence' ? this.settings.skipSettings?.sentenceCount :
                                    this.settings.skipSettings?.paragraphCount) || 1;
                            for (let i = 0; i < count; i++) {
                                if (unit === 'word') controller.skipWord(-1, this.currentTokens);
                                else if (unit === 'sentence') controller.skipSentence(-1, this.currentTokens);
                                else controller.skipParagraph(-1, this.currentTokens);
                            }
                        }
                    }
                    break;
                case 'MediaStop':
                    controller.pause();
                    controller.seekByToken(0);
                    break;
            }
        });
    }

    private async selectVoiceForLanguage(langCode: string): Promise<string | null> {
        const voices = await this.audioEngine.getAvailableVoices();
        // Priority 1: Installed voice matching language
        let match = voices.find(v => v.lang.startsWith(langCode) && v.isInstalled);
        if (match) return match.id;

        // Priority 2: Any voice matching language
        match = voices.find(v => v.lang.startsWith(langCode));
        if (match) return match.id;

        return null;
    }
}
