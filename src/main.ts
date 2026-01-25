import { ReaderShell } from './ui/ReaderShell';

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
