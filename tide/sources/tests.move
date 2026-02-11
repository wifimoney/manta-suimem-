#[test_only]
module tide::tests {
    use sui::clock;
    use sui::test_scenario::{Self as ts, Scenario};
    use tide::memory::{Self, MemoryObject, MemoryCap};

    const OWNER: address = @0xA;
    const RECIPIENT: address = @0xB;
    const ATTACKER: address = @0xC;

    // ============ Helper Functions ============

    fun setup(): Scenario {
        ts::begin(OWNER)
    }

    fun clock(scenario: &mut Scenario): clock::Clock {
        ts::next_tx(scenario, OWNER);
        clock::create_for_testing(ts::ctx(scenario))
    }

    // ============ Creation Tests ============

    #[test]
    fun test_create_episodic_memory() {
        let mut scenario = setup();
        let mut clock = clock(&mut scenario);
        
        ts::next_tx(&mut scenario, OWNER);
        {
            memory::create_episodic(&clock, ts::ctx(&mut scenario));
        };
        
        ts::next_tx(&mut scenario, OWNER);
        {
            let memory = ts::take_from_sender<MemoryObject>(&scenario);
            assert!(memory.is_episodic());
            assert!(memory.get_version() == 0);
            assert!(memory.get_owner() == OWNER);
            ts::return_to_sender(&scenario, memory);
        };
        
        clock.destroy_for_testing();
        ts::end(scenario);
    }

    #[test]
    fun test_create_semantic_memory() {
        let mut scenario = setup();
        let mut clock = clock(&mut scenario);
        
        ts::next_tx(&mut scenario, OWNER);
        {
            memory::create_semantic(&clock, ts::ctx(&mut scenario));
        };
        
        ts::next_tx(&mut scenario, OWNER);
        {
            let memory = ts::take_from_sender<MemoryObject>(&scenario);
            assert!(memory.is_semantic());
            assert!(memory.get_owner() == OWNER);
            ts::return_to_sender(&scenario, memory);
        };
        
        clock.destroy_for_testing();
        ts::end(scenario);
    }

    // ============ Write Tests ============

    #[test]
    fun test_append_episodic() {
        let mut scenario = setup();
        let mut clock = clock(&mut scenario);
        
        ts::next_tx(&mut scenario, OWNER);
        {
            memory::create_episodic(&clock, ts::ctx(&mut scenario));
        };
        
        ts::next_tx(&mut scenario, OWNER);
        {
            let mut memory = ts::take_from_sender<MemoryObject>(&scenario);
            memory::append(&mut memory, b"test payload", &clock, ts::ctx(&mut scenario));
            assert!(memory.get_version() == 1);
            ts::return_to_sender(&scenario, memory);
        };
        
        clock.destroy_for_testing();
        ts::end(scenario);
    }

    #[test]
    fun test_update_semantic() {
        let mut scenario = setup();
        let mut clock = clock(&mut scenario);
        
        ts::next_tx(&mut scenario, OWNER);
        {
            memory::create_semantic(&clock, ts::ctx(&mut scenario));
        };
        
        ts::next_tx(&mut scenario, OWNER);
        {
            let mut memory = ts::take_from_sender<MemoryObject>(&scenario);
            memory::update(&mut memory, b"key", b"value", &clock, ts::ctx(&mut scenario));
            assert!(memory.get_version() == 1);
            ts::return_to_sender(&scenario, memory);
        };
        
        clock.destroy_for_testing();
        ts::end(scenario);
    }

    #[test]
    fun test_multiple_appends() {
        let mut scenario = setup();
        let mut clock = clock(&mut scenario);
        
        ts::next_tx(&mut scenario, OWNER);
        {
            memory::create_episodic(&clock, ts::ctx(&mut scenario));
        };
        
        ts::next_tx(&mut scenario, OWNER);
        {
            let mut memory = ts::take_from_sender<MemoryObject>(&scenario);
            memory::append(&mut memory, b"entry 1", &clock, ts::ctx(&mut scenario));
            memory::append(&mut memory, b"entry 2", &clock, ts::ctx(&mut scenario));
            memory::append(&mut memory, b"entry 3", &clock, ts::ctx(&mut scenario));
            assert!(memory.get_version() == 3);
            ts::return_to_sender(&scenario, memory);
        };
        
        clock.destroy_for_testing();
        ts::end(scenario);
    }

    // ============ Delegation Tests ============

    #[test]
    fun test_delegate_read_cap() {
        let mut scenario = setup();
        let mut clock = clock(&mut scenario);
        
        ts::next_tx(&mut scenario, OWNER);
        {
            memory::create_episodic(&clock, ts::ctx(&mut scenario));
        };
        
        ts::next_tx(&mut scenario, OWNER);
        {
            let memory = ts::take_from_sender<MemoryObject>(&scenario);
            memory::delegate_read(&memory, RECIPIENT, option::none(), &clock, ts::ctx(&mut scenario));
            ts::return_to_sender(&scenario, memory);
        };
        
        ts::next_tx(&mut scenario, RECIPIENT);
        {
            let cap = ts::take_from_sender<MemoryCap>(&scenario);
            assert!(cap.cap_has_permission(1)); // READ
            ts::return_to_sender(&scenario, cap);
        };
        
        clock.destroy_for_testing();
        ts::end(scenario);
    }

    #[test]
    fun test_delegate_append_and_use() {
        let mut scenario = setup();
        let mut clock = clock(&mut scenario);
        
        ts::next_tx(&mut scenario, OWNER);
        {
            memory::create_shared_episodic(&clock, ts::ctx(&mut scenario));
        };
        
        ts::next_tx(&mut scenario, OWNER);
        {
            let memory = ts::take_shared<MemoryObject>(&scenario);
            memory::delegate_append(&memory, RECIPIENT, option::none(), &clock, ts::ctx(&mut scenario));
            ts::return_shared(memory);
        };
        
        ts::next_tx(&mut scenario, RECIPIENT);
        {
            let mut memory = ts::take_shared<MemoryObject>(&scenario);
            let cap = ts::take_from_sender<MemoryCap>(&scenario);
            memory::cap_append(&mut memory, &cap, b"delegated write", &clock, ts::ctx(&mut scenario));
            assert!(memory.get_version() == 1);
            ts::return_to_sender(&scenario, cap);
            ts::return_shared(memory);
        };
        
        clock.destroy_for_testing();
        ts::end(scenario);
    }

    #[test]
    fun test_revoke_cap() {
        let mut scenario = setup();
        let mut clock = clock(&mut scenario);
        
        ts::next_tx(&mut scenario, OWNER);
        {
            memory::create_episodic(&clock, ts::ctx(&mut scenario));
        };
        
        ts::next_tx(&mut scenario, OWNER);
        {
            let memory = ts::take_from_sender<MemoryObject>(&scenario);
            memory::delegate_read(&memory, RECIPIENT, option::none(), &clock, ts::ctx(&mut scenario));
            ts::return_to_sender(&scenario, memory);
        };
        
        ts::next_tx(&mut scenario, RECIPIENT);
        {
            let cap = ts::take_from_sender<MemoryCap>(&scenario);
            memory::revoke(cap, ts::ctx(&mut scenario));
        };
        
        clock.destroy_for_testing();
        ts::end(scenario);
    }

    // ============ Security Tests ============

    #[test]
    #[expected_failure(abort_code = memory::ECapabilityExpired)]
    fun test_expired_cap_fails() {
        let mut scenario = setup();
        let mut clock = clock(&mut scenario);
        
        ts::next_tx(&mut scenario, OWNER);
        {
            memory::create_shared_episodic(&clock, ts::ctx(&mut scenario));
        };
        
        ts::next_tx(&mut scenario, OWNER);
        {
            let memory = ts::take_shared<MemoryObject>(&scenario);
            // Expire in 1000ms
            memory::delegate_append(&memory, RECIPIENT, option::some(1000), &clock, ts::ctx(&mut scenario));
            ts::return_shared(memory);
        };
        
        // Advance time past expiry
        clock.increment_for_testing(2000);
        
        ts::next_tx(&mut scenario, RECIPIENT);
        {
            let mut memory = ts::take_shared<MemoryObject>(&scenario);
            let cap = ts::take_from_sender<MemoryCap>(&scenario);
            // This should fail - cap is expired
            memory::cap_append(&mut memory, &cap, b"should fail", &clock, ts::ctx(&mut scenario));
            ts::return_to_sender(&scenario, cap);
            ts::return_shared(memory);
        };
        
        clock.destroy_for_testing();
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = memory::EPermissionDenied)]
    fun test_wrong_permission_fails() {
        let mut scenario = setup();
        let mut clock = clock(&mut scenario);
        
        ts::next_tx(&mut scenario, OWNER);
        {
            memory::create_shared_episodic(&clock, ts::ctx(&mut scenario));
        };
        
        ts::next_tx(&mut scenario, OWNER);
        {
            let memory = ts::take_shared<MemoryObject>(&scenario);
            // Only grant READ permission
            memory::delegate_read(&memory, RECIPIENT, option::none(), &clock, ts::ctx(&mut scenario));
            ts::return_shared(memory);
        };
        
        ts::next_tx(&mut scenario, RECIPIENT);
        {
            let mut memory = ts::take_shared<MemoryObject>(&scenario);
            let cap = ts::take_from_sender<MemoryCap>(&scenario);
            // This should fail - cap only has READ, not APPEND
            memory::cap_append(&mut memory, &cap, b"should fail", &clock, ts::ctx(&mut scenario));
            ts::return_to_sender(&scenario, cap);
            ts::return_shared(memory);
        };
        
        clock.destroy_for_testing();
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = memory::ENotOwner)]
    fun test_non_owner_cannot_append_to_shared() {
        let mut scenario = setup();
        let mut clock = clock(&mut scenario);
        
        ts::next_tx(&mut scenario, OWNER);
        {
            memory::create_shared_episodic(&clock, ts::ctx(&mut scenario));
        };
        
        // ATTACKER tries to append directly without cap
        ts::next_tx(&mut scenario, ATTACKER);
        {
            let mut memory = ts::take_shared<MemoryObject>(&scenario);
            // This should fail - ATTACKER is not owner
            memory::append(&mut memory, b"malicious data", &clock, ts::ctx(&mut scenario));
            ts::return_shared(memory);
        };
        
        clock.destroy_for_testing();
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = memory::ENotOwner)]
    fun test_non_owner_cannot_delegate() {
        let mut scenario = setup();
        let mut clock = clock(&mut scenario);
        
        ts::next_tx(&mut scenario, OWNER);
        {
            memory::create_shared_episodic(&clock, ts::ctx(&mut scenario));
        };
        
        // ATTACKER tries to delegate to themselves
        ts::next_tx(&mut scenario, ATTACKER);
        {
            let memory = ts::take_shared<MemoryObject>(&scenario);
            // This should fail - ATTACKER is not owner
            memory::delegate_full(&memory, ATTACKER, option::none(), &clock, ts::ctx(&mut scenario));
            ts::return_shared(memory);
        };
        
        clock.destroy_for_testing();
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = memory::ENotOwner)]
    fun test_non_owner_cannot_destroy() {
        let mut scenario = setup();
        let mut clock = clock(&mut scenario);
        
        ts::next_tx(&mut scenario, OWNER);
        {
            memory::create_episodic(&clock, ts::ctx(&mut scenario));
        };
        
        ts::next_tx(&mut scenario, OWNER);
        {
            let memory = ts::take_from_sender<MemoryObject>(&scenario);
            transfer::public_transfer(memory, ATTACKER);
        };
        
        // ATTACKER now holds the object but is not the owner field
        ts::next_tx(&mut scenario, ATTACKER);
        {
            let memory = ts::take_from_sender<MemoryObject>(&scenario);
            // This should fail - ATTACKER is holder but not owner
            memory::destroy(memory, ts::ctx(&mut scenario));
        };
        
        clock.destroy_for_testing();
        ts::end(scenario);
    }

    #[test]
    fun test_destroy_memory() {
        let mut scenario = setup();
        let mut clock = clock(&mut scenario);
        
        ts::next_tx(&mut scenario, OWNER);
        {
            memory::create_episodic(&clock, ts::ctx(&mut scenario));
        };
        
        ts::next_tx(&mut scenario, OWNER);
        {
            let memory = ts::take_from_sender<MemoryObject>(&scenario);
            memory::destroy(memory, ts::ctx(&mut scenario));
        };
        
        clock.destroy_for_testing();
        ts::end(scenario);
    }

    #[test]
    fun test_transfer_ownership() {
        let mut scenario = setup();
        let mut clock = clock(&mut scenario);
        
        ts::next_tx(&mut scenario, OWNER);
        {
            memory::create_episodic(&clock, ts::ctx(&mut scenario));
        };
        
        ts::next_tx(&mut scenario, OWNER);
        {
            let mut memory = ts::take_from_sender<MemoryObject>(&scenario);
            assert!(memory.get_owner() == OWNER);
            memory::transfer_ownership(&mut memory, RECIPIENT, ts::ctx(&mut scenario));
            assert!(memory.get_owner() == RECIPIENT);
            ts::return_to_sender(&scenario, memory);
        };
        
        clock.destroy_for_testing();
        ts::end(scenario);
    }
}
