import type { Token, Settings } from '@spec/types';
import './styles/main.css';
import { AudioEngine } from '../audio/AudioEngine';
import { seedMockVoices } from '../utils/seed_voices';

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

export class ReaderShell {
    private container: HTMLElement;
    private audioEngine: AudioEngine;
    private controls!: Controls;
    private currentView!: ReaderView;
    private rsvpView: RSVPView;
    private paragraphView: ParagraphView;
    private settings!: Settings;

    // UI states
    private viewContainer!: HTMLElement;
    private uiLoopActive: boolean = false;

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
        this.renderShell();
        await this.loadInitialState();

        // Seed voices if needed
        await seedMockVoices();

        await this.setupComponents();

        // Initialize loading overlay
        this.loadingOverlay = new LoadingOverlay();
        // Hide initial loading screen if present
        const initialLoader = document.querySelector('.loading');
        if (initialLoader) initialLoader.remove();

        this.startUiLoop();
        this.setupMediaSession();
        this.setupKeyboardShortcuts();
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
                        <button class="btn btn-secondary" id="btn-library" style="margin-right: 10px">Library</button>
                        <button class="btn btn-secondary" id="btn-new-text" style="margin-right: 10px">New</button>
                        <button class="btn btn-secondary" id="btn-toggle-view" style="margin-right: 10px">Switch View</button>
                        <button class="btn btn-secondary" id="btn-settings">Settings</button>
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
                language: 'en-US'
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
                controller.seek(offset);
            },
            onSkip: (type, direction) => {
                const tokens = this.currentTokens;
                if (!tokens.length) return;

                if (type === 'word') {
                    controller.skipWord(direction, tokens);
                } else if (type === 'sentence') {
                    controller.skipSentence(direction, tokens);
                } else if (type === 'paragraph') {
                    controller.skipParagraph(direction, tokens);
                }

                if (controller.getState() === 'PLAYING') {
                    // already playing
                }
            },
            onSpeedChange: (rate) => this.handleRateChange(rate),
            onWpmChange: (wpm) => this.handleWpmChange(wpm),
            onVolumeChange: (vol) => this.audioEngine.setVolume(vol)
        }, this.settings.playbackRate || 1.0, this.settings.speedWpm || 250, 1.0);

        // Settings
        const settingsMount = this.container.querySelector('#settings-mount') as HTMLElement;

        // Load fresh defaults for the settings panel, separate from active settings
        let defaultSettings = await settingsStore.loadSettings();

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
                const { title, originalText, ttsText, contentType } = docs[0];
                await this.handleNewDocument(title, originalText, ttsText, contentType);
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

    private async handleNewDocument(title: string, originalText: string, ttsText: string, contentType: 'text' | 'html' | 'markdown') {
        this.loadingOverlay.show('Processing Document...', () => this.audioEngine.cancelSynthesis());

        const tokens = TextPipeline.tokenize(ttsText);
        this.currentTokens = tokens;

        const doc = await documentStore.createDocument(title, originalText, ttsText, contentType, tokens.length);
        this.currentDocId = doc.id;

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

    private async handleBulkImport(docs: { title: string, originalText: string, ttsText: string, contentType: 'text' | 'html' | 'markdown' }[]) {
        this.loadingOverlay.show(`Importing ${docs.length} documents...`, () => { });

        for (let i = 0; i < docs.length; i++) {
            const f = docs[i];
            const tokens = TextPipeline.tokenize(f.ttsText);

            this.loadingOverlay.setText(`Importing ${i + 1}/${docs.length}: ${f.title}`);
            this.loadingOverlay.setProgress((i / docs.length) * 100);

            await documentStore.createDocument(f.title, f.originalText, f.ttsText, f.contentType, tokens.length);
        }

        this.loadingOverlay.hide();
        await this.showDocumentList();
    }

    private showTextInput() {
        this.audioEngine.getController().pause();
        if (this.currentView) this.currentView.unmount();
        this.documentList.unmount();
        this.textInput.mount();

        const toggleBtn = this.container.querySelector('#btn-toggle-view') as HTMLElement;
        if (toggleBtn) toggleBtn.style.display = 'none';
    }

    private async showDocumentList() {
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

        if (doc.speedWpm) {
            this.settings.speedWpm = doc.speedWpm;
            // Update controls to reflect new WPM
            this.controls.updateSpeed(this.settings.playbackRate || 1.0, this.settings.speedWpm);
        }

        if (doc.mode) {
            this.settings.mode = doc.mode;
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
        await this.audioEngine.updateSettings(this.settings, (p, msg) => {
            this.loadingOverlay.setProgress(p);
            if (msg) this.loadingOverlay.setText(msg);
        });
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

            const skipPara = (direction: 1 | -1) => {
                if (this.currentTokens.length) controller.skipParagraph(direction, this.currentTokens);
            };

            navigator.mediaSession.setActionHandler('play', togglePlay);
            navigator.mediaSession.setActionHandler('pause', togglePlay);
            navigator.mediaSession.setActionHandler('previoustrack', () => skipPara(-1));
            navigator.mediaSession.setActionHandler('nexttrack', () => skipPara(1));

            // Optional: Seek
            navigator.mediaSession.setActionHandler('seekbackward', () => controller.seek(-10));
            navigator.mediaSession.setActionHandler('seekforward', () => controller.seek(10));
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
                    if (this.currentTokens.length) controller.skipParagraph(1, this.currentTokens);
                    break;
                case 'MediaTrackPrevious':
                    if (this.currentTokens.length) controller.skipParagraph(-1, this.currentTokens);
                    break;
                case 'MediaStop':
                    controller.pause();
                    controller.seekByToken(0);
                    break;
            }
        });
    }
}
