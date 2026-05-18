import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Controls } from '../Controls';

describe('Controls', () => {
    let container: HTMLElement;
    let callbacks: any;
    let controls: Controls;

    beforeEach(() => {
        container = document.createElement('div');
        callbacks = {
            onPlayPause: vi.fn(),
            onSeek: vi.fn(),
            onSkip: vi.fn(),
            onHighlight: vi.fn(),
            onNote: vi.fn(),
            onCopySentence: vi.fn(),
            onViewChange: vi.fn(),
            onSpeedChange: vi.fn(),
            onWpmChange: vi.fn(),
            onVolumeChange: vi.fn()
        };

        controls = new Controls(container, callbacks, 1.0, 250, 1.0);
    });

    it('renders initial state correctly', () => {
        const speedInput = container.querySelector('#speed-input') as HTMLInputElement;
        const wpmInput = container.querySelector('#wpm-input') as HTMLInputElement;
        
        expect(speedInput.value).toBe('1');
        expect(wpmInput.value).toBe('250');
    });

    it('clamps WPM to the allowed range', () => {
        // Assume default range 200-1400
        controls.setWpmRange(200, 1400);
        
        // Simulating a change event with an out-of-bounds value
        const wpmNumberInput = container.querySelector('#wpm-input-number') as HTMLInputElement;
        wpmNumberInput.value = '1500';
        wpmNumberInput.dispatchEvent(new Event('change'));

        // It should clamp down to 1400 and trigger callback
        expect(callbacks.onWpmChange).toHaveBeenCalledWith(1400);
        expect(wpmNumberInput.value).toBe('1400');

        wpmNumberInput.value = '100';
        wpmNumberInput.dispatchEvent(new Event('change'));

        expect(callbacks.onWpmChange).toHaveBeenCalledWith(200);
        expect(wpmNumberInput.value).toBe('200');
    });

    it('invokes speed change callbacks when modified', () => {
        const speedInput = container.querySelector('#speed-input') as HTMLInputElement;
        speedInput.value = '1.5';
        speedInput.dispatchEvent(new Event('input'));

        expect(callbacks.onSpeedChange).toHaveBeenCalledWith(1.5);
        const speedDisplay = container.querySelector('#speed-val-display');
        expect(speedDisplay?.textContent).toBe('[1.5x]');
    });

    it('applies preset WPMs when clicking preset buttons', () => {
        // Assume default has presets like [180, 240, 300, 360]
        const presets = Array.from(container.querySelectorAll('.wpm-preset')) as HTMLButtonElement[];
        
        // Find the 300 preset button
        const preset300 = presets.find(btn => btn.dataset.wpm === '300');
        expect(preset300).toBeTruthy();
        
        preset300?.click();

        expect(callbacks.onWpmChange).toHaveBeenCalledWith(300);
        
        const wpmInput = container.querySelector('#wpm-input-number') as HTMLInputElement;
        expect(wpmInput.value).toBe('300');
    });

    it('toggles drawer state correctly', () => {
        const drawerHandle = container.querySelector('#drawer-handle') as HTMLElement;
        const drawerClose = container.querySelector('#drawer-close') as HTMLElement;
        const drawerPanel = container.querySelector('#drawer-panel') as HTMLElement;

        expect(drawerPanel.classList.contains('open')).toBe(false);

        drawerHandle.click();
        expect(drawerPanel.classList.contains('open')).toBe(true);

        drawerClose.click();
        expect(drawerPanel.classList.contains('open')).toBe(false);
    });
});
