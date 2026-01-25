module manta::cap {
    use sui::clock::Clock;
    use manta::memory::{Self, MemoryObject};

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
        clock: &Clock,
        ctx: &mut TxContext
    ): MemoryCap {
        assert!(permissions > 0 && permissions <= 7, EInvalidPermissions);
        
        MemoryCap {
            id: object::new(ctx),
            memory_id: memory::get_id(memory),
            permissions,
            expiry,
            created_at: clock.timestamp_ms(),
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
        let cap = delegate_access(memory, PERM_READ, expiry_ms, clock, ctx);
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
        let cap = delegate_access(memory, PERM_READ | PERM_APPEND, expiry_ms, clock, ctx);
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
        let cap = delegate_access(memory, PERM_READ | PERM_UPDATE, expiry_ms, clock, ctx);
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
        let cap = delegate_access(memory, PERM_READ | PERM_APPEND | PERM_UPDATE, expiry_ms, clock, ctx);
        transfer::transfer(cap, recipient);
    }

    // ============ Revocation ============

    /// Revoke access by destroying the capability
    public fun revoke_access(cap: MemoryCap) {
        let MemoryCap { id, memory_id: _, permissions: _, expiry: _, created_at: _ } = cap;
        id.delete();
    }

    /// Entry function: revoke access
    entry fun revoke(cap: MemoryCap) {
        revoke_access(cap);
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
