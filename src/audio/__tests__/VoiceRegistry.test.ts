import { describe, expect, it } from 'vitest';
import { VOICE_REGISTRY } from '../VoiceRegistry';

describe('VOICE_REGISTRY', () => {
  it('uses app-relative asset URLs for the built-in Piper voice', () => {
    const builtin = VOICE_REGISTRY.find((voice) => voice.isBuiltIn);

    expect(builtin).toBeDefined();
    expect(builtin?.modelUrl).toBe('piper/en_US-amy-medium.onnx');
    expect(builtin?.configUrl).toBe('piper/en_US-amy-medium.onnx.json');
    expect(builtin?.modelUrl.startsWith('/')).toBe(false);
    expect(builtin?.configUrl.startsWith('/')).toBe(false);
  });
});
