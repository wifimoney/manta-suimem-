#[allow(lint(share_owned))]
module manta::memory {
    use sui::clock::Clock;
    use sui::bcs;
    use sui::hash;
    use manta::events;

    // ============ Constants ============
    
    const SCHEMA_EPISODIC: u8 = 0;
    const SCHEMA_SEMANTIC: u8 = 1;

    // ============ Errors ============
    
    const ESchemaTypeMismatch: u64 = 1;

    // ============ Structs ============

    /// Core memory object - the fundamental Manta primitive
    public struct MemoryObject has key, store {
        id: UID,
        schema_type: u8,
        data: vector<u8>,
        version: u64,
        created_at: u64,
    }

    /// Single entry in episodic memory (append-only log)
    public struct EpisodicEntry has store, copy, drop {
        timestamp: u64,
        actor: address,
        payload: vector<u8>,
    }

    /// Single entry in semantic memory (key-value store)
    public struct SemanticEntry has store, copy, drop {
        key: vector<u8>,
        value: vector<u8>,
        updated_at: u64,
    }

    // ============ Create Functions ============

    /// Create a new private (owned) episodic memory
    public fun create_episodic_memory(
        clock: &Clock,
        ctx: &mut TxContext
    ): MemoryObject {
        let id = object::new(ctx);
        let memory_id = id.to_inner();
        let created_at = clock.timestamp_ms();
        let owner = ctx.sender();
        
        events::emit_memory_created(memory_id, SCHEMA_EPISODIC, owner, created_at);
        
        MemoryObject {
            id,
            schema_type: SCHEMA_EPISODIC,
            data: vector::empty(),
            version: 0,
            created_at,
        }
    }

    /// Create a new private (owned) semantic memory
    public fun create_semantic_memory(
        clock: &Clock,
        ctx: &mut TxContext
    ): MemoryObject {
        let id = object::new(ctx);
        let memory_id = id.to_inner();
        let created_at = clock.timestamp_ms();
        let owner = ctx.sender();
        
        events::emit_memory_created(memory_id, SCHEMA_SEMANTIC, owner, created_at);
        
        MemoryObject {
            id,
            schema_type: SCHEMA_SEMANTIC,
            data: vector::empty(),
            version: 0,
            created_at,
        }
    }

    /// Entry function: create episodic memory and transfer to sender
    entry fun create_episodic(
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let memory = create_episodic_memory(clock, ctx);
        transfer::transfer(memory, ctx.sender());
    }

    /// Entry function: create semantic memory and transfer to sender
    entry fun create_semantic(
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let memory = create_semantic_memory(clock, ctx);
        transfer::transfer(memory, ctx.sender());
    }

    /// Entry function: create shared episodic memory
    entry fun create_shared_episodic(
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let memory = create_episodic_memory(clock, ctx);
        transfer::share_object(memory);
    }

    /// Entry function: create shared semantic memory
    entry fun create_shared_semantic(
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let memory = create_semantic_memory(clock, ctx);
        transfer::share_object(memory);
    }

    // ============ Append (Episodic Only) ============

    /// Append an entry to episodic memory
    public fun append_memory(
        memory: &mut MemoryObject,
        payload: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(memory.schema_type == SCHEMA_EPISODIC, ESchemaTypeMismatch);
        
        let timestamp = clock.timestamp_ms();
        let actor = ctx.sender();
        let payload_size = payload.length();
        
        let entry = EpisodicEntry {
            timestamp,
            actor,
            payload,
        };
        
        // Serialize and append entry
        let entry_bytes = bcs::to_bytes(&entry);
        let entry_len = entry_bytes.length();
        
        // Prepend length as u32 for parsing
        let len_bytes = bcs::to_bytes(&(entry_len as u32));
        memory.data.append(len_bytes);
        memory.data.append(entry_bytes);
        
        memory.version = memory.version + 1;
        
        events::emit_episodic_append(
            memory.id.to_inner(),
            actor,
            memory.version,
            (payload_size as u64),
            timestamp,
        );
    }

    /// Entry function: append to episodic memory
    entry fun append(
        memory: &mut MemoryObject,
        payload: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        append_memory(memory, payload, clock, ctx);
    }

    // ============ Update (Semantic Only) ============

    /// Update or insert a key-value pair in semantic memory
    public fun update_memory(
        memory: &mut MemoryObject,
        key: vector<u8>,
        value: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(memory.schema_type == SCHEMA_SEMANTIC, ESchemaTypeMismatch);
        
        let timestamp = clock.timestamp_ms();
        let actor = ctx.sender();
        
        // Hash the key for the event (keeps events compact)
        let key_hash = hash::blake2b256(&key);
        
        let entry = SemanticEntry {
            key,
            value,
            updated_at: timestamp,
        };
        
        // For V1: simple append-based storage
        // Each update appends; latest value for key wins on read
        let entry_bytes = bcs::to_bytes(&entry);
        let entry_len = entry_bytes.length();
        
        let len_bytes = bcs::to_bytes(&(entry_len as u32));
        memory.data.append(len_bytes);
        memory.data.append(entry_bytes);
        
        memory.version = memory.version + 1;
        
        events::emit_semantic_update(
            memory.id.to_inner(),
            actor,
            memory.version,
            key_hash,
            timestamp,
        );
    }

    /// Entry function: update semantic memory
    entry fun update(
        memory: &mut MemoryObject,
        key: vector<u8>,
        value: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        update_memory(memory, key, value, clock, ctx);
    }

    // ============ Read Functions ============

    /// Get the raw data bytes (off-chain interpretation)
    public fun read_data(memory: &MemoryObject): &vector<u8> {
        &memory.data
    }

    /// Get memory metadata
    public fun get_id(memory: &MemoryObject): ID {
        memory.id.to_inner()
    }

    public fun get_schema_type(memory: &MemoryObject): u8 {
        memory.schema_type
    }

    public fun get_version(memory: &MemoryObject): u64 {
        memory.version
    }

    public fun get_created_at(memory: &MemoryObject): u64 {
        memory.created_at
    }

    /// Check if memory is episodic
    public fun is_episodic(memory: &MemoryObject): bool {
        memory.schema_type == SCHEMA_EPISODIC
    }

    /// Check if memory is semantic
    public fun is_semantic(memory: &MemoryObject): bool {
        memory.schema_type == SCHEMA_SEMANTIC
    }

    // ============ Destroy ============

    /// Destroy a memory object (only owner can call)
    public fun destroy(memory: MemoryObject) {
        let MemoryObject { id, schema_type: _, data: _, version, created_at: _ } = memory;
        
        events::emit_memory_destroyed(id.to_inner(), version);
        
        id.delete();
    }

    // ============ Test Helpers ============

    #[test_only]
    public fun schema_episodic(): u8 { SCHEMA_EPISODIC }

    #[test_only]
    public fun schema_semantic(): u8 { SCHEMA_SEMANTIC }
}
