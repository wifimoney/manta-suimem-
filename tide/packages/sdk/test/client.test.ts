import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TideClient } from '../src/client';
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';

// Mock SuiJsonRpcClient
vi.mock('@mysten/sui/jsonRpc', () => {
    return {
        SuiJsonRpcClient: vi.fn(),
        SuiTransactionBlockResponse: vi.fn(),
        getJsonRpcFullnodeUrl: vi.fn(() => 'https://fullnode.testnet.sui.io'),
    };
});

describe('TideClient', () => {
    let client: TideClient;
    let mockSuiClient: any;

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();

        mockSuiClient = {
            getObject: vi.fn(),
            getOwnedObjects: vi.fn(),
        };

        // Instantiate client with mocked SuiClient
        client = new TideClient({
            network: 'testnet',
            client: mockSuiClient,
        });
    });

    it('should be instantiated correctly', () => {
        expect(client).toBeDefined();
        expect(client.network).toBe('testnet');
    });

    it('should parse MemoryObject with capEpoch', async () => {
        const mockResponse = {
            data: {
                content: {
                    dataType: 'moveObject',
                    fields: {
                        id: { id: '0x123' },
                        owner: '0xOwner',
                        schema_type: 0,
                        data: [],
                        version: '1',
                        created_at: '1000',
                        cap_epoch: '0',
                    },
                },
            },
        };

        mockSuiClient.getObject.mockResolvedValue(mockResponse);

        const memory = await client.getMemory('0x123');
        expect(memory).toBeDefined();
        expect(memory?.id).toBe('0x123');
        expect(memory?.capEpoch).toBe(0n);
    });

    it('should parse MemoryCap with issuedEpoch', async () => {
        const mockResponse = {
            data: {
                content: {
                    dataType: 'moveObject',
                    fields: {
                        id: { id: '0xCap' },
                        memory_id: '0x123',
                        permissions: 1,
                        expiry: { vec: [] },
                        created_at: '2000',
                        issued_epoch: '0',
                    },
                },
            },
        };

        mockSuiClient.getObject.mockResolvedValue(mockResponse);

        const cap = await client.getCap('0xCap');
        expect(cap).toBeDefined();
        expect(cap?.id).toBe('0xCap');
        expect(cap?.issuedEpoch).toBe(0n);
    });

    it('should create revokeAllCaps transaction', () => {
        const tx = client.revokeAllCaps('0x123');
        expect(tx).toBeDefined();
        // In a real unit test we might inspect the transaction block data, 
        // but here we just ensure it builds without error.
    });
});
