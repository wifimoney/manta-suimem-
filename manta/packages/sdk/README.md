# @manta/sdk

TypeScript SDK for **Manta** - A Sui-native on-chain memory primitive.

## Installation
```bash
npm install @manta/sdk @mysten/sui
```

## Quick Start
```typescript
import { MantaClient, Permissions } from '@manta/sdk';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

// Initialize client
const manta = new MantaClient({ network: 'testnet' });

// Create a keypair (or use existing)
const keypair = new Ed25519Keypair();

// Create episodic memory
const createTx = manta.createEpisodicMemory();
const result = await manta.client.signAndExecuteTransaction({
  transaction: createTx,
  signer: keypair,
});

// Get the created memory object ID from events
const memoryId = '0x...'; // from result

// Append to memory
const appendTx = manta.append(memoryId, 'Hello, Manta!');
await manta.client.signAndExecuteTransaction({
  transaction: appendTx,
  signer: keypair,
});

// Read memory
const memory = await manta.getMemory(memoryId);
const entries = manta.decodeEpisodic(memory!);
console.log(entries);
```

## Features

### Create Memory
```typescript
// Private episodic (append-only log)
const tx1 = manta.createEpisodicMemory();

// Private semantic (key-value store)
const tx2 = manta.createSemanticMemory();

// Shared episodic (cap-gated)
const tx3 = manta.createSharedEpisodicMemory();

// Shared semantic (cap-gated)
const tx4 = manta.createSharedSemanticMemory();
```

### Write to Memory
```typescript
// Append to episodic (owner)
const tx1 = manta.append(memoryId, 'event data');

// Update semantic (owner)
const tx2 = manta.update(memoryId, 'key', 'value');

// Append with capability (shared memory)
const tx3 = manta.capAppend(memoryId, capId, 'event data');

// Update with capability (shared memory)
const tx4 = manta.capUpdate(memoryId, capId, 'key', 'value');
```

### Delegate Access
```typescript
// Delegate read-only
const tx1 = manta.delegateRead(memoryId, recipientAddress);

// Delegate append access
const tx2 = manta.delegateAppend(memoryId, recipientAddress);

// Delegate full access with expiry (1 hour)
const expiry = BigInt(Date.now() + 3600000);
const tx3 = manta.delegateFull(memoryId, recipientAddress, expiry);

// Custom permissions
const tx4 = manta.delegate(
  memoryId, 
  recipientAddress, 
  Permissions.READ | Permissions.APPEND
);

// Revoke access
const tx5 = manta.revoke(capId);
```

### Read Memory
```typescript
// Get memory object
const memory = await manta.getMemory(memoryId);

// Decode episodic entries
const entries = manta.decodeEpisodic(memory!);
for (const entry of entries) {
  console.log({
    timestamp: entry.timestamp,
    actor: entry.actor,
    payload: new TextDecoder().decode(entry.payload),
  });
}

// Decode semantic entries (build KV map)
const kvMap = manta.buildKVMap(memory!);
for (const [keyHex, value] of kvMap) {
  console.log(`${keyHex}: ${new TextDecoder().decode(value)}`);
}

// Get owned memories
const memories = await manta.getOwnedMemories(address);

// Get owned capabilities
const caps = await manta.getOwnedCaps(address);
```

### Check Capabilities
```typescript
const cap = await manta.getCap(capId);

// Check permissions
const canRead = manta.hasPermission(cap!, Permissions.READ);
const canAppend = manta.hasPermission(cap!, Permissions.APPEND);

// Check expiry
const expired = manta.isExpired(cap!);
```

## Networks

| Network | Package ID |
|---------|------------|
| Testnet | `0xbd9a427e3a8145364e7ffeeb5a317cbf9495e65830b1c1c4c242e6b31576101c` |
| Devnet | `0x759a1ecfbfe2c157430a9d6c3138e40b971d0fc4ee8e0e1f67e6a3873232c6c7` |

## License

Apache-2.0
