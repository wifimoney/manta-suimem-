export interface ChunkResult {
    text: string;
    index: number;
    tokens: number;
}

function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}

/**
 * Splits text into paragraphs, then sentences, then raw character chunks
 * to stay under maxTokens while preserving semantic boundaries where possible.
 */
export function chunk(text: string, maxTokens: number = 400): ChunkResult[] {
    text = text.trim();
    if (!text) return [];

    const tokens = estimateTokens(text);
    if (tokens <= maxTokens) {
        return [{ text, index: 0, tokens }];
    }

    // Layer 1: Split by paragraphs
    const paragraphs = text.split(/\n\s*\n/);
    let finalChunks: string[] = [];
    let currentChunk = '';

    for (const para of paragraphs) {
        if (estimateTokens(currentChunk + '\n\n' + para) <= maxTokens) {
            currentChunk = currentChunk ? currentChunk + '\n\n' + para : para;
        } else {
            if (currentChunk) finalChunks.push(currentChunk);

            // If a single paragraph is too long, split it by sentences
            if (estimateTokens(para) > maxTokens) {
                const sentences = para.split(/(?<=[.!?])\s+/);
                let sentenceBuffer = '';

                for (const sentence of sentences) {
                    if (estimateTokens(sentenceBuffer + ' ' + sentence) <= maxTokens) {
                        sentenceBuffer = sentenceBuffer ? sentenceBuffer + ' ' + sentence : sentence;
                    } else {
                        if (sentenceBuffer) finalChunks.push(sentenceBuffer);

                        // If a single sentence is still too long, split it by raw characters
                        if (estimateTokens(sentence) > maxTokens) {
                            let remaining = sentence;
                            while (remaining.length > 0) {
                                // maxTokens * 4 is a rough char limit
                                const charLimit = maxTokens * 4;
                                const slice = remaining.slice(0, charLimit);
                                finalChunks.push(slice);
                                remaining = remaining.slice(charLimit);
                            }
                            sentenceBuffer = '';
                        } else {
                            sentenceBuffer = sentence;
                        }
                    }
                }
                currentChunk = sentenceBuffer;
            } else {
                currentChunk = para;
            }
        }
    }

    if (currentChunk) finalChunks.push(currentChunk);

    return finalChunks.map((t, i) => ({
        text: t.trim(), // trimmed text
        index: i, // index of the chunk
        tokens: estimateTokens(t.trim()), // number of tokens in the chunk
    }));
}