import { documentStore } from '../storage/DocumentStore';
import { TextPipeline } from '../domain/TextPipeline';
import { APP_DESCRIPTION } from '../constants/appDescription';

export async function seedDocuments() {
    const existing = await documentStore.getAllDocuments();

    const seeds = [
        {
            title: "Welcome to Spirtz Voice",
            body: APP_DESCRIPTION,
            language: 'en-US'
        },
        {
            title: "Welcome to Spirtz Voice (Deutsch)",
            body: `# Willkommen bei Spirtz Voice

**Spirtz Voice** ist eine Offline-First-Leseanwendung, die Text und Sprachsynthese (TTS) präzise synchronisiert. Sie kombiniert **RSVP (Rapid Serial Visual Presentation)** mit exakter Audioausrichtung, damit du schneller lesen und mehr behalten kannst.

## Highlights
* **Exakte Synchronisation**: Visueller Text wird exakt mit der gesprochenen Sprache ausgerichtet.
* **RSVP-Lesen**: Wörter oder Phrasen werden einzeln angezeigt, um Augenbewegungen zu reduzieren.
* **Offline-First**: Funktioniert vollständig offline als Progressive Web App.
* **Lokale TTS**: Hochwertige Sprachsynthese im Browser (kein Server erforderlich).
* **Bibliothek**: Texte werden lokal gespeichert und sind jederzeit verfügbar.

## Kurz gesagt
Ein schnelles, privates und leistungsfähiges Tool, das Lesen mit Augen und Ohren verbindet.
`,
            language: 'de-DE'
        },
        {
            title: "Welcome to Spirtz Voice (Русский)",
            body: `# Добро пожаловать в Spirtz Voice

**Spirtz Voice** — это офлайн‑первое приложение для чтения, которое точно синхронизирует текст и синтезированную речь (TTS). Оно сочетает **RSVP (Rapid Serial Visual Presentation)** с точной аудио‑разметкой, чтобы вы читали быстрее и лучше запоминали.

## Главное
* **Точная синхронизация**: визуальный текст совпадает с тем, что произносится.
* **RSVP‑чтение**: слова или фразы показываются по одному, уменьшая движения глаз.
* **Offline‑First**: работает полностью офлайн как PWA.
* **Локальный TTS**: высокое качество синтеза речи прямо в браузере.
* **Библиотека**: тексты хранятся локально и всегда доступны.

## Кратко
Быстрый, приватный и мощный инструмент для чтения глазами и ушами одновременно.
`,
            language: 'ru-RU'
        }
    ];

    const pending = seeds.filter(seed => !existing.some(d => d.title === seed.title));
    if (!pending.length) return;

    console.log("Seeding welcome documents...");
    for (const seed of pending) {
        const tokens = TextPipeline.tokenize(seed.body);
        await documentStore.createDocument(
            seed.title,
            seed.body,
            seed.body,
            'markdown',
            tokens.length,
            seed.language
        );
    }
    console.log("Welcome documents seeded.");
}
