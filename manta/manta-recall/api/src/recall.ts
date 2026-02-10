import { Db } from "../../indexer/src/db";
import { embedQuery } from "../../indexer/src/embedder";   

export interface RecallResult {
    chunkText: string;
    chunkIndex: number;
    memoryId: string;
    similarity: number;
    epoch: number;
    timestampMs: number;
    txDigest: string;
    actor: string | null;  
    schemaType: number;
}

export async function recall(
  db: Db,
  query: string,
  options?: { memoryId?: string; owner?: string; limit?: number },
): Promise<RecallResult[]> {
  const embedding = await embedQuery(query);
  const vectorStr = `[${embedding.join(",")}]`;
  const limit = options?.limit ?? 5;
  return db.searchChunks(vectorStr, limit, options?.memoryId, options?.owner);
}