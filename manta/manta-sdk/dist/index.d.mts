import { SuiClient, SuiTransactionBlockResponse } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';

/**
 * Manta Package IDs by network
 */
declare const PACKAGE_IDS: {
    readonly mainnet: "";
    readonly testnet: "0x61f59d91f6ac0c1a321a2682d7d70cab4bc0425ed1d8b417d2494f0bbc0d6be0";
    readonly devnet: "0x759a1ecfbfe2c157430a9d6c3138e40b971d0fc4ee8e0e1f67e6a3873232c6c7";
};
/**
 * Sui Clock object ID (shared across all networks)
 */
declare const CLOCK_ID = "0x6";
/**
 * Memory schema types
 */
declare const SchemaType: {
    readonly EPISODIC: 0;
    readonly SEMANTIC: 1;
};
/**
 * Permission flags for MemoryCap
 */
declare const Permissions: {
    readonly READ: 1;
    readonly APPEND: 2;
    readonly UPDATE: 4;
    readonly READ_APPEND: 3;
    readonly READ_UPDATE: 5;
    readonly FULL: 7;
};
/**
 * Module names
 */
declare const MODULES: {
    readonly MEMORY: "memory";
    readonly EVENTS: "events";
};
/**
 * Function names
 */
declare const FUNCTIONS: {
    readonly CREATE_EPISODIC: "create_episodic";
    readonly CREATE_SEMANTIC: "create_semantic";
    readonly CREATE_SHARED_EPISODIC: "create_shared_episodic";
    readonly CREATE_SHARED_SEMANTIC: "create_shared_semantic";
    readonly APPEND: "append";
    readonly UPDATE: "update";
    readonly CAP_APPEND: "cap_append";
    readonly CAP_UPDATE: "cap_update";
    readonly DELEGATE: "delegate";
    readonly DELEGATE_READ: "delegate_read";
    readonly DELEGATE_APPEND: "delegate_append";
    readonly DELEGATE_UPDATE: "delegate_update";
    readonly DELEGATE_FULL: "delegate_full";
    readonly REVOKE: "revoke";
    readonly DESTROY: "destroy";
};
type Network = keyof typeof PACKAGE_IDS;
type SchemaTypeValue = typeof SchemaType[keyof typeof SchemaType];
type PermissionValue = typeof Permissions[keyof typeof Permissions];

/**
 * Parsed MemoryObject
 */
interface MemoryObject {
    id: string;
    owner: string;
    schemaType: SchemaTypeValue;
    data: Uint8Array;
    version: bigint;
    createdAt: bigint;
}
/**
 * Parsed MemoryCap
 */
interface MemoryCap {
    id: string;
    memoryId: string;
    permissions: PermissionValue;
    expiry: bigint | null;
    createdAt: bigint;
}
/**
 * Episodic entry (decoded from BCS)
 */
interface EpisodicEntry {
    timestamp: bigint;
    actor: string;
    payload: Uint8Array;
}
/**
 * Semantic entry (decoded from BCS)
 */
interface SemanticEntry {
    key: Uint8Array;
    value: Uint8Array;
    updatedAt: bigint;
}
/**
 * Event types emitted by Manta
 */
interface MemoryCreatedEvent {
    memory_id: string;
    schema_type: number;
    owner: string;
    created_at: string;
}
interface EpisodicAppendEvent {
    memory_id: string;
    actor: string;
    version: string;
    payload_size: string;
    timestamp: string;
}
interface SemanticUpdateEvent {
    memory_id: string;
    actor: string;
    version: string;
    key_hash: number[];
    timestamp: string;
}
interface CapabilityDelegatedEvent {
    cap_id: string;
    memory_id: string;
    grantor: string;
    grantee: string;
    permissions: number;
    expiry: {
        vec: string[];
    } | null;
    created_at: string;
}
interface CapabilityRevokedEvent {
    cap_id: string;
    memory_id: string;
    revoked_by: string;
}
interface CapabilityUsedEvent {
    cap_id: string;
    memory_id: string;
    actor: string;
    operation: number;
    timestamp: string;
}
interface MemoryDestroyedEvent {
    memory_id: string;
    final_version: string;
}
type MantaEvent = {
    type: 'MemoryCreated';
    data: MemoryCreatedEvent;
} | {
    type: 'EpisodicAppend';
    data: EpisodicAppendEvent;
} | {
    type: 'SemanticUpdate';
    data: SemanticUpdateEvent;
} | {
    type: 'CapabilityDelegated';
    data: CapabilityDelegatedEvent;
} | {
    type: 'CapabilityRevoked';
    data: CapabilityRevokedEvent;
} | {
    type: 'CapabilityUsed';
    data: CapabilityUsedEvent;
} | {
    type: 'MemoryDestroyed';
    data: MemoryDestroyedEvent;
};

interface MantaClientConfig {
    network: Network;
    client?: SuiClient;
}
declare class MantaClient {
    readonly network: Network;
    readonly packageId: string;
    readonly client: SuiClient;
    constructor(config: MantaClientConfig);
    private getRpcUrl;
    createEpisodicMemory(): Transaction;
    createSemanticMemory(): Transaction;
    createSharedEpisodicMemory(): Transaction;
    createSharedSemanticMemory(): Transaction;
    append(memoryId: string, payload: Uint8Array | string): Transaction;
    update(memoryId: string, key: Uint8Array | string, value: Uint8Array | string): Transaction;
    capAppend(memoryId: string, capId: string, payload: Uint8Array | string): Transaction;
    capUpdate(memoryId: string, capId: string, key: Uint8Array | string, value: Uint8Array | string): Transaction;
    delegate(memoryId: string, recipient: string, permissions: PermissionValue, expiryMs?: bigint): Transaction;
    delegateRead(memoryId: string, recipient: string, expiryMs?: bigint): Transaction;
    delegateAppend(memoryId: string, recipient: string, expiryMs?: bigint): Transaction;
    delegateFull(memoryId: string, recipient: string, expiryMs?: bigint): Transaction;
    transferOwnership(memoryId: string, newOwner: string): Transaction;
    revoke(capId: string): Transaction;
    destroy(memoryId: string): Transaction;
    getMemory(objectId: string): Promise<MemoryObject | null>;
    getCap(objectId: string): Promise<MemoryCap | null>;
    getOwnedMemories(owner: string): Promise<MemoryObject[]>;
    getOwnedCaps(owner: string): Promise<MemoryCap[]>;
    decodeEpisodic(memory: MemoryObject): EpisodicEntry[];
    decodeSemantic(memory: MemoryObject): SemanticEntry[];
    buildKVMap(memory: MemoryObject): Map<string, Uint8Array>;
    parseEvents(response: SuiTransactionBlockResponse): MantaEvent[];
    hasPermission(cap: MemoryCap, permission: PermissionValue): boolean;
    isExpired(cap: MemoryCap, currentTimeMs?: bigint): boolean;
    isOwner(memory: MemoryObject, address: string): boolean;
}

/**
 * Decode episodic memory entries from raw data
 *
 * Entry format:
 * [u32 entry_len][u64 timestamp][address actor][u32 payload_len][bytes payload]
 */
declare function decodeEpisodicEntries(data: Uint8Array): EpisodicEntry[];
/**
 * Decode semantic memory entries from raw data
 *
 * Entry format:
 * [u32 entry_len][u32 key_len][bytes key][u32 value_len][bytes value][u64 updated_at]
 */
declare function decodeSemanticEntries(data: Uint8Array): SemanticEntry[];
/**
 * Get the latest value for a key from semantic entries
 * (Last write wins)
 */
declare function getLatestValue(entries: SemanticEntry[], key: Uint8Array): Uint8Array | null;
/**
 * Build a key-value map from semantic entries
 * (Last write wins for each key)
 */
declare function buildKeyValueMap(entries: SemanticEntry[]): Map<string, Uint8Array>;
/**
 * Helper: Convert bytes to hex string
 */
declare function bytesToHex(bytes: Uint8Array): string;
/**
 * Helper: Convert hex string to bytes
 */
declare function hexToBytes(hex: string): Uint8Array;
/**
 * Helper: Convert string to bytes (UTF-8)
 */
declare function stringToBytes(str: string): Uint8Array;
/**
 * Helper: Convert bytes to string (UTF-8)
 */
declare function bytesToString(bytes: Uint8Array): string;

export { CLOCK_ID, type CapabilityDelegatedEvent, type CapabilityRevokedEvent, type CapabilityUsedEvent, type EpisodicAppendEvent, type EpisodicEntry, FUNCTIONS, MODULES, MantaClient, type MantaClientConfig, type MantaEvent, type MemoryCap, type MemoryCreatedEvent, type MemoryDestroyedEvent, type MemoryObject, type Network, PACKAGE_IDS, type PermissionValue, Permissions, SchemaType, type SchemaTypeValue, type SemanticEntry, type SemanticUpdateEvent, buildKeyValueMap, bytesToHex, bytesToString, decodeEpisodicEntries, decodeSemanticEntries, getLatestValue, hexToBytes, stringToBytes };
