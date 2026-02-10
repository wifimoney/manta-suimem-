import pg from 'pg';

const { Pool } = pg;

export class Db {
  private pool: pg.Pool;
  private network: string;

  constructor(connectionString: string, network: string) {
    this.pool = new Pool({ connectionString });
    this.network = network;
  }

  async connect(): Promise<void> {
    // Test the connection
    const client = await this.pool.connect();
    client.release();
    console.log('[db] Connected to Postgres');
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  // ============================================================
  // Sync state
  // ============================================================

  async getCursor(): Promise<{ txDigest: string | null; eventSeq: string }> {
    const res = await this.pool.query(
      'SELECT last_tx_digest, last_event_seq FROM sync_state WHERE network = $1',
      [this.network],
    );

    if (res.rows.length === 0) {
      return { txDigest: null, eventSeq: '0' };
    }

    return {
      txDigest: res.rows[0].last_tx_digest,
      eventSeq: String(res.rows[0].last_event_seq),
    };
  }

  async updateCursor(txDigest: string, eventSeq: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO sync_state (network, last_tx_digest, last_event_seq, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (network) DO UPDATE
       SET last_tx_digest = $2, last_event_seq = $3, updated_at = NOW()`,
      [this.network, txDigest, eventSeq],
    );
  }

  // ============================================================
  // Raw event storage (replay / debugging)
  // ============================================================

  async storeRawEvent(
    txDigest: string,
    eventSeq: string,
    eventType: string,
    eventData: unknown,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO raw_events (network, tx_digest, event_seq, event_type, event_data)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (network, tx_digest, event_seq) DO NOTHING`,
      [this.network, txDigest, eventSeq, eventType, JSON.stringify(eventData)],
    );
  }

  // ============================================================
  // Memory operations
  // ============================================================

  async upsertMemory(
    objectId: string,
    owner: string,
    schemaType: number,
    version: number,
    createdTx: string | null,
    epoch: number | null,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO memories (object_id, owner, schema_type, version, network, created_tx, created_at_epoch)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (object_id) DO UPDATE
       SET owner = $2, version = GREATEST(memories.version, $4), synced_at = NOW()`,
      [objectId, owner, schemaType, version, this.network, createdTx, epoch],
    );
  }

  async updateMemoryVersion(
    objectId: string,
    version: number,
  ): Promise<void> {
    await this.pool.query(
      'UPDATE memories SET version = GREATEST(version, $2), synced_at = NOW() WHERE object_id = $1',
      [objectId, version],
    );
  }

  async markMemoryDeleted(objectId: string): Promise<void> {
    await this.pool.query(
      'UPDATE memories SET is_deleted = TRUE, synced_at = NOW() WHERE object_id = $1',
      [objectId],
    );
  }

  async transferMemoryOwner(
    objectId: string,
    newOwner: string,
  ): Promise<void> {
    await this.pool.query(
      'UPDATE memories SET owner = $2, synced_at = NOW() WHERE object_id = $1',
      [objectId, newOwner],
    );
  }

  // ============================================================
  // Memory entry operations
  // ============================================================

  async insertEntry(params: {
    memoryId: string;
    entryIndex: number;
    actor: string | null;
    key: Buffer | null;
    payload: Buffer;
    payloadText: string | null;
    txDigest: string | null;
    epoch: number | null;
    timestampMs: number | null;
    version: number;
  }): Promise<number> {
    const res = await this.pool.query(
      `INSERT INTO memory_entries
         (memory_id, entry_index, actor, key, payload, payload_text, tx_digest, epoch, timestamp_ms, version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (memory_id, entry_index) DO UPDATE
       SET payload = $5, payload_text = $6, version = $10, synced_at = NOW()
       RETURNING id`,
      [
        params.memoryId,
        params.entryIndex,
        params.actor,
        params.key,
        params.payload,
        params.payloadText,
        params.txDigest,
        params.epoch,
        params.timestampMs,
        params.version,
      ],
    );

    return res.rows[0].id;
  }

  // ============================================================
  // Capability operations
  // ============================================================

  async upsertCap(
    capId: string,
    memoryId: string,
    grantee: string,
    permissions: number,
    expiryMs: number | null,
    createdTx: string | null,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO memory_caps (cap_id, memory_id, grantee, permissions, expiry_ms, created_tx)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (cap_id) DO UPDATE
       SET grantee = $3, permissions = $4, expiry_ms = $5, synced_at = NOW()`,
      [capId, memoryId, grantee, permissions, expiryMs, createdTx],
    );
  }

  async revokeCap(capId: string): Promise<void> {
    await this.pool.query(
      'UPDATE memory_caps SET is_revoked = TRUE, synced_at = NOW() WHERE cap_id = $1',
      [capId],
    );
  }

  // ============================================================
  // Chunk operations (Phase 2)
  // ============================================================

  async insertChunks(
    entryId: number,
    memoryId: string,
    chunks: { text: string; index: number; tokens: number; embedding?: number[] }[],
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const chunk of chunks) {
        const vectorStr = chunk.embedding ? `[${chunk.embedding.join(',')}]` : null;
        await client.query(
          `INSERT INTO memory_chunks (entry_id, memory_id, chunk_index, chunk_text, token_count, embedding, model_name)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [entryId, memoryId, chunk.index, chunk.text, chunk.tokens, vectorStr, 'nomic-embed-text-v1.5'],
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}