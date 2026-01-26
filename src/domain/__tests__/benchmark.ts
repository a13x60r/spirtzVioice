
import { TextPipeline } from '../TextPipeline';

const TEXT = "This is a sample sentence to test the tokenizer performance. It has words, punctuation! And some newlines.\n";

const sizes = [1000, 5000, 10000, 50000]; // Multipliers of TEXT (approx 100 chars)

for (const mul of sizes) {
    const longText = TEXT.repeat(mul);
    const len = longText.length;

    global.gc?.(); // Try to GC if exposed

    const start = performance.now();
    const tokens = TextPipeline.tokenize(longText);
    const end = performance.now();

    console.log(`Length: ${len}, Time: ${(end - start).toFixed(2)}ms, Tokens: ${tokens.length}`);
}
