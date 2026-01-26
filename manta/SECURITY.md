# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.3.x   | :white_check_mark: |
| < 1.3   | :x:                |

## Security Model

Manta V1.3 enforces strict access control:

### Owner Field
Every `MemoryObject` stores an `owner` address. This is set at creation time and controls:
- Direct writes (`append`, `update`)
- Capability delegation (`delegate*`)
- Destruction (`destroy`)
- Ownership transfer (`transfer_ownership`)

### Shared Objects
Even when a memory is shared (via `create_shared_*`), only the owner can:
- Write directly
- Mint new capabilities
- Transfer ownership

Other users must use capabilities (`cap_append`, `cap_update`).

### Capability Validation
Capabilities are validated for:
1. **Memory ID match** - Cap must be for this specific memory
2. **Permission flags** - Cap must have required permission
3. **Expiry** - Cap must not be expired

## Known Limitations

1. **Vector size** - Memory data is stored in a single `vector<u8>`. Very large memories may hit gas limits.
2. **No encryption** - Data is stored in plaintext. Use off-chain encryption if needed.
3. **Owner transferability** - Owner can be changed via `transfer_ownership`. Track ownership carefully.

## Reporting a Vulnerability

Please report security vulnerabilities to: security@your-domain.com

Do NOT open public issues for security vulnerabilities.

## Audit Status

- [x] Internal security audit (V1.3)
- [ ] External security audit (pending)
