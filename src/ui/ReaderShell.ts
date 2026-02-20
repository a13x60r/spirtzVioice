
import type { Token, Settings } from '@spec/types';
import './styles/main.css';
import { AudioEngine } from '../audio/AudioEngine';
import { seedMockVoices } from '../utils/seed_voices';
import { seedDocuments } from '../utils/seed_documents';

import { documentStore } from '../storage/DocumentStore';
import { settingsStore } from '../storage/SettingsStore';
import { Controls } from './components/Controls';
import { SettingsPanel } from './components/Settings';
import { InfoModal } from './components/InfoModal';
import { TextInput } from './components/TextInput';
import { DocumentList } from './components/DocumentList';
import { RSVPView } from './views/RSVPView';
import { LoadingOverlay } from './components/LoadingOverlay';
import { ParagraphView } from './views/ParagraphView';
import type { ReaderView } from './views/ViewInterface';
import { TextPipeline } from '@domain/TextPipeline';
import { AppInstaller } from './AppInstaller';
import { FocusView } from './views/FocusView';
import { buildReaderChunksForParagraph, mapTokensToChunks, splitParagraphs, type ReaderChunk } from '../lib/readerModel';
import { prevChunk, prevSentence, rewindByMs } from '../lib/navigation';
import { createAdaptState, evaluateAdaptation, recordRewind } from '../lib/adapt';
import { Progress } from './components/Progress';
import { KeyboardHelp } from './components/KeyboardHelp';
import { segmentCacheStore } from '../storage/SegmentCacheStore';
import { annotationStore } from '../storage/AnnotationStore';
import type { AnnotationEntity } from '../storage/Database';
import { ICONS } from './icons';

const HEADER_ICONS = {
    library: ICONS.library,
    newDoc: ICONS.newDoc,
    switchView: ICONS.switchView,
    settings: ICONS.settings,
    install: ICONS.install,
    info: ICONS.info
};

const DEFAULT_WPM_RANGE = { min: 200, max: 1400 };
const FOCUS_WPM_RANGE = { min: 120, max: 450 };

export class ReaderShell {
    private container: HTMLElement;
    private audioEngine: AudioEngine;
    private controls!: Controls;
    private currentView!: ReaderView;
    private rsvpView: RSVPView;
    private paragraphView: ParagraphView;
    private focusView: FocusView;
    private settings!: Settings;
    private initialized: boolean = false;
    private destroyed: boolean = false;
    private appInstaller: AppInstaller | null = null;

    // UI states
    private viewContainer!: HTMLElement;
    private uiLoopActive: boolean = false;
    private isReaderActive: boolean = false;
    private lastWpmLogTime: number = 0;

    // Components
    private settingsPanel!: SettingsPanel;
    private infoModal!: InfoModal;
    private textInput!: TextInput;
    private loadingOverlay!: LoadingOverlay;
    private documentList!: DocumentList;
    private progress!: Progress;
    private keyboardHelp!: KeyboardHelp;
    private isHelpOpen: boolean = false;
    private voiceWarningEl: HTMLElement | null = null;
    private voiceWarningInstallId: string | null = null;
    private fatigueNudgeEl: HTMLElement | null = null;
    private fatigueActiveMs: number = 0;
    private fatigueLastTickMs: number | null = null;
    private fatigueNudgeShown: boolean = false;
    private scrollSaveTimer: number | null = null;
    private currentDocId: string | null = null;
    private currentDocTitle: string = '';
    private currentTtsText: string = '';
    private currentLanguage: string = 'en-US';
    private currentAnnotations: AnnotationEntity[] = [];
    private currentTokens: Token[] = [];
    private currentChunks: ReaderChunk[] = [];
    private tokenChunkMap: number[] = [];
    private adaptState = createAdaptState();

    constructor(containerId: string) {
        const el = document.getElementById(containerId);
        if (!el) throw new Error(`Container #${containerId} not found`);
        this.container = el;

        this.audioEngine = new AudioEngine();
        this.rsvpView = new RSVPView();
        this.paragraphView = new ParagraphView();
        this.focusView = new FocusView();
        this.paragraphView.setScrollHandler((scrollTop) => this.handleParagraphScroll(scrollTop));
        this.focusView.setPanicExitHandler(() => {
            this.handleFocusPanicExit();
        });

        // Initial setup for TS - actually init in renderShell
        this.keepAliveAudio = new Audio();
    }

    async init() {
        if (this.initialized) return;
        this.initialized = true;
        this.renderShell();
        this.appInstaller = new AppInstaller((available: boolean) => {
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
        this.keyboardHelp?.unmount();

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
                        <button class="btn btn-secondary btn-icon" id="btn-install-app" title="Install App" aria-label="Install App" style="display: none;">${HEADER_ICONS.install}</button>
                        <button class="btn btn-secondary btn-icon" id="btn-info" title="Info & Help" aria-label="Info & Help">${HEADER_ICONS.info}</button>
                        <button class="btn btn-secondary btn-icon" id="btn-settings" title="Settings" aria-label="Settings">${HEADER_ICONS.settings}</button>
                    </div>
                </header>

                <div id="structure-progress-mount"></div>

                <div id="voice-warning" class="voice-warning voice-warning-hidden"></div>
                
                <main class="main-view" id="view-container">
                    <!-- Views or Text Input mounted here -->
                </main>
                
                <footer class="controls-area" id="controls-mount">
                </footer>

                <div id="fatigue-nudge" class="fatigue-nudge fatigue-nudge-hidden"></div>
                
                <div id="settings-mount"></div>
                <div id="info-mount"></div>
                <div id="help-mount"></div>
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

        // Info toggle
        this.container.querySelector('#btn-info')?.addEventListener('click', () => {
            this.infoModal.mount();
        });

        // Install app
        this.container.querySelector('#btn-install-app')?.addEventListener('click', async () => {
            await this.appInstaller?.promptInstall();
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
                textSize: 1.0,
                theme: 'default',
                readerFontFamily: 'literata',
                readerLineHeight: 1.6,
                orpEnabled: true,
                orpIntensity: 1.0,
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

        const theme = this.settings.theme || (this.settings.darkMode ? 'dark' : 'default');
        this.settings.theme = theme;
        this.applyTheme(theme);
        this.applyTypography();
        this.applyOrpSettings();
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
                if (seekVal < 0) this.noteRewind();
                controller.seek(seekVal);
            },
            onSkip: (type, direction) => {
                const tokens = this.currentTokens;
                if (!tokens.length) return;

                const count = (type === 'word' ? this.settings.skipSettings?.wordCount :
                    type === 'sentence' ? this.settings.skipSettings?.sentenceCount :
                        this.settings.skipSettings?.paragraphCount) || 1;

                const step = direction > 0 ? 1 : -1;

                if (type === 'chunk') {
                    if (!this.currentChunks.length) return;
                    if (direction === -1) this.noteRewind();
                    const tokenIndex = controller.getCurrentTokenIndex();
                    const chunkIndex = this.tokenChunkMap[tokenIndex] ?? 0;
                    const targetChunkIndex = prevChunk(chunkIndex, this.currentChunks);
                    const targetChunk = this.currentChunks[targetChunkIndex];
                    if (!targetChunk) return;
                    const targetIndex = this.findTokenIndexForOffset(targetChunk.startOffset, tokenIndex);
                    controller.seekByToken(targetIndex);
                    return;
                }

                for (let i = 0; i < count; i++) {
                    if (type === 'word') {
                        if (step === -1) this.noteRewind();
                        controller.skipWord(step, tokens);
                    } else if (type === 'sentence') {
                        if (step === -1) this.noteRewind();
                        if (step === -1) {
                            const targetIndex = prevSentence(controller.getCurrentTokenIndex(), tokens);
                            controller.seekByToken(targetIndex);
                        } else {
                            controller.skipSentence(step, tokens);
                        }
                    } else if (type === 'paragraph') {
                        if (step === -1) this.noteRewind();
                        controller.skipParagraph(step, tokens);
                    }
                }
            },
            onHighlight: () => this.handleHighlightBuffer(),
            onNote: () => this.handleAddNote(),
            onCopySentence: () => this.handleCopySentence(),
            onViewChange: (mode) => this.switchView(mode),
            onSpeedChange: (rate) => this.handleRateChange(rate),
            onWpmChange: (wpm) => this.handleWpmChange(wpm),
            onVolumeChange: (vol) => this.audioEngine.setVolume(vol)
        }, this.settings.playbackRate || 1.0, this.settings.speedWpm || 250, 1.0);

        const initialRange = this.settings.mode === 'FOCUS' ? FOCUS_WPM_RANGE : DEFAULT_WPM_RANGE;
        this.controls.setWpmRange(initialRange.min, initialRange.max);

        const initialTheme = this.settings.theme || (this.settings.darkMode ? 'dark' : 'default');
        this.settings.theme = initialTheme;
        this.applyTheme(initialTheme);
        this.applyTypography();
        this.applyOrpSettings();

        this.controls.setActiveView(this.settings.mode);

        const progressMount = this.container.querySelector('#structure-progress-mount') as HTMLElement;
        this.progress = new Progress(progressMount);
        this.progress.setVisible(false);

        this.voiceWarningEl = this.container.querySelector('#voice-warning');

        this.fatigueNudgeEl = this.container.querySelector('#fatigue-nudge');
        this.renderFatigueNudge();

        const helpMount = this.container.querySelector('#help-mount') as HTMLElement;
        this.keyboardHelp = new KeyboardHelp(helpMount, () => this.setHelpVisible(false));
        this.setHelpVisible(false);

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

                        const installedVoice = voices.find(v => v.id === voiceId);
                        const currentLang = (this.currentLanguage || '').toLowerCase();
                        const currentBase = currentLang.split('-')[0];
                        const voiceLang = installedVoice?.lang.toLowerCase() || '';
                        const matchesLanguage = Boolean(currentBase && voiceLang.startsWith(currentBase));

                        if (installedVoice && (this.settings.voiceId === voiceId || matchesLanguage)) {
                            this.settings.voiceId = voiceId;
                            if (this.currentDocId) {
                                await documentStore.updateSettings(this.currentDocId, voiceId, this.settings.speedWpm);
                            }
                            this.loadingOverlay.setText('Initializing voice...');
                            await this.audioEngine.updateSettings(this.settings, (p, msg) => {
                                this.loadingOverlay.setProgress(p);
                                if (msg) this.loadingOverlay.setText(msg);
                            }, true);
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
                    this.applyTypography();
                },
                onThemeChange: async (theme) => {
                    defaultSettings.theme = theme;
                    this.settings.theme = theme;
                    settingsStore.saveSettings({ theme });
                    this.applyTheme(theme);
                },
                onFontFamilyChange: async (fontFamily) => {
                    defaultSettings.readerFontFamily = fontFamily;
                    this.settings.readerFontFamily = fontFamily;
                    settingsStore.saveSettings({ readerFontFamily: fontFamily });
                    this.applyTypography();
                },
                onLineHeightChange: async (lineHeight) => {
                    defaultSettings.readerLineHeight = lineHeight;
                    this.settings.readerLineHeight = lineHeight;
                    settingsStore.saveSettings({ readerLineHeight: lineHeight });
                    this.applyTypography();
                },
                onOrpToggle: async (enabled) => {
                    defaultSettings.orpEnabled = enabled;
                    this.settings.orpEnabled = enabled;
                    settingsStore.saveSettings({ orpEnabled: enabled });
                    this.applyOrpSettings();
                },
                onOrpIntensityChange: async (intensity) => {
                    defaultSettings.orpIntensity = intensity;
                    this.settings.orpIntensity = intensity;
                    settingsStore.saveSettings({ orpIntensity: intensity });
                    this.applyOrpSettings();
                },
                onSkipSettingsChange: async (skipSettings) => {
                    this.settings.skipSettings = skipSettings;
                    await settingsStore.saveSettings({ skipSettings });
                }
            },
            defaultSettings
        );

        // Info Modal
        const infoMount = this.container.querySelector('#info-mount') as HTMLElement;
        this.infoModal = new InfoModal(infoMount, () => { });

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

        try {
            const tokens = TextPipeline.tokenize(ttsText);
            this.currentTokens = tokens;
            this.currentDocTitle = title;
            this.currentTtsText = ttsText;
            this.currentLanguage = language || this.settings.language;
            if (language) {
                this.settings.language = language;
            }

            const doc = await documentStore.createDocument(title, originalText, ttsText, contentType, tokens.length, language);
            this.currentChunks = await this.buildChunksWithCache(doc.id, ttsText, this.currentLanguage);
            this.tokenChunkMap = mapTokensToChunks(tokens, this.currentChunks);
            this.currentDocId = doc.id;
            this.currentAnnotations = [];

            await documentStore.updateSettings(doc.id, this.settings.voiceId, this.settings.speedWpm);

            // Auto-select voice for language
            if (language) {
                const voiceId = await this.selectVoiceForLanguage(language);
                if (voiceId) {
                    this.settings.voiceId = voiceId;
                    await documentStore.updateSettings(doc.id, voiceId, this.settings.speedWpm);
                }
                await this.warnIfVoiceMissing(language, voiceId ?? null);
            }

            await this.audioEngine.loadDocument(doc.id, tokens, this.settings, 0, (p, msg) => {
                this.loadingOverlay.setProgress(p);
                if (msg) this.loadingOverlay.setText(msg);
            });

            this.paragraphView.setDocumentContext(originalText, contentType, ttsText);
            this.paragraphView.setAnnotations([], null);
            this.progress.setDocumentContext({
                title,
                originalText,
                ttsText,
                contentType
            });
            this.progress.setVisible(true);
            this.resetFatigueNudge();

        } catch (err) {
            console.error('[ReaderShell] handleNewDocument failed:', err);
        } finally {
            this.loadingOverlay.hide();
        }

        this.switchView(this.settings.mode);

        if (this.currentView) {
            this.currentView.update(0, this.currentTokens);
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
        this.progress.setVisible(false);

    }

    private async showDocumentList() {
        this.isReaderActive = false;
        this.audioEngine.getController().pause();
        if (this.currentView) this.currentView.unmount();
        this.textInput.unmount();
        await this.documentList.mount();
        this.progress.setVisible(false);

    }

    private async resumeDocument(docId: string) {
        const doc = await documentStore.getDocument(docId);
        if (!doc) return;

        this.currentDocId = docId;
        this.currentDocTitle = doc.title;
        this.currentTtsText = doc.ttsText || doc.originalText;
        this.currentLanguage = doc.language || this.settings.language;
        if (doc.language) {
            this.settings.language = doc.language;
        }
		this.loadingOverlay.show('Loading Document...', () => this.audioEngine.cancelSynthesis());

		try {
            const textForTts = doc.ttsText || doc.originalText;
            this.paragraphView.setDocumentContext(doc.originalText, doc.contentType || 'text', textForTts);
            const tokens = TextPipeline.tokenize(textForTts);
            this.currentTokens = tokens;
            this.currentChunks = await this.buildChunksWithCache(doc.id, textForTts, this.currentLanguage);
            this.tokenChunkMap = mapTokensToChunks(tokens, this.currentChunks);

            if (doc.language) {
                const preferredVoice = await this.selectVoiceForLanguage(doc.language);
                const voiceMatches = doc.voiceId ? await this.voiceMatchesLanguage(doc.voiceId, doc.language) : false;
                if (preferredVoice && (!doc.voiceId || doc.voiceId === 'default' || !voiceMatches)) {
                    this.settings.voiceId = preferredVoice;
                    await documentStore.updateSettings(doc.id, preferredVoice, this.settings.speedWpm);
                } else if (doc.voiceId && doc.voiceId !== 'default') {
                    this.settings.voiceId = doc.voiceId;
                }
                await this.warnIfVoiceMissing(doc.language, preferredVoice ?? doc.voiceId ?? null);
            } else if (doc.voiceId && doc.voiceId !== 'default') {
                this.settings.voiceId = doc.voiceId;
            }

            if (doc.speedWpm) {
                this.settings.speedWpm = doc.speedWpm;
                this.controls.setWpm(doc.speedWpm);
            }

            if (doc.mode) {
                this.settings.mode = doc.mode;
            }

            const fallbackIndex = doc.progressTokenIndex ?? 0;
            const resumeIndex = doc.progressOffset !== undefined
                ? this.findTokenIndexForOffset(doc.progressOffset, fallbackIndex)
                : fallbackIndex;

            await this.audioEngine.loadDocument(doc.id, tokens, this.settings, resumeIndex, (p, msg) => {
                this.loadingOverlay.setProgress(p);
                if (msg) this.loadingOverlay.setText(msg);
            });

            this.progress.setDocumentContext({
                title: doc.title,
                originalText: doc.originalText,
                ttsText: textForTts,
                contentType: doc.contentType || 'text'
            });
            this.progress.setVisible(true);
            this.resetFatigueNudge();
        } catch (err) {
            console.error('[ReaderShell] resumeDocument failed:', err);
            // Optionally clear docId if resuming totally fails
        } finally {
            this.loadingOverlay.hide();
        }

        this.switchView(this.settings.mode);
        this.setupPlaybackListeners();
        this.updateMediaMetadata(doc.title);

        await this.loadAnnotations(docId);

        if (this.settings.mode === 'PARAGRAPH' && doc.progressScrollTop !== undefined) {
            window.setTimeout(() => {
                this.paragraphView.setScrollTop(doc.progressScrollTop || 0);
            }, 0);
        }
    }

    private async buildChunksWithCache(docId: string, text: string, language: string): Promise<ReaderChunk[]> {
        const paragraphs = splitParagraphs(text);
        const chunks: ReaderChunk[] = [];
        let sentenceId = 0;

        for (let paraId = 0; paraId < paragraphs.length; paraId++) {
            const para = paragraphs[paraId];
            const cached = await segmentCacheStore.getChunks(docId, paraId, para.text, language);
            if (cached && cached.length > 0) {
                chunks.push(...cached);
                const lastSentenceId = cached[cached.length - 1].sentenceId;
                sentenceId = Math.max(sentenceId, lastSentenceId + 1);
                continue;
            }

            const paraChunks = buildReaderChunksForParagraph(para, sentenceId, paraId, language);
            chunks.push(...paraChunks);
            if (paraChunks.length > 0) {
                const lastSentenceId = paraChunks[paraChunks.length - 1].sentenceId;
                sentenceId = Math.max(sentenceId, lastSentenceId + 1);
            } else {
                sentenceId += 1;
            }
            await segmentCacheStore.setChunks(docId, paraId, para.text, paraChunks, language);
        }

        return chunks;
    }

    private async voiceMatchesLanguage(voiceId: string, langCode: string): Promise<boolean> {
        const voices = await this.audioEngine.getAvailableVoices();
        const voice = voices.find(v => v.id === voiceId);
        if (!voice) return false;
        const normalized = langCode.toLowerCase();
        const baseLang = normalized.split('-')[0];
        const voiceLang = voice.lang.toLowerCase();
        return voiceLang.startsWith(normalized) || voiceLang.startsWith(baseLang);
    }

    private switchView(mode: 'RSVP' | 'PARAGRAPH' | 'FOCUS') {
        this.isReaderActive = true;

        if (this.currentDocId) {
            const tokenIndex = this.audioEngine.getController().getCurrentTokenIndex();
            documentStore.updateReadingState(this.currentDocId, this.buildReadingState(tokenIndex));
        }

        if (this.currentView) this.currentView.unmount();
        this.textInput.unmount();
        this.documentList.unmount();

        this.settings.mode = mode;
        settingsStore.saveSettings({ mode });

        if (mode === 'RSVP') {
            this.currentView = this.rsvpView;
        } else if (mode === 'FOCUS') {
            this.currentView = this.focusView;
        } else {
            this.currentView = this.paragraphView;
        }

        this.currentView.mount(this.viewContainer);

        this.controls.setActiveView(mode);

        // Force update to render content
        const controller = this.audioEngine.getController();
        // If we have tokens, make sure we render them
        if (this.currentView instanceof FocusView) {
            const tokenIndex = controller.getCurrentTokenIndex();
            const chunkIndex = this.tokenChunkMap[tokenIndex] ?? 0;
            this.currentView.update(chunkIndex, this.currentChunks, tokenIndex, this.currentTokens);
        } else if (this.currentTokens.length > 0 || (this.currentView instanceof ParagraphView)) {
            this.currentView.update(controller.getCurrentTokenIndex(), this.currentTokens);
        }

        const range = mode === 'FOCUS' ? FOCUS_WPM_RANGE : DEFAULT_WPM_RANGE;
        const clampedWpm = this.controls.setWpmRange(range.min, range.max);
        if (clampedWpm !== this.settings.speedWpm) {
            void this.handleWpmChange(clampedWpm);
        }

        const initialTokenIndex = controller.getCurrentTokenIndex();
        const initialOffset = this.currentTokens[initialTokenIndex]?.startOffset ?? 0;
        this.progress.updatePosition(initialOffset);
        this.progress.setVisible(true);

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
            const tokenIndex = this.audioEngine.getController().getCurrentTokenIndex();
            await documentStore.updateReadingState(this.currentDocId, {
                ...this.buildReadingState(tokenIndex),
                speedWpm: wpm
            });
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
            if (this.currentView instanceof FocusView) {
                const chunkIndex = this.tokenChunkMap[index] ?? 0;
                this.currentView.update(chunkIndex, this.currentChunks, index, this.currentTokens);
            } else if (this.currentView) {
                this.currentView.update(index, this.currentTokens);
            }

            const offset = this.currentTokens[index]?.startOffset ?? 0;
            this.progress.updatePosition(offset);

            // Auto-save progress
            if (this.currentDocId) {
                const now = Date.now();
                if (now - lastSaveTime > SAVE_INTERVAL) {
                    documentStore.updateReadingState(this.currentDocId, this.buildReadingState(index));
                    lastSaveTime = now;
                }
            }

            this.maybeAdaptSpeed();
        };

        controller.onTimeUpdate = () => {
            this.trackSessionTick();
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
                    const scheduler = controller.getScheduler();
                    const current = scheduler.getCurrentTime();
                    const duration = controller.getDuration();
                    const target = rewindByMs(current, val * 1000 * (direction === -1 ? 1 : -1), duration);
                    if (direction === -1) this.noteRewind();
                    controller.seek(target - current);
                    return;
                }

                const count = (unit === 'word' ? this.settings.skipSettings?.wordCount :
                    unit === 'sentence' ? this.settings.skipSettings?.sentenceCount :
                        this.settings.skipSettings?.paragraphCount) || 1;

                for (let i = 0; i < count; i++) {
                    if (unit === 'word') controller.skipWord(direction, this.currentTokens);
                    else if (unit === 'sentence') {
                        if (direction === -1) {
                            this.noteRewind();
                            const targetIndex = prevSentence(controller.getCurrentTokenIndex(), this.currentTokens);
                            controller.seekByToken(targetIndex);
                        } else {
                            controller.skipSentence(direction, this.currentTokens);
                        }
                    }
                    else {
                        if (direction === -1) this.noteRewind();
                        controller.skipParagraph(direction, this.currentTokens);
                    }
                }
            };

            navigator.mediaSession.setActionHandler('play', togglePlay);
            navigator.mediaSession.setActionHandler('pause', togglePlay);
            navigator.mediaSession.setActionHandler('previoustrack', () => handleMediaSkip(-1)); // Back
            navigator.mediaSession.setActionHandler('nexttrack', () => handleMediaSkip(1));      // Forward

            // Optional: Seek
            navigator.mediaSession.setActionHandler('seekbackward', () => {
                const val = (this.settings.skipSettings?.seekSec || 10);
                this.noteRewind();
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

    private setHelpVisible(visible: boolean) {
        this.isHelpOpen = visible;
        this.keyboardHelp.setVisible(visible);
    }

    private renderFatigueNudge() {
        if (!this.fatigueNudgeEl) return;
        this.fatigueNudgeEl.innerHTML = `
            <div class="fatigue-nudge-content" role="status" aria-live="polite">
                <div class="fatigue-text">
                    You have been reading for a while. Want a quick break or switch to paging?
                </div>
                <div class="fatigue-actions">
                    <button class="btn btn-secondary" id="fatigue-dismiss">Maybe later</button>
                    <button class="btn btn-secondary" id="fatigue-paging">Open paging</button>
                </div>
            </div>
        `;

        this.fatigueNudgeEl.querySelector('#fatigue-dismiss')?.addEventListener('click', () => {
            this.hideFatigueNudge();
        });
        this.fatigueNudgeEl.querySelector('#fatigue-paging')?.addEventListener('click', () => {
            this.hideFatigueNudge();
            this.openPagingFromShortcut();
        });
    }

    private showFatigueNudge() {
        if (!this.fatigueNudgeEl || this.fatigueNudgeShown) return;
        this.fatigueNudgeShown = true;
        this.fatigueNudgeEl.classList.remove('fatigue-nudge-hidden');
    }

    private hideFatigueNudge() {
        if (!this.fatigueNudgeEl) return;
        this.fatigueNudgeEl.classList.add('fatigue-nudge-hidden');
    }

    private resetFatigueNudge() {
        this.fatigueActiveMs = 0;
        this.fatigueLastTickMs = null;
        this.fatigueNudgeShown = false;
        this.hideFatigueNudge();
    }

    private trackSessionTick() {
        if (this.fatigueNudgeShown) return;
        const now = Date.now();
        if (this.fatigueLastTickMs === null) {
            this.fatigueLastTickMs = now;
            return;
        }

        const delta = now - this.fatigueLastTickMs;
        this.fatigueLastTickMs = now;
        if (delta <= 0) return;
        if (delta > 5000) return;

        this.fatigueActiveMs += delta;
        if (this.fatigueActiveMs >= 20 * 60 * 1000) {
            this.showFatigueNudge();
        }
    }

    private async loadAnnotations(docId: string) {
        this.currentAnnotations = await annotationStore.getAnnotations(docId);
        this.updateParagraphAnnotations();
    }

    private updateParagraphAnnotations() {
        const ranges = this.currentAnnotations.map(annotation => ({
            id: annotation.id,
            type: annotation.type,
            startOffset: annotation.startOffset,
            endOffset: annotation.endOffset,
            text: annotation.type === 'note'
                ? annotation.text
                : this.buildSnippet(annotation.startOffset, annotation.endOffset)
        }));

        this.paragraphView.setAnnotations(ranges, (id) => this.handleAnnotationSelect(id));
    }

    private handleAnnotationSelect(id: string) {
        const annotation = this.currentAnnotations.find(item => item.id === id);
        if (!annotation) return;
        const controller = this.audioEngine.getController();
        const fallback = controller.getCurrentTokenIndex();
        const tokenIndex = this.findTokenIndexForOffset(annotation.startOffset, fallback);
        if (!(this.currentView instanceof ParagraphView)) {
            this.switchView('PARAGRAPH');
        }
        controller.seekByToken(tokenIndex);
        if (this.currentView instanceof ParagraphView) {
            this.currentView.update(tokenIndex, this.currentTokens);
        }
    }

    private buildSnippet(start: number, end: number) {
        const text = this.currentTtsText || '';
        const raw = text.slice(start, Math.min(end, start + 140));
        return raw.replace(/\s+/g, ' ').trim();
    }

    private getSentenceRange() {
        const controller = this.audioEngine.getController();
        const tokenIndex = controller.getCurrentTokenIndex();
        const token = this.currentTokens[tokenIndex];
        if (!token) return null;
        const sentenceId = token.sentenceId;
        const sentenceTokens = this.currentTokens.filter(t => t.sentenceId === sentenceId);
        if (!sentenceTokens.length) return null;
        const startToken = sentenceTokens[0];
        const endToken = sentenceTokens[sentenceTokens.length - 1];
        return {
            startOffset: startToken.startOffset,
            endOffset: endToken.endOffset
        };
    }

    private getHighlightRange() {
        if (!this.currentChunks.length) return null;
        const controller = this.audioEngine.getController();
        const tokenIndex = controller.getCurrentTokenIndex();
        const chunkIndex = this.tokenChunkMap[tokenIndex] ?? 0;
        const prevIndex = Math.max(0, chunkIndex - 1);
        const nextIndex = Math.min(this.currentChunks.length - 1, chunkIndex + 1);
        const startOffset = this.currentChunks[prevIndex].startOffset;
        const endOffset = this.currentChunks[nextIndex].endOffset;
        return { startOffset, endOffset };
    }

    private async handleHighlightBuffer() {
        if (!this.currentDocId) return;
        const range = this.getHighlightRange();
        if (!range) return;
        const controller = this.audioEngine.getController();
        const tokenIndex = controller.getCurrentTokenIndex();
        const chunkIndex = this.tokenChunkMap[tokenIndex] ?? 0;
        const paraId = this.currentChunks[chunkIndex]?.paraId;
        await annotationStore.addHighlight(this.currentDocId, range.startOffset, range.endOffset, paraId);
        await this.loadAnnotations(this.currentDocId);
    }

    private async handleAddNote() {
        if (!this.currentDocId) return;
        const range = this.getSentenceRange();
        if (!range) return;
        const text = window.prompt('Add a note for this sentence:');
        if (!text) return;
        const controller = this.audioEngine.getController();
        const tokenIndex = controller.getCurrentTokenIndex();
        const chunkIndex = this.tokenChunkMap[tokenIndex] ?? 0;
        const paraId = this.currentChunks[chunkIndex]?.paraId;
        await annotationStore.addNote(this.currentDocId, range.startOffset, range.endOffset, text.trim(), paraId);
        await this.loadAnnotations(this.currentDocId);
    }

    private async handleCopySentence() {
        const range = this.getSentenceRange();
        if (!range) return;
        const sentence = this.currentTtsText.slice(range.startOffset, range.endOffset).replace(/\s+/g, ' ').trim();
        const payload = `${sentence} — ${this.currentDocTitle}`.trim();
        try {
            await navigator.clipboard.writeText(payload);
        } catch {
            const textarea = document.createElement('textarea');
            textarea.value = payload;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            textarea.remove();
        }
    }

    private handleParagraphScroll(scrollTop: number) {
        if (!this.currentDocId) return;
        if (!(this.currentView instanceof ParagraphView)) return;

        if (this.scrollSaveTimer !== null) {
            window.clearTimeout(this.scrollSaveTimer);
        }

        this.scrollSaveTimer = window.setTimeout(() => {
            const tokenIndex = this.audioEngine.getController().getCurrentTokenIndex();
            const state = this.buildReadingState(tokenIndex);
            state.progressScrollTop = scrollTop;
            documentStore.updateReadingState(this.currentDocId as string, state);
            this.scrollSaveTimer = null;
        }, 500);
    }

    private noteRewind() {
        recordRewind(Date.now(), this.adaptState);
    }

    private maybeAdaptSpeed() {
        const now = Date.now();
        const result = evaluateAdaptation(now, this.settings.speedWpm, this.adaptState);
        if (result && result.nextWpm !== this.settings.speedWpm) {
            void this.handleWpmChange(result.nextWpm);
        }
    }

    private getActiveWpmRange() {
        return this.settings.mode === 'FOCUS' ? FOCUS_WPM_RANGE : DEFAULT_WPM_RANGE;
    }

    private applyTheme(theme: 'default' | 'calm' | 'dark') {
        const root = document.documentElement;
        root.classList.remove('theme-default', 'theme-calm', 'theme-dark', 'dark-mode');
        root.classList.add(`theme-${theme}`);
    }

    private applyTypography() {
        const root = document.documentElement;
        const scale = this.settings.textSize || 1.0;
        const lineHeight = this.settings.readerLineHeight || 1.6;
        const fontFamily = this.settings.readerFontFamily || 'literata';
        const fontMap: Record<string, string> = {
            literata: '"Literata", "Times New Roman", serif',
            'source-serif': '"Source Serif 4", "Georgia", serif',
            atkinson: '"Atkinson Hyperlegible", "Arial", sans-serif'
        };
        const family = fontMap[fontFamily] || fontMap.literata;

        root.style.setProperty('--font-size-base', `${16 * scale}px`);
        root.style.setProperty('--reader-font-size', `${16 * scale}px`);
        root.style.setProperty('--reader-font-scale', scale.toString());
        root.style.setProperty('--reader-font-family', family);
        root.style.setProperty('--reader-line-height', lineHeight.toString());
    }

    private applyOrpSettings() {
        const root = document.documentElement;
        const enabled = this.settings.orpEnabled !== false;
        const intensity = typeof this.settings.orpIntensity === 'number' ? this.settings.orpIntensity : 1.0;
        root.style.setProperty('--orp-opacity', Math.max(0, Math.min(1, intensity)).toString());
        root.classList.toggle('orp-disabled', !enabled);
    }

    private showVoiceWarning(message: string) {
        if (!this.voiceWarningEl) return;
        this.voiceWarningEl.innerHTML = `
            <div class="voice-warning-content">
                <div class="voice-warning-text">
                    <div class="voice-warning-title">Voice not installed</div>
                    <div>${message}</div>
                </div>
                <div class="voice-warning-actions">
                    <button class="btn btn-secondary btn-sm" id="voice-warning-download" ${this.voiceWarningInstallId ? '' : 'disabled'}>
                        Download Voice
                    </button>
                    <button class="btn btn-secondary btn-sm" id="voice-warning-settings">Open Settings</button>
                    <button class="btn btn-secondary btn-sm" id="voice-warning-dismiss">Dismiss</button>
                </div>
            </div>
        `;
        this.voiceWarningEl.classList.remove('voice-warning-hidden');
        this.voiceWarningEl.querySelector('#voice-warning-settings')?.addEventListener('click', () => {
            this.settingsPanel.mount();
        });
        this.voiceWarningEl.querySelector('#voice-warning-download')?.addEventListener('click', async () => {
            if (!this.voiceWarningInstallId) return;
            const btn = this.voiceWarningEl?.querySelector('#voice-warning-download') as HTMLButtonElement | null;
            if (btn) {
                btn.disabled = true;
                btn.textContent = 'Downloading...';
            }
            try {
                await this.audioEngine.installVoice(this.voiceWarningInstallId);
                this.settings.voiceId = this.voiceWarningInstallId;
                if (this.currentDocId) {
                    await documentStore.updateSettings(this.currentDocId, this.voiceWarningInstallId, this.settings.speedWpm);
                }
                await this.audioEngine.updateSettings(this.settings, undefined, true);
                this.hideVoiceWarning();
            } catch {
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = 'Download Voice';
                }
            }
        });
        this.voiceWarningEl.querySelector('#voice-warning-dismiss')?.addEventListener('click', () => {
            this.voiceWarningEl?.classList.add('voice-warning-hidden');
        });
    }

    private hideVoiceWarning() {
        this.voiceWarningEl?.classList.add('voice-warning-hidden');
    }

    private async warnIfVoiceMissing(language: string, voiceId: string | null) {
        if (!language) return;
        const voices = await this.audioEngine.getAvailableVoices();
        const voice = voiceId ? voices.find(v => v.id === voiceId) : undefined;
        if (!voice) {
            this.voiceWarningInstallId = null;
            this.showVoiceWarning(`${this.formatLanguageLabel(language)} voice is not available. Using English voice for now.`);
            return;
        }
        if (!voice.isInstalled) {
            this.voiceWarningInstallId = voice.id;
            this.showVoiceWarning(`${voice.name} (${this.formatLanguageLabel(language)}) is not installed. Using English voice for now.`);
        } else {
            this.voiceWarningInstallId = null;
            this.hideVoiceWarning();
        }
    }

    private formatLanguageLabel(language: string): string {
        const base = language.split('-')[0].toLowerCase();
        switch (base) {
            case 'de':
                return 'German';
            case 'ru':
                return 'Russian';
            case 'es':
                return 'Spanish';
            case 'fr':
                return 'French';
            case 'en':
                return 'English';
            default:
                return language;
        }
    }

    private handleSpeedShortcut(direction: 1 | -1) {
        const delta = 10;
        const range = this.getActiveWpmRange();
        const target = Math.min(range.max, Math.max(range.min, this.settings.speedWpm + delta * direction));
        if (target === this.settings.speedWpm) return;
        void this.handleWpmChange(target);
    }

    private buildReadingState(tokenIndex: number) {
        const token = this.currentTokens[tokenIndex];
        const chunkIndex = this.tokenChunkMap[tokenIndex] ?? 0;
        const chunk = this.currentChunks[chunkIndex];
        const scrollTop = this.currentView instanceof ParagraphView
            ? this.paragraphView.getScrollTop()
            : undefined;

        return {
            progressTokenIndex: tokenIndex,
            progressOffset: token?.startOffset ?? 0,
            progressChunkIndex: chunkIndex,
            progressParaId: chunk?.paraId ?? 0,
            progressScrollTop: scrollTop,
            speedWpm: this.settings.speedWpm,
            mode: this.settings.mode
        };
    }

    private openPagingFromShortcut() {
        if (this.currentView instanceof FocusView) {
            void this.handleFocusPanicExit();
            return;
        }
        if (!(this.currentView instanceof ParagraphView)) {
            this.switchView('PARAGRAPH');
        }
    }

    private setupKeyboardShortcuts() {
        window.addEventListener('keydown', (e) => {
            const controller = this.audioEngine.getController();

            // Ignore if in input field
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

            if (this.isHelpOpen) {
                if (e.key === 'Escape' || e.key === '?' || (e.code === 'Slash' && e.shiftKey)) {
                    e.preventDefault();
                    this.setHelpVisible(false);
                }
                return;
            }

            if (e.key === '?' || (e.code === 'Slash' && e.shiftKey)) {
                e.preventDefault();
                this.setHelpVisible(true);
                return;
            }

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
                            this.noteRewind();
                            controller.seek(-val);
                        } else {
                            const count = (unit === 'word' ? this.settings.skipSettings?.wordCount :
                                unit === 'sentence' ? this.settings.skipSettings?.sentenceCount :
                                    this.settings.skipSettings?.paragraphCount) || 1;
                            for (let i = 0; i < count; i++) {
                                if (unit === 'word') controller.skipWord(-1, this.currentTokens);
                                else if (unit === 'sentence') {
                                    this.noteRewind();
                                    const targetIndex = prevSentence(controller.getCurrentTokenIndex(), this.currentTokens);
                                    controller.seekByToken(targetIndex);
                                }
                                else {
                                    this.noteRewind();
                                    controller.skipParagraph(-1, this.currentTokens);
                                }
                            }
                        }
                    }
                    break;
                case 'MediaStop':
                    controller.pause();
                    controller.seekByToken(0);
                    break;
                case 'ArrowLeft': {
                    e.preventDefault();
                    if (!this.currentTokens.length || !this.currentChunks.length) return;
                    if (e.shiftKey) {
                        this.noteRewind();
                        const targetIndex = prevSentence(controller.getCurrentTokenIndex(), this.currentTokens);
                        controller.seekByToken(targetIndex);
                        return;
                    }
                    this.noteRewind();
                    const tokenIndex = controller.getCurrentTokenIndex();
                    const chunkIndex = this.tokenChunkMap[tokenIndex] ?? 0;
                    const targetChunkIndex = prevChunk(chunkIndex, this.currentChunks);
                    const targetChunk = this.currentChunks[targetChunkIndex];
                    if (!targetChunk) return;
                    const targetIndex = this.findTokenIndexForOffset(targetChunk.startOffset, tokenIndex);
                    controller.seekByToken(targetIndex);
                    break;
                }
                case 'ArrowRight': {
                    e.preventDefault();
                    if (!this.currentTokens.length || !this.currentChunks.length) return;
                    if (e.shiftKey) {
                        controller.skipSentence(1, this.currentTokens);
                        return;
                    }
                    const tokenIndex = controller.getCurrentTokenIndex();
                    const chunkIndex = this.tokenChunkMap[tokenIndex] ?? 0;
                    const targetChunkIndex = Math.min(this.currentChunks.length - 1, chunkIndex + 1);
                    const targetChunk = this.currentChunks[targetChunkIndex];
                    if (!targetChunk) return;
                    const targetIndex = this.findTokenIndexForOffset(targetChunk.startOffset, tokenIndex);
                    controller.seekByToken(targetIndex);
                    break;
                }
                case 'Equal':
                case 'NumpadAdd':
                    e.preventDefault();
                    this.handleSpeedShortcut(1);
                    break;
                case 'Minus':
                case 'NumpadSubtract':
                    e.preventDefault();
                    this.handleSpeedShortcut(-1);
                    break;
                case 'Escape':
                    e.preventDefault();
                    this.openPagingFromShortcut();
                    break;
            }
        });
    }

    private async selectVoiceForLanguage(langCode: string): Promise<string | null> {
        const voices = await this.audioEngine.getAvailableVoices();
        const normalized = langCode.toLowerCase();
        const baseLang = normalized.split('-')[0];

        // Priority 1: Installed voice matching full language
        let match = voices.find(v => v.lang.toLowerCase().startsWith(normalized) && v.isInstalled);
        if (match) return match.id;

        // Priority 2: Installed voice matching base language
        match = voices.find(v => v.lang.toLowerCase().startsWith(baseLang) && v.isInstalled);
        if (match) return match.id;

        // Priority 3: Any voice matching full language
        match = voices.find(v => v.lang.toLowerCase().startsWith(normalized));
        if (match) return match.id;

        // Priority 4: Any voice matching base language
        match = voices.find(v => v.lang.toLowerCase().startsWith(baseLang));
        if (match) return match.id;

        return null;
    }

    private async handleFocusPanicExit() {
        const controller = this.audioEngine.getController();
        if (!this.currentTokens.length || !this.currentChunks.length) {
            this.switchView('PARAGRAPH');
            return;
        }

        if (controller.getState() === 'PLAYING') {
            try {
                await controller.pause();
            } catch {
                // best-effort pause
            }
        }

        const tokenIndex = controller.getCurrentTokenIndex();
        const chunkIndex = this.tokenChunkMap[tokenIndex] ?? 0;
        const chunk = this.currentChunks[chunkIndex];
        const targetIndex = chunk
            ? this.findTokenIndexForOffset(chunk.startOffset, tokenIndex)
            : Math.max(0, tokenIndex);

        controller.seekByToken(targetIndex);
        this.switchView('PARAGRAPH');

        if (this.currentView instanceof ParagraphView) {
            this.currentView.update(targetIndex, this.currentTokens);
        }
    }

    private findTokenIndexForOffset(offset: number, fallbackIndex: number): number {
        if (!this.currentTokens.length) return fallbackIndex;

        let left = 0;
        let right = this.currentTokens.length - 1;
        let result = -1;

        while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            const startOffset = this.currentTokens[mid].startOffset;

            if (startOffset >= offset) {
                result = mid;
                right = mid - 1;
            } else {
                left = mid + 1;
            }
        }

        if (result === -1) return this.currentTokens.length - 1;
        return result;
    }

}
