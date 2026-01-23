export interface VoiceDefinition {
    id: string;
    name: string;
    lang: string;
    modelUrl: string;
    configUrl: string;
    sizeBytes: number;
    isBuiltIn?: boolean;
}

const BASE_URL = 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/';

export const VOICE_REGISTRY: VoiceDefinition[] = [
    {
        id: 'en_US-amy-medium.onnx',
        name: 'Amy (Medium)',
        lang: 'en-US',
        modelUrl: '/piper/en_US-amy-medium.onnx',
        configUrl: '/piper/en_US-amy-medium.onnx.json',
        sizeBytes: 63201294,
        isBuiltIn: true
    },
    {
        id: 'es_ES-sharvard-medium.onnx',
        name: 'Alvaro (Medium)',
        lang: 'es-ES',
        modelUrl: BASE_URL + 'es/es_ES/sharvard/medium/es_ES-sharvard-medium.onnx',
        configUrl: BASE_URL + 'es/es_ES/sharvard/medium/es_ES-sharvard-medium.onnx.json',
        sizeBytes: 64149097
    },
    {
        id: 'fr_FR-siwis-medium.onnx',
        name: 'Siwis (Medium)',
        lang: 'fr-FR',
        modelUrl: BASE_URL + 'fr/fr_FR/siwis/medium/fr_FR-siwis-medium.onnx',
        configUrl: BASE_URL + 'fr/fr_FR/siwis/medium/fr_FR-siwis-medium.onnx.json',
        sizeBytes: 65160000
    },
    {
        id: 'de_DE-thorsten-medium.onnx',
        name: 'Thorsten (Medium)',
        lang: 'de-DE',
        modelUrl: BASE_URL + 'de/de_DE/thorsten/medium/de_DE-thorsten-medium.onnx',
        configUrl: BASE_URL + 'de/de_DE/thorsten/medium/de_DE-thorsten-medium.onnx.json',
        sizeBytes: 65548000
    },
    {
        id: 'ru_RU-dmitri-medium.onnx',
        name: 'Dmitri (Medium)',
        lang: 'ru-RU',
        modelUrl: BASE_URL + 'ru/ru_RU/dmitri/medium/ru_RU-dmitri-medium.onnx',
        configUrl: BASE_URL + 'ru/ru_RU/dmitri/medium/ru_RU-dmitri-medium.onnx.json',
        sizeBytes: 63000000
    }
];
