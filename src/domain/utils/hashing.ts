/**
 * Generate a hash for a chunk of text with voice and speed parameters
 * Used for audio cache lookup
 */
export async function generateChunkHash(
  chunkText: string,
  voiceId: string,
  speedWpm: number
): Promise<string> {
  // Combine all parameters that affect audio output
  const data = `${chunkText}|${voiceId}|${speedWpm}`;
  
  // Use SubtleCrypto API for SHA-256 hashing
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  
  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex;
}

/**
 * Synchronous version using simpler hash (for non-critical paths)
 */
export function generateChunkHashSync(
  chunkText: string,
  voiceId: string,
  speedWpm: number
): string {
  const data = `${chunkText}|${voiceId}|${speedWpm}`;
  
  // Simple hash function (FNV-1a)
  let hash = 2166136261;
  for (let i = 0; i < data.length; i++) {
    hash ^= data.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  
  return (hash >>> 0).toString(16).padStart(8, '0');
}
