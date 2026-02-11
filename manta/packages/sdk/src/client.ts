import {
  SuiJsonRpcClient,
  SuiTransactionBlockResponse,
  SuiObjectResponse,
  SuiEvent,
  getJsonRpcFullnodeUrl,
} from '@mysten/sui/jsonRpc';
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
  client?: SuiJsonRpcClient;
}

export class MantaClient {
  readonly network: Network;
  readonly packageId: string;
  readonly client: SuiJsonRpcClient;

  constructor(config: MantaClientConfig) {
    this.network = config.network;
    this.packageId = PACKAGE_IDS[config.network];

    if (!this.packageId) {
      throw new Error(`Manta not deployed on ${config.network}`);
    }

    this.client = config.client ?? new SuiJsonRpcClient({
      network: this.network,
      url: getJsonRpcFullnodeUrl(this.network),
    });
  }

  // ============ Create Functions ============

  createEpisodicMemory(): Transaction {
    const tx = new Transaction();
    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.CREATE_EPISODIC}`,
      arguments: [tx.object(CLOCK_ID)],
    });
    return tx;
  }

  createSemanticMemory(): Transaction {
    const tx = new Transaction();
    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.CREATE_SEMANTIC}`,
      arguments: [tx.object(CLOCK_ID)],
    });
    return tx;
  }

  createSharedEpisodicMemory(): Transaction {
    const tx = new Transaction();
    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.CREATE_SHARED_EPISODIC}`,
      arguments: [tx.object(CLOCK_ID)],
    });
    return tx;
  }

  createSharedSemanticMemory(): Transaction {
    const tx = new Transaction();
    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.CREATE_SHARED_SEMANTIC}`,
      arguments: [tx.object(CLOCK_ID)],
    });
    return tx;
  }

  // ============ Write Functions ============

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

  // ============ Delegation Functions ============

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
        expiryMs ? tx.pure('vector<u64>', [expiryMs.toString()]) : tx.pure('vector<u64>', []),
        tx.object(CLOCK_ID),
      ],
    });
    return tx;
  }

  delegateRead(memoryId: string, recipient: string, expiryMs?: bigint): Transaction {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.DELEGATE_READ}`,
      arguments: [
        tx.object(memoryId),
        tx.pure('address', recipient),
        expiryMs ? tx.pure('vector<u64>', [expiryMs.toString()]) : tx.pure('vector<u64>', []),
        tx.object(CLOCK_ID),
      ],
    });
    return tx;
  }

  delegateAppend(memoryId: string, recipient: string, expiryMs?: bigint): Transaction {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.DELEGATE_APPEND}`,
      arguments: [
        tx.object(memoryId),
        tx.pure('address', recipient),
        expiryMs ? tx.pure('vector<u64>', [expiryMs.toString()]) : tx.pure('vector<u64>', []),
        tx.object(CLOCK_ID),
      ],
    });
    return tx;
  }

  delegateFull(memoryId: string, recipient: string, expiryMs?: bigint): Transaction {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.DELEGATE_FULL}`,
      arguments: [
        tx.object(memoryId),
        tx.pure('address', recipient),
        expiryMs ? tx.pure('vector<u64>', [expiryMs.toString()]) : tx.pure('vector<u64>', []),
        tx.object(CLOCK_ID),
      ],
    });
    return tx;
  }

  // ============ Ownership Transfer ============

  transferOwnership(memoryId: string, newOwner: string): Transaction {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::transfer_ownership`,
      arguments: [
        tx.object(memoryId),
        tx.pure('address', newOwner),
      ],
    });
    return tx;
  }

  // ============ Revoke & Destroy ============

  revoke(capId: string): Transaction {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.REVOKE}`,
      arguments: [tx.object(capId)],
    });
    return tx;
  }

  revokeAllCaps(memoryId: string): Transaction {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.REVOKE_ALL_CAPS}`,
      arguments: [tx.object(memoryId)],
    });
    return tx;
  }

  destroy(memoryId: string): Transaction {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.DESTROY}`,
      arguments: [tx.object(memoryId)],
    });
    return tx;
  }

  // ============ Read Functions ============

  async getMemory(objectId: string): Promise<MemoryObject | null> {
    const response = await this.client.getObject({
      id: objectId,
      options: { showContent: true },
    });

    if (!response.data?.content || response.data.content.dataType !== 'moveObject') {
      return null;
    }

    const fields = response.data.content.fields as unknown as MemoryObjectRaw;

    return {
      id: fields.id.id,
      owner: fields.owner,
      schemaType: fields.schema_type as 0 | 1,
      data: new Uint8Array(fields.data),
      version: BigInt(fields.version ?? '0'),
      createdAt: BigInt(fields.created_at ?? '0'),
      capEpoch: BigInt(fields.cap_epoch ?? '0'),
    };
  }

  async getCap(objectId: string): Promise<MemoryCap | null> {
    const response = await this.client.getObject({
      id: objectId,
      options: { showContent: true },
    });

    if (!response.data?.content || response.data.content.dataType !== 'moveObject') {
      return null;
    }

    const fields = response.data.content.fields as unknown as MemoryCapRaw;

    return {
      id: fields.id.id,
      memoryId: fields.memory_id,
      permissions: fields.permissions as PermissionValue,
      expiry: fields.expiry?.vec?.[0] ? BigInt(fields.expiry.vec[0]) : null,
      createdAt: BigInt(fields.created_at ?? '0'),
      issuedEpoch: BigInt(fields.issued_epoch ?? '0'),
    };
  }

  async getOwnedMemories(owner: string): Promise<MemoryObject[]> {
    const objects = await this.client.getOwnedObjects({
      owner,
      filter: {
        StructType: `${this.packageId}::${MODULES.MEMORY}::MemoryObject`,
      },
      options: { showContent: true },
    });

    return objects.data
      .filter((obj: SuiObjectResponse) => obj.data?.content?.dataType === 'moveObject')
      .map((obj: SuiObjectResponse) => {
        const fields = (obj.data!.content as any).fields as MemoryObjectRaw;
        return {
          id: fields.id.id,
          owner: fields.owner,
          schemaType: fields.schema_type as 0 | 1,
          data: new Uint8Array(fields.data),
          version: BigInt(fields.version),
          createdAt: BigInt(fields.created_at),
          capEpoch: BigInt(fields.cap_epoch),
        };
      });
  }

  async getOwnedCaps(owner: string): Promise<MemoryCap[]> {
    const objects = await this.client.getOwnedObjects({
      owner,
      filter: {
        StructType: `${this.packageId}::${MODULES.MEMORY}::MemoryCap`,
      },
      options: { showContent: true },
    });

    return objects.data
      .filter((obj: SuiObjectResponse) => obj.data?.content?.dataType === 'moveObject')
      .map((obj: SuiObjectResponse) => {
        const fields = (obj.data!.content as any).fields as MemoryCapRaw;
        return {
          id: fields.id.id,
          memoryId: fields.memory_id,
          permissions: fields.permissions as PermissionValue,
          expiry: fields.expiry?.vec?.[0] ? BigInt(fields.expiry.vec[0]) : null,
          createdAt: BigInt(fields.created_at),
          issuedEpoch: BigInt(fields.issued_epoch),
        };
      });
  }

  // ============ Decode Functions ============

  decodeEpisodic(memory: MemoryObject): EpisodicEntry[] {
    if (memory.schemaType !== SchemaType.EPISODIC) {
      throw new Error('Memory is not episodic');
    }
    return decodeEpisodicEntries(memory.data);
  }

  decodeSemantic(memory: MemoryObject): SemanticEntry[] {
    if (memory.schemaType !== SchemaType.SEMANTIC) {
      throw new Error('Memory is not semantic');
    }
    return decodeSemanticEntries(memory.data);
  }

  buildKVMap(memory: MemoryObject): Map<string, Uint8Array> {
    const entries = this.decodeSemantic(memory);
    return buildKeyValueMap(entries);
  }

  // ============ Event Parsing ============

  parseEvents(response: SuiTransactionBlockResponse): MantaEvent[] {
    if (!response.events) return [];

    return response.events
      .filter((event: SuiEvent) => event.type.startsWith(this.packageId))
      .map((event: SuiEvent) => {
        const eventType = event.type.split('::').pop()!;
        return {
          type: eventType,
          data: event.parsedJson,
        } as MantaEvent;
      });
  }

  // ============ Helpers ============

  hasPermission(cap: MemoryCap, permission: PermissionValue): boolean {
    return (cap.permissions & permission) === permission;
  }

  isExpired(cap: MemoryCap, currentTimeMs?: bigint): boolean {
    if (!cap.expiry) return false;
    const now = currentTimeMs ?? BigInt(Date.now());
    return now > cap.expiry;
  }

  isOwner(memory: MemoryObject, address: string): boolean {
    return memory.owner === address;
  }
}
