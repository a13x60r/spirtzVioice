/**
 * Playwright globalTeardown — runs after all tests pass.
 * Regenerates the animated GIF slideshow from the latest screenshots.
 */
import generate from '../../scripts/generate-slideshow.mjs';

export default async function globalTeardown() {
  try {
    await generate();
  } catch (err) {
    console.error('[slideshow] Failed to generate GIF:', (err as Error).message);
    // Non-fatal: don't fail the Playwright run over a cosmetic asset
  }
}
