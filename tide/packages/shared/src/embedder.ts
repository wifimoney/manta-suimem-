import { pipeline } from "@huggingface/transformers";

export async function embedQuery(text: string): Promise<number[]> {
    const pipe = await load();
    const result = await pipe("search_query: " + text, { pooling: 'mean', normalize: true });
    return result.tolist()[0];
}

let pipe: any = null;
async function load() {
    if (!pipe) {
        pipe = await pipeline("feature-extraction", "nomic-ai/nomic-embed-text-v1.5");
    }
    return pipe;
}

export async function embedChunks(chunks: string[]): Promise<number[][]> {
    await load();
    const prefixed = chunks.map(t => "search_document: " + t);
    const result = await pipe(prefixed, { pooling: 'mean', normalize: true });
    const list = result.tolist();
    // Ensure always returns number[][] even for single input
    return Array.isArray(list[0]) ? list : [list];
}
