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
    }

    private renderShell() {
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
                tokenizerVersion: '1'
            };
        }
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

                // Resume if was playing, or just update view? 
                // Skip logic usually updates view via onTokenChanged.
                // If we want to ensure playback continues or pauses:
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
                    // Update default
                    defaultSettings.voiceId = voiceId;
                    await settingsStore.saveSettings({ voiceId });

                    // Also update active session if desired, OR just defaults?
                    // User probably expects voice change to be immediate.
                    this.settings.voiceId = voiceId;

                    this.loadingOverlay.show('Loading Voice...', () => this.audioEngine.cancelSynthesis());
                    await this.audioEngine.updateSettings(this.settings, (p, msg) => {
                        this.loadingOverlay.setProgress(p);
                        if (msg) this.loadingOverlay.setText(msg);
                    });
                    this.loadingOverlay.hide();
                },
                onSpeedChange: async (wpm) => {
                    // STRICT SEPARATION:
                    // Settings Panel WPM is GLOBAL DEFAULT only.
                    // It does NOT affect the current active document.
                    defaultSettings.speedWpm = wpm;
                    settingsStore.saveSettings({ speedWpm: wpm });

                    // Do NOT update this.settings.speedWpm
                    // Do NOT call audioEngine.updateSettings
                    console.log(`[Settings] Updated global default WPM to ${wpm}. Active doc remains at ${this.settings.speedWpm}`);
                },
                onStrategyChange: async (strategy) => {
                    this.settings.strategy = strategy;
                    settingsStore.saveSettings({ strategy });

                    // Strategy changes likely should apply immediately too?
                    // For consistency with WPM, maybe strict separate? 
                    // But strategy is "how to read". WPM is "how fast".
                    // Let's keep strategy immediate for now as per user request focused on WPM.
                    this.settings.strategy = strategy;

                    this.loadingOverlay.show('Updating Strategy...', () => this.audioEngine.cancelSynthesis());
                    await this.audioEngine.updateSettings(this.settings, (p, msg) => {
                        this.loadingOverlay.setProgress(p);
                        if (msg) this.loadingOverlay.setText(msg);
                    });
                    this.loadingOverlay.hide();
                }
            },
            defaultSettings // Pass defaults, not active settings
        );

        // Fetch available voices
        this.audioEngine.getAvailableVoices().then(voices => {
            this.settingsPanel.setVoices(voices);
        }).catch(err => console.error("Failed to fetch voices", err));

        // TextInput
        this.textInput = new TextInput(this.viewContainer, async (title, originalText, ttsText, contentType) => {
            await this.handleNewDocument(title, originalText, ttsText, contentType);
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

        await this.audioEngine.loadDocument(doc.id, tokens, this.settings, doc.progressTokenIndex, (p, msg) => {
            this.loadingOverlay.setProgress(p);
            if (msg) this.loadingOverlay.setText(msg);
        });

        this.loadingOverlay.hide();
        this.switchView(this.settings.mode);
        this.setupPlaybackListeners();
    }

    private switchView(mode: 'RSVP' | 'PARAGRAPH') {
        if (this.currentView) this.currentView.unmount();
        this.textInput.unmount();
        this.documentList.unmount();

        this.settings.mode = mode;
        settingsStore.saveSettings({ mode });

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
            await documentStore.updateProgress(this.currentDocId, this.audioEngine.getController().getCurrentTokenIndex(), wpm);
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
                    documentStore.updateProgress(this.currentDocId, index, this.settings.speedWpm);
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
        }
    }
}
