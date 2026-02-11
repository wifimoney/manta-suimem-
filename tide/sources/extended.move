module tide::extended {
    use sui::table::{Self, Table};

    use sui::event;
    use tide::memory::{Self, MemoryObject};

    public struct BlobReference has store, drop, copy {
        blob_id: address,
        memory_id: address,
        size_bytes: u64,
        created_at: u64,
    }

    public struct ExtendedRegistry has key {
        id: UID,
        refs: Table<address, BlobReference>,
    }

    public struct BlobAttached has copy, drop {
        blob_id: address,
        memory_id: address,
    }

    public struct BlobDetached has copy, drop {
        blob_id: address,
        memory_id: address,
    }

    fun init(ctx: &mut TxContext) {
        let extended_registry = ExtendedRegistry {
            id: object::new(ctx),
            refs: table::new(ctx),
        };
        transfer::share_object(extended_registry);
    }

    public fun attach_blob(
        registry: &mut ExtendedRegistry,
        memory: &MemoryObject,
        blob_id: address,
        size_bytes: u64,
        ctx: &mut TxContext
    ) {
        let owner = tx_context::sender(ctx);
        assert!(owner == memory::get_owner(memory), 0);
        let memory_id = object::id_to_address(&memory::get_id(memory));
        assert!(!table::contains(&registry.refs, blob_id), 0);
        let blob_ref = BlobReference {
            blob_id: blob_id,
            memory_id: memory_id,
            size_bytes: size_bytes,
            created_at: tx_context::epoch(ctx),
        };
        table::add(&mut registry.refs, blob_id, blob_ref);
        event::emit(BlobAttached {
            blob_id: blob_id,
            memory_id: memory_id,
        });
    }

    public fun detach_blob(
        registry: &mut ExtendedRegistry,
        memory: &MemoryObject,
        blob_id: address,
        ctx: &mut TxContext
    ) {
        let owner = tx_context::sender(ctx);
        assert!(owner == memory::get_owner(memory), 0);
        let memory_id = object::id_to_address(&memory::get_id(memory));
        assert!(table::contains(&registry.refs, blob_id), 0);
        let _blob_ref = table::remove(&mut registry.refs, blob_id);
        event::emit(BlobDetached {
            blob_id: blob_id,
            memory_id: memory_id,
        });
    }
    
    public fun blob_id(ref: &BlobReference): address {
        ref.blob_id
    }

    public fun blob_memory_id(ref: &BlobReference): address {
        ref.memory_id
    }

    public fun blob_size(ref: &BlobReference): u64 {
        ref.size_bytes
    }

    public fun blob_created_at(ref: &BlobReference): u64 {
        ref.created_at
    }

    public fun get_blob(registry: &ExtendedRegistry, blob_id: address): &BlobReference {
        table::borrow(&registry.refs, blob_id)
    }

}