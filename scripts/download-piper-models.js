
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_PIPER_DIR = path.resolve(__dirname, '../public/piper');

if (!fs.existsSync(PUBLIC_PIPER_DIR)) {
    fs.mkdirSync(PUBLIC_PIPER_DIR, { recursive: true });
}

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

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        console.log(`Downloading ${url} to ${dest}...`);

        https.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                downloadFile(response.headers.location, dest).then(resolve).catch(reject);
                return;
            }

            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download ${url}: Status ${response.statusCode}`));
                return;
            }

            response.pipe(file);
            file.on('finish', () => {
                file.close(() => {
                    console.log(`Downloaded ${dest}`);
                    resolve();
                });
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => { });
            reject(err);
        });
    });
}

async function main() {
    console.log('Starting Piper Main Model Download...');

    for (const item of FILES_TO_DOWNLOAD) {
        const destPath = path.join(PUBLIC_PIPER_DIR, item.name);
        if (fs.existsSync(destPath)) {
            console.log(`${item.name} already exists, skipping.`);
            continue;
        }
        await downloadFile(item.url, destPath);
    }

    console.log('All downloads complete.');
}

main().catch(console.error);
