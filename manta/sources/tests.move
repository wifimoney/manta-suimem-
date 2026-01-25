#[test_only]
module manta::tests {
    use sui::test_scenario as ts;
    use sui::clock;
    
    use manta::memory::{Self, MemoryObject};
    use manta::cap::{Self, MemoryCap};

    const OWNER: address = @0xA;
    const DELEGATE: address = @0xB;

    #[test]
    fun test_create_episodic_memory() {
        let mut scenario = ts::begin(OWNER);
        let clock = clock::create_for_testing(scenario.ctx());
        
        scenario.next_tx(OWNER);
        {
            let memory = memory::create_episodic_memory(&clock, scenario.ctx());
            assert!(memory.is_episodic());
            assert!(memory.get_version() == 0);
            transfer::public_transfer(memory, OWNER);
        };
        
        scenario.next_tx(OWNER);
        {
            let memory = scenario.take_from_sender<MemoryObject>();
            assert!(memory.is_episodic());
            scenario.return_to_sender(memory);
        };
        
        clock.destroy_for_testing();
        scenario.end();
    }

    #[test]
    fun test_create_semantic_memory() {
        let mut scenario = ts::begin(OWNER);
        let clock = clock::create_for_testing(scenario.ctx());
        
        scenario.next_tx(OWNER);
        {
            let memory = memory::create_semantic_memory(&clock, scenario.ctx());
            assert!(memory.is_semantic());
            assert!(memory.get_version() == 0);
            transfer::public_transfer(memory, OWNER);
        };
        
        scenario.next_tx(OWNER);
        {
            let memory = scenario.take_from_sender<MemoryObject>();
            assert!(memory.is_semantic());
            scenario.return_to_sender(memory);
        };
        
        clock.destroy_for_testing();
        scenario.end();
    }

    #[test]
    fun test_append_episodic() {
        let mut scenario = ts::begin(OWNER);
        let clock = clock::create_for_testing(scenario.ctx());
        
        scenario.next_tx(OWNER);
        {
            let memory = memory::create_episodic_memory(&clock, scenario.ctx());
            transfer::public_transfer(memory, OWNER);
        };
        
        scenario.next_tx(OWNER);
        {
            let mut memory = scenario.take_from_sender<MemoryObject>();
            let payload = b"test event";
            memory::append_memory(&mut memory, payload, &clock, scenario.ctx());
            assert!(memory.get_version() == 1);
            scenario.return_to_sender(memory);
        };
        
        clock.destroy_for_testing();
        scenario.end();
    }

    #[test]
    fun test_update_semantic() {
        let mut scenario = ts::begin(OWNER);
        let clock = clock::create_for_testing(scenario.ctx());
        
        scenario.next_tx(OWNER);
        {
            let memory = memory::create_semantic_memory(&clock, scenario.ctx());
            transfer::public_transfer(memory, OWNER);
        };
        
        scenario.next_tx(OWNER);
        {
            let mut memory = scenario.take_from_sender<MemoryObject>();
            let key = b"name";
            let value = b"manta";
            memory::update_memory(&mut memory, key, value, &clock, scenario.ctx());
            assert!(memory.get_version() == 1);
            scenario.return_to_sender(memory);
        };
        
        clock.destroy_for_testing();
        scenario.end();
    }

    #[test]
    fun test_multiple_appends() {
        let mut scenario = ts::begin(OWNER);
        let clock = clock::create_for_testing(scenario.ctx());
        
        scenario.next_tx(OWNER);
        {
            let memory = memory::create_episodic_memory(&clock, scenario.ctx());
            transfer::public_transfer(memory, OWNER);
        };
        
        scenario.next_tx(OWNER);
        {
            let mut memory = scenario.take_from_sender<MemoryObject>();
            memory::append_memory(&mut memory, b"event 1", &clock, scenario.ctx());
            memory::append_memory(&mut memory, b"event 2", &clock, scenario.ctx());
            memory::append_memory(&mut memory, b"event 3", &clock, scenario.ctx());
            assert!(memory.get_version() == 3);
            scenario.return_to_sender(memory);
        };
        
        clock.destroy_for_testing();
        scenario.end();
    }

    #[test]
    fun test_delegate_read_cap() {
        let mut scenario = ts::begin(OWNER);
        let clock = clock::create_for_testing(scenario.ctx());
        
        // Owner creates memory
        scenario.next_tx(OWNER);
        {
            let memory = memory::create_episodic_memory(&clock, scenario.ctx());
            transfer::public_transfer(memory, OWNER);
        };
        
        // Owner delegates read access
        scenario.next_tx(OWNER);
        {
            let memory = scenario.take_from_sender<MemoryObject>();
            let cap = cap::delegate_access(&memory, cap::perm_read(), option::none(), &clock, scenario.ctx());
            transfer::public_transfer(cap, DELEGATE);
            scenario.return_to_sender(memory);
        };
        
        // Delegate receives cap
        scenario.next_tx(DELEGATE);
        {
            let cap = scenario.take_from_sender<MemoryCap>();
            assert!(cap.has_read());
            assert!(!cap.has_append());
            assert!(!cap.has_update());
            scenario.return_to_sender(cap);
        };
        
        clock.destroy_for_testing();
        scenario.end();
    }

    #[test]
    fun test_delegate_append_and_use() {
        let mut scenario = ts::begin(OWNER);
        let clock = clock::create_for_testing(scenario.ctx());
        
        // Owner creates memory and shares it
        scenario.next_tx(OWNER);
        {
            let memory = memory::create_episodic_memory(&clock, scenario.ctx());
            transfer::public_share_object(memory);
        };
        
        // Owner delegates append access
        scenario.next_tx(OWNER);
        {
            let memory = scenario.take_shared<MemoryObject>();
            let cap = cap::delegate_access(
                &memory, 
                cap::perm_read() | cap::perm_append(), 
                option::none(), 
                &clock, 
                scenario.ctx()
            );
            transfer::public_transfer(cap, DELEGATE);
            ts::return_shared(memory);
        };
        
        // Delegate uses cap to append
        scenario.next_tx(DELEGATE);
        {
            let mut memory = scenario.take_shared<MemoryObject>();
            let cap = scenario.take_from_sender<MemoryCap>();
            
            cap::append_with_cap(&mut memory, &cap, b"delegated write", &clock, scenario.ctx());
            assert!(memory.get_version() == 1);
            
            scenario.return_to_sender(cap);
            ts::return_shared(memory);
        };
        
        clock.destroy_for_testing();
        scenario.end();
    }

    #[test]
    fun test_revoke_cap() {
        let mut scenario = ts::begin(OWNER);
        let clock = clock::create_for_testing(scenario.ctx());
        
        scenario.next_tx(OWNER);
        {
            let memory = memory::create_episodic_memory(&clock, scenario.ctx());
            transfer::public_transfer(memory, OWNER);
        };
        
        scenario.next_tx(OWNER);
        {
            let memory = scenario.take_from_sender<MemoryObject>();
            let cap = cap::delegate_access(&memory, cap::perm_read(), option::none(), &clock, scenario.ctx());
            transfer::public_transfer(cap, DELEGATE);
            scenario.return_to_sender(memory);
        };
        
        // Delegate revokes their own cap
        scenario.next_tx(DELEGATE);
        {
            let cap = scenario.take_from_sender<MemoryCap>();
            cap::revoke_access(cap);
        };
        
        // Verify cap no longer exists
        scenario.next_tx(DELEGATE);
        {
            assert!(!ts::has_most_recent_for_sender<MemoryCap>(&scenario));
        };
        
        clock.destroy_for_testing();
        scenario.end();
    }

    #[test]
    #[expected_failure(abort_code = cap::ECapabilityExpired)]
    fun test_expired_cap_fails() {
        let mut scenario = ts::begin(OWNER);
        let mut clock = clock::create_for_testing(scenario.ctx());
        
        // Owner creates shared memory
        scenario.next_tx(OWNER);
        {
            let memory = memory::create_episodic_memory(&clock, scenario.ctx());
            transfer::public_share_object(memory);
        };
        
        // Owner delegates with expiry at timestamp 1000
        scenario.next_tx(OWNER);
        {
            let memory = scenario.take_shared<MemoryObject>();
            let cap = cap::delegate_access(
                &memory, 
                cap::perm_read() | cap::perm_append(), 
                option::some(1000), 
                &clock, 
                scenario.ctx()
            );
            transfer::public_transfer(cap, DELEGATE);
            ts::return_shared(memory);
        };
        
        // Advance clock past expiry
        clock.set_for_testing(2000);
        
        // Delegate tries to use expired cap - should fail
        scenario.next_tx(DELEGATE);
        {
            let mut memory = scenario.take_shared<MemoryObject>();
            let cap = scenario.take_from_sender<MemoryCap>();
            
            // This should abort with ECapabilityExpired
            cap::append_with_cap(&mut memory, &cap, b"should fail", &clock, scenario.ctx());
            
            scenario.return_to_sender(cap);
            ts::return_shared(memory);
        };
        
        clock.destroy_for_testing();
        scenario.end();
    }

    #[test]
    #[expected_failure(abort_code = cap::EPermissionDenied)]
    fun test_wrong_permission_fails() {
        let mut scenario = ts::begin(OWNER);
        let clock = clock::create_for_testing(scenario.ctx());
        
        // Owner creates shared memory
        scenario.next_tx(OWNER);
        {
            let memory = memory::create_semantic_memory(&clock, scenario.ctx());
            transfer::public_share_object(memory);
        };
        
        // Owner delegates READ only
        scenario.next_tx(OWNER);
        {
            let memory = scenario.take_shared<MemoryObject>();
            let cap = cap::delegate_access(&memory, cap::perm_read(), option::none(), &clock, scenario.ctx());
            transfer::public_transfer(cap, DELEGATE);
            ts::return_shared(memory);
        };
        
        // Delegate tries to UPDATE with read-only cap - should fail
        scenario.next_tx(DELEGATE);
        {
            let mut memory = scenario.take_shared<MemoryObject>();
            let cap = scenario.take_from_sender<MemoryCap>();
            
            // This should abort with EPermissionDenied
            cap::update_with_cap(&mut memory, &cap, b"key", b"value", &clock, scenario.ctx());
            
            scenario.return_to_sender(cap);
            ts::return_shared(memory);
        };
        
        clock.destroy_for_testing();
        scenario.end();
    }

    #[test]
    fun test_destroy_memory() {
        let mut scenario = ts::begin(OWNER);
        let clock = clock::create_for_testing(scenario.ctx());
        
        scenario.next_tx(OWNER);
        {
            let memory = memory::create_episodic_memory(&clock, scenario.ctx());
            memory::destroy(memory);
        };
        
        clock.destroy_for_testing();
        scenario.end();
    }
}
