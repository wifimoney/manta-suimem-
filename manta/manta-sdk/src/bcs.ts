import type { EpisodicEntry, SemanticEntry } from './types';

/**
 * BCS decoder utilities for Manta memory data
 */

/**
 * Read a little-endian u32 from bytes
 */
function readU32LE(data: Uint8Array, offset: number): number {
  return (
    data[offset] |
    (data[offset + 1] << 8) |
    (data[offset + 2] << 16) |
    (data[offset + 3] << 24)
  ) >>> 0;
}

/**
 * Read a little-endian u64 from bytes as bigint
 */
function readU64LE(data: Uint8Array, offset: number): bigint {
  const low = BigInt(readU32LE(data, offset));
  const high = BigInt(readU32LE(data, offset + 4));
  return (high << 32n) | low;
}

/**
 * Read an address (32 bytes) and return as hex string
 */
function readAddress(data: Uint8Array, offset: number): string {
  const bytes = data.slice(offset, offset + 32);
  return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Decode episodic memory entries from raw data
 * 
 * Entry format:
 * [u32 entry_len][u64 timestamp][address actor][u32 payload_len][bytes payload]
 */
export function decodeEpisodicEntries(data: Uint8Array): EpisodicEntry[] {
  const entries: EpisodicEntry[] = [];
  let offset = 0;

  while (offset < data.length) {
    // Read entry length
    const entryLen = readU32LE(data, offset);
    offset += 4;

    // Read timestamp (u64)
    const timestamp = readU64LE(data, offset);
    offset += 8;

    // Read actor (address = 32 bytes)
    const actor = readAddress(data, offset);
    offset += 32;

    // Read payload length (u32)
    const payloadLen = readU32LE(data, offset);
    offset += 4;

    // Read payload
    const payload = data.slice(offset, offset + payloadLen);
    offset += payloadLen;

    entries.push({ timestamp, actor, payload });
  }

  return entries;
}

/**
 * Decode semantic memory entries from raw data
 * 
 * Entry format:
 * [u32 entry_len][u32 key_len][bytes key][u32 value_len][bytes value][u64 updated_at]
 */
export function decodeSemanticEntries(data: Uint8Array): SemanticEntry[] {
  const entries: SemanticEntry[] = [];
  let offset = 0;

  while (offset < data.length) {
    // Read entry length
    const entryLen = readU32LE(data, offset);
    offset += 4;

    // Read key length (u32)
    const keyLen = readU32LE(data, offset);
    offset += 4;

    // Read key
    const key = data.slice(offset, offset + keyLen);
    offset += keyLen;

    // Read value length (u32)
    const valueLen = readU32LE(data, offset);
    offset += 4;

    // Read value
    const value = data.slice(offset, offset + valueLen);
    offset += valueLen;

    // Read updated_at (u64)
    const updatedAt = readU64LE(data, offset);
    offset += 8;

    entries.push({ key, value, updatedAt });
  }

  return entries;
}

/**
 * Get the latest value for a key from semantic entries
 * (Last write wins)
 */
export function getLatestValue(entries: SemanticEntry[], key: Uint8Array): Uint8Array | null {
  let latest: SemanticEntry | null = null;

  for (const entry of entries) {
    if (arraysEqual(entry.key, key)) {
      if (!latest || entry.updatedAt > latest.updatedAt) {
        latest = entry;
      }
    }
  }

  return latest?.value ?? null;
}

/**
 * Build a key-value map from semantic entries
 * (Last write wins for each key)
 */
export function buildKeyValueMap(entries: SemanticEntry[]): Map<string, Uint8Array> {
  const map = new Map<string, { value: Uint8Array; updatedAt: bigint }>();

  for (const entry of entries) {
    const keyHex = bytesToHex(entry.key);
    const existing = map.get(keyHex);
    
    if (!existing || entry.updatedAt > existing.updatedAt) {
      map.set(keyHex, { value: entry.value, updatedAt: entry.updatedAt });
    }
  }

  return new Map(Array.from(map.entries()).map(([k, v]) => [k, v.value]));
}

/**
 * Helper: Compare two Uint8Arrays
 */
function arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Helper: Convert bytes to hex string
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Helper: Convert hex string to bytes
 */
export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Helper: Convert string to bytes (UTF-8)
 */
export function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/**
 * Helper: Convert bytes to string (UTF-8)
 */
export function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}
