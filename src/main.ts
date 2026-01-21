import { ReaderShell } from './ui/ReaderShell';

console.log('Spirtz Voice initializing...');

const app = new ReaderShell('app');
app.init().catch(console.error);

console.log('Spirtz Voice mounted.');
