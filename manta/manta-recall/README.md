# Manta Recall

Self-hosted semantic recall infrastructure for [Manta](https://github.com/wifimoney/manta-suimem-) on-chain memory objects.

```
On-chain (Sui)          Off-chain (your infra)
┌─────────────┐         ┌───────────────────────────┐
│ MemoryObject │ ◄──────│ Indexer (TypeScript)       │
│ MemoryCap    │  events│   polls events + getObject │
└─────────────┘         │   writes to Postgres       │
                        ├───────────────────────────┤
                        │ Postgres + pgvector        │
                        │   memories, entries, caps  │
                        │   chunks + embeddings (P2) │
                        └───────────────────────────┘
```

## Quick Start

```bash
cp .env.example .env
# Edit .env → set MANTA_PACKAGE_ID

docker compose up
```

The indexer will:
1. Connect to Sui RPC and Postgres
2. Poll for Manta events every 2 seconds
3. Process events → write to `memories`, `memory_caps`, `raw_events`
4. Fetch full object state via `getObject()` → write to `memory_entries`

## Project Structure

```
manta-recall/
├── db/
│   └── migrations/
│       └── 001_init.sql          # Postgres schema (auto-runs on first boot)
├── indexer/
│   ├── src/
│   │   ├── index.ts              # Entry point — poll loop
│   │   ├── config.ts             # Env-based configuration
│   │   ├── db.ts                 # Postgres operations
│   │   ├── events.ts             # Event parser + processor
│   │   ├── object-reader.ts      # Fetches MemoryObject state from chain
│   │   └── types.ts              # Manta event types + constants
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
├── docker-compose.yml
├── .env.example
└── README.md
```

## Stack

| Component | Technology |
|-----------|-----------|
| Language | TypeScript (100%) |
| Sui SDK | `@mysten/sui` |
| Database | Postgres 16 + pgvector |
| Container | Docker Compose |
| License | Apache-2.0 |

## Development

```bash
cd indexer
npm install
cp ../.env.example ../.env

# Run Postgres separately
docker compose up postgres

# Run indexer in watch mode
npm run dev
```

## Roadmap

- [x] **Phase 1** — Data pipeline (indexer + Postgres + object reader)
- [ ] **Phase 2** — Embeddings (nomic-embed-text via ONNX, chunking pipeline)
- [ ] **Phase 3** — Recall API (semantic search with on-chain provenance)
- [ ] **Phase 4** — Recall SDK (`@manta/recall` npm package)

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MANTA_PACKAGE_ID` | ✅ | — | Deployed Manta package on Sui |
| `DATABASE_URL` | ✅ | — | Postgres connection string |
| `SUI_RPC_URL` | ❌ | testnet fullnode | Sui RPC endpoint |
| `NETWORK` | ❌ | `testnet` | Network name for cursor tracking |
| `POLL_INTERVAL_MS` | ❌ | `2000` | Event polling interval |
| `BATCH_SIZE` | ❌ | `50` | Events per poll batch |
| `MODULE_NAME` | ❌ | `memory` | Move module name |
