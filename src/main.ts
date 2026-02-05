import { ReaderShell } from './ui/ReaderShell';
import { registerSW } from 'virtual:pwa-register';

declare global {
    interface Window {
        __spirtzApp?: ReaderShell;
    }
}

console.log('Spirtz Voice initializing...');

if (!window.__spirtzApp) {
    const app = new ReaderShell('app');
    window.__spirtzApp = app;
    app.init().catch(console.error);
}

if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        window.__spirtzApp?.destroy?.();
        window.__spirtzApp = undefined;
    });
}

console.log('Spirtz Voice mounted.');

if (import.meta.env.PROD) {
    registerSW({
        immediate: true,
        onOfflineReady() {
            console.log('Spirtz Voice ready for offline use.');
        },
        onNeedRefresh() {
            console.log('Spirtz Voice update available.');
        }
    });
}
