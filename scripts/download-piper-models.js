import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const publicPiperDir = path.join(projectRoot, 'public', 'piper');
const piperBuildDir = path.join(projectRoot, 'node_modules', 'piper-wasm', 'build');
const piperWorkerDir = path.join(piperBuildDir, 'worker');

const FILES_TO_DOWNLOAD = [
  {
    name: 'en_US-amy-medium.onnx',
    url: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx'
  },
  {
    name: 'en_US-amy-medium.onnx.json',
    url: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx.json'
  }
];

const RUNTIME_FILES = [
  ['piper_phonemize.js', 'piper_phonemize.js'],
  ['piper_phonemize.wasm', 'piper_phonemize.wasm'],
  ['piper_phonemize.data', 'piper_phonemize.data'],
  [path.join('worker', 'piper_worker.js'), 'piper_worker.js']
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFileIfNeeded(source, destination) {
  ensureDir(path.dirname(destination));
  fs.copyFileSync(source, destination);
  console.log(`Copied ${path.relative(projectRoot, source)} -> ${path.relative(projectRoot, destination)}`);
}

function copyDirRecursive(source, destination) {
  ensureDir(destination);
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(sourcePath, destinationPath);
    } else {
      copyFileIfNeeded(sourcePath, destinationPath);
    }
  }
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    ensureDir(path.dirname(dest));
    const file = fs.createWriteStream(dest);
    console.log(`Downloading ${url} -> ${path.relative(projectRoot, dest)}`);

    https.get(url, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode ?? 0)) {
        file.close(() => {
          fs.unlink(dest, () => {});
          const redirectUrl = new URL(response.headers.location, url).toString();
          downloadFile(redirectUrl, dest).then(resolve).catch(reject);
        });
        return;
      }

      if (response.statusCode !== 200) {
        file.close(() => {
          fs.unlink(dest, () => {});
          reject(new Error(`Failed to download ${url}: status ${response.statusCode}`));
        });
        return;
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          console.log(`Downloaded ${path.relative(projectRoot, dest)}`);
          resolve();
        });
      });
    }).on('error', (err) => {
      file.close(() => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    });
  });
}

function assertPiperInstalled() {
  if (!fs.existsSync(piperBuildDir)) {
    throw new Error('piper-wasm build assets not found. Run npm install first.');
  }
}

async function syncRuntimeAssets() {
  assertPiperInstalled();
  ensureDir(publicPiperDir);

  for (const [sourceRelative, destinationRelative] of RUNTIME_FILES) {
    const source = path.join(piperBuildDir, sourceRelative);
    const destination = path.join(publicPiperDir, destinationRelative);
    if (!fs.existsSync(source)) {
      throw new Error(`Missing runtime asset: ${source}`);
    }
    copyFileIfNeeded(source, destination);
  }

  const sourceDist = path.join(piperWorkerDir, 'dist');
  const destinationDist = path.join(publicPiperDir, 'dist');
  if (!fs.existsSync(sourceDist)) {
    throw new Error(`Missing ONNX runtime directory: ${sourceDist}`);
  }
  copyDirRecursive(sourceDist, destinationDist);
}

async function ensureDefaultVoiceModel() {
  for (const item of FILES_TO_DOWNLOAD) {
    const destination = path.join(publicPiperDir, item.name);
    if (fs.existsSync(destination) && fs.statSync(destination).size > 0) {
      console.log(`Already present: public/piper/${item.name}`);
      continue;
    }
    await downloadFile(item.url, destination);
  }
}

async function main() {
  console.log('Preparing Piper browser assets...');
  await syncRuntimeAssets();
  await ensureDefaultVoiceModel();
  console.log('Piper assets are ready.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
