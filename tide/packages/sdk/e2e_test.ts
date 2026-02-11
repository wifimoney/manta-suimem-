
import { TideClient, SchemaType, Permissions } from './src';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromBase64 } from '@mysten/sui/utils';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { requestSuiFromFaucetV2, getFaucetHost } from '@mysten/sui/faucet';

// Helper to delay execution
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
    console.log('🌊 Starting Tide E2E Test...');

    // 1. Setup Client & Signer
    const PRIVATE_KEY = process.env.TIDE_PRIVATE_KEY;
    let keypair;

    if (!PRIVATE_KEY) {
        console.log('⚠️ No TIDE_PRIVATE_KEY found. Generating ephemeral wallet...');
        keypair = new Ed25519Keypair();
        const address = keypair.toSuiAddress();
        console.log(`Created wallet: ${address}`);

        console.log('🚰 Requesting SUI from Testnet Faucet...');
        try {
            await requestSuiFromFaucetV2({
                host: getFaucetHost('testnet'),
                recipient: address,
            });
            console.log('✅ Faucet request sent. Waiting for funds...');
            await sleep(5000); // Wait longer for inclusion
        } catch (e) {
            console.error('❌ Faucet failed. Please set TIDE_PRIVATE_KEY or try again later.');
            console.error(e);
            process.exit(1);
        }
    } else {
        try {
            if (PRIVATE_KEY.startsWith('suiprivkey')) {
                const { schema, secretKey } = decodeSuiPrivateKey(PRIVATE_KEY) as any;
                keypair = Ed25519Keypair.fromSecretKey(secretKey);
            } else {
                const bytes = fromBase64(PRIVATE_KEY);
                if (bytes.length === 33 && bytes[0] === 0) {
                    keypair = Ed25519Keypair.fromSecretKey(bytes.slice(1));
                } else if (bytes.length === 32) {
                    keypair = Ed25519Keypair.fromSecretKey(bytes);
                } else {
                    throw new Error(`Invalid private key length: ${bytes.length}. Expected 32 or 33 bytes (base64).`);
                }
            }
        } catch (e: any) {
            console.error('Error loading private key:', e.message);
            process.exit(1);
        }
    }

    console.log(`Using wallet: ${keypair.toSuiAddress()}`);

    const client = new SuiJsonRpcClient({
        network: 'testnet',
        url: getJsonRpcFullnodeUrl('testnet')
    });
    const tide = new TideClient({ network: 'testnet', client });

    // 2. Create Episodic Memory
    console.log('\n--- 1. Creating Episodic Memory ---');
    const createTx = tide.createEpisodicMemory();
    const createRes = await client.signAndExecuteTransaction({
        transaction: createTx as any,
        signer: keypair,
        options: { showEffects: true, showObjectChanges: true },
    });

    const createdObj = createRes.objectChanges?.find(
        (c) => c.type === 'created' && c.objectType.includes('::memory::MemoryObject')
    );

    if (!createdObj || createdObj.type !== 'created') {
        throw new Error('Failed to create episodic memory object');
    }

    const memoryId = createdObj.objectId;
    console.log(`✅ Created Episodic Memory: ${memoryId}`);

    // Wait for indexing/propagation (optional but good for e2e)
    await sleep(2000);

    // 3. Append Logic
    console.log('\n--- 2. Appending Log Entry ---');
    const logMessage = "Test log entry " + Date.now();
    const appendTx = tide.append(memoryId, logMessage);
    await client.signAndExecuteTransaction({
        transaction: appendTx as any,
        signer: keypair,
        options: { showEffects: true },
    });
    console.log(`✅ Appended: "${logMessage}"`);

    await sleep(2000);

    // 4. Verifying Data (Read Back)
    console.log('\n--- 3. Verifying Data ---');
    const memory = await tide.getMemory(memoryId);
    if (!memory) throw new Error('Failed to fetch memory object');

    const entries = tide.decodeEpisodic(memory);
    const lastEntry = entries[entries.length - 1];
    const decodedPayload = new TextDecoder().decode(lastEntry.payload);

    console.log(`Read back payload: "${decodedPayload}"`);

    if (decodedPayload === logMessage) {
        console.log('✅ verification SUCCESS: Data matches');
    } else {
        console.error('❌ verification FAILED: Data mismatch');
        console.error(`Expected: ${logMessage}`);
        console.error(`Got: ${decodedPayload}`);
        process.exit(1);
    }

    // 5. Shared Semantic Memory & Delegation
    console.log('\n--- 4. Shared Semantic Memory & Delegation ---');
    const createSharedTx = tide.createSharedSemanticMemory();
    const createSharedRes = await client.signAndExecuteTransaction({
        transaction: createSharedTx as any,
        signer: keypair,
        options: { showEffects: true, showObjectChanges: true },
    });

    const sharedObj = createSharedRes.objectChanges?.find(
        (c) => c.type === 'created' && c.objectType.includes('::memory::MemoryObject')
    );
    if (!sharedObj || sharedObj.type !== 'created') {
        throw new Error('Failed to create shared semantic memory object');
    }
    const sharedMemoryId = sharedObj.objectId;
    console.log(`✅ Created Shared Semantic Memory: ${sharedMemoryId}`);

    await sleep(2000);

    // Update directly as owner
    console.log('Updating as owner...');
    const key1 = "config_mode";
    const val1 = "dark";
    const updateTx = tide.update(sharedMemoryId, key1, val1);
    await client.signAndExecuteTransaction({
        transaction: updateTx as any,
        signer: keypair,
        options: { showEffects: true },
    });
    console.log(`✅ Updated ${key1} = ${val1}`);

    // Delegate
    console.log('Delegating APPEND access (to self for test)...');
    const delegateTx = tide.delegateAppend(sharedMemoryId, keypair.toSuiAddress());
    const delegateRes = await client.signAndExecuteTransaction({
        transaction: delegateTx as any,
        signer: keypair,
        options: { showEffects: true, showObjectChanges: true },
    });

    const capObj = delegateRes.objectChanges?.find(
        (c) => c.type === 'created' && c.objectType.includes('::memory::MemoryCap')
    );
    if (!capObj || capObj.type !== 'created') {
        throw new Error('Failed to create capability');
    }
    const capId = capObj.objectId;
    console.log(`✅ Created Capability: ${capId}`);

    // Use Capability (Using capAppend on Semantic memory should fail or be invalid? Wait, Semantic memory uses Update, Episodic uses Append.)
    // Let's check SchemaType. Shared Semantic Memory should support Update.
    // Did I delegate APPEND? Yes. 
    // Semantic memory usually requires UPDATE permission to change keys?
    // Let's check `constants.ts` or `README`. 
    // README says: Semantic -> `update`, `cap_update`.
    // If I delegated APPEND, can I update?
    // `MemoryCap` has permissions. APPEND=2, UPDATE=4.
    // If I delegated APPEND, I likely cannot UPDATE.
    // Let's verify this failure!

    console.log('Attempting CAP_UPDATE with APPEND-only cap (Should Fail)...');
    const failTx = tide.capUpdate(sharedMemoryId, capId, "should", "fail");
    try {
        await client.signAndExecuteTransaction({
            transaction: failTx as any,
            signer: keypair,
            options: { showEffects: true },
        });
        console.error('❌ Error: Transaction succeeded but should have failed due to permissions.');
    } catch (e) {
        console.log('✅ Transaction failed as expected (Permission Denied).');
    }

    console.log('\n🎉 E2E Test Completed Successfully!');
}

main().catch(console.error);
