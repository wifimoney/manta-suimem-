# @tide/sdk

TypeScript SDK for **Tide** - A Sui-native on-chain memory primitive.

## Installation
```bash
npm install @tide/sdk @mysten/sui
```

## Quick Start
```typescript
import { TideClient, Permissions } from '@tide/sdk';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

// Initialize client
const tide = new TideClient({ network: 'testnet' });

// Create a keypair (or use existing)
const keypair = new Ed25519Keypair();

// Create episodic memory
const createTx = tide.createEpisodicMemory();
const result = await tide.client.signAndExecuteTransaction({
  transaction: createTx,
  signer: keypair,
});

// Get the created memory object ID from events
const memoryId = '0x...'; // from result

// Append to memory
const appendTx = tide.append(memoryId, 'Hello, Tide!');
await tide.client.signAndExecuteTransaction({
  transaction: appendTx,
  signer: keypair,
});

// Read memory
const memory = await tide.getMemory(memoryId);
const entries = tide.decodeEpisodic(memory!);
console.log(entries);
```

## Features

### Create Memory
```typescript
// Private episodic (append-only log)
const tx1 = tide.createEpisodicMemory();

// Private semantic (key-value store)
const tx2 = tide.createSemanticMemory();

// Shared episodic (cap-gated)
const tx3 = tide.createSharedEpisodicMemory();

// Shared semantic (cap-gated)
const tx4 = tide.createSharedSemanticMemory();
```

### Write to Memory
```typescript
// Append to episodic (owner)
const tx1 = tide.append(memoryId, 'event data');

// Update semantic (owner)
const tx2 = tide.update(memoryId, 'key', 'value');

// Append with capability (shared memory)
const tx3 = tide.capAppend(memoryId, capId, 'event data');

// Update with capability (shared memory)
const tx4 = tide.capUpdate(memoryId, capId, 'key', 'value');
```

### Delegate Access
```typescript
// Delegate read-only
const tx1 = tide.delegateRead(memoryId, recipientAddress);

// Delegate append access
const tx2 = tide.delegateAppend(memoryId, recipientAddress);

// Delegate full access with expiry (1 hour)
const expiry = BigInt(Date.now() + 3600000);
const tx3 = tide.delegateFull(memoryId, recipientAddress, expiry);

// Custom permissions
const tx4 = tide.delegate(
  memoryId, 
  recipientAddress, 
  Permissions.READ | Permissions.APPEND
);

// Revoke access
const tx5 = tide.revoke(capId);
```

### Read Memory
```typescript
// Get memory object
const memory = await tide.getMemory(memoryId);

// Decode episodic entries
const entries = tide.decodeEpisodic(memory!);
for (const entry of entries) {
  console.log({
    timestamp: entry.timestamp,
    actor: entry.actor,
    payload: new TextDecoder().decode(entry.payload),
  });
}

// Decode semantic entries (build KV map)
const kvMap = tide.buildKVMap(memory!);
for (const [keyHex, value] of kvMap) {
  console.log(`${keyHex}: ${new TextDecoder().decode(value)}`);
}

// Get owned memories
const memories = await tide.getOwnedMemories(address);

// Get owned capabilities
const caps = await tide.getOwnedCaps(address);
```

### Check Capabilities
```typescript
const cap = await tide.getCap(capId);

// Check permissions
const canRead = tide.hasPermission(cap!, Permissions.READ);
const canAppend = tide.hasPermission(cap!, Permissions.APPEND);

// Check expiry
const expired = tide.isExpired(cap!);
```

## Networks

| Network | Package ID |
|---------|------------|
| Testnet | `0xbd9a427e3a8145364e7ffeeb5a317cbf9495e65830b1c1c4c242e6b31576101c` |
| Devnet | `0x759a1ecfbfe2c157430a9d6c3138e40b971d0fc4ee8e0e1f67e6a3873232c6c7` |

## License

Apache-2.0
