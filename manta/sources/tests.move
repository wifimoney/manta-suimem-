#[test_only]
module manta::tests {
    use sui::test_scenario as ts;
    use sui::clock;
    
    use manta::memory::{Self, MemoryObject, MemoryCap};

    const OWNER: address = @0xA;
    const DELEGATE: address = @0xB;

    #[test]
    fun test_create_episodic_memory() {
        let mut scenario = ts::begin(OWNER);
        let clock = clock::create_for_testing(scenario.ctx());
        
        scenario.next_tx(OWNER);
        {
            memory::create_episodic(&clock, scenario.ctx());
        };
        
        scenario.next_tx(OWNER);
        {
            let memory = scenario.take_from_sender<MemoryObject>();
            assert!(memory.is_episodic());
            assert!(memory.get_version() == 0);
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
            memory::create_semantic(&clock, scenario.ctx());
        };
        
        scenario.next_tx(OWNER);
        {
            let memory = scenario.take_from_sender<MemoryObject>();
            assert!(memory.is_semantic());
            assert!(memory.get_version() == 0);
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
            memory::create_episodic(&clock, scenario.ctx());
        };
        
        scenario.next_tx(OWNER);
        {
            let mut memory = scenario.take_from_sender<MemoryObject>();
            memory::append(&mut memory, b"test event", &clock, scenario.ctx());
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
            memory::create_semantic(&clock, scenario.ctx());
        };
        
        scenario.next_tx(OWNER);
        {
            let mut memory = scenario.take_from_sender<MemoryObject>();
            memory::update(&mut memory, b"name", b"manta", &clock, scenario.ctx());
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
            memory::create_episodic(&clock, scenario.ctx());
        };
        
        scenario.next_tx(OWNER);
        {
            let mut memory = scenario.take_from_sender<MemoryObject>();
            memory::append(&mut memory, b"event 1", &clock, scenario.ctx());
            memory::append(&mut memory, b"event 2", &clock, scenario.ctx());
            memory::append(&mut memory, b"event 3", &clock, scenario.ctx());
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
        
        scenario.next_tx(OWNER);
        {
            memory::create_episodic(&clock, scenario.ctx());
        };
        
        scenario.next_tx(OWNER);
        {
            let memory = scenario.take_from_sender<MemoryObject>();
            memory::delegate_read(&memory, DELEGATE, option::none(), &clock, scenario.ctx());
            scenario.return_to_sender(memory);
        };
        
        scenario.next_tx(DELEGATE);
        {
            let cap = scenario.take_from_sender<MemoryCap>();
            assert!(cap.cap_has_read());
            assert!(!cap.cap_has_append());
            assert!(!cap.cap_has_update());
            scenario.return_to_sender(cap);
        };
        
        clock.destroy_for_testing();
        scenario.end();
    }

    #[test]
    fun test_delegate_append_and_use() {
        let mut scenario = ts::begin(OWNER);
        let clock = clock::create_for_testing(scenario.ctx());
        
        scenario.next_tx(OWNER);
        {
            memory::create_shared_episodic(&clock, scenario.ctx());
        };
        
        scenario.next_tx(OWNER);
        {
            let memory = scenario.take_shared<MemoryObject>();
            memory::delegate_append(&memory, DELEGATE, option::none(), &clock, scenario.ctx());
            ts::return_shared(memory);
        };
        
        scenario.next_tx(DELEGATE);
        {
            let mut memory = scenario.take_shared<MemoryObject>();
            let cap = scenario.take_from_sender<MemoryCap>();
            
            memory::cap_append(&mut memory, &cap, b"delegated write", &clock, scenario.ctx());
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
            memory::create_episodic(&clock, scenario.ctx());
        };
        
        scenario.next_tx(OWNER);
        {
            let memory = scenario.take_from_sender<MemoryObject>();
            memory::delegate_read(&memory, DELEGATE, option::none(), &clock, scenario.ctx());
            scenario.return_to_sender(memory);
        };
        
        scenario.next_tx(DELEGATE);
        {
            let cap = scenario.take_from_sender<MemoryCap>();
            memory::revoke(cap, scenario.ctx());
        };
        
        scenario.next_tx(DELEGATE);
        {
            assert!(!ts::has_most_recent_for_sender<MemoryCap>(&scenario));
        };
        
        clock.destroy_for_testing();
        scenario.end();
    }

    #[test]
    #[expected_failure(abort_code = memory::ECapabilityExpired)]
    fun test_expired_cap_fails() {
        let mut scenario = ts::begin(OWNER);
        let mut clock = clock::create_for_testing(scenario.ctx());
        
        scenario.next_tx(OWNER);
        {
            memory::create_shared_episodic(&clock, scenario.ctx());
        };
        
        scenario.next_tx(OWNER);
        {
            let memory = scenario.take_shared<MemoryObject>();
            memory::delegate_append(&memory, DELEGATE, option::some(1000), &clock, scenario.ctx());
            ts::return_shared(memory);
        };
        
        clock.set_for_testing(2000);
        
        scenario.next_tx(DELEGATE);
        {
            let mut memory = scenario.take_shared<MemoryObject>();
            let cap = scenario.take_from_sender<MemoryCap>();
            
            memory::cap_append(&mut memory, &cap, b"should fail", &clock, scenario.ctx());
            
            scenario.return_to_sender(cap);
            ts::return_shared(memory);
        };
        
        clock.destroy_for_testing();
        scenario.end();
    }

    #[test]
    #[expected_failure(abort_code = memory::EPermissionDenied)]
    fun test_wrong_permission_fails() {
        let mut scenario = ts::begin(OWNER);
        let clock = clock::create_for_testing(scenario.ctx());
        
        scenario.next_tx(OWNER);
        {
            memory::create_shared_semantic(&clock, scenario.ctx());
        };
        
        scenario.next_tx(OWNER);
        {
            let memory = scenario.take_shared<MemoryObject>();
            memory::delegate_read(&memory, DELEGATE, option::none(), &clock, scenario.ctx());
            ts::return_shared(memory);
        };
        
        scenario.next_tx(DELEGATE);
        {
            let mut memory = scenario.take_shared<MemoryObject>();
            let cap = scenario.take_from_sender<MemoryCap>();
            
            memory::cap_update(&mut memory, &cap, b"key", b"value", &clock, scenario.ctx());
            
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
            memory::create_episodic(&clock, scenario.ctx());
        };
        
        scenario.next_tx(OWNER);
        {
            let memory = scenario.take_from_sender<MemoryObject>();
            memory::destroy(memory);
        };
        
        clock.destroy_for_testing();
        scenario.end();
    }
}
