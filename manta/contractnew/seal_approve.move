module manta::seal_approve {
    use sui::bcs; 
    use sui::tx_context;
    use sui::object;
    use sui::table;
    use sui::event;
    use manta::memory::{Self, MemoryObject};

    const EInvalidIdentity: u64 = 0;
    const ENotRegistered: u64 = 1;
    const ENoAccess: u64 = 2;

    entry fun seal_approve(id: vector<u8>, registry: &VaultRegistry, cap: &MemoryCap) {
        let mut prepared = bcs::new(id);
        let memory_addr = prepared.peel_address();
        assert!(prepared.into_remainder_bytes().length() == 0, EInvalidIdentity);
        assert!(table::contains(&registry.entries, memory_addr), ENotRegistered);
        let entry = table::borrow(&registry.entries, memory_addr);
        assert!(cap.memory_id == memory_addr, ENoAccess);
        assert!(cap.permissions & 1 == 1, ENoAccess);
        assert!(prepared.into_remainder_bytes().length() == 0, EInvalidIdentity);
        assert!(table::contains(&registry.entries, memory_addr), ENotRegistered);
        let entry = table::borrow(&registry.entries, memory_addr);
        assert!(cap.memory_id == memory_addr, ENoAccess);
        assert!(cap.permissions & 1 == 1, ENoAccess);
    }
}