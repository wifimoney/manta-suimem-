import type { SuiClient, SuiObjectResponse } from '@mysten/sui/client';
import type { Db } from './db.js';
import { SCHEMA_EPISODIC, SCHEMA_SEMANTIC } from './types.js';

// ============================================================
// On-chain BCS layout of MemoryObject.data
//
// Episodic:  vector<Entry> where Entry = { actor, payload, timestamp }
// Semantic:  vector<KVEntry> where KVEntry = { key, value, updated_at }
//
// Both are opaque bytes on-chain. The SDK decodes via BCS, but
// since Sui RPC returns `content.fields` as JSON when using
// showContent: true, we can read the fields directly.
// ============================================================

interface MemoryObjectFields {
  id: { id: string };
  owner: string;
  schema_type: number;
  data: number[];   // vector<u8> comes as number[] in JSON
  version: string;  // u64 as string
  created_at: string;
}

export class ObjectReader {
  constructor(
    private sui: SuiClient,
    private db: Db,
  ) {}

  /**
   * Fetch a MemoryObject from chain and sync its entries to Postgres.
   * Called after EpisodicAppend / SemanticUpdate events.
   */
  async syncObject(
    objectId: string,
    txDigest: string,
    actor: string | null,
    timestampMs: string | null,
  ): Promise<void> {
    const response: SuiObjectResponse = await this.sui.getObject({
      id: objectId,
      options: {
        showContent: true,
        showOwner: true,
      },
    });

    if (!response.data?.content || response.data.content.dataType !== 'moveObject') {
      console.warn(`[object-reader] Object ${objectId} not found or not a Move object`);
      return;
    }

    const fields = response.data.content.fields as unknown as MemoryObjectFields;
    const version = parseInt(fields.version, 10);
    const schemaType = fields.schema_type;
    const rawData = Buffer.from(fields.data);

    // Update the memory row with latest version
    await this.db.updateMemoryVersion(objectId, version);

    // Sync the full data blob
    // For now, store the entire data vector as a single entry at index = version.
    // Phase 1b can add BCS parsing to split into individual episodic entries
    // or semantic key-value pairs.
    //
    // This gives us:
    //  - Full object state in Postgres
    //  - Provenance (tx_digest, actor, timestamp)
    //  - Raw bytes for future BCS decoding / embedding

    const payloadText = tryDecodeUtf8(rawData);

    await this.db.insertEntry({
      memoryId: objectId,
      entryIndex: version,
      actor,
      key: schemaType === SCHEMA_SEMANTIC ? rawData.subarray(0, 32) : null, // first 32 bytes as key hint
      payload: rawData,
      payloadText,
      txDigest,
      epoch: null,
      timestampMs: timestampMs ? parseInt(timestampMs, 10) : null,
      version,
    });

    console.log(
      `[object-reader] Synced ${objectId} v=${version} ` +
      `(${rawData.length} bytes, schema=${schemaType === SCHEMA_EPISODIC ? 'episodic' : 'semantic'})`,
    );
  }
}

// ============================================================
// Helpers
// ============================================================

/** Best-effort UTF-8 decode — returns null if binary garbage */
function tryDecodeUtf8(buf: Buffer): string | null {
  try {
    const text = buf.toString('utf-8');
    // Reject if more than 20% of chars are control characters (likely binary)
    const controlCount = [...text].filter(
      (c) => c.charCodeAt(0) < 32 && c !== '\n' && c !== '\r' && c !== '\t',
    ).length;
    if (controlCount > text.length * 0.2) return null;
    return text;
  } catch {
    return null;
  }
}
