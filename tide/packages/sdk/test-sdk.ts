import { TideClient, Permissions, SchemaType } from './src';

const tide = new TideClient({ network: 'testnet' });

console.log('Package ID:', tide.packageId);
console.log('Network:', tide.network);

// Build a transaction
const tx = tide.createEpisodicMemory();
console.log('Transaction created:', tx);

console.log('✅ SDK working!');
