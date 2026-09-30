# Sentinel Fork backend (Role 1)

Run the API with:

```powershell
cargo run
```

It listens on `http://127.0.0.1:8787`; the analysis endpoint is `POST /api/analyze`.

For transaction simulation, install Foundry/Anvil and optionally set `SEPOLIA_RPC_URL` to a Sepolia RPC endpoint. An `rpc_url` in the request takes precedence. The backend resolves a block using that upstream RPC, then forks it locally and makes all state-changing calls only to the local Anvil node.

The API directly consumes the Role 2 decoder library. It decodes supported ERC-20/721/1155 calls and EIP-712 intents, enriches unknown calls with fork bytecode data, and matches both transaction targets and approval operators against the local demo drainer database.
