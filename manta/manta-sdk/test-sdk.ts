import { MantaClient, Permissions, SchemaType } from './src';

const manta = new MantaClient({ network: 'testnet' });

console.log('Package ID:', manta.packageId);
console.log('Network:', manta.network);

// Build a transaction
const tx = manta.createEpisodicMemory();
console.log('Transaction created:', tx);

console.log('✅ SDK working!');
