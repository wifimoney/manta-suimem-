module manta::events {
    use sui::event;

    // ============ Memory Events ============

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

    // ============ Capability Events ============

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

    // ============ Emit Functions ============

    public fun emit_memory_created(
        memory_id: ID,
        schema_type: u8,
        owner: address,
        created_at: u64,
    ) {
        event::emit(MemoryCreated {
            memory_id,
            schema_type,
            owner,
            created_at,
        });
    }

    public fun emit_episodic_append(
        memory_id: ID,
        actor: address,
        version: u64,
        payload_size: u64,
        timestamp: u64,
    ) {
        event::emit(EpisodicAppend {
            memory_id,
            actor,
            version,
            payload_size,
            timestamp,
        });
    }

    public fun emit_semantic_update(
        memory_id: ID,
        actor: address,
        version: u64,
        key_hash: vector<u8>,
        timestamp: u64,
    ) {
        event::emit(SemanticUpdate {
            memory_id,
            actor,
            version,
            key_hash,
            timestamp,
        });
    }

    public fun emit_memory_destroyed(
        memory_id: ID,
        final_version: u64,
    ) {
        event::emit(MemoryDestroyed {
            memory_id,
            final_version,
        });
    }

    public fun emit_capability_delegated(
        cap_id: ID,
        memory_id: ID,
        grantor: address,
        grantee: address,
        permissions: u8,
        expiry: Option<u64>,
        created_at: u64,
    ) {
        event::emit(CapabilityDelegated {
            cap_id,
            memory_id,
            grantor,
            grantee,
            permissions,
            expiry,
            created_at,
        });
    }

    public fun emit_capability_revoked(
        cap_id: ID,
        memory_id: ID,
        revoked_by: address,
    ) {
        event::emit(CapabilityRevoked {
            cap_id,
            memory_id,
            revoked_by,
        });
    }

    public fun emit_capability_used(
        cap_id: ID,
        memory_id: ID,
        actor: address,
        operation: u8,
        timestamp: u64,
    ) {
        event::emit(CapabilityUsed {
            cap_id,
            memory_id,
            actor,
            operation,
            timestamp,
        });
    }
}
