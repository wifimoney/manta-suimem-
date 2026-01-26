import { SuiClient, SuiTransactionBlockResponse } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import {
  PACKAGE_IDS,
  CLOCK_ID,
  MODULES,
  FUNCTIONS,
  SchemaType,
  Permissions,
  type Network,
  type PermissionValue,
} from './constants';
import type {
  MemoryObject,
  MemoryObjectRaw,
  MemoryCap,
  MemoryCapRaw,
  EpisodicEntry,
  SemanticEntry,
  MantaTxResult,
  MantaEvent,
} from './types';
import {
  decodeEpisodicEntries,
  decodeSemanticEntries,
  buildKeyValueMap,
  stringToBytes,
} from './bcs';

export interface MantaClientConfig {
  network: Network;
  client?: SuiClient;
}

/**
 * Manta SDK Client
 * 
 * @example
 * ```ts
 * import { MantaClient } from '@manta/sdk';
 * 
 * const manta = new MantaClient({ network: 'testnet' });
 * 
 * // Create memory
 * const tx = manta.createEpisodicMemory();
 * 
 * // Read memory
 * const memory = await manta.getMemory(objectId);
 * const entries = manta.decodeEpisodic(memory);
 * ```
 */
export class MantaClient {
  readonly network: Network;
  readonly packageId: string;
  readonly client: SuiClient;

  constructor(config: MantaClientConfig) {
    this.network = config.network;
    this.packageId = PACKAGE_IDS[config.network];
    
    if (!this.packageId) {
      throw new Error(`Manta not deployed on ${config.network}`);
    }

    this.client = config.client ?? new SuiClient({
      url: this.getRpcUrl(),
    });
  }

  private getRpcUrl(): string {
    switch (this.network) {
      case 'mainnet':
        return 'https://fullnode.mainnet.sui.io';
      case 'testnet':
        return 'https://fullnode.testnet.sui.io';
      case 'devnet':
        return 'https://fullnode.devnet.sui.io';
    }
  }

  // ============ Transaction Builders ============

  /**
   * Create a private episodic memory
   */
  createEpisodicMemory(): Transaction {
    const tx = new Transaction();
    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.CREATE_EPISODIC}`,
      arguments: [tx.object(CLOCK_ID)],
    });
    return tx;
  }

  /**
   * Create a private semantic memory
   */
  createSemanticMemory(): Transaction {
    const tx = new Transaction();
    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.CREATE_SEMANTIC}`,
      arguments: [tx.object(CLOCK_ID)],
    });
    return tx;
  }

  /**
   * Create a shared episodic memory
   */
  createSharedEpisodicMemory(): Transaction {
    const tx = new Transaction();
    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.CREATE_SHARED_EPISODIC}`,
      arguments: [tx.object(CLOCK_ID)],
    });
    return tx;
  }

  /**
   * Create a shared semantic memory
   */
  createSharedSemanticMemory(): Transaction {
    const tx = new Transaction();
    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.CREATE_SHARED_SEMANTIC}`,
      arguments: [tx.object(CLOCK_ID)],
    });
    return tx;
  }

  /**
   * Append to episodic memory (owner)
   */
  append(memoryId: string, payload: Uint8Array | string): Transaction {
    const tx = new Transaction();
    const payloadBytes = typeof payload === 'string' ? stringToBytes(payload) : payload;
    
    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.APPEND}`,
      arguments: [
        tx.object(memoryId),
        tx.pure('vector<u8>', Array.from(payloadBytes)),
        tx.object(CLOCK_ID),
      ],
    });
    return tx;
  }

  /**
   * Update semantic memory (owner)
   */
  update(memoryId: string, key: Uint8Array | string, value: Uint8Array | string): Transaction {
    const tx = new Transaction();
    const keyBytes = typeof key === 'string' ? stringToBytes(key) : key;
    const valueBytes = typeof value === 'string' ? stringToBytes(value) : value;
    
    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.UPDATE}`,
      arguments: [
        tx.object(memoryId),
        tx.pure('vector<u8>', Array.from(keyBytes)),
        tx.pure('vector<u8>', Array.from(valueBytes)),
        tx.object(CLOCK_ID),
      ],
    });
    return tx;
  }

  /**
   * Append using capability (for shared memory)
   */
  capAppend(memoryId: string, capId: string, payload: Uint8Array | string): Transaction {
    const tx = new Transaction();
    const payloadBytes = typeof payload === 'string' ? stringToBytes(payload) : payload;
    
    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.CAP_APPEND}`,
      arguments: [
        tx.object(memoryId),
        tx.object(capId),
        tx.pure('vector<u8>', Array.from(payloadBytes)),
        tx.object(CLOCK_ID),
      ],
    });
    return tx;
  }

  /**
   * Update using capability (for shared memory)
   */
  capUpdate(
    memoryId: string,
    capId: string,
    key: Uint8Array | string,
    value: Uint8Array | string
  ): Transaction {
    const tx = new Transaction();
    const keyBytes = typeof key === 'string' ? stringToBytes(key) : key;
    const valueBytes = typeof value === 'string' ? stringToBytes(value) : value;
    
    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.CAP_UPDATE}`,
      arguments: [
        tx.object(memoryId),
        tx.object(capId),
        tx.pure('vector<u8>', Array.from(keyBytes)),
        tx.pure('vector<u8>', Array.from(valueBytes)),
        tx.object(CLOCK_ID),
      ],
    });
    return tx;
  }

  /**
   * Delegate access to memory
   */
  delegate(
    memoryId: string,
    recipient: string,
    permissions: PermissionValue,
    expiryMs?: bigint
  ): Transaction {
    const tx = new Transaction();
    
    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.DELEGATE}`,
      arguments: [
        tx.object(memoryId),
        tx.pure('address', recipient),
        tx.pure('u8', permissions),
        tx.pure('Option<u64>', expiryMs ? [expiryMs.toString()] : []),
        tx.object(CLOCK_ID),
      ],
    });
    return tx;
  }

  /**
   * Delegate read-only access
   */
  delegateRead(memoryId: string, recipient: string, expiryMs?: bigint): Transaction {
    const tx = new Transaction();
    
    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.DELEGATE_READ}`,
      arguments: [
        tx.object(memoryId),
        tx.pure('address', recipient),
        tx.pure('Option<u64>', expiryMs ? [expiryMs.toString()] : []),
        tx.object(CLOCK_ID),
      ],
    });
    return tx;
  }

  /**
   * Delegate append access
   */
  delegateAppend(memoryId: string, recipient: string, expiryMs?: bigint): Transaction {
    const tx = new Transaction();
    
    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.DELEGATE_APPEND}`,
      arguments: [
        tx.object(memoryId),
        tx.pure('address', recipient),
        tx.pure('Option<u64>', expiryMs ? [expiryMs.toString()] : []),
        tx.object(CLOCK_ID),
      ],
    });
    return tx;
  }

  /**
   * Delegate full access
   */
  delegateFull(memoryId: string, recipient: string, expiryMs?: bigint): Transaction {
    const tx = new Transaction();
    
    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.DELEGATE_FULL}`,
      arguments: [
        tx.object(memoryId),
        tx.pure('address', recipient),
        tx.pure('Option<u64>', expiryMs ? [expiryMs.toString()] : []),
        tx.object(CLOCK_ID),
      ],
    });
    return tx;
  }

  /**
   * Revoke capability
   */
  revoke(capId: string): Transaction {
    const tx = new Transaction();
    
    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.REVOKE}`,
      arguments: [tx.object(capId)],
    });
    return tx;
  }

  /**
   * Destroy memory
   */
  destroy(memoryId: string): Transaction {
    const tx = new Transaction();
    
    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.DESTROY}`,
      arguments: [tx.object(memoryId)],
    });
    return tx;
  }

  // ============ Read Methods ============

  /**
   * Get a MemoryObject by ID
   */
  async getMemory(objectId: string): Promise<MemoryObject | null> {
    const response = await this.client.getObject({
      id: objectId,
      options: { showContent: true },
    });

    if (!response.data?.content || response.data.content.dataType !== 'moveObject') {
      return null;
    }

    const fields = response.data.content.fields as MemoryObjectRaw;
    
    return {
      id: fields.id.id,
      schemaType: fields.schema_type as 0 | 1,
      data: new Uint8Array(fields.data),
      version: BigInt(fields.version),
      createdAt: BigInt(fields.created_at),
    };
  }

  /**
   * Get a MemoryCap by ID
   */
  async getCap(objectId: string): Promise<MemoryCap | null> {
    const response = await this.client.getObject({
      id: objectId,
      options: { showContent: true },
    });

    if (!response.data?.content || response.data.content.dataType !== 'moveObject') {
      return null;
    }

    const fields = response.data.content.fields as MemoryCapRaw;
    
    return {
      id: fields.id.id,
      memoryId: fields.memory_id,
      permissions: fields.permissions as PermissionValue,
      expiry: fields.expiry?.vec?.[0] ? BigInt(fields.expiry.vec[0]) : null,
      createdAt: BigInt(fields.created_at),
    };
  }

  /**
   * Get all MemoryObjects owned by an address
   */
  async getOwnedMemories(owner: string): Promise<MemoryObject[]> {
    const objects = await this.client.getOwnedObjects({
      owner,
      filter: {
        StructType: `${this.packageId}::${MODULES.MEMORY}::MemoryObject`,
      },
      options: { showContent: true },
    });

    return objects.data
      .filter(obj => obj.data?.content?.dataType === 'moveObject')
      .map(obj => {
        const fields = (obj.data!.content as any).fields as MemoryObjectRaw;
        return {
          id: fields.id.id,
          schemaType: fields.schema_type as 0 | 1,
          data: new Uint8Array(fields.data),
          version: BigInt(fields.version),
          createdAt: BigInt(fields.created_at),
        };
      });
  }

  /**
   * Get all MemoryCaps owned by an address
   */
  async getOwnedCaps(owner: string): Promise<MemoryCap[]> {
    const objects = await this.client.getOwnedObjects({
      owner,
      filter: {
        StructType: `${this.packageId}::${MODULES.MEMORY}::MemoryCap`,
      },
      options: { showContent: true },
    });

    return objects.data
      .filter(obj => obj.data?.content?.dataType === 'moveObject')
      .map(obj => {
        const fields = (obj.data!.content as any).fields as MemoryCapRaw;
        return {
          id: fields.id.id,
          memoryId: fields.memory_id,
          permissions: fields.permissions as PermissionValue,
          expiry: fields.expiry?.vec?.[0] ? BigInt(fields.expiry.vec[0]) : null,
          createdAt: BigInt(fields.created_at),
        };
      });
  }

  // ============ Decode Methods ============

  /**
   * Decode episodic memory entries
   */
  decodeEpisodic(memory: MemoryObject): EpisodicEntry[] {
    if (memory.schemaType !== SchemaType.EPISODIC) {
      throw new Error('Memory is not episodic');
    }
    return decodeEpisodicEntries(memory.data);
  }

  /**
   * Decode semantic memory entries
   */
  decodeSemantic(memory: MemoryObject): SemanticEntry[] {
    if (memory.schemaType !== SchemaType.SEMANTIC) {
      throw new Error('Memory is not semantic');
    }
    return decodeSemanticEntries(memory.data);
  }

  /**
   * Build key-value map from semantic memory
   */
  buildKVMap(memory: MemoryObject): Map<string, Uint8Array> {
    const entries = this.decodeSemantic(memory);
    return buildKeyValueMap(entries);
  }

  // ============ Event Parsing ============

  /**
   * Parse events from transaction response
   */
  parseEvents(response: SuiTransactionBlockResponse): MantaEvent[] {
    if (!response.events) return [];

    return response.events
      .filter(event => event.type.startsWith(this.packageId))
      .map(event => {
        const eventType = event.type.split('::').pop()!;
        return {
          type: eventType,
          data: event.parsedJson,
        } as MantaEvent;
      });
  }

  // ============ Helpers ============

  /**
   * Check if a capability has a specific permission
   */
  hasPermission(cap: MemoryCap, permission: PermissionValue): boolean {
    return (cap.permissions & permission) === permission;
  }

  /**
   * Check if a capability is expired
   */
  isExpired(cap: MemoryCap, currentTimeMs?: bigint): boolean {
    if (!cap.expiry) return false;
    const now = currentTimeMs ?? BigInt(Date.now());
    return now > cap.expiry;
  }
}
EOFcat > src/client.ts << 'EOF'
import { SuiClient, SuiTransactionBlockResponse } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import {
  PACKAGE_IDS,
  CLOCK_ID,
  MODULES,
  FUNCTIONS,
  SchemaType,
  Permissions,
  type Network,
  type PermissionValue,
} from './constants';
import type {
  MemoryObject,
  MemoryObjectRaw,
  MemoryCap,
  MemoryCapRaw,
  EpisodicEntry,
  SemanticEntry,
  MantaTxResult,
  MantaEvent,
} from './types';
import {
  decodeEpisodicEntries,
  decodeSemanticEntries,
  buildKeyValueMap,
  stringToBytes,
} from './bcs';

export interface MantaClientConfig {
  network: Network;
  client?: SuiClient;
}

/**
 * Manta SDK Client
 * 
 * @example
 * ```ts
 * import { MantaClient } from '@manta/sdk';
 * 
 * const manta = new MantaClient({ network: 'testnet' });
 * 
 * // Create memory
 * const tx = manta.createEpisodicMemory();
 * 
 * // Read memory
 * const memory = await manta.getMemory(objectId);
 * const entries = manta.decodeEpisodic(memory);
 * ```
 */
export class MantaClient {
  readonly network: Network;
  readonly packageId: string;
  readonly client: SuiClient;

  constructor(config: MantaClientConfig) {
    this.network = config.network;
    this.packageId = PACKAGE_IDS[config.network];
    
    if (!this.packageId) {
      throw new Error(`Manta not deployed on ${config.network}`);
    }

    this.client = config.client ?? new SuiClient({
      url: this.getRpcUrl(),
    });
  }

  private getRpcUrl(): string {
    switch (this.network) {
      case 'mainnet':
        return 'https://fullnode.mainnet.sui.io';
      case 'testnet':
        return 'https://fullnode.testnet.sui.io';
      case 'devnet':
        return 'https://fullnode.devnet.sui.io';
    }
  }

  // ============ Transaction Builders ============

  /**
   * Create a private episodic memory
   */
  createEpisodicMemory(): Transaction {
    const tx = new Transaction();
    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.CREATE_EPISODIC}`,
      arguments: [tx.object(CLOCK_ID)],
    });
    return tx;
  }

  /**
   * Create a private semantic memory
   */
  createSemanticMemory(): Transaction {
    const tx = new Transaction();
    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.CREATE_SEMANTIC}`,
      arguments: [tx.object(CLOCK_ID)],
    });
    return tx;
  }

  /**
   * Create a shared episodic memory
   */
  createSharedEpisodicMemory(): Transaction {
    const tx = new Transaction();
    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.CREATE_SHARED_EPISODIC}`,
      arguments: [tx.object(CLOCK_ID)],
    });
    return tx;
  }

  /**
   * Create a shared semantic memory
   */
  createSharedSemanticMemory(): Transaction {
    const tx = new Transaction();
    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.CREATE_SHARED_SEMANTIC}`,
      arguments: [tx.object(CLOCK_ID)],
    });
    return tx;
  }

  /**
   * Append to episodic memory (owner)
   */
  append(memoryId: string, payload: Uint8Array | string): Transaction {
    const tx = new Transaction();
    const payloadBytes = typeof payload === 'string' ? stringToBytes(payload) : payload;
    
    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.APPEND}`,
      arguments: [
        tx.object(memoryId),
        tx.pure('vector<u8>', Array.from(payloadBytes)),
        tx.object(CLOCK_ID),
      ],
    });
    return tx;
  }

  /**
   * Update semantic memory (owner)
   */
  update(memoryId: string, key: Uint8Array | string, value: Uint8Array | string): Transaction {
    const tx = new Transaction();
    const keyBytes = typeof key === 'string' ? stringToBytes(key) : key;
    const valueBytes = typeof value === 'string' ? stringToBytes(value) : value;
    
    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.UPDATE}`,
      arguments: [
        tx.object(memoryId),
        tx.pure('vector<u8>', Array.from(keyBytes)),
        tx.pure('vector<u8>', Array.from(valueBytes)),
        tx.object(CLOCK_ID),
      ],
    });
    return tx;
  }

  /**
   * Append using capability (for shared memory)
   */
  capAppend(memoryId: string, capId: string, payload: Uint8Array | string): Transaction {
    const tx = new Transaction();
    const payloadBytes = typeof payload === 'string' ? stringToBytes(payload) : payload;
    
    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.CAP_APPEND}`,
      arguments: [
        tx.object(memoryId),
        tx.object(capId),
        tx.pure('vector<u8>', Array.from(payloadBytes)),
        tx.object(CLOCK_ID),
      ],
    });
    return tx;
  }

  /**
   * Update using capability (for shared memory)
   */
  capUpdate(
    memoryId: string,
    capId: string,
    key: Uint8Array | string,
    value: Uint8Array | string
  ): Transaction {
    const tx = new Transaction();
    const keyBytes = typeof key === 'string' ? stringToBytes(key) : key;
    const valueBytes = typeof value === 'string' ? stringToBytes(value) : value;
    
    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.CAP_UPDATE}`,
      arguments: [
        tx.object(memoryId),
        tx.object(capId),
        tx.pure('vector<u8>', Array.from(keyBytes)),
        tx.pure('vector<u8>', Array.from(valueBytes)),
        tx.object(CLOCK_ID),
      ],
    });
    return tx;
  }

  /**
   * Delegate access to memory
   */
  delegate(
    memoryId: string,
    recipient: string,
    permissions: PermissionValue,
    expiryMs?: bigint
  ): Transaction {
    const tx = new Transaction();
    
    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.DELEGATE}`,
      arguments: [
        tx.object(memoryId),
        tx.pure('address', recipient),
        tx.pure('u8', permissions),
        tx.pure('Option<u64>', expiryMs ? [expiryMs.toString()] : []),
        tx.object(CLOCK_ID),
      ],
    });
    return tx;
  }

  /**
   * Delegate read-only access
   */
  delegateRead(memoryId: string, recipient: string, expiryMs?: bigint): Transaction {
    const tx = new Transaction();
    
    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.DELEGATE_READ}`,
      arguments: [
        tx.object(memoryId),
        tx.pure('address', recipient),
        tx.pure('Option<u64>', expiryMs ? [expiryMs.toString()] : []),
        tx.object(CLOCK_ID),
      ],
    });
    return tx;
  }

  /**
   * Delegate append access
   */
  delegateAppend(memoryId: string, recipient: string, expiryMs?: bigint): Transaction {
    const tx = new Transaction();
    
    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.DELEGATE_APPEND}`,
      arguments: [
        tx.object(memoryId),
        tx.pure('address', recipient),
        tx.pure('Option<u64>', expiryMs ? [expiryMs.toString()] : []),
        tx.object(CLOCK_ID),
      ],
    });
    return tx;
  }

  /**
   * Delegate full access
   */
  delegateFull(memoryId: string, recipient: string, expiryMs?: bigint): Transaction {
    const tx = new Transaction();
    
    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.DELEGATE_FULL}`,
      arguments: [
        tx.object(memoryId),
        tx.pure('address', recipient),
        tx.pure('Option<u64>', expiryMs ? [expiryMs.toString()] : []),
        tx.object(CLOCK_ID),
      ],
    });
    return tx;
  }

  /**
   * Revoke capability
   */
  revoke(capId: string): Transaction {
    const tx = new Transaction();
    
    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.REVOKE}`,
      arguments: [tx.object(capId)],
    });
    return tx;
  }

  /**
   * Destroy memory
   */
  destroy(memoryId: string): Transaction {
    const tx = new Transaction();
    
    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.DESTROY}`,
      arguments: [tx.object(memoryId)],
    });
    return tx;
  }

  // ============ Read Methods ============

  /**
   * Get a MemoryObject by ID
   */
  async getMemory(objectId: string): Promise<MemoryObject | null> {
    const response = await this.client.getObject({
      id: objectId,
      options: { showContent: true },
    });

    if (!response.data?.content || response.data.content.dataType !== 'moveObject') {
      return null;
    }

    const fields = response.data.content.fields as MemoryObjectRaw;
    
    return {
      id: fields.id.id,
      schemaType: fields.schema_type as 0 | 1,
      data: new Uint8Array(fields.data),
      version: BigInt(fields.version),
      createdAt: BigInt(fields.created_at),
    };
  }

  /**
   * Get a MemoryCap by ID
   */
  async getCap(objectId: string): Promise<MemoryCap | null> {
    const response = await this.client.getObject({
      id: objectId,
      options: { showContent: true },
    });

    if (!response.data?.content || response.data.content.dataType !== 'moveObject') {
      return null;
    }

    const fields = response.data.content.fields as MemoryCapRaw;
    
    return {
      id: fields.id.id,
      memoryId: fields.memory_id,
      permissions: fields.permissions as PermissionValue,
      expiry: fields.expiry?.vec?.[0] ? BigInt(fields.expiry.vec[0]) : null,
      createdAt: BigInt(fields.created_at),
    };
  }

  /**
   * Get all MemoryObjects owned by an address
   */
  async getOwnedMemories(owner: string): Promise<MemoryObject[]> {
    const objects = await this.client.getOwnedObjects({
      owner,
      filter: {
        StructType: `${this.packageId}::${MODULES.MEMORY}::MemoryObject`,
      },
      options: { showContent: true },
    });

    return objects.data
      .filter(obj => obj.data?.content?.dataType === 'moveObject')
      .map(obj => {
        const fields = (obj.data!.content as any).fields as MemoryObjectRaw;
        return {
          id: fields.id.id,
          schemaType: fields.schema_type as 0 | 1,
          data: new Uint8Array(fields.data),
          version: BigInt(fields.version),
          createdAt: BigInt(fields.created_at),
        };
      });
  }

  /**
   * Get all MemoryCaps owned by an address
   */
  async getOwnedCaps(owner: string): Promise<MemoryCap[]> {
    const objects = await this.client.getOwnedObjects({
      owner,
      filter: {
        StructType: `${this.packageId}::${MODULES.MEMORY}::MemoryCap`,
      },
      options: { showContent: true },
    });

    return objects.data
      .filter(obj => obj.data?.content?.dataType === 'moveObject')
      .map(obj => {
        const fields = (obj.data!.content as any).fields as MemoryCapRaw;
        return {
          id: fields.id.id,
          memoryId: fields.memory_id,
          permissions: fields.permissions as PermissionValue,
          expiry: fields.expiry?.vec?.[0] ? BigInt(fields.expiry.vec[0]) : null,
          createdAt: BigInt(fields.created_at),
        };
      });
  }

  // ============ Decode Methods ============

  /**
   * Decode episodic memory entries
   */
  decodeEpisodic(memory: MemoryObject): EpisodicEntry[] {
    if (memory.schemaType !== SchemaType.EPISODIC) {
      throw new Error('Memory is not episodic');
    }
    return decodeEpisodicEntries(memory.data);
  }

  /**
   * Decode semantic memory entries
   */
  decodeSemantic(memory: MemoryObject): SemanticEntry[] {
    if (memory.schemaType !== SchemaType.SEMANTIC) {
      throw new Error('Memory is not semantic');
    }
    return decodeSemanticEntries(memory.data);
  }

  /**
   * Build key-value map from semantic memory
   */
  buildKVMap(memory: MemoryObject): Map<string, Uint8Array> {
    const entries = this.decodeSemantic(memory);
    return buildKeyValueMap(entries);
  }

  // ============ Event Parsing ============

  /**
   * Parse events from transaction response
   */
  parseEvents(response: SuiTransactionBlockResponse): MantaEvent[] {
    if (!response.events) return [];

    return response.events
      .filter(event => event.type.startsWith(this.packageId))
      .map(event => {
        const eventType = event.type.split('::').pop()!;
        return {
          type: eventType,
          data: event.parsedJson,
        } as MantaEvent;
      });
  }

  // ============ Helpers ============

  /**
   * Check if a capability has a specific permission
   */
  hasPermission(cap: MemoryCap, permission: PermissionValue): boolean {
    return (cap.permissions & permission) === permission;
  }

  /**
   * Check if a capability is expired
   */
  isExpired(cap: MemoryCap, currentTimeMs?: bigint): boolean {
    if (!cap.expiry) return false;
    const now = currentTimeMs ?? BigInt(Date.now());
    return now > cap.expiry;
  }
}
