export interface ReaderView {
    mount(container: HTMLElement): void;
    unmount(): void;
    update(tokenIndex: number, tokens: any[]): void; // Using any[] for tokens to avoid circular dep for now, or import type
    setTheme(theme: string): void;
}
