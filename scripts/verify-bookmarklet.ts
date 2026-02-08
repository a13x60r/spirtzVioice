
import { generateBookmarkletCode } from '../src/utils/bookmarklet';

const baseUrl = process.argv[2] || 'http://localhost:5173';
const code = generateBookmarkletCode(baseUrl);
const decoded = decodeURIComponent(code.replace('javascript:', ''));

console.log('--- GENERATED BOOKMARKLET CODE ---');
console.log(decoded);
console.log('--- END ---');
