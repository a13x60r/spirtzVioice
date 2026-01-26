export class InstallPrompt {
    private promptEvent: any;
    private container: HTMLElement;
    private onAvailabilityChange?: (available: boolean) => void;

    constructor(onAvailabilityChange?: (available: boolean) => void) {
        this.onAvailabilityChange = onAvailabilityChange;
        this.container = document.createElement('div');
        this.container.className = 'install-prompt-container';
        this.container.style.display = 'none'; // Hidden by default

        // Listen for the install prompt
        window.addEventListener('beforeinstallprompt', (e) => {
            // Prevent Chrome 67 and earlier from automatically showing the prompt
            e.preventDefault();
            // Stash the event so it can be triggered later.
            this.promptEvent = e;
            this.onAvailabilityChange?.(true);
            // Update UI to notify the user they can add to home screen
            this.showPrompt();
        });

        window.addEventListener('appinstalled', () => {
            this.promptEvent = null;
            this.onAvailabilityChange?.(false);
            this.container.style.display = 'none';
        });
    }

    isAvailable() {
        return Boolean(this.promptEvent);
    }

    async promptInstall() {
        if (!this.promptEvent) return false;
        await this.triggerPrompt();
        return true;
    }

    private showPrompt() {
        this.container.style.display = 'block';
        this.container.innerHTML = `
            <div class="install-prompt">
                <p>Install Spirtz Voice for offline use</p>
                <div class="install-buttons">
                    <button id="btn-install" class="btn btn-primary">Install</button>
                    <button id="btn-dismiss" class="btn btn-secondary">Dismiss</button>
                </div>
            </div>
        `;

        document.body.appendChild(this.container);

        this.container.querySelector('#btn-install')?.addEventListener('click', async () => {
            this.container.style.display = 'none';
            await this.triggerPrompt();
        });

        this.container.querySelector('#btn-dismiss')?.addEventListener('click', () => {
            this.container.style.display = 'none';
        });
    }

    private async triggerPrompt() {
        if (!this.promptEvent) return;
        this.promptEvent.prompt();
        const choiceResult = await this.promptEvent.userChoice;
        if (choiceResult.outcome === 'accepted') {
            console.log('User accepted the A2HS prompt');
        } else {
            console.log('User dismissed the A2HS prompt');
        }
        this.promptEvent = null;
        this.onAvailabilityChange?.(false);
    }
}
