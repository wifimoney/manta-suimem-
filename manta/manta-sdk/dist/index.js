"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  CLOCK_ID: () => CLOCK_ID,
  FUNCTIONS: () => FUNCTIONS,
  MODULES: () => MODULES,
  MantaClient: () => MantaClient,
  PACKAGE_IDS: () => PACKAGE_IDS,
  Permissions: () => Permissions,
  SchemaType: () => SchemaType,
  SuiJsonRpcClient: () => import_jsonRpc2.SuiJsonRpcClient,
  buildKeyValueMap: () => buildKeyValueMap,
  bytesToHex: () => bytesToHex,
  bytesToString: () => bytesToString,
  decodeEpisodicEntries: () => decodeEpisodicEntries,
  decodeSemanticEntries: () => decodeSemanticEntries,
  getLatestValue: () => getLatestValue,
  hexToBytes: () => hexToBytes,
  stringToBytes: () => stringToBytes
});
module.exports = __toCommonJS(index_exports);

// src/client.ts
var import_jsonRpc = require("@mysten/sui/jsonRpc");
var import_transactions = require("@mysten/sui/transactions");

// src/constants.ts
var PACKAGE_IDS = {
  mainnet: "0x212b3966f9235171499e0e6c1f276fb6d815ff366e29b95a270a9288e5fff508",
  testnet: "0x61f59d91f6ac0c1a321a2682d7d70cab4bc0425ed1d8b417d2494f0bbc0d6be0",
  devnet: "0x38c55662dfe0ff2cd0e346da0bf20916afa26bb65fe86239a687b47826643e0d"
};
var CLOCK_ID = "0x6";
var SchemaType = {
  EPISODIC: 0,
  SEMANTIC: 1
};
var Permissions = {
  READ: 1,
  APPEND: 2,
  UPDATE: 4,
  READ_APPEND: 3,
  READ_UPDATE: 5,
  FULL: 7
};
var MODULES = {
  MEMORY: "memory"
};
var FUNCTIONS = {
  CREATE_EPISODIC: "create_episodic",
  CREATE_SEMANTIC: "create_semantic",
  CREATE_SHARED_EPISODIC: "create_shared_episodic",
  CREATE_SHARED_SEMANTIC: "create_shared_semantic",
  APPEND: "append",
  UPDATE: "update",
  CAP_APPEND: "cap_append",
  CAP_UPDATE: "cap_update",
  DELEGATE: "delegate",
  DELEGATE_READ: "delegate_read",
  DELEGATE_APPEND: "delegate_append",
  DELEGATE_UPDATE: "delegate_update",
  DELEGATE_FULL: "delegate_full",
  REVOKE: "revoke",
  REVOKE_ALL_CAPS: "revoke_all_caps",
  DESTROY: "destroy",
  TRANSFER_OWNERSHIP: "transfer_ownership"
};

// src/bcs.ts
function readU32LE(data, offset) {
  if (offset + 4 > data.length) {
    throw new Error(`Buffer overflow: cannot read u32 at offset ${offset}, data length ${data.length}`);
  }
  return (data[offset] | data[offset + 1] << 8 | data[offset + 2] << 16 | data[offset + 3] << 24) >>> 0;
}
function readU64LE(data, offset) {
  if (offset + 8 > data.length) {
    throw new Error(`Buffer overflow: cannot read u64 at offset ${offset}, data length ${data.length}`);
  }
  const low = BigInt(readU32LE(data, offset));
  const high = BigInt(readU32LE(data, offset + 4));
  return high << 32n | low;
}
function readAddress(data, offset) {
  if (offset + 32 > data.length) {
    throw new Error(`Buffer overflow: cannot read address at offset ${offset}, data length ${data.length}`);
  }
  const bytes = data.slice(offset, offset + 32);
  return "0x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function decodeEpisodicEntries(data) {
  const entries = [];
  let offset = 0;
  while (offset < data.length) {
    if (offset + 4 > data.length) {
      throw new Error(`Malformed data: cannot read entry length at offset ${offset}`);
    }
    const entryLen = readU32LE(data, offset);
    offset += 4;
    if (offset + entryLen > data.length) {
      throw new Error(`Malformed data: entry claims ${entryLen} bytes but only ${data.length - offset} available`);
    }
    if (entryLen < 44) {
      throw new Error(`Malformed data: entry too small (${entryLen} bytes)`);
    }
    const timestamp = readU64LE(data, offset);
    offset += 8;
    const actor = readAddress(data, offset);
    offset += 32;
    const payloadLen = readU32LE(data, offset);
    offset += 4;
    if (payloadLen > entryLen - 44) {
      throw new Error(`Malformed data: payload length ${payloadLen} exceeds entry bounds`);
    }
    const payload = data.slice(offset, offset + payloadLen);
    offset += payloadLen;
    entries.push({ timestamp, actor, payload });
  }
  return entries;
}
function decodeSemanticEntries(data) {
  const entries = [];
  let offset = 0;
  while (offset < data.length) {
    if (offset + 4 > data.length) {
      throw new Error(`Malformed data: cannot read entry length at offset ${offset}`);
    }
    const entryLen = readU32LE(data, offset);
    offset += 4;
    if (offset + entryLen > data.length) {
      throw new Error(`Malformed data: entry claims ${entryLen} bytes but only ${data.length - offset} available`);
    }
    if (entryLen < 16) {
      throw new Error(`Malformed data: entry too small (${entryLen} bytes)`);
    }
    const entryStart = offset;
    const keyLen = readU32LE(data, offset);
    offset += 4;
    if (keyLen > entryLen - 16) {
      throw new Error(`Malformed data: key length ${keyLen} exceeds entry bounds`);
    }
    const key = data.slice(offset, offset + keyLen);
    offset += keyLen;
    if (offset + 4 > data.length) {
      throw new Error(`Malformed data: cannot read value length at offset ${offset}`);
    }
    const valueLen = readU32LE(data, offset);
    offset += 4;
    if (offset + valueLen + 8 > entryStart + entryLen + 4) {
      throw new Error(`Malformed data: value length ${valueLen} exceeds entry bounds`);
    }
    const value = data.slice(offset, offset + valueLen);
    offset += valueLen;
    const updatedAt = readU64LE(data, offset);
    offset += 8;
    entries.push({ key, value, updatedAt });
  }
  return entries;
}
function getLatestValue(entries, key) {
  let latest = null;
  for (const entry of entries) {
    if (arraysEqual(entry.key, key)) {
      if (!latest || entry.updatedAt > latest.updatedAt) {
        latest = entry;
      }
    }
  }
  return latest?.value ?? null;
}
function buildKeyValueMap(entries) {
  const map = /* @__PURE__ */ new Map();
  for (const entry of entries) {
    const keyHex = bytesToHex(entry.key);
    const existing = map.get(keyHex);
    if (!existing || entry.updatedAt > existing.updatedAt) {
      map.set(keyHex, { value: entry.value, updatedAt: entry.updatedAt });
    }
  }
  return new Map(Array.from(map.entries()).map(([k, v]) => [k, v.value]));
}
function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function hexToBytes(hex) {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) {
    throw new Error("Invalid hex string: odd length");
  }
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    const byte = parseInt(clean.substr(i * 2, 2), 16);
    if (isNaN(byte)) {
      throw new Error(`Invalid hex character at position ${i * 2}`);
    }
    bytes[i] = byte;
  }
  return bytes;
}
function stringToBytes(str) {
  return new TextEncoder().encode(str);
}
function bytesToString(bytes) {
  return new TextDecoder().decode(bytes);
}

// src/client.ts
var MantaClient = class {
  constructor(config) {
    this.network = config.network;
    this.packageId = PACKAGE_IDS[config.network];
    if (!this.packageId) {
      throw new Error(`Manta not deployed on ${config.network}`);
    }
    this.client = config.client ?? new import_jsonRpc.SuiJsonRpcClient({
      network: this.network,
      url: (0, import_jsonRpc.getJsonRpcFullnodeUrl)(this.network)
    });
  }
  // ============ Create Functions ============
  createEpisodicMemory() {
    const tx = new import_transactions.Transaction();
    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.CREATE_EPISODIC}`,
      arguments: [tx.object(CLOCK_ID)]
    });
    return tx;
  }
  createSemanticMemory() {
    const tx = new import_transactions.Transaction();
    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.CREATE_SEMANTIC}`,
      arguments: [tx.object(CLOCK_ID)]
    });
    return tx;
  }
  createSharedEpisodicMemory() {
    const tx = new import_transactions.Transaction();
    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.CREATE_SHARED_EPISODIC}`,
      arguments: [tx.object(CLOCK_ID)]
    });
    return tx;
  }
  createSharedSemanticMemory() {
    const tx = new import_transactions.Transaction();
    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.CREATE_SHARED_SEMANTIC}`,
      arguments: [tx.object(CLOCK_ID)]
    });
    return tx;
  }
  // ============ Write Functions ============
  append(memoryId, payload) {
    const tx = new import_transactions.Transaction();
    const payloadBytes = typeof payload === "string" ? stringToBytes(payload) : payload;
    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.APPEND}`,
      arguments: [
        tx.object(memoryId),
        tx.pure("vector<u8>", Array.from(payloadBytes)),
        tx.object(CLOCK_ID)
      ]
    });
    return tx;
  }
  update(memoryId, key, value) {
    const tx = new import_transactions.Transaction();
    const keyBytes = typeof key === "string" ? stringToBytes(key) : key;
    const valueBytes = typeof value === "string" ? stringToBytes(value) : value;
    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.UPDATE}`,
      arguments: [
        tx.object(memoryId),
        tx.pure("vector<u8>", Array.from(keyBytes)),
        tx.pure("vector<u8>", Array.from(valueBytes)),
        tx.object(CLOCK_ID)
      ]
    });
    return tx;
  }
  capAppend(memoryId, capId, payload) {
    const tx = new import_transactions.Transaction();
    const payloadBytes = typeof payload === "string" ? stringToBytes(payload) : payload;
    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.CAP_APPEND}`,
      arguments: [
        tx.object(memoryId),
        tx.object(capId),
        tx.pure("vector<u8>", Array.from(payloadBytes)),
        tx.object(CLOCK_ID)
      ]
    });
    return tx;
  }
  capUpdate(memoryId, capId, key, value) {
    const tx = new import_transactions.Transaction();
    const keyBytes = typeof key === "string" ? stringToBytes(key) : key;
    const valueBytes = typeof value === "string" ? stringToBytes(value) : value;
    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.CAP_UPDATE}`,
      arguments: [
        tx.object(memoryId),
        tx.object(capId),
        tx.pure("vector<u8>", Array.from(keyBytes)),
        tx.pure("vector<u8>", Array.from(valueBytes)),
        tx.object(CLOCK_ID)
      ]
    });
    return tx;
  }
  // ============ Delegation Functions ============
  delegate(memoryId, recipient, permissions, expiryMs) {
    const tx = new import_transactions.Transaction();
    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.DELEGATE}`,
      arguments: [
        tx.object(memoryId),
        tx.pure("address", recipient),
        tx.pure("u8", permissions),
        expiryMs ? tx.pure("vector<u64>", [expiryMs.toString()]) : tx.pure("vector<u64>", []),
        tx.object(CLOCK_ID)
      ]
    });
    return tx;
  }
  delegateRead(memoryId, recipient, expiryMs) {
    const tx = new import_transactions.Transaction();
    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.DELEGATE_READ}`,
      arguments: [
        tx.object(memoryId),
        tx.pure("address", recipient),
        expiryMs ? tx.pure("vector<u64>", [expiryMs.toString()]) : tx.pure("vector<u64>", []),
        tx.object(CLOCK_ID)
      ]
    });
    return tx;
  }
  delegateAppend(memoryId, recipient, expiryMs) {
    const tx = new import_transactions.Transaction();
    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.DELEGATE_APPEND}`,
      arguments: [
        tx.object(memoryId),
        tx.pure("address", recipient),
        expiryMs ? tx.pure("vector<u64>", [expiryMs.toString()]) : tx.pure("vector<u64>", []),
        tx.object(CLOCK_ID)
      ]
    });
    return tx;
  }
  delegateFull(memoryId, recipient, expiryMs) {
    const tx = new import_transactions.Transaction();
    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.DELEGATE_FULL}`,
      arguments: [
        tx.object(memoryId),
        tx.pure("address", recipient),
        expiryMs ? tx.pure("vector<u64>", [expiryMs.toString()]) : tx.pure("vector<u64>", []),
        tx.object(CLOCK_ID)
      ]
    });
    return tx;
  }
  // ============ Ownership Transfer ============
  transferOwnership(memoryId, newOwner) {
    const tx = new import_transactions.Transaction();
    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::transfer_ownership`,
      arguments: [
        tx.object(memoryId),
        tx.pure("address", newOwner)
      ]
    });
    return tx;
  }
  // ============ Revoke & Destroy ============
  revoke(capId) {
    const tx = new import_transactions.Transaction();
    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.REVOKE}`,
      arguments: [tx.object(capId)]
    });
    return tx;
  }
  revokeAllCaps(memoryId) {
    const tx = new import_transactions.Transaction();
    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.REVOKE_ALL_CAPS}`,
      arguments: [tx.object(memoryId)]
    });
    return tx;
  }
  destroy(memoryId) {
    const tx = new import_transactions.Transaction();
    tx.moveCall({
      target: `${this.packageId}::${MODULES.MEMORY}::${FUNCTIONS.DESTROY}`,
      arguments: [tx.object(memoryId)]
    });
    return tx;
  }
  // ============ Read Functions ============
  async getMemory(objectId) {
    const response = await this.client.getObject({
      id: objectId,
      options: { showContent: true }
    });
    if (!response.data?.content || response.data.content.dataType !== "moveObject") {
      return null;
    }
    const fields = response.data.content.fields;
    return {
      id: fields.id.id,
      owner: fields.owner,
      schemaType: fields.schema_type,
      data: new Uint8Array(fields.data),
      version: BigInt(fields.version),
      createdAt: BigInt(fields.created_at),
      capEpoch: BigInt(fields.cap_epoch)
    };
  }
  async getCap(objectId) {
    const response = await this.client.getObject({
      id: objectId,
      options: { showContent: true }
    });
    if (!response.data?.content || response.data.content.dataType !== "moveObject") {
      return null;
    }
    const fields = response.data.content.fields;
    return {
      id: fields.id.id,
      memoryId: fields.memory_id,
      permissions: fields.permissions,
      expiry: fields.expiry?.vec?.[0] ? BigInt(fields.expiry.vec[0]) : null,
      createdAt: BigInt(fields.created_at),
      issuedEpoch: BigInt(fields.issued_epoch)
    };
  }
  async getOwnedMemories(owner) {
    const objects = await this.client.getOwnedObjects({
      owner,
      filter: {
        StructType: `${this.packageId}::${MODULES.MEMORY}::MemoryObject`
      },
      options: { showContent: true }
    });
    return objects.data.filter((obj) => obj.data?.content?.dataType === "moveObject").map((obj) => {
      const fields = obj.data.content.fields;
      return {
        id: fields.id.id,
        owner: fields.owner,
        schemaType: fields.schema_type,
        data: new Uint8Array(fields.data),
        version: BigInt(fields.version),
        createdAt: BigInt(fields.created_at),
        capEpoch: BigInt(fields.cap_epoch)
      };
    });
  }
  async getOwnedCaps(owner) {
    const objects = await this.client.getOwnedObjects({
      owner,
      filter: {
        StructType: `${this.packageId}::${MODULES.MEMORY}::MemoryCap`
      },
      options: { showContent: true }
    });
    return objects.data.filter((obj) => obj.data?.content?.dataType === "moveObject").map((obj) => {
      const fields = obj.data.content.fields;
      return {
        id: fields.id.id,
        memoryId: fields.memory_id,
        permissions: fields.permissions,
        expiry: fields.expiry?.vec?.[0] ? BigInt(fields.expiry.vec[0]) : null,
        createdAt: BigInt(fields.created_at),
        issuedEpoch: BigInt(fields.issued_epoch)
      };
    });
  }
  // ============ Decode Functions ============
  decodeEpisodic(memory) {
    if (memory.schemaType !== SchemaType.EPISODIC) {
      throw new Error("Memory is not episodic");
    }
    return decodeEpisodicEntries(memory.data);
  }
  decodeSemantic(memory) {
    if (memory.schemaType !== SchemaType.SEMANTIC) {
      throw new Error("Memory is not semantic");
    }
    return decodeSemanticEntries(memory.data);
  }
  buildKVMap(memory) {
    const entries = this.decodeSemantic(memory);
    return buildKeyValueMap(entries);
  }
  // ============ Event Parsing ============
  parseEvents(response) {
    if (!response.events) return [];
    return response.events.filter((event) => event.type.startsWith(this.packageId)).map((event) => {
      const eventType = event.type.split("::").pop();
      return {
        type: eventType,
        data: event.parsedJson
      };
    });
  }
  // ============ Helpers ============
  hasPermission(cap, permission) {
    return (cap.permissions & permission) === permission;
  }
  isExpired(cap, currentTimeMs) {
    if (!cap.expiry) return false;
    const now = currentTimeMs ?? BigInt(Date.now());
    return now > cap.expiry;
  }
  isOwner(memory, address) {
    return memory.owner === address;
  }
};

// src/index.ts
var import_jsonRpc2 = require("@mysten/sui/jsonRpc");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CLOCK_ID,
  FUNCTIONS,
  MODULES,
  MantaClient,
  PACKAGE_IDS,
  Permissions,
  SchemaType,
  SuiJsonRpcClient,
  buildKeyValueMap,
  bytesToHex,
  bytesToString,
  decodeEpisodicEntries,
  decodeSemanticEntries,
  getLatestValue,
  hexToBytes,
  stringToBytes
});
