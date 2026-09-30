# Sentinel Fork decoder (Role 2)

The Rust library lives in `backend/` and provides calldata decoding, EIP-712
intent recognition, local demo-drainer matching, and plain-English findings.
It performs no network calls and has no HTTP/API dependency.

```rust
use sentinel_fork_decoder::{
    decode_transaction, generate_findings, match_drainer_db,
};

let intent = decode_transaction(target, &calldata);
let selector = calldata.get(..4).and_then(|v| v.try_into().ok()).unwrap_or([0; 4]);
let matches = match_drainer_db(target, selector, runtime_bytecode_hash);
let findings = generate_findings(&intent, &matches);
```

Use `decode_transaction_with_lookup` with an implementation of `ChainLookup`
when the simulation engine has RPC access. The deployed Sepolia demo drainer
address is recorded in `backend/drainer-db/db.json`.

Run tests with `cargo test` from `role2/backend`.
