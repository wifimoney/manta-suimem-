module manta::cap {
    use sui::clock::Clock;
    use manta::memory::{Self, MemoryObject};
    use manta::events;

    // ============ Permission Constants ============
    
    const PERM_READ: u8 = 1;    // 0b001
    const PERM_APPEND: u8 = 2;  // 0b010
    const PERM_UPDATE: u8 = 4;  // 0b100

    // ============ Errors ============
    
    const EPermissionDenied: u64 = 100;
    const ECapabilityExpired: u64 = 101;
    const EMemoryIdMismatch: u64 = 102;
    const EInvalidPermissions: u64 = 103;

    // ============ Structs ============

    /// Capability token granting access to a MemoryObject
    public struct MemoryCap has key, store {
        id: UID,
        memory_id: ID,
        permissions: u8,
        expiry: Option<u64>,  // timestamp in ms, None = no expiry
        created_at: u64,
    }

    // ============ Delegation ============

    /// Create a capability for a memory object (owner calls this)
    public fun delegate_access(
        memory: &MemoryObject,
        permissions: u8,
        expiry: Option<u64>,
        recipient: address,
        clock: &Clock,
        ctx: &mut TxContext
    ): MemoryCap {
        assert!(permissions > 0 && permissions <= 7, EInvalidPermissions);
        
        let id = object::new(ctx);
        let cap_id = id.to_inner();
        let memory_id = memory::get_id(memory);
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

    /// Entry function: delegate read access
    entry fun delegate_read(
        memory: &MemoryObject,
        recipient: address,
        expiry_ms: Option<u64>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let cap = delegate_access(memory, PERM_READ, expiry_ms, recipient, clock, ctx);
        transfer::transfer(cap, recipient);
    }

    /// Entry function: delegate append access (includes read)
    entry fun delegate_append(
        memory: &MemoryObject,
        recipient: address,
        expiry_ms: Option<u64>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let cap = delegate_access(memory, PERM_READ | PERM_APPEND, expiry_ms, recipient, clock, ctx);
        transfer::transfer(cap, recipient);
    }

    /// Entry function: delegate update access (includes read)
    entry fun delegate_update(
        memory: &MemoryObject,
        recipient: address,
        expiry_ms: Option<u64>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let cap = delegate_access(memory, PERM_READ | PERM_UPDATE, expiry_ms, recipient, clock, ctx);
        transfer::transfer(cap, recipient);
    }

    /// Entry function: delegate full access
    entry fun delegate_full(
        memory: &MemoryObject,
        recipient: address,
        expiry_ms: Option<u64>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let cap = delegate_access(memory, PERM_READ | PERM_APPEND | PERM_UPDATE, expiry_ms, recipient, clock, ctx);
        transfer::transfer(cap, recipient);
    }

    // ============ Revocation ============

    /// Revoke access by destroying the capability
    public fun revoke_access(cap: MemoryCap, ctx: &TxContext) {
        let MemoryCap { id, memory_id, permissions: _, expiry: _, created_at: _ } = cap;
        
        events::emit_capability_revoked(id.to_inner(), memory_id, ctx.sender());
        
        id.delete();
    }

    /// Entry function: revoke access
    entry fun revoke(cap: MemoryCap, ctx: &TxContext) {
        revoke_access(cap, ctx);
    }

    // ============ Validation ============

    /// Check if capability is valid for a memory object
    public fun validate_cap(
        cap: &MemoryCap,
        memory: &MemoryObject,
        required_permission: u8,
        clock: &Clock
    ): bool {
        // Check memory ID matches
        if (cap.memory_id != memory::get_id(memory)) {
            return false
        };
        
        // Check expiry
        if (cap.expiry.is_some()) {
            let exp = *cap.expiry.borrow();
            if (clock.timestamp_ms() > exp) {
                return false
            };
        };
        
        // Check permission
        (cap.permissions & required_permission) == required_permission
    }

    /// Assert capability is valid (aborts if not)
    public fun assert_valid_cap(
        cap: &MemoryCap,
        memory: &MemoryObject,
        required_permission: u8,
        clock: &Clock
    ) {
        assert!(cap.memory_id == memory::get_id(memory), EMemoryIdMismatch);
        
        if (cap.expiry.is_some()) {
            let exp = *cap.expiry.borrow();
            assert!(clock.timestamp_ms() <= exp, ECapabilityExpired);
        };
        
        assert!((cap.permissions & required_permission) == required_permission, EPermissionDenied);
    }

    // ============ Cap-Gated Operations ============

    /// Append to memory using capability
    public fun append_with_cap(
        memory: &mut MemoryObject,
        cap: &MemoryCap,
        payload: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert_valid_cap(cap, memory, PERM_APPEND, clock);
        
        events::emit_capability_used(
            cap.id.to_inner(),
            cap.memory_id,
            ctx.sender(),
            PERM_APPEND,
            clock.timestamp_ms(),
        );
        
        memory::append_memory(memory, payload, clock, ctx);
    }

    /// Update memory using capability
    public fun update_with_cap(
        memory: &mut MemoryObject,
        cap: &MemoryCap,
        key: vector<u8>,
        value: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert_valid_cap(cap, memory, PERM_UPDATE, clock);
        
        events::emit_capability_used(
            cap.id.to_inner(),
            cap.memory_id,
            ctx.sender(),
            PERM_UPDATE,
            clock.timestamp_ms(),
        );
        
        memory::update_memory(memory, key, value, clock, ctx);
    }

    /// Entry function: append using capability
    entry fun cap_append(
        memory: &mut MemoryObject,
        cap: &MemoryCap,
        payload: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        append_with_cap(memory, cap, payload, clock, ctx);
    }

    /// Entry function: update using capability
    entry fun cap_update(
        memory: &mut MemoryObject,
        cap: &MemoryCap,
        key: vector<u8>,
        value: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        update_with_cap(memory, cap, key, value, clock, ctx);
    }

    // ============ Getters ============

    public fun get_cap_id(cap: &MemoryCap): ID {
        cap.id.to_inner()
    }

    public fun get_memory_id(cap: &MemoryCap): ID {
        cap.memory_id
    }

    public fun get_permissions(cap: &MemoryCap): u8 {
        cap.permissions
    }

    public fun get_expiry(cap: &MemoryCap): Option<u64> {
        cap.expiry
    }

    public fun has_read(cap: &MemoryCap): bool {
        (cap.permissions & PERM_READ) == PERM_READ
    }

    public fun has_append(cap: &MemoryCap): bool {
        (cap.permissions & PERM_APPEND) == PERM_APPEND
    }

    public fun has_update(cap: &MemoryCap): bool {
        (cap.permissions & PERM_UPDATE) == PERM_UPDATE
    }

    // ============ Permission Constants (Public) ============

    public fun perm_read(): u8 { PERM_READ }
    public fun perm_append(): u8 { PERM_APPEND }
    public fun perm_update(): u8 { PERM_UPDATE }
}
