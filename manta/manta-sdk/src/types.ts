import type { SchemaTypeValue, PermissionValue } from './constants';

/**
 * Raw MemoryObject data from chain
 */
export interface MemoryObjectRaw {
  id: { id: string };
  owner: string;
  schema_type: number;
  data: number[];
  version: string;
  created_at: string;
}

/**
 * Parsed MemoryObject
 */
export interface MemoryObject {
  id: string;
  owner: string;
  schemaType: SchemaTypeValue;
  data: Uint8Array;
  version: bigint;
  createdAt: bigint;
}

/**
 * Raw MemoryCap data from chain
 */
export interface MemoryCapRaw {
  id: { id: string };
  memory_id: string;
  permissions: number;
  expiry: { vec: string[] } | null;
  created_at: string;
}

/**
 * Parsed MemoryCap
 */
export interface MemoryCap {
  id: string;
  memoryId: string;
  permissions: PermissionValue;
  expiry: bigint | null;
  createdAt: bigint;
}

/**
 * Episodic entry (decoded from BCS)
 */
export interface EpisodicEntry {
  timestamp: bigint;
  actor: string;
  payload: Uint8Array;
}

/**
 * Semantic entry (decoded from BCS)
 */
export interface SemanticEntry {
  key: Uint8Array;
  value: Uint8Array;
  updatedAt: bigint;
}

/**
 * Event types emitted by Manta
 */
export interface MemoryCreatedEvent {
  memory_id: string;
  schema_type: number;
  owner: string;
  created_at: string;
}

export interface EpisodicAppendEvent {
  memory_id: string;
  actor: string;
  version: string;
  payload_size: string;
  timestamp: string;
}

export interface SemanticUpdateEvent {
  memory_id: string;
  actor: string;
  version: string;
  key_hash: number[];
  timestamp: string;
}

export interface CapabilityDelegatedEvent {
  cap_id: string;
  memory_id: string;
  grantor: string;
  grantee: string;
  permissions: number;
  expiry: { vec: string[] } | null;
  created_at: string;
}

export interface CapabilityRevokedEvent {
  cap_id: string;
  memory_id: string;
  revoked_by: string;
}

export interface CapabilityUsedEvent {
  cap_id: string;
  memory_id: string;
  actor: string;
  operation: number;
  timestamp: string;
}

export interface MemoryDestroyedEvent {
  memory_id: string;
  final_version: string;
}

export type MantaEvent =
  | { type: 'MemoryCreated'; data: MemoryCreatedEvent }
  | { type: 'EpisodicAppend'; data: EpisodicAppendEvent }
  | { type: 'SemanticUpdate'; data: SemanticUpdateEvent }
  | { type: 'CapabilityDelegated'; data: CapabilityDelegatedEvent }
  | { type: 'CapabilityRevoked'; data: CapabilityRevokedEvent }
  | { type: 'CapabilityUsed'; data: CapabilityUsedEvent }
  | { type: 'MemoryDestroyed'; data: MemoryDestroyedEvent };
