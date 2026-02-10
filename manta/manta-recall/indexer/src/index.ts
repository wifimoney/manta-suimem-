import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import type { SuiEventFilter, EventId } from '@mysten/sui/client';
import { loadConfig } from './config.js';
import { Db } from './db.js';
import { EventProcessor } from './events.js';
import { ObjectReader } from './object-reader.js';

async function main() {
  const config = loadConfig();

  console.log(`[manta-indexer] Starting...`);
  console.log(`[manta-indexer] network=${config.network}`);
  console.log(`[manta-indexer] package=${config.mantaPackageId}`);
  console.log(`[manta-indexer] rpc=${config.suiRpcUrl}`);
  console.log(`[manta-indexer] poll=${config.pollIntervalMs}ms`);

  // Connect to Postgres
  const db = new Db(config.databaseUrl, config.network);
  await db.connect();

  // Connect to Sui
  const sui = new SuiClient({ url: config.suiRpcUrl });
  console.log('[manta-indexer] Connected to Sui RPC');

  const objectReader = new ObjectReader(sui, db);
  const processor = new EventProcessor(db, config, objectReader);

  // Event filter: all events from the Manta package's memory module
  const filter: SuiEventFilter = {
    MoveModule: {
      package: config.mantaPackageId,
      module: config.moduleName,
    },
  };

  // Main poll loop
  console.log('[manta-indexer] Entering poll loop...');

  let running = true;
  const shutdown = async () => {
    console.log('\n[manta-indexer] Shutting down...');
    running = false;
    await db.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  while (running) {
    try {
      const count = await pollOnce(sui, db, processor, config, filter);
      if (count > 0) {
        console.log(`[manta-indexer] Processed ${count} events`);
      }
    } catch (err) {
      console.error('[manta-indexer] Poll error (will retry):', err);
    }

    await sleep(config.pollIntervalMs);
  }
}

// ============================================================
// Single poll iteration
// ============================================================

async function pollOnce(
  sui: SuiClient,
  db: Db,
  processor: EventProcessor,
  config: { batchSize: number },
  filter: SuiEventFilter,
): Promise<number> {
  // Read cursor from DB
  const { txDigest, eventSeq } = await db.getCursor();

  // Build cursor for Sui RPC (null = start from beginning)
  const cursor: EventId | null =
    txDigest !== null
      ? { txDigest, eventSeq }
      : null;

  // Query events from chain
  const page = await sui.queryEvents({
    query: filter,
    cursor,
    limit: config.batchSize,
    order: 'ascending',
  });

  let count = 0;

  for (const suiEvent of page.data) {
    try {
      const parsed = processor.parseEvent(suiEvent);
      await processor.process(parsed);
      count++;
    } catch (err) {
      console.error(
        `[manta-indexer] Failed to process event tx=${suiEvent.id.txDigest} seq=${suiEvent.id.eventSeq}:`,
        err,
      );
      // Continue processing other events
    }
  }

  return count;
}

// ============================================================
// Helpers
// ============================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
// Run
// ============================================================

main().catch((err) => {
  console.error('[manta-indexer] Fatal error:', err);
  process.exit(1);
});
