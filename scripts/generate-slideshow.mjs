/**
 * generate-slideshow.mjs
 * Combines e2e screenshots into an animated GIF slideshow.
 * Called automatically via Playwright globalTeardown.
 *
 * Usage:  node scripts/generate-slideshow.mjs
 */
import sharp from 'sharp';
import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const SCREENSHOTS_DIR = resolve('tests/e2e/screenshots');
const OUTPUT = join(SCREENSHOTS_DIR, 'slideshow.gif');
const WIDTH = 1280;
const HEIGHT = 720;
const DELAY_MS = 2000;

export default async function generate() {
  const files = (await readdir(SCREENSHOTS_DIR))
    .filter(f => /^\d+.*\.png$/i.test(f))
    .sort();

  if (files.length === 0) {
    console.log('[slideshow] No screenshots found, skipping.');
    return;
  }

  console.log(`[slideshow] Building GIF from ${files.length} screenshots…`);

  // Resize each frame to fit WIDTH×HEIGHT, centered on dark background
  const rawFrames = await Promise.all(
    files.map(file =>
      sharp(join(SCREENSHOTS_DIR, file))
        .resize(WIDTH, HEIGHT, {
          fit: 'contain',
          background: { r: 24, g: 24, b: 32, alpha: 1 },
        })
        .ensureAlpha()
        .raw()
        .toBuffer(),
    ),
  );

  // Stack all frames vertically into one tall raw buffer
  // sharp treats each HEIGHT-row slice as a separate animation page
  const stacked = Buffer.concat(rawFrames);

  await sharp(stacked, {
    raw: {
      width: WIDTH,
      height: HEIGHT * files.length,
      channels: 4,
      pages: files.length,         // ← tells sharp how many frames
      pageHeight: HEIGHT,          // ← height of each frame
    },
  })
    .gif({
      delay: Array(files.length).fill(DELAY_MS),
      loop: 0,
    })
    .toFile(OUTPUT);

  console.log(`[slideshow] ✓ ${OUTPUT}`);
}

// Run directly if called as script (not imported as teardown)
const isDirectRun = process.argv[1]?.endsWith('generate-slideshow.mjs');
if (isDirectRun) {
  generate().catch((err) => {
    console.error('[slideshow] Error:', err.message);
    process.exitCode = 1;
  });
}
