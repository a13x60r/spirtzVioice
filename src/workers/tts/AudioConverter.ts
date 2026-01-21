/**
 * Convert Float32Array PCM to WAV ArrayBuffer
 */
export function pcmToWav(
    pcmData: Float32Array,
    sampleRate: number,
    numChannels: number = 1
): ArrayBuffer {
    const bytesPerSample = 2; // 16-bit PCM
    const totalSamples = pcmData.length;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = totalSamples * blockAlign;
    const bufferSize = 44 + dataSize;

    const buffer = new ArrayBuffer(bufferSize);
    const view = new DataView(buffer);

    // Ref: http://soundfile.sapp.org/doc/WaveFormat/

    // RIFF Chunk
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');

    // fmt Chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
    view.setUint16(22, numChannels, true); // NumChannels
    view.setUint32(24, sampleRate, true); // SampleRate
    view.setUint32(28, byteRate, true); // ByteRate
    view.setUint16(32, blockAlign, true); // BlockAlign
    view.setUint16(34, 16, true); // BitsPerSample (16 bits)

    // data Chunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Data
    floatTo16BitPCM(view, 44, pcmData);

    return buffer;
}

function writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}


function floatTo16BitPCM(view: DataView, offset: number, input: Float32Array) {
    for (let i = 0; i < input.length; i++, offset += 2) {
        let s = Math.max(-1, Math.min(1, input[i]));
        s = s < 0 ? s * 0x8000 : s * 0x7FFF;
        view.setInt16(offset, s, true);
    }
}

/**
 * Decode WAV ArrayBuffer to Float32Array and get sample rate
 */
export function wavToPcm(wavBuffer: ArrayBuffer): { audioData: Float32Array, sampleRate: number } {
    const view = new DataView(wavBuffer);

    // Parse header to sanity check and get sample rate
    // RIFF at 0, WAVE at 8. 
    // fmt at 12.
    // AudioFormat at 20 (1=PCM).
    // NumChannels at 22.
    // SampleRate at 24.
    // BitsPerSample at 34.
    // data at 36 (usually, but we should search for it if we want to be robust, 
    // but for mespeak output it's likely standard).

    const sampleRate = view.getUint32(24, true);
    // const channels = view.getUint16(22, true);
    const bitsPerSample = view.getUint16(34, true);

    let dataOffset = 36;
    while (dataOffset < view.byteLength) {
        if (view.getUint32(dataOffset, false) === 0x64617461) { // "data"
            // Found data chunk
            dataOffset += 8; // skip tag and size
            break;
        }
        dataOffset += 1; // Brute force search or parse chunks properly? 
        // Standard header usually has data at 36 or 44 depending on extra format bytes.
        // For simple WAV output from tools like mespeak, it's usually at 44 (standard 44 byte header).
        // Let's assume 44 for now if "data" check fails or verify standard header size.
    }

    // Fallback if loop fails (simple header assumption)
    if (dataOffset >= view.byteLength) {
        dataOffset = 44;
    }

    const dataLength = wavBuffer.byteLength - dataOffset;
    const numSamples = dataLength / (bitsPerSample / 8);
    const floatData = new Float32Array(numSamples);

    // Convert
    if (bitsPerSample === 16) {
        for (let i = 0; i < numSamples; i++) {
            const int16 = view.getInt16(dataOffset + i * 2, true);
            // Convert to float [-1, 1]
            floatData[i] = int16 < 0 ? int16 / 0x8000 : int16 / 0x7FFF;
        }
    } else if (bitsPerSample === 8) {
        for (let i = 0; i < numSamples; i++) {
            const uint8 = view.getUint8(dataOffset + i);
            // 0..255 -> -1..1
            floatData[i] = (uint8 - 128) / 128;
        }
    }

    return { audioData: floatData, sampleRate };
}

