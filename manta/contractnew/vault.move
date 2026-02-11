module manta::vault {
    use sui::table::{Self, Table}
    use sui::tx_context::{Self, TxContext}
    use sui::object::{Self, UID}    
    use sui::transfer;
    use sui::event;


    public struct VaultEntry has store, drop, copy {
        memory_id: address,
        owner: address,
        created_at: u64,
    }
    
    public struct VaultRegistry has key {
        id: object::UID,
        entries: Table<address, VaultEntry>,
    }

    fun init(ctx: &mut tx_context::TxContext) {
        let vault_registry = VaultRegistry {
            id: object::new(ctx),
            entries: table::new(ctx),
        };
        transfer::share_object(vault_registry);
    }

}