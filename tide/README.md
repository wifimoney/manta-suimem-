# 🌊 Tide

**Sui-native on-chain memory primitive**

Tide provides persistent, composable memory objects on Sui using native ownership semantics and capability-based access control. Designed to be consumed by agents, wallets, games, and applications.

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Sui](https://img.shields.io/badge/Sui-Testnet-blue)](https://sui.io)
[![Tests](https://img.shields.io/badge/tests-14%2F14%20passing-brightgreen)]()

---

## Overview

Tide answers: **"Where does long-term state live on Sui, and who controls it?"**
```
┌─────────────────────────────────────────────────────────┐
│                    MemoryObject                         │
│  ├── owner: address (controls delegation & writes)     │
│  ├── Episodic: append-only log (events, history)       │
│  └── Semantic: key-value store (facts, preferences)    │
└─────────────────────────────────────────────────────────┘
                          │
                    controlled by
                          │
┌─────────────────────────────────────────────────────────┐
│                     MemoryCap                           │
│  ├── Permissions: READ | APPEND | UPDATE                │
│  └── Expiry: optional time-limited access               │
└─────────────────────────────────────────────────────────┘
```

### Key Features

- **Secure Access Control** - Strict ownership checks; capabilities for delegated access
- **Two Memory Schemas** - Episodic (append-only logs) and Semantic (key-value stores)
- **Capability-based Delegation** - Time-bounded, permission-scoped access tokens
- **Shared Object Support** - Safe global memory with owner-controlled writes
- **Minimal On-chain Logic** - Data interpretation happens off-chain (BCS encoded)

---

## Installation

### Prerequisites

- [Sui CLI](https://docs.sui.io/guides/developer/getting-started/sui-install) (v1.45+)
- [Node.js](https://nodejs.org/) (v18+) for SDK

### Clone and Build
```bash
git clone https://github.com/anthropics/tide.git
cd tide
sui move build
```

## Development

This project is organized as a monorepo:
- `sources/`: Core Move smart contracts.
- `packages/sdk/`: TypeScript SDK.
- `packages/api/`: Backend API.
- `packages/indexer/`: Indexer service.

### Requirements
- [Sui CLI](https://docs.sui.io/guides/developer/getting-started/sui-install)
- [Bun](https://bun.sh/) (Runtime & Package Manager)
- [Docker](https://www.docker.com/) (for local services)

### Run Tests

#### Move Contract Tests
Run the Move test suite validation:
```bash
sui move test
```

#### SDK Tests
Run the TypeScript SDK tests (requires Bun):
```bash
cd packages/sdk
bun install
bun test
```
#### Root Convenience Scripts
If you are at the repository root, you can use these shortcuts:
- `bun run test`: Run SDK unit tests.
- `bun run test:e2e`: Run the full Testnet E2E suite.
- `bun run test:move`: Run Move contract tests.
- `bun run test:sdk`: Run SDK tests using Vitest directly.

---

## Deployed Packages

| Network | Package ID | Version |
|---------|------------|---------|
| **Testnet** | `0x61f59d91f6ac0c1a321a2682d7d70cab4bc0425ed1d8b417d2494f0bbc0d6be0` | V1.3 |
| Devnet | `0x759a1ecfbfe2c157430a9d6c3138e40b971d0fc4ee8e0e1f67e6a3873232c6c7` | V1.2 |
| Mainnet | Coming soon | - |

---

## Quick Start

### 1. Create a Memory Object
```bash
# Create private episodic memory (for logs/events)
sui client call \
  --package 0x61f59d91f6ac0c1a321a2682d7d70cab4bc0425ed1d8b417d2494f0bbc0d6be0 \
  --module memory \
  --function create_episodic \
  --args 0x6 \
  --gas-budget 10000000

# Create shared semantic memory (globally readable, owner/cap writable)
sui client call \
  --package 0x61f59d91f6ac0c1a321a2682d7d70cab4bc0425ed1d8b417d2494f0bbc0d6be0 \
  --module memory \
  --function create_shared_semantic \
  --args 0x6 \
  --gas-budget 10000000
```

### 2. Write to Memory (Owner Only)
```bash
# Append to episodic memory (payload is hex-encoded bytes)
sui client call \
  --package 0x61f59d91f6ac0c1a321a2682d7d70cab4bc0425ed1d8b417d2494f0bbc0d6be0 \
  --module memory \
  --function append \
  --args <MEMORY_OBJECT_ID> 0x68656c6c6f 0x6 \
  --gas-budget 10000000

# Update semantic memory
sui client call \
  --package 0x61f59d91f6ac0c1a321a2682d7d70cab4bc0425ed1d8b417d2494f0bbc0d6be0 \
  --module memory \
  --function update \
  --args <MEMORY_OBJECT_ID> 0x6b6579 0x76616c7565 0x6 \
  --gas-budget 10000000
```

### 3. Delegate Access (Owner Only)
```bash
# Delegate append access to another address
sui client call \
  --package 0x61f59d91f6ac0c1a321a2682d7d70cab4bc0425ed1d8b417d2494f0bbc0d6be0 \
  --module memory \
  --function delegate_append \
  --args <MEMORY_OBJECT_ID> <RECIPIENT_ADDRESS> "[]" 0x6 \
  --gas-budget 10000000
```

### 4. Use Delegated Access (Cap Holder)
```bash
# Write using a capability
sui client call \
  --package 0x61f59d91f6ac0c1a321a2682d7d70cab4bc0425ed1d8b417d2494f0bbc0d6be0 \
  --module memory \
  --function cap_append \
  --args <MEMORY_OBJECT_ID> <CAP_ID> 0x64656c6567617465645f6576656e74 0x6 \
  --gas-budget 10000000
```

---

## Architecture

### Memory Schemas

| Schema | Description | Operations | Use Cases |
|--------|-------------|------------|-----------|
| **Episodic** | Append-only ordered log | `append`, `cap_append` | Events, history, audit trails |
| **Semantic** | Mutable key-value store | `update`, `cap_update` | Facts, preferences, configuration |

### Security Model

All memory objects track an `owner` address for access control:

| Action | Who Can Do It |
|--------|---------------|
| **Direct Write** (`append`, `update`) | Owner only |
| **Cap Write** (`cap_append`, `cap_update`) | Valid capability holder |
| **Delegate** (`delegate_*`) | Owner only |
| **Destroy** | Owner only |
| **Transfer Ownership** | Owner only |

Even shared objects enforce owner-only writes. Non-owners must use capabilities.

### Semantics & Expectations (Read This)

The protocol enforces access control for **writes**, but **does not provide on-chain privacy**. Object state is readable via Sui RPC regardless of ownership. The `PERM_READ` capability is only required for on-chain reads via `cap_get_data`; it does not make data private off-chain.

Ownership vs sharing:
- **Owned** objects are not shared, but their contents are still publicly readable off-chain.
- **Shared** objects are globally addressable, but writes remain owner/cap-gated.
- **Shared objects are permanent in V1**: `destroy` only works for owned objects.

Delegation & revocation:
- Capabilities are **transferable objects**; recipients can re-transfer them.
- `revoke` destroys the specific cap **only if you hold it**. Any cap holder can revoke their own access.
- **Critical**: Owners generally cannot revoke a specific delegated cap because they don't hold it. They must use `revoke_all_caps` as the emergency lever to invalidate **all** outstanding caps (by bumping `cap_epoch`).
- `transfer_ownership` **does** invalidate existing caps by bumping `cap_epoch`; prior caps become unusable immediately.
- **Warning for Shared Objects**: `transfer_ownership` on a shared object is **permanent**. The new owner gains full write control and the previous owner cannot reclaim it unless the new owner transfers it back.
- `delegate` can mint any nonzero permission bitmask (including write-only caps that omit READ). The convenience helpers (`delegate_append`, `delegate_update`) always include READ.

Permanence, mutability, and versioning:
- **Episodic** data is append-only. **Semantic** updates also append new entries; old values remain in history (last-write-wins is off-chain).
- `version` increments on every append/update; it is not a schema version.
- Storage is **bounded** (per-entry and total size limits); memory objects are not unboundedly permanent.

---

## API Reference

### Module: `tide::memory`

#### Structs
```move
public struct MemoryObject has key, store {
    id: UID,
    owner: address,       // Controls writes & delegation
    schema_type: u8,      // 0 = episodic, 1 = semantic
    data: vector<u8>,     // BCS-encoded entries
    version: u64,
    created_at: u64,
}

public struct MemoryCap has key, store {
    id: UID,
    memory_id: ID,
    permissions: u8,      // Bitmask: READ=1, APPEND=2, UPDATE=4
    expiry: Option<u64>,  // Optional expiry timestamp (ms)
    created_at: u64,
}
```

#### Functions

| Function | Description | Access |
|----------|-------------|--------|
| `create_episodic` | Create private episodic memory | Public |
| `create_semantic` | Create private semantic memory | Public |
| `create_shared_episodic` | Create shared episodic memory | Public |
| `create_shared_semantic` | Create shared semantic memory | Public |
| `append` | Append to episodic memory | Owner only |
| `update` | Update semantic memory | Owner only |
| `cap_append` | Append using capability | Cap holder |
| `cap_update` | Update using capability | Cap holder |
| `delegate` | Create custom capability | Owner only |
| `delegate_read` | Create read-only capability | Owner only |
| `delegate_append` | Create append capability | Owner only |
| `delegate_update` | Create update capability | Owner only |
| `delegate_full` | Create full-access capability | Owner only |
| `revoke` | Destroy a capability | Cap holder |
| `destroy` | Delete memory object | Owner only |
| `transfer_ownership` | Transfer owner to new address | Owner only |

#### Events

| Event | Emitted When |
|-------|--------------|
| `MemoryCreated` | Memory object created |
| `EpisodicAppend` | Entry appended to episodic memory |
| `SemanticUpdate` | Key-value updated in semantic memory |
| `CapabilityDelegated` | New capability minted |
| `CapabilityUsed` | Capability used for write |
| `CapabilityRevoked` | Capability destroyed |
| `MemoryDestroyed` | Memory object deleted |

---

## TypeScript SDK

The Tide SDK provides a high-level wrapper for interacting with Tide memory objects.

### Installation

Inside the monorepo:
```bash
cd packages/sdk
bun install
bun run build
```

To use it in your own project within this monorepo, add it as a workspace dependency:
```json
"dependencies": {
  "tide-sui-sdk": "workspace:*"
}
```

### Basic Usage

#### 1. Initialize the Client
```typescript
import { TideClient } from 'tide-sui-sdk';
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';

const client = new SuiJsonRpcClient({
    network: 'testnet',
    url: getJsonRpcFullnodeUrl('testnet')
});

const tide = new TideClient({ 
    network: 'testnet', 
    client 
});
```

#### 2. Create and Write to Memory
```typescript
// Create an episodic memory (append-only)
const tx = tide.createEpisodicMemory();
// ... sign and execute tx ...

// Generate an append transaction
const appendTx = tide.append(memoryId, "Your data here or Uint8Array");
// ... sign and execute appendTx ...
```

#### 3. Read and Decode Memory
```typescript
// Fetch the memory object
const memory = await tide.getMemory(memoryId);

if (memory) {
    // Decode episodic entries (auto-parses BCS)
    const entries = tide.decodeEpisodic(memory);
    entries.forEach(entry => {
        console.log(`[${entry.timestamp}] Actor: ${entry.actor} Payload:`, entry.payload);
    });
}
```

#### 4. Capability Delegation
```typescript
// Delegate APPEND rights to another user
const delegateTx = tide.delegateAppend(memoryId, RECIPIENT_ADDRESS);
// ... sign and execute ...
```

### End-to-End Reference
For a complete working example including wallet generation and permission checks, see:
`packages/sdk/e2e_test.ts`

---

## Security

### V1.3 Security Fixes

- ✅ **Owner field** - All memory objects track owner address
- ✅ **Owner checks** - `append`, `update`, `delegate*`, `destroy` require owner
- ✅ **Shared object safety** - Non-owners cannot write directly
- ✅ **Capability validation** - Permission + expiry checks enforced
- ✅ **BCS bounds checking** - SDK validates buffer lengths

### Vulnerability Disclosure

Please report security issues privately. Do not open public issues.

---

## Roadmap

- [x] Core memory module (episodic + semantic)
- [x] Capability system with delegation
- [x] Shared memory support
- [x] Security audit & access control hardening (V1.3)
- [x] TypeScript SDK with bounds checking
- [x] Testnet deployment
- [x] Devnet V1.3 deployment
- [x] External security audit
- [x] Mainnet deployment

---

## License

Apache 2.0
