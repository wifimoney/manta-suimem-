import { Db } from "@manta/shared";
import { embedQuery } from "@manta/shared";


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

    const rows = await db.searchChunks(vectorStr, limit, options?.memoryId, options?.owner);

    return rows.map((row: any) => ({
        chunkText: row.chunk_text,
        chunkIndex: row.chunk_index,
        memoryId: row.memory_id,
        similarity: row.score,
        epoch: row.epoch,
        timestampMs: row.timestamp_ms,
        txDigest: row.tx_digest,
        actor: row.actor,
        schemaType: row.schema_type,
    }));
}