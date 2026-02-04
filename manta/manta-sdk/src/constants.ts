export const PACKAGE_IDS = {
  mainnet: '',
  testnet: '0x61f59d91f6ac0c1a321a2682d7d70cab4bc0425ed1d8b417d2494f0bbc0d6be0',
  devnet: '0x38c55662dfe0ff2cd0e346da0bf20916afa26bb65fe86239a687b47826643e0d',
} as const;

export const CLOCK_ID = '0x6';

export const SchemaType = {
  EPISODIC: 0,
  SEMANTIC: 1,
} as const;

export const Permissions = {
  READ: 1,
  APPEND: 2,
  UPDATE: 4,
  READ_APPEND: 3,
  READ_UPDATE: 5,
  FULL: 7,
} as const;

export const MODULES = {
  MEMORY: 'memory',
} as const;

export const FUNCTIONS = {
  CREATE_EPISODIC: 'create_episodic',
  CREATE_SEMANTIC: 'create_semantic',
  CREATE_SHARED_EPISODIC: 'create_shared_episodic',
  CREATE_SHARED_SEMANTIC: 'create_shared_semantic',
  APPEND: 'append',
  UPDATE: 'update',
  CAP_APPEND: 'cap_append',
  CAP_UPDATE: 'cap_update',
  DELEGATE: 'delegate',
  DELEGATE_READ: 'delegate_read',
  DELEGATE_APPEND: 'delegate_append',
  DELEGATE_UPDATE: 'delegate_update',
  DELEGATE_FULL: 'delegate_full',
  REVOKE: 'revoke',
  REVOKE_ALL_CAPS: 'revoke_all_caps',
  DESTROY: 'destroy',
  TRANSFER_OWNERSHIP: 'transfer_ownership',
} as const;

export type Network = keyof typeof PACKAGE_IDS;
export type SchemaTypeValue = (typeof SchemaType)[keyof typeof SchemaType];
export type PermissionValue = (typeof Permissions)[keyof typeof Permissions];
