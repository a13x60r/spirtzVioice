import './styles/main.css';
import { AudioEngine } from '../audio/AudioEngine';
import { seedMockVoices } from '../utils/seed_voices';

import { documentStore } from '../storage/DocumentStore';
import { settingsStore } from '../storage/SettingsStore';
import { Controls } from './components/Controls';
import { SettingsPanel } from './components/Settings';
import { TextInput } from './components/TextInput';
import { RSVPView } from './views/RSVPView';
import { LoadingOverlay } from './components/LoadingOverlay';
import { ParagraphView } from './views/ParagraphView';
import type { ReaderView } from './views/ViewInterface';
import type { Settings } from '@spec/types';
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

        // Seed voices if needed
        await seedMockVoices();

        this.setupComponents();

        // Initialize loading overlay
        this.loadingOverlay = new LoadingOverlay();
        // Hide initial loading screen if present
        const initialLoader = document.querySelector('.loading');
        if (initialLoader) initialLoader.remove();

        this.startUiLoop();
    }

    private renderShell() {
        this.container.innerHTML = `
            <div class="shell-container">
                <header class="header">
                    <h1>Spritz Voice</h1>
                    <div>
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

            // Check for existing documents? For MVP, show TextInput if no doc loaded.
            // We need to know if we have an active document.
            // For now, always show text input on fresh load unless we implemented persistence hooks.
            // Let's assume no doc initially.

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

    private setupComponents() {
        // Controls
        const controlsMount = this.container.querySelector('#controls-mount') as HTMLElement;
        const controller = this.audioEngine.getController();

        this.controls = new Controls(controlsMount, {
            onPlayPause: async () => {
                // Ensure context is resumed on user gesture
                await this.audioEngine.getController().getScheduler().resumeContext();

                if (controller.getState() === 'PLAYING') {
                    controller.pause();
                } else {
                    controller.play().catch(err => console.error("Play failed", err));
                }
            },
            onSeek: (offset) => {
                controller.seek(offset);
            },
            onSpeedChange: async (wpm) => {
                this.settings.speedWpm = wpm;
                settingsStore.saveSettings({ speedWpm: wpm });

                this.loadingOverlay.show('Updating Speed...');
                await this.audioEngine.updateSettings(this.settings, (p, msg) => {
                    this.loadingOverlay.setProgress(p);
                    if (msg) this.loadingOverlay.setText(msg);
                });
                this.loadingOverlay.hide();
            }
        });

        // Settings
        const settingsMount = this.container.querySelector('#settings-mount') as HTMLElement;
        this.settingsPanel = new SettingsPanel(
            settingsMount,
            {
                onClose: () => this.settingsPanel.unmount(),
                onVoiceChange: async (voiceId) => {
                    console.log('Voice selected:', voiceId);
                    this.settings.voiceId = voiceId;
                    await settingsStore.saveSettings({ voiceId });

                    // Update engine (load voice + re-synth)
                    this.loadingOverlay.show('Loading Voice...');
                    await this.audioEngine.updateSettings(this.settings, (p, msg) => {
                        this.loadingOverlay.setProgress(p);
                        if (msg) this.loadingOverlay.setText(msg);
                    });
                    this.loadingOverlay.hide();
                },
                onSpeedChange: async (wpm) => {
                    this.settings.speedWpm = wpm;
                    settingsStore.saveSettings({ speedWpm: wpm });

                    this.loadingOverlay.show('Updating Speed...');
                    await this.audioEngine.updateSettings(this.settings, (p, msg) => {
                        this.loadingOverlay.setProgress(p);
                        if (msg) this.loadingOverlay.setText(msg);
                    });
                    this.loadingOverlay.hide();
                },
                onStrategyChange: async (strategy) => {
                    this.settings.strategy = strategy;
                    settingsStore.saveSettings({ strategy });

                    this.loadingOverlay.show('Updating Strategy...');
                    await this.audioEngine.updateSettings(this.settings, (p, msg) => {
                        this.loadingOverlay.setProgress(p);
                        if (msg) this.loadingOverlay.setText(msg);
                    });
                    this.loadingOverlay.hide();
                }
            },
            this.settings
        );

        // Fetch available voices
        this.audioEngine.getAvailableVoices().then(voices => {
            console.log('Available voices:', voices);
            this.settingsPanel.setVoices(voices);
            // If current settings voice is not in list (e.g. fresh ID), reset?
            // For now, assume it handles it.
        }).catch(err => console.error("Failed to fetch voices", err));

        // TextInput
        // We'll mount it immediately if no document.
        this.textInput = new TextInput(this.viewContainer, async (title, text) => {
            await this.handleNewDocument(title, text);
        });

        // Initially mount input and hide switch view
        this.showTextInput();
    }

    private async handleNewDocument(title: string, text: string) {
        console.log('Processing new document:', title);

        this.loadingOverlay.show('Processing Document...');

        // 1. Save to DB
        const doc = await documentStore.createDocument(title, text);

        // 2. Tokenize
        // Ideally offload to worker or domain. TextPipeline is sync for now.
        const tokens = TextPipeline.tokenize(text);

        // 3. Load into Engine
        await this.audioEngine.loadDocument(doc.id, tokens, this.settings, 0, (p, msg) => {
            this.loadingOverlay.setProgress(p);
            if (msg) this.loadingOverlay.setText(msg);
        });

        this.loadingOverlay.hide();

        // 4. Switch to reading view
        this.switchView(this.settings.mode);

        // Show toggle view button
        const toggleBtn = this.container.querySelector('#btn-toggle-view') as HTMLElement;
        if (toggleBtn) toggleBtn.style.display = 'inline-block';

        // Hack: update view with tokens immediately
        if (this.currentView) {
            this.currentView.update(0, tokens);
        }

        // Hook up controller listener to update view
        const controller = this.audioEngine.getController();
        controller.onTokenChanged = (index) => {
            if (this.currentView) {
                this.currentView.update(index, tokens);
            }
        };
    }

    private showTextInput() {
        // Pause if playing
        this.audioEngine.getController().pause();

        // Unmount current view
        if (this.currentView) this.currentView.unmount();

        // Mount Text Input
        this.textInput.mount();

        // Hide switch view button (irrelevant in input mode)
        const toggleBtn = this.container.querySelector('#btn-toggle-view') as HTMLElement;
        if (toggleBtn) toggleBtn.style.display = 'none';
    }

    private switchView(mode: 'RSVP' | 'PARAGRAPH') {
        // Unmount current (either View or TextInput)
        if (this.currentView) this.currentView.unmount();
        this.textInput.unmount(); // Unmount just in case

        this.settings.mode = mode;
        settingsStore.saveSettings({ mode });

        if (mode === 'RSVP') {
            this.currentView = this.rsvpView;
        } else {
            this.currentView = this.paragraphView;
        }

        this.currentView.mount(this.viewContainer);
    }

    private startUiLoop() {
        if (this.uiLoopActive) return;
        this.uiLoopActive = true;

        const loop = () => {
            const controller = this.audioEngine.getController();
            const scheduler = controller.getScheduler();

            // Update Play/Pause button
            const isPlaying = controller.getState() === 'PLAYING';
            this.controls.setPlaying(isPlaying);

            // Update Progress
            const currentTime = scheduler.getCurrentTime();
            const totalTime = controller.getDuration();
            this.controls.setTime(currentTime.toFixed(1), totalTime > 0 ? totalTime.toFixed(1) : "--:--");

            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }
}
