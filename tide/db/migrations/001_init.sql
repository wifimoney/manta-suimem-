-- Tide Recall: Phase 1 Schema
-- Postgres 16 + pgvector

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- Sync state: tracks indexer cursor per network
-- ============================================================
CREATE TABLE sync_state (
    network         TEXT PRIMARY KEY,           -- 'testnet', 'devnet', 'mainnet'
    last_tx_digest  TEXT,                       -- last processed transaction digest
    last_event_seq  BIGINT NOT NULL DEFAULT 0,  -- event sequence cursor
    last_checkpoint  BIGINT NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Memories: mirrors on-chain MemoryObject state
-- ============================================================
CREATE TABLE memories (
    -- On-chain identity
    object_id       TEXT PRIMARY KEY,           -- Sui object ID (0x...)
    owner           TEXT NOT NULL,              -- owner address
    schema_type     SMALLINT NOT NULL,          -- 0 = episodic, 1 = semantic
    version         BIGINT NOT NULL DEFAULT 0,  -- on-chain version

    -- Metadata
    network         TEXT NOT NULL DEFAULT 'testnet',
    created_at_epoch BIGINT,
    created_tx      TEXT,                       -- creation tx digest

    -- Local tracking
    synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_memories_owner ON memories(owner);
CREATE INDEX idx_memories_schema ON memories(schema_type);
CREATE INDEX idx_memories_network ON memories(network);

-- ============================================================
-- Memory entries: individual records within a MemoryObject
-- ============================================================
-- For episodic: each append creates a row (append-only log)
-- For semantic: each key has one row, updated in place
CREATE TABLE memory_entries (
    id              BIGSERIAL PRIMARY KEY,
    memory_id       TEXT NOT NULL REFERENCES memories(object_id),
    
    -- Entry data
    entry_index     INTEGER NOT NULL,           -- position in on-chain vector
    actor           TEXT,                       -- address that wrote this
    key             BYTEA,                      -- semantic memory key (NULL for episodic)
    payload         BYTEA NOT NULL,             -- raw bytes from chain
    payload_text    TEXT,                       -- decoded text (best-effort)
    
    -- Provenance
    tx_digest       TEXT,                       -- transaction that wrote this
    epoch           BIGINT,
    timestamp_ms    BIGINT,
    version         BIGINT NOT NULL DEFAULT 0,

    synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_entries_memory ON memory_entries(memory_id);
CREATE INDEX idx_entries_actor ON memory_entries(actor);
CREATE INDEX idx_entries_key ON memory_entries(memory_id, key);
CREATE UNIQUE INDEX idx_entries_unique ON memory_entries(memory_id, entry_index);

-- ============================================================
-- Capabilities: tracks on-chain MemoryCap objects
-- ============================================================
CREATE TABLE memory_caps (
    cap_id          TEXT PRIMARY KEY,           -- Sui object ID of the cap
    memory_id       TEXT NOT NULL REFERENCES memories(object_id),
    grantee         TEXT NOT NULL,              -- address holding the cap
    permissions     SMALLINT NOT NULL,          -- bitmask: 1=read, 2=append, 4=update
    expiry_ms       BIGINT,                    -- NULL = no expiry
    
    created_tx      TEXT,
    is_revoked      BOOLEAN NOT NULL DEFAULT FALSE,
    synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_caps_memory ON memory_caps(memory_id);
CREATE INDEX idx_caps_grantee ON memory_caps(grantee);

-- ============================================================
-- Phase 2 (reserved): chunks + embeddings
-- Tables created now so the schema is stable
-- ============================================================
CREATE TABLE memory_chunks (
    id              BIGSERIAL PRIMARY KEY,
    entry_id        BIGINT NOT NULL REFERENCES memory_entries(id),
    memory_id       TEXT NOT NULL REFERENCES memories(object_id),
    
    chunk_index     INTEGER NOT NULL,           -- position within the entry
    chunk_text      TEXT NOT NULL,
    token_count     INTEGER,
    
    -- Vector embedding (Phase 2 — NULL until embedder is running)
    embedding       vector(768),                -- nomic-embed-text default dims
    model_name      TEXT,
    
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chunks_entry ON memory_chunks(entry_id);
CREATE INDEX idx_chunks_memory ON memory_chunks(memory_id);

-- HNSW index for fast similarity search (Phase 2)
-- Using cosine distance — standard for normalized embeddings
CREATE INDEX idx_chunks_embedding ON memory_chunks 
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- ============================================================
-- Event log: raw events from chain (debugging + replay)
-- ============================================================
CREATE TABLE raw_events (
    id              BIGSERIAL PRIMARY KEY,
    network         TEXT NOT NULL,
    tx_digest       TEXT NOT NULL,
    event_seq       BIGINT NOT NULL,
    event_type      TEXT NOT NULL,
    event_data      JSONB NOT NULL,
    processed       BOOLEAN NOT NULL DEFAULT FALSE,
    received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_tx ON raw_events(tx_digest);
CREATE INDEX idx_events_type ON raw_events(event_type);
CREATE INDEX idx_events_unprocessed ON raw_events(processed) WHERE NOT processed;
CREATE UNIQUE INDEX idx_events_unique ON raw_events(network, tx_digest, event_seq);
