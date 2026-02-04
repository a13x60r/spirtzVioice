export class AppInstaller {
    private promptEvent: any;
    private onAvailabilityChange?: (available: boolean) => void;

    constructor(onAvailabilityChange?: (available: boolean) => void) {
        this.onAvailabilityChange = onAvailabilityChange;

        window.addEventListener('beforeinstallprompt', (e) => {
            // Prevent Chrome 67 and earlier from automatically showing the prompt
            e.preventDefault();
            // Stash the event so it can be triggered later.
            this.promptEvent = e;
            // Notify listener
            this.onAvailabilityChange?.(true);
        });

        window.addEventListener('appinstalled', () => {
            this.promptEvent = null;
            this.onAvailabilityChange?.(false);
        });
    }

    async promptInstall() {
        if (!this.promptEvent) return;
        this.promptEvent.prompt();
        // Wait for the user to respond to the prompt
        const choiceResult = await this.promptEvent.userChoice;
        if (choiceResult.outcome === 'accepted') {
            console.log('User accepted the A2HS prompt');
            this.promptEvent = null;
            this.onAvailabilityChange?.(false);
        } else {
            console.log('User dismissed the A2HS prompt');
        }
    }
}
