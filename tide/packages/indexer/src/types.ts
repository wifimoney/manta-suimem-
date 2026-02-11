// ============================================================
// On-chain event types (from Tide V1.3 memory.move)
// ============================================================

export interface MemoryCreatedEvent {
  memory_id: string;
  owner: string;
  schema_type: number;
}

export interface MemoryAppendedEvent {
  memory_id: string;
  actor: string;
  data_length: string; // u64 comes as string from JSON RPC
  version: string;
}

export interface MemoryUpdatedEvent {
  memory_id: string;
  actor: string;
  version: string;
}

export interface CapDelegatedEvent {
  cap_id: string;
  memory_id: string;
  grantee: string;
  permissions: number;
  expiry: string | null; // Option<u64>
}

export interface CapRevokedEvent {
  cap_id: string;
  memory_id: string;
}

export interface MemoryDestroyedEvent {
  memory_id: string;
}

export interface OwnershipTransferredEvent {
  memory_id: string;
  old_owner: string;
  new_owner: string;
}

// ============================================================
// Event type suffixes (match Move struct names)
// ============================================================

export const EVENT_TYPES = {
  MemoryCreated: 'MemoryCreated',
  EpisodicAppend: 'EpisodicAppend',
  SemanticUpdate: 'SemanticUpdate',
  MemoryDestroyed: 'MemoryDestroyed',
  CapabilityDelegated: 'CapabilityDelegated',
  CapabilityRevoked: 'CapabilityRevoked',
  CapabilityUsed: 'CapabilityUsed',
  OwnershipTransferred: 'OwnershipTransferred',
} as const;

// ============================================================
// Schema + permission constants
// ============================================================

export const SCHEMA_EPISODIC = 0;
export const SCHEMA_SEMANTIC = 1;

export const PERM_READ = 1;
export const PERM_APPEND = 2;
export const PERM_UPDATE = 4;

// ============================================================
// Parsed event wrapper
// ============================================================

export type TideEvent =
  | { type: 'MemoryCreated'; data: MemoryCreatedEvent }
  | { type: 'EpisodicAppend'; data: MemoryAppendedEvent }
  | { type: 'SemanticUpdate'; data: MemoryUpdatedEvent }
  | { type: 'CapabilityDelegated'; data: CapDelegatedEvent }
  | { type: 'CapabilityRevoked'; data: CapRevokedEvent }
  | { type: 'MemoryDestroyed'; data: MemoryDestroyedEvent }
  | { type: 'OwnershipTransferred'; data: OwnershipTransferredEvent }
  | { type: 'Unknown'; data: unknown };

export interface IndexerEvent {
  txDigest: string;
  eventSeq: string;
  timestampMs: string | null;
  event: TideEvent;
}
