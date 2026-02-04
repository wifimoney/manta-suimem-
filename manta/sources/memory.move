/// Manta: Sui-native on-chain memory primitive
/// 
/// Provides persistent memory storage with capability-based access control.
/// Supports two schemas: episodic (append-only) and semantic (key-value).
module manta::memory {
    use sui::clock::Clock;
    use sui::event;

    // ============ Error Codes ============
    
    const EInvalidSchemaType: u64 = 0;
    const EWrongMemory: u64 = 1;
    const EPermissionDenied: u64 = 2;
    const ECapabilityExpired: u64 = 3;
    const EInvalidPermissions: u64 = 4;
    const ENotOwner: u64 = 5;
    const ELengthOverflow: u64 = 6;
    const EEntryTooLarge: u64 = 7;
    const EMemoryTooLarge: u64 = 8;

    // ============ Constants ============
    
    const SCHEMA_EPISODIC: u8 = 0;
    const SCHEMA_SEMANTIC: u8 = 1;

    const PERM_READ: u8 = 1;
    const PERM_APPEND: u8 = 2;
    const PERM_UPDATE: u8 = 4;

    // V1 hard limits to cap gas/memory growth and keep encoding bounded.
    const MAX_U32: u64 = 0xFFFF_FFFF;
    const MAX_ENTRY_BYTES: u64 = 65536;
    const MAX_MEMORY_BYTES: u64 = 1048576;

    // ============ Core Structs ============

    public struct MemoryObject has key, store {
        id: UID,
        owner: address,
        schema_type: u8,
        data: vector<u8>,
        version: u64,
        created_at: u64,
        // Epoch used to invalidate all outstanding caps without holding them.
        cap_epoch: u64,
    }

    public struct MemoryCap has key, store {
        id: UID,
        memory_id: ID,
        permissions: u8,
        expiry: Option<u64>,
        created_at: u64,
        issued_epoch: u64,
    }

    // ============ Events ============

    public struct MemoryCreated has copy, drop {
        memory_id: ID,
        schema_type: u8,
        owner: address,
        created_at: u64,
    }

    public struct EpisodicAppend has copy, drop {
        memory_id: ID,
        actor: address,
        version: u64,
        payload_size: u64,
        timestamp: u64,
    }

    public struct SemanticUpdate has copy, drop {
        memory_id: ID,
        actor: address,
        version: u64,
        key_hash: vector<u8>,
        timestamp: u64,
    }

    public struct MemoryDestroyed has copy, drop {
        memory_id: ID,
        final_version: u64,
    }

    public struct CapabilityDelegated has copy, drop {
        cap_id: ID,
        memory_id: ID,
        grantor: address,
        grantee: address,
        permissions: u8,
        expiry: Option<u64>,
        created_at: u64,
    }

    public struct CapabilityRevoked has copy, drop {
        cap_id: ID,
        memory_id: ID,
        revoked_by: address,
    }

    public struct CapabilityUsed has copy, drop {
        cap_id: ID,
        memory_id: ID,
        actor: address,
        operation: u8,
        timestamp: u64,
    }

    // ============ Internal Constructors ============

    fun new_episodic(clock: &Clock, ctx: &mut TxContext): MemoryObject {
        let id = object::new(ctx);
        let memory_id = object::uid_to_inner(&id);
        let owner = ctx.sender();
        let created_at = clock.timestamp_ms();
        
        event::emit(MemoryCreated {
            memory_id,
            schema_type: SCHEMA_EPISODIC,
            owner,
            created_at,
        });

        MemoryObject {
            id,
            owner,
            schema_type: SCHEMA_EPISODIC,
            data: vector::empty(),
            version: 0,
            created_at,
            cap_epoch: 0,
        }
    }

    fun new_semantic(clock: &Clock, ctx: &mut TxContext): MemoryObject {
        let id = object::new(ctx);
        let memory_id = object::uid_to_inner(&id);
        let owner = ctx.sender();
        let created_at = clock.timestamp_ms();
        
        event::emit(MemoryCreated {
            memory_id,
            schema_type: SCHEMA_SEMANTIC,
            owner,
            created_at,
        });

        MemoryObject {
            id,
            owner,
            schema_type: SCHEMA_SEMANTIC,
            data: vector::empty(),
            version: 0,
            created_at,
            cap_epoch: 0,
        }
    }

    fun new_cap(
        memory_id: ID,
        permissions: u8,
        expiry: Option<u64>,
        cap_epoch: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ): MemoryCap {
        assert!(permissions > 0 && permissions <= 7, EInvalidPermissions);
        
        MemoryCap {
            id: object::new(ctx),
            memory_id,
            permissions,
            expiry,
            created_at: clock.timestamp_ms(),
            issued_epoch: cap_epoch,
        }
    }

    // ============ Create Functions ============

    entry fun create_episodic(clock: &Clock, ctx: &mut TxContext) {
        let memory = new_episodic(clock, ctx);
        transfer::transfer(memory, ctx.sender());
    }

    entry fun create_semantic(clock: &Clock, ctx: &mut TxContext) {
        let memory = new_semantic(clock, ctx);
        transfer::transfer(memory, ctx.sender());
    }

    entry fun create_shared_episodic(clock: &Clock, ctx: &mut TxContext) {
        let memory = new_episodic(clock, ctx);
        transfer::share_object(memory);
    }

    entry fun create_shared_semantic(clock: &Clock, ctx: &mut TxContext) {
        let memory = new_semantic(clock, ctx);
        transfer::share_object(memory);
    }

    // ============ Owner Check ============

    fun assert_is_owner(memory: &MemoryObject, ctx: &TxContext) {
        assert!(ctx.sender() == memory.owner, ENotOwner);
    }

    // ============ Write Functions (Owner Only) ============

    entry fun append(
        memory: &mut MemoryObject,
        payload: vector<u8>,
        clock: &Clock,
        ctx: &TxContext
    ) {
        assert_is_owner(memory, ctx);
        assert!(memory.schema_type == SCHEMA_EPISODIC, EInvalidSchemaType);
        append_internal(memory, payload, ctx.sender(), clock);
    }

    entry fun update(
        memory: &mut MemoryObject,
        key: vector<u8>,
        value: vector<u8>,
        clock: &Clock,
        ctx: &TxContext
    ) {
        assert_is_owner(memory, ctx);
        assert!(memory.schema_type == SCHEMA_SEMANTIC, EInvalidSchemaType);
        update_internal(memory, key, value, ctx.sender(), clock);
    }

    // ============ Cap-Gated Write Functions ============

    entry fun cap_append(
        memory: &mut MemoryObject,
        cap: &MemoryCap,
        payload: vector<u8>,
        clock: &Clock,
        ctx: &TxContext
    ) {
        assert_valid_cap(cap, memory, PERM_APPEND, clock);
        assert!(memory.schema_type == SCHEMA_EPISODIC, EInvalidSchemaType);
        
        event::emit(CapabilityUsed {
            cap_id: object::uid_to_inner(&cap.id),
            memory_id: cap.memory_id,
            actor: ctx.sender(),
            operation: PERM_APPEND,
            timestamp: clock.timestamp_ms(),
        });
        
        append_internal(memory, payload, ctx.sender(), clock);
    }

    entry fun cap_update(
        memory: &mut MemoryObject,
        cap: &MemoryCap,
        key: vector<u8>,
        value: vector<u8>,
        clock: &Clock,
        ctx: &TxContext
    ) {
        assert_valid_cap(cap, memory, PERM_UPDATE, clock);
        assert!(memory.schema_type == SCHEMA_SEMANTIC, EInvalidSchemaType);
        
        event::emit(CapabilityUsed {
            cap_id: object::uid_to_inner(&cap.id),
            memory_id: cap.memory_id,
            actor: ctx.sender(),
            operation: PERM_UPDATE,
            timestamp: clock.timestamp_ms(),
        });
        
        update_internal(memory, key, value, ctx.sender(), clock);
    }

    // ============ Internal Write Helpers ============

    fun append_internal(
        memory: &mut MemoryObject,
        payload: vector<u8>,
        actor: address,
        clock: &Clock
    ) {
        let payload_len = payload.length() as u64;
        // Enforce 4-byte length encoding limits before any encoding occurs.
        assert!(payload_len <= MAX_U32, ELengthOverflow);
        let entry_len = 8 + 32 + 4 + payload_len;
        assert!(entry_len <= MAX_U32, ELengthOverflow);
        let final_entry_len = 4 + entry_len;
        assert!(final_entry_len <= MAX_ENTRY_BYTES, EEntryTooLarge);
        let memory_len = memory.data.length() as u64;
        assert!(memory_len + final_entry_len <= MAX_MEMORY_BYTES, EMemoryTooLarge);

        let timestamp = clock.timestamp_ms();
        let mut entry = vector::empty<u8>();
        
        let mut ts = timestamp;
        let mut i = 0;
        while (i < 8) {
            entry.push_back((ts & 0xFF) as u8);
            ts = ts >> 8;
            i = i + 1;
        };
        
        let actor_bytes = actor.to_bytes();
        let mut j = 0;
        while (j < 32) {
            entry.push_back(actor_bytes[j]);
            j = j + 1;
        };
        
        let len = payload_len;
        let mut l = len;
        let mut k = 0;
        while (k < 4) {
            entry.push_back((l & 0xFF) as u8);
            l = l >> 8;
            k = k + 1;
        };
        
        entry.append(payload);
        
        let entry_len = entry.length() as u64;
        let mut final_entry = vector::empty<u8>();
        let mut el = entry_len;
        let mut m = 0;
        while (m < 4) {
            final_entry.push_back((el & 0xFF) as u8);
            el = el >> 8;
            m = m + 1;
        };
        final_entry.append(entry);
        
        memory.data.append(final_entry);
        memory.version = memory.version + 1;
        
        event::emit(EpisodicAppend {
            memory_id: object::uid_to_inner(&memory.id),
            actor,
            version: memory.version,
            payload_size: len,
            timestamp,
        });
    }

    fun update_internal(
        memory: &mut MemoryObject,
        key: vector<u8>,
        value: vector<u8>,
        actor: address,
        clock: &Clock
    ) {
        let key_len = key.length() as u64;
        let value_len = value.length() as u64;
        // Enforce 4-byte length encoding limits before any encoding occurs.
        assert!(key_len <= MAX_U32, ELengthOverflow);
        assert!(value_len <= MAX_U32, ELengthOverflow);
        let entry_len = 4 + key_len + 4 + value_len + 8;
        assert!(entry_len <= MAX_U32, ELengthOverflow);
        let final_entry_len = 4 + entry_len;
        assert!(final_entry_len <= MAX_ENTRY_BYTES, EEntryTooLarge);
        let memory_len = memory.data.length() as u64;
        assert!(memory_len + final_entry_len <= MAX_MEMORY_BYTES, EMemoryTooLarge);

        let timestamp = clock.timestamp_ms();
        let mut entry = vector::empty<u8>();
        
        let mut kl = key_len;
        let mut i = 0;
        while (i < 4) {
            entry.push_back((kl & 0xFF) as u8);
            kl = kl >> 8;
            i = i + 1;
        };
        
        entry.append(key);
        
        let mut vl = value_len;
        let mut j = 0;
        while (j < 4) {
            entry.push_back((vl & 0xFF) as u8);
            vl = vl >> 8;
            j = j + 1;
        };
        
        entry.append(value);
        
        let mut ts = timestamp;
        let mut k = 0;
        while (k < 8) {
            entry.push_back((ts & 0xFF) as u8);
            ts = ts >> 8;
            k = k + 1;
        };
        
        let entry_len = entry.length() as u64;
        let mut final_entry = vector::empty<u8>();
        let mut el = entry_len;
        let mut m = 0;
        while (m < 4) {
            final_entry.push_back((el & 0xFF) as u8);
            el = el >> 8;
            m = m + 1;
        };
        final_entry.append(entry);
        
        memory.data.append(final_entry);
        memory.version = memory.version + 1;
        
        let key_hash = std::hash::sha2_256(key);
        
        event::emit(SemanticUpdate {
            memory_id: object::uid_to_inner(&memory.id),
            actor,
            version: memory.version,
            key_hash,
            timestamp,
        });
    }

    // ============ Delegation Functions (Owner Only) ============

    entry fun delegate(
        memory: &MemoryObject,
        recipient: address,
        permissions: u8,
        expiry: Option<u64>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert_is_owner(memory, ctx);
        
        let memory_id = object::uid_to_inner(&memory.id);
        let cap = new_cap(memory_id, permissions, expiry, memory.cap_epoch, clock, ctx);
        let cap_id = object::uid_to_inner(&cap.id);
        
        event::emit(CapabilityDelegated {
            cap_id,
            memory_id,
            grantor: ctx.sender(),
            grantee: recipient,
            permissions,
            expiry,
            created_at: clock.timestamp_ms(),
        });
        
        transfer::transfer(cap, recipient);
    }

    entry fun delegate_read(
        memory: &MemoryObject,
        recipient: address,
        expiry: Option<u64>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        delegate(memory, recipient, PERM_READ, expiry, clock, ctx);
    }

    entry fun delegate_append(
        memory: &MemoryObject,
        recipient: address,
        expiry: Option<u64>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        delegate(memory, recipient, PERM_READ | PERM_APPEND, expiry, clock, ctx);
    }

    entry fun delegate_update(
        memory: &MemoryObject,
        recipient: address,
        expiry: Option<u64>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        delegate(memory, recipient, PERM_READ | PERM_UPDATE, expiry, clock, ctx);
    }

    entry fun delegate_full(
        memory: &MemoryObject,
        recipient: address,
        expiry: Option<u64>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        delegate(memory, recipient, PERM_READ | PERM_APPEND | PERM_UPDATE, expiry, clock, ctx);
    }

    // ============ Revoke & Destroy ============

    entry fun revoke(cap: MemoryCap, ctx: &TxContext) {
        let MemoryCap { id, memory_id, permissions: _, expiry: _, created_at: _, issued_epoch: _ } = cap;
        
        event::emit(CapabilityRevoked {
            cap_id: object::uid_to_inner(&id),
            memory_id,
            revoked_by: ctx.sender(),
        });
        
        object::delete(id);
    }

    /// Owner-driven invalidation of all outstanding caps without holding them.
    entry fun revoke_all_caps(memory: &mut MemoryObject, ctx: &TxContext) {
        assert_is_owner(memory, ctx);
        memory.cap_epoch = memory.cap_epoch + 1;
    }

    // Note: Shared MemoryObjects are intentionally permanent in V1.
    entry fun destroy(memory: MemoryObject, ctx: &TxContext) {
        assert!(ctx.sender() == memory.owner, ENotOwner);
        
        let MemoryObject { id, owner: _, schema_type: _, data: _, version, created_at: _, cap_epoch: _ } = memory;
        
        event::emit(MemoryDestroyed {
            memory_id: object::uid_to_inner(&id),
            final_version: version,
        });
        
        object::delete(id);
    }

    entry fun transfer_ownership(
        memory: &mut MemoryObject,
        new_owner: address,
        ctx: &TxContext
    ) {
        assert_is_owner(memory, ctx);
        memory.owner = new_owner;
    }

    // ============ Capability Validation ============

    fun assert_valid_cap(cap: &MemoryCap, memory: &MemoryObject, required_perm: u8, clock: &Clock) {
        assert!(cap.memory_id == object::uid_to_inner(&memory.id), EWrongMemory);
        assert!((cap.permissions & required_perm) == required_perm, EPermissionDenied);
        assert!(cap.issued_epoch == memory.cap_epoch, EPermissionDenied);
        
        if (cap.expiry.is_some()) {
            let expiry = *cap.expiry.borrow();
            assert!(clock.timestamp_ms() < expiry, ECapabilityExpired);
        };
    }

    // ============ Read Functions ============

    public fun get_id(memory: &MemoryObject): ID {
        object::uid_to_inner(&memory.id)
    }

    public fun get_owner(memory: &MemoryObject): address {
        memory.owner
    }

    public fun get_schema_type(memory: &MemoryObject): u8 {
        memory.schema_type
    }

    public fun cap_get_data(memory: &MemoryObject, cap: &MemoryCap, clock: &Clock): &vector<u8> {
        assert_valid_cap(cap, memory, PERM_READ, clock);
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

    public fun cap_memory_id(cap: &MemoryCap): ID {
        cap.memory_id
    }

    public fun cap_permissions(cap: &MemoryCap): u8 {
        cap.permissions
    }

    public fun cap_expiry(cap: &MemoryCap): Option<u64> {
        cap.expiry
    }

    public fun cap_created_at(cap: &MemoryCap): u64 {
        cap.created_at
    }

    public fun cap_has_permission(cap: &MemoryCap, perm: u8): bool {
        (cap.permissions & perm) == perm
    }

    public fun cap_is_expired(cap: &MemoryCap, clock: &Clock): bool {
        if (cap.expiry.is_some()) {
            clock.timestamp_ms() >= *cap.expiry.borrow()
        } else {
            false
        }
    }
}
