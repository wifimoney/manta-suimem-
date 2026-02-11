export const PACKAGE_IDS = {
  mainnet: '0x212b3966f9235171499e0e6c1f276fb6d815ff366e29b95a270a9288e5fff508',
  testnet: '0xd6a19fc6db4c7ad58e5b453b2b208053caab7c3681b473f2e6261bd79dd964f6',
  devnet: '0x38c55662dfe0ff2cd0e346da0bf20916afa26bb65fe86239a687b47826643e0d',
} as const;

export const REGISTRY_IDS = {
  testnet: {
    vault: '0xcd9ae4228a53425b2491d43c031109dd4b5caf8f7ef51255ef8679b4bc5f5a27',
    extended: '0xf06dd79f8f1a83c39c9aa9dfb5c0427115f5841da351c9f6e4e98cc30e2347ca',
  }
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
  VAULT: 'vault',
  EXTENDED: 'extended',
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
  REGISTER_MEMORY: 'register_memory',
  DEREGISTER_MEMORY: 'deregister_memory',
  ATTACH_BLOB: 'attach_blob',
  DETACH_BLOB: 'detach_blob',
} as const;

export type Network = keyof typeof PACKAGE_IDS;
export type SchemaTypeValue = (typeof SchemaType)[keyof typeof SchemaType];
export type PermissionValue = (typeof Permissions)[keyof typeof Permissions];
