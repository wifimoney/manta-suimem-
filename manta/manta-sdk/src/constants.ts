/**
 * Manta Package IDs by network
 */
export const PACKAGE_IDS = {
  mainnet: '', // Not yet deployed
  testnet: '0xbd9a427e3a8145364e7ffeeb5a317cbf9495e65830b1c1c4c242e6b31576101c',
  devnet: '0x759a1ecfbfe2c157430a9d6c3138e40b971d0fc4ee8e0e1f67e6a3873232c6c7',
} as const;

/**
 * Sui Clock object ID (shared across all networks)
 */
export const CLOCK_ID = '0x6';

/**
 * Memory schema types
 */
export const SchemaType = {
  EPISODIC: 0,
  SEMANTIC: 1,
} as const;

/**
 * Permission flags for MemoryCap
 */
export const Permissions = {
  READ: 1,    // 0b001
  APPEND: 2,  // 0b010
  UPDATE: 4,  // 0b100
  READ_APPEND: 3,        // READ | APPEND
  READ_UPDATE: 5,        // READ | UPDATE
  FULL: 7,               // READ | APPEND | UPDATE
} as const;

/**
 * Module names
 */
export const MODULES = {
  MEMORY: 'memory',
  EVENTS: 'events',
} as const;

/**
 * Function names
 */
export const FUNCTIONS = {
  // Create
  CREATE_EPISODIC: 'create_episodic',
  CREATE_SEMANTIC: 'create_semantic',
  CREATE_SHARED_EPISODIC: 'create_shared_episodic',
  CREATE_SHARED_SEMANTIC: 'create_shared_semantic',
  // Write
  APPEND: 'append',
  UPDATE: 'update',
  CAP_APPEND: 'cap_append',
  CAP_UPDATE: 'cap_update',
  // Delegate
  DELEGATE: 'delegate',
  DELEGATE_READ: 'delegate_read',
  DELEGATE_APPEND: 'delegate_append',
  DELEGATE_UPDATE: 'delegate_update',
  DELEGATE_FULL: 'delegate_full',
  REVOKE: 'revoke',
  // Destroy
  DESTROY: 'destroy',
} as const;

export type Network = keyof typeof PACKAGE_IDS;
export type SchemaTypeValue = typeof SchemaType[keyof typeof SchemaType];
export type PermissionValue = typeof Permissions[keyof typeof Permissions];
