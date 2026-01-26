#[allow(lint(share_owned))]
module manta::memory {
    use sui::clock::Clock;
    use sui::bcs;
    use sui::hash;
    use manta::events;

    // ============ Schema Constants ============
    
    const SCHEMA_EPISODIC: u8 = 0;
    const SCHEMA_SEMANTIC: u8 = 1;

    // ============ Permission Constants ============
    
    const PERM_READ: u8 = 1;    // 0b001
    const PERM_APPEND: u8 = 2;  // 0b010
    const PERM_UPDATE: u8 = 4;  // 0b100

    // ============ Errors ============
    
    const ESchemaTypeMismatch: u64 = 1;
    const EPermissionDenied: u64 = 100;
    const ECapabilityExpired: u64 = 101;
    const EMemoryIdMismatch: u64 = 102;
    const EInvalidPermissions: u64 = 103;

    // ============ Core Structs ============

    /// Core memory object - the fundamental Manta primitive
    /// Data is stored as opaque BCS-encoded bytes
    /// Schema type indicates format: episodic (append-only) or semantic (key-value)
    public struct MemoryObject has key, store {
        id: UID,
        schema_type: u8,
        data: vector<u8>,
        version: u64,
        created_at: u64,
    }

    /// Capability token granting access to a MemoryObject
    /// Transferable, time-limited, permission-scoped
    public struct MemoryCap has key, store {
        id: UID,
        memory_id: ID,
        permissions: u8,
        expiry: Option<u64>,
        created_at: u64,
    }

    // ============ Create Functions ============

    /// Create a new episodic (append-only) memory - internal
    fun new_episodic(clock: &Clock, ctx: &mut TxContext): MemoryObject {
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

    /// Create a new semantic (key-value) memory - internal
    fun new_semantic(clock: &Clock, ctx: &mut TxContext): MemoryObject {
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

    /// Entry: create private episodic memory
    entry fun create_episodic(clock: &Clock, ctx: &mut TxContext) {
        let memory = new_episodic(clock, ctx);
        transfer::transfer(memory, ctx.sender());
    }

    /// Entry: create private semantic memory
    entry fun create_semantic(clock: &Clock, ctx: &mut TxContext) {
        let memory = new_semantic(clock, ctx);
        transfer::transfer(memory, ctx.sender());
    }

    /// Entry: create shared episodic memory (append-only by cap holders)
    entry fun create_shared_episodic(clock: &Clock, ctx: &mut TxContext) {
        let memory = new_episodic(clock, ctx);
        transfer::share_object(memory);
    }

    /// Entry: create shared semantic memory (cap-gated writes)
    entry fun create_shared_semantic(clock: &Clock, ctx: &mut TxContext) {
        let memory = new_semantic(clock, ctx);
        transfer::share_object(memory);
    }

    // ============ Write Functions (Owner) ============

    /// Append payload to episodic memory (owner only)
    entry fun append(
        memory: &mut MemoryObject,
        payload: vector<u8>,
        clock: &Clock,
        ctx: &TxContext
    ) {
        assert!(memory.schema_type == SCHEMA_EPISODIC, ESchemaTypeMismatch);
        
        let timestamp = clock.timestamp_ms();
        let actor = ctx.sender();
        append_internal(memory, payload, timestamp, actor);
    }

    /// Update key-value in semantic memory (owner only)
    entry fun update(
        memory: &mut MemoryObject,
        key: vector<u8>,
        value: vector<u8>,
        clock: &Clock,
        ctx: &TxContext
    ) {
        assert!(memory.schema_type == SCHEMA_SEMANTIC, ESchemaTypeMismatch);
        
        let timestamp = clock.timestamp_ms();
        let actor = ctx.sender();
        update_internal(memory, key, value, timestamp, actor);
    }

    // ============ Internal Write Helpers ============

    /// Internal append - used by both owner and cap-gated paths
    fun append_internal(
        memory: &mut MemoryObject,
        payload: vector<u8>,
        timestamp: u64,
        actor: address
    ) {
        let payload_size = payload.length();
        
        // BCS encode: timestamp + actor + payload
        let mut entry_bytes = bcs::to_bytes(&timestamp);
        entry_bytes.append(bcs::to_bytes(&actor));
        let payload_len = payload.length() as u32;
        entry_bytes.append(bcs::to_bytes(&payload_len));
        entry_bytes.append(payload);
        
        // Prepend total length
        let entry_len = entry_bytes.length() as u32;
        let mut len_bytes = bcs::to_bytes(&entry_len);
        len_bytes.append(entry_bytes);
        
        memory.data.append(len_bytes);
        memory.version = memory.version + 1;
        
        events::emit_episodic_append(
            memory.id.to_inner(),
            actor,
            memory.version,
            payload_size as u64,
            timestamp,
        );
    }

    /// Internal update - used by both owner and cap-gated paths
    fun update_internal(
        memory: &mut MemoryObject,
        key: vector<u8>,
        value: vector<u8>,
        timestamp: u64,
        actor: address
    ) {
        let key_hash = hash::blake2b256(&key);
        
        // BCS encode: key + value + updated_at
        let key_len = key.length() as u32;
        let value_len = value.length() as u32;
        
        let mut entry_bytes = bcs::to_bytes(&key_len);
        entry_bytes.append(key);
        entry_bytes.append(bcs::to_bytes(&value_len));
        entry_bytes.append(value);
        entry_bytes.append(bcs::to_bytes(&timestamp));
        
        // Prepend total length
        let entry_len = entry_bytes.length() as u32;
        let mut len_bytes = bcs::to_bytes(&entry_len);
        len_bytes.append(entry_bytes);
        
        memory.data.append(len_bytes);
        memory.version = memory.version + 1;
        
        events::emit_semantic_update(
            memory.id.to_inner(),
            actor,
            memory.version,
            key_hash,
            timestamp,
        );
    }

    // ============ Capability Delegation ============

    /// Delegate access to memory - creates a transferable capability
    entry fun delegate(
        memory: &MemoryObject,
        recipient: address,
        permissions: u8,
        expiry_ms: Option<u64>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(permissions > 0 && permissions <= 7, EInvalidPermissions);
        
        let cap = new_cap(memory, permissions, expiry_ms, recipient, clock, ctx);
        transfer::transfer(cap, recipient);
    }

    /// Delegate read-only access
    entry fun delegate_read(
        memory: &MemoryObject,
        recipient: address,
        expiry_ms: Option<u64>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let cap = new_cap(memory, PERM_READ, expiry_ms, recipient, clock, ctx);
        transfer::transfer(cap, recipient);
    }

    /// Delegate read + append access
    entry fun delegate_append(
        memory: &MemoryObject,
        recipient: address,
        expiry_ms: Option<u64>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let cap = new_cap(memory, PERM_READ | PERM_APPEND, expiry_ms, recipient, clock, ctx);
        transfer::transfer(cap, recipient);
    }

    /// Delegate read + update access
    entry fun delegate_update(
        memory: &MemoryObject,
        recipient: address,
        expiry_ms: Option<u64>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let cap = new_cap(memory, PERM_READ | PERM_UPDATE, expiry_ms, recipient, clock, ctx);
        transfer::transfer(cap, recipient);
    }

    /// Delegate full access (read + append + update)
    entry fun delegate_full(
        memory: &MemoryObject,
        recipient: address,
        expiry_ms: Option<u64>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let cap = new_cap(memory, PERM_READ | PERM_APPEND | PERM_UPDATE, expiry_ms, recipient, clock, ctx);
        transfer::transfer(cap, recipient);
    }

    /// Internal: create capability object
    fun new_cap(
        memory: &MemoryObject,
        permissions: u8,
        expiry: Option<u64>,
        recipient: address,
        clock: &Clock,
        ctx: &mut TxContext
    ): MemoryCap {
        let id = object::new(ctx);
        let cap_id = id.to_inner();
        let memory_id = memory.id.to_inner();
        let created_at = clock.timestamp_ms();
        let grantor = ctx.sender();
        
        events::emit_capability_delegated(
            cap_id,
            memory_id,
            grantor,
            recipient,
            permissions,
            expiry,
            created_at,
        );
        
        MemoryCap {
            id,
            memory_id,
            permissions,
            expiry,
            created_at,
        }
    }

    // ============ Capability Revocation ============

    /// Revoke access by destroying capability
    entry fun revoke(cap: MemoryCap, ctx: &TxContext) {
        let MemoryCap { id, memory_id, permissions: _, expiry: _, created_at: _ } = cap;
        
        events::emit_capability_revoked(id.to_inner(), memory_id, ctx.sender());
        
        id.delete();
    }

    // ============ Cap-Gated Write Functions ============

    /// Append using capability (for shared memory)
    entry fun cap_append(
        memory: &mut MemoryObject,
        cap: &MemoryCap,
        payload: vector<u8>,
        clock: &Clock,
        ctx: &TxContext
    ) {
        assert!(memory.schema_type == SCHEMA_EPISODIC, ESchemaTypeMismatch);
        assert_valid_cap(cap, memory, PERM_APPEND, clock);
        
        let timestamp = clock.timestamp_ms();
        let actor = ctx.sender();
        
        events::emit_capability_used(
            cap.id.to_inner(),
            cap.memory_id,
            actor,
            PERM_APPEND,
            timestamp,
        );
        
        append_internal(memory, payload, timestamp, actor);
    }

    /// Update using capability (for shared memory)
    entry fun cap_update(
        memory: &mut MemoryObject,
        cap: &MemoryCap,
        key: vector<u8>,
        value: vector<u8>,
        clock: &Clock,
        ctx: &TxContext
    ) {
        assert!(memory.schema_type == SCHEMA_SEMANTIC, ESchemaTypeMismatch);
        assert_valid_cap(cap, memory, PERM_UPDATE, clock);
        
        let timestamp = clock.timestamp_ms();
        let actor = ctx.sender();
        
        events::emit_capability_used(
            cap.id.to_inner(),
            cap.memory_id,
            actor,
            PERM_UPDATE,
            timestamp,
        );
        
        update_internal(memory, key, value, timestamp, actor);
    }

    // ============ Capability Validation ============

    /// Assert capability is valid (aborts if not)
    fun assert_valid_cap(
        cap: &MemoryCap,
        memory: &MemoryObject,
        required_permission: u8,
        clock: &Clock
    ) {
        // Check memory ID matches
        assert!(cap.memory_id == memory.id.to_inner(), EMemoryIdMismatch);
        
        // Check expiry
        if (cap.expiry.is_some()) {
            let exp = *cap.expiry.borrow();
            assert!(clock.timestamp_ms() <= exp, ECapabilityExpired);
        };
        
        // Check permission
        assert!((cap.permissions & required_permission) == required_permission, EPermissionDenied);
    }

    // ============ Destroy ============

    /// Destroy memory object (owner only)
    entry fun destroy(memory: MemoryObject) {
        let MemoryObject { id, schema_type: _, data: _, version, created_at: _ } = memory;
        
        events::emit_memory_destroyed(id.to_inner(), version);
        
        id.delete();
    }

    // ============ Read Functions (Public) ============

    public fun get_id(memory: &MemoryObject): ID {
        memory.id.to_inner()
    }

    public fun get_schema_type(memory: &MemoryObject): u8 {
        memory.schema_type
    }

    public fun get_data(memory: &MemoryObject): &vector<u8> {
        &memory.data
    }

    public fun get_version(memory: &MemoryObject): u64 {
        memory.version
    }

    public fun get_created_at(memory: &MemoryObject): u64 {
        memory.created_at
    }

    public fun is_episodic(memory: &MemoryObject): bool {
        memory.schema_type == SCHEMA_EPISODIC
    }

    public fun is_semantic(memory: &MemoryObject): bool {
        memory.schema_type == SCHEMA_SEMANTIC
    }

    // ============ Capability Read Functions (Public) ============

    public fun cap_memory_id(cap: &MemoryCap): ID {
        cap.memory_id
    }

    public fun cap_permissions(cap: &MemoryCap): u8 {
        cap.permissions
    }

    public fun cap_expiry(cap: &MemoryCap): Option<u64> {
        cap.expiry
    }

    public fun cap_has_read(cap: &MemoryCap): bool {
        (cap.permissions & PERM_READ) == PERM_READ
    }

    public fun cap_has_append(cap: &MemoryCap): bool {
        (cap.permissions & PERM_APPEND) == PERM_APPEND
    }

    public fun cap_has_update(cap: &MemoryCap): bool {
        (cap.permissions & PERM_UPDATE) == PERM_UPDATE
    }

    // ============ Constants (Public) ============

    public fun schema_episodic(): u8 { SCHEMA_EPISODIC }
    public fun schema_semantic(): u8 { SCHEMA_SEMANTIC }
    public fun perm_read(): u8 { PERM_READ }
    public fun perm_append(): u8 { PERM_APPEND }
    public fun perm_update(): u8 { PERM_UPDATE }
}
