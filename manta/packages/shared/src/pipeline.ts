import { ChunkResult } from "./chunker";
import { embedChunks } from "./embedder";
import { Db } from "./db";
import { chunk } from "./chunker";

export async function pipeline(chunks: ChunkResult[]) {
    const embeddings = await embedChunks(chunks.map(c => c.text));
    return chunks.map((chunk, i) => ({
        ...chunk,
        embedding: embeddings[i],
    }));
}

export async function processEntry(
  db: Db,
  memoryId: string,
  entryId: number,
  payloadText: string,
): Promise<void> {
    const chunks = await chunk(payloadText);
    const chunksWithEmbeddings = await pipeline(chunks);
    await db.insertChunks(entryId, memoryId, chunksWithEmbeddings);
}