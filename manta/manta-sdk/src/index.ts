// Main client
export { MantaClient, type MantaClientConfig } from './client';

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
  MantaEvent,
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
