import 'dotenv/config';

export interface IndexerConfig {
  suiRpcUrl: string;
  tidePackageId: string;
  databaseUrl: string;
  network: string;
  pollIntervalMs: number;
  batchSize: number;
  /** Module name within the package that emits events */
  moduleName: string;
}

export function loadConfig(): IndexerConfig {
  const tidePackageId = process.env.TIDE_PACKAGE_ID;
  if (!tidePackageId) throw new Error('TIDE_PACKAGE_ID is required');

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');

  return {
    suiRpcUrl:
      process.env.SUI_RPC_URL ?? 'https://fullnode.testnet.sui.io:443',
    tidePackageId,
    databaseUrl,
    network: process.env.NETWORK ?? 'testnet',
    pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS ?? '2000', 10),
    batchSize: parseInt(process.env.BATCH_SIZE ?? '50', 10),
    moduleName: process.env.MODULE_NAME ?? 'memory',
  };
}
