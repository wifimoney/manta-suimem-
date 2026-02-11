// Main client
export { TideClient, type TideClientConfig } from './client';

// Re-export Sui client for convenience
export { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';

// Constants
export {
  PACKAGE_IDS,
  CLOCK_ID,
  SchemaType,
  Permissions,
  MODULES,
  FUNCTIONS,
  type Network,
  type SchemaTypeValue,
  type PermissionValue,
} from './constants';

// Types
export type {
  MemoryObject,
  MemoryCap,
  EpisodicEntry,
  SemanticEntry,
  TideEvent,
  MemoryCreatedEvent,
  EpisodicAppendEvent,
  SemanticUpdateEvent,
  CapabilityDelegatedEvent,
  CapabilityRevokedEvent,
  CapabilityUsedEvent,
  MemoryDestroyedEvent,
} from './types';

// BCS utilities
export {
  decodeEpisodicEntries,
  decodeSemanticEntries,
  buildKeyValueMap,
  getLatestValue,
  bytesToHex,
  hexToBytes,
  stringToBytes,
  bytesToString,
} from './bcs';
