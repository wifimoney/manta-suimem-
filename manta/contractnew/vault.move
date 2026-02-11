module manta::vault {
    use sui::table::{Self, Table};
    use sui::tx_context::{Self, TxContext};
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::event;
    use sui::bcs;
    use manta::memory::{Self, MemoryObject, MemoryCap};
    
    const EInvalidIdentity: u64 = 0;
    const ENotRegistered: u64 = 1;
    const ENoAccess: u64 = 2;

    public struct VaultEntry has store, drop, copy {
        memory_id: address,
        owner: address,
        created_at: u64,
    }
    
    public struct VaultRegistry has key {
        id: UID,
        entries: Table<address, VaultEntry>,
    }

    public struct VaultRegistered has copy, drop {
        memory_id: address,
        owner: address,
    }

    fun init(ctx: &mut TxContext) {
        let vault_registry = VaultRegistry {
            id: object::new(ctx),
            entries: table::new(ctx),
        };
        transfer::share_object(vault_registry);
    }

    public entry fun register_memory(registry: &mut VaultRegistry, memory: &MemoryObject, ctx: &mut TxContext) {
        let owner = tx_context::sender(ctx);
        assert!(owner == memory::get_owner(memory), 0);
        let memory_id = object::id_to_address(&memory::get_id(memory));
        assert!(!table::contains(&registry.entries, memory_id), 0);
        let vault_entry = VaultEntry {
            memory_id: memory_id,
            owner: owner,
            created_at: tx_context::epoch(ctx),
        };
        table::add(&mut registry.entries, memory_id, vault_entry);
        event::emit(VaultRegistered {
            memory_id: memory_id,
            owner: owner,
        });
    }

    // entry functions
    entry fun seal_approve(id: vector<u8>, registry: &VaultRegistry, cap: &MemoryCap) {
        let mut prepared = bcs::new(id);
        let memory_addr = prepared.peel_address();
    // assert functions
        assert!(prepared.into_remainder_bytes().length() == 0, EInvalidIdentity);
        assert!(table::contains(&registry.entries, memory_addr), ENotRegistered);
        assert!(object::id_to_address(&memory::cap_memory_id(cap)) == memory_addr, ENoAccess);
        assert!(memory::cap_has_permission(cap, 1), ENoAccess);
    }

    // Deregister Functions

    public struct VaultDeregistered has copy, drop {
    memory_id: address,
    memory_owner: address,
}

public entry fun deregister_memory(registry: &mut VaultRegistry, memory: &MemoryObject, ctx: &mut TxContext) {
    let owner = tx_context::sender(ctx);
    assert!(owner == memory::get_owner(memory), 0);
    let memory_id = object::id_to_address(&memory::get_id(memory));
    assert!(table::contains(&registry.entries, memory_id), ENotRegistered);
    let vault_entry = table::remove(&mut registry.entries, memory_id);
    event::emit(VaultDeregistered {
        memory_id: memory_id,
        memory_owner: vault_entry.owner,
    });
}
}