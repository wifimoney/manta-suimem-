# 🌊 Manta

**Sui-native on-chain memory primitive**

Manta provides persistent, composable memory objects on Sui using native ownership semantics and capability-based access control. Designed to be consumed by agents, wallets, games, and applications.

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Sui](https://img.shields.io/badge/Sui-Devnet-blue)](https://sui.io)
[![Tests](https://img.shields.io/badge/tests-11%2F11%20passing-brightgreen)]()

---

## Overview

Manta answers: **"Where does long-term state live on Sui, and who controls it?"**

```
┌─────────────────────────────────────────────────────────┐
│                     MemoryObject                        │
│  ├── Episodic: append-only log (events, history)       │
│  └── Semantic: key-value store (facts, preferences)    │
└─────────────────────────────────────────────────────────┘
                           │
                     controlled by
                           │
┌─────────────────────────────────────────────────────────┐
│                      MemoryCap                          │
│  ├── Permissions: READ | APPEND | UPDATE               │
│  └── Expiry: optional time-limited access              │
└─────────────────────────────────────────────────────────┘
```

### Key Features

- **First-class Sui objects** - Memory is owned, transferred, and shared like any Sui object
- **Two memory schemas** - Episodic (append-only logs) and Semantic (key-value stores)
- **Capability-based access** - Delegate read/write access with optional expiry
- **Three memory modes** - Private, shared, and delegated
- **Minimal on-chain logic** - Data interpretation happens off-chain

---

## Installation

### Prerequisites

- [Sui CLI](https://docs.sui.io/guides/developer/getting-started/sui-install) (v1.45+)

### Clone and Build

```bash
git clone https://github.com/YOUR_USERNAME/manta.git
cd manta
sui move build
```

### Run Tests

```bash
sui move test
```

---

## Deployed Packages

| Network | Package ID |
|---------|------------|
| Devnet | `0xeffab5fc45c38896e681cb9108d3ec9eb0bd8e2617d35cb36d2c5bf905b10c65` |
| Testnet | Coming soon |
| Mainnet | Coming soon |

---

## Quick Start

### 1. Create a Memory Object

```bash
# Create private episodic memory (for logs/events)
sui client call \
  --package 0xeffab5fc45c38896e681cb9108d3ec9eb0bd8e2617d35cb36d2c5bf905b10c65 \
  --module memory \
  --function create_episodic \
  --args 0x6 \
  --gas-budget 10000000

# Create private semantic memory (for key-value state)
sui client call \
  --package 0xeffab5fc45c38896e681cb9108d3ec9eb0bd8e2617d35cb36d2c5bf905b10c65 \
  --module memory \
  --function create_semantic \
  --args 0x6 \
  --gas-budget 10000000
```

### 2. Write to Memory

```bash
# Append to episodic memory
# Payload is hex-encoded bytes (e.g., "hello" = 0x68656c6c6f)
sui client call \
  --package 0xeffab5fc45c38896e681cb9108d3ec9eb0bd8e2617d35cb36d2c5bf905b10c65 \
  --module memory \
  --function append \
  --args <MEMORY_OBJECT_ID> 0x68656c6c6f 0x6 \
  --gas-budget 10000000

# Update semantic memory
# Key and value are hex-encoded bytes
sui client call \
  --package 0xeffab5fc45c38896e681cb9108d3ec9eb0bd8e2617d35cb36d2c5bf905b10c65 \
  --module memory \
  --function update \
  --args <MEMORY_OBJECT_ID> 0x6e616d65 0x6d616e7461 0x6 \
  --gas-budget 10000000
```

### 3. Delegate Access

```bash
# Delegate append access to another address
sui client call \
  --package 0xeffab5fc45c38896e681cb9108d3ec9eb0bd8e2617d35cb36d2c5bf905b10c65 \
  --module cap \
  --function delegate_append \
  --args <MEMORY_OBJECT_ID> <RECIPIENT_ADDRESS> "[]" 0x6 \
  --gas-budget 10000000
```

### 4. Use Delegated Access

```bash
# Write using a capability (as delegate)
sui client call \
  --package 0xeffab5fc45c38896e681cb9108d3ec9eb0bd8e2617d35cb36d2c5bf905b10c65 \
  --module cap \
  --function cap_append \
  --args <MEMORY_OBJECT_ID> <CAP_ID> 0x64656c6567617465645f6576656e74 0x6 \
  --gas-budget 10000000
```

---

## Architecture

### Memory Schemas

| Schema | Description | Operations | Use Cases |
|--------|-------------|------------|-----------|
| **Episodic** | Append-only ordered log | `append` | Events, history, audit trails |
| **Semantic** | Mutable key-value store | `update` | Facts, preferences, configuration |

### Memory Modes

| Mode | Ownership | Access Control | Use Cases |
|------|-----------|----------------|-----------|
| **Private** | Owned object | Owner only | Agent memory, wallet state |
| **Shared** | Shared object | Cap-gated writes | DAOs, multiplayer games |
| **Delegated** | Owned + MemoryCaps | Cap holders | Temporary access, agents |

### Capability Permissions

| Permission | Value | Description |
|------------|-------|-------------|
| `READ` | 1 | Read memory data |
| `APPEND` | 2 | Append to episodic memory |
| `UPDATE` | 4 | Update semantic memory |

Permissions can be combined: `READ | APPEND` = 3

---

## API Reference

### Module: `manta::memory`

#### Structs

```move
public struct MemoryObject has key, store {
    id: UID,
    schema_type: u8,      // 0 = episodic, 1 = semantic
    data: vector<u8>,     // BCS-encoded entries
    version: u64,         // Increments on each write
    created_at: u64,      // Timestamp in ms
}
```

#### Functions

| Function | Description |
|----------|-------------|
| `create_episodic_memory(clock, ctx)` | Create owned episodic memory |
| `create_semantic_memory(clock, ctx)` | Create owned semantic memory |
| `create_episodic(clock, ctx)` | Entry: create and transfer to sender |
| `create_semantic(clock, ctx)` | Entry: create and transfer to sender |
| `create_shared_episodic(clock, ctx)` | Entry: create shared episodic |
| `create_shared_semantic(clock, ctx)` | Entry: create shared semantic |
| `append_memory(memory, payload, clock, ctx)` | Append to episodic memory |
| `update_memory(memory, key, value, clock, ctx)` | Update semantic memory |
| `read_data(memory)` | Get raw data bytes |
| `get_version(memory)` | Get current version |
| `is_episodic(memory)` | Check if episodic schema |
| `is_semantic(memory)` | Check if semantic schema |
| `destroy(memory)` | Delete memory object |

### Module: `manta::cap`

#### Structs

```move
public struct MemoryCap has key, store {
    id: UID,
    memory_id: ID,        // Target memory object
    permissions: u8,      // Bitmask: READ=1, APPEND=2, UPDATE=4
    expiry: Option<u64>,  // Optional expiry timestamp (ms)
    created_at: u64,
}
```

#### Functions

| Function | Description |
|----------|-------------|
| `delegate_access(memory, permissions, expiry, clock, ctx)` | Create capability |
| `delegate_read(memory, recipient, expiry, clock, ctx)` | Entry: delegate read |
| `delegate_append(memory, recipient, expiry, clock, ctx)` | Entry: delegate read+append |
| `delegate_update(memory, recipient, expiry, clock, ctx)` | Entry: delegate read+update |
| `delegate_full(memory, recipient, expiry, clock, ctx)` | Entry: delegate all permissions |
| `revoke_access(cap)` | Destroy capability |
| `validate_cap(cap, memory, permission, clock)` | Check cap validity |
| `append_with_cap(memory, cap, payload, clock, ctx)` | Append using capability |
| `update_with_cap(memory, cap, key, value, clock, ctx)` | Update using capability |
| `has_read(cap)` | Check read permission |
| `has_append(cap)` | Check append permission |
| `has_update(cap)` | Check update permission |

---

## Data Format

### Episodic Entry (BCS-encoded)

```move
struct EpisodicEntry {
    timestamp: u64,       // When the event occurred
    actor: address,       // Who triggered the event
    payload: vector<u8>,  // Event data
}
```

### Semantic Entry (BCS-encoded)

```move
struct SemanticEntry {
    key: vector<u8>,      // Lookup key
    value: vector<u8>,    // Stored value
    updated_at: u64,      // Last update timestamp
}
```

### Storage Format

Entries are stored as length-prefixed BCS bytes:

```
[u32 length][entry bytes][u32 length][entry bytes]...
```

For semantic memory, the latest entry for each key takes precedence (parsed off-chain).

---

## Examples

### Agent Memory

```move
// Agent creates private memory for its state
let memory = memory::create_semantic_memory(&clock, ctx);

// Store agent preferences
memory::update_memory(&mut memory, b"personality", b"helpful", &clock, ctx);
memory::update_memory(&mut memory, b"language", b"english", &clock, ctx);
```

### DAO Shared Memory

```move
// DAO creates shared memory for proposals
memory::create_shared_episodic(&clock, ctx);

// Members with caps can append proposals
cap::append_with_cap(&mut memory, &member_cap, proposal_bytes, &clock, ctx);
```

### Time-Limited Access

```move
// Grant 24-hour access to a service
let expiry = clock::timestamp_ms(&clock) + 86400000; // 24 hours
let cap = cap::delegate_access(&memory, 3, option::some(expiry), &clock, ctx);
transfer::transfer(cap, service_address);
```

---

## Design Principles

1. **Memory is a first-class Sui object** - Ownership and mutability enforced by the VM
2. **Access control uses capabilities** - Not ACL lists; caps are transferable objects
3. **Schemas are explicit but lightweight** - Two schemas cover most use cases
4. **On-chain logic is minimal** - Data interpretation happens off-chain
5. **Avoid over-engineering** - V1 ships with exactly what's needed

---

## Roadmap

- [x] Core memory module (episodic + semantic)
- [x] Capability system with delegation
- [x] Shared memory support
- [x] Unit tests (11/11 passing)
- [x] Devnet deployment
- [ ] Event emissions for indexers
- [ ] Testnet deployment
- [ ] TypeScript SDK
- [ ] Security audit
- [ ] Mainnet deployment

---

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

1. Fork the repository
2. Create a feature branch
3. Run tests: `sui move test`
4. Submit a pull request

---

## License

Apache 2.0 - see [LICENSE](LICENSE) for details.

---

## Links

- [Sui Documentation](https://docs.sui.io)
- [Move Book](https://move-book.com)
- [Package on SuiScan (Devnet)](https://suiscan.xyz/devnet/object/0xeffab5fc45c38896e681cb9108d3ec9eb0bd8e2617d35cb36d2c5bf905b10c65)

---

Built with 🌊 on Sui