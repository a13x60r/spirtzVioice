import { documentStore } from '../storage/DocumentStore';
import { TextPipeline } from '../domain/TextPipeline';
import { APP_DESCRIPTION } from '../constants/appDescription';

export async function seedDocuments() {
    const existing = await documentStore.getAllDocuments();

    // Check if welcome document already exists
    const welcomeTitle = "Welcome to Spirtz Voice";
    const alreadyExists = existing.some(d => d.title === welcomeTitle);

    if (alreadyExists) {
        return;
    }

    console.log("Seeding welcome document...");
    const tokens = TextPipeline.tokenize(APP_DESCRIPTION);
    await documentStore.createDocument(
        welcomeTitle,
        APP_DESCRIPTION,
        APP_DESCRIPTION,
        'markdown',
        tokens.length,
        'en-US'
    );
    console.log("Welcome document seeded.");
}
