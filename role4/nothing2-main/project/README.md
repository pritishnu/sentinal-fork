# Sentinel Fork frontend

The demo intercepts sensitive EIP-1193 wallet methods, sends them to the Rust
analysis API, and holds the original MetaMask request until the user explicitly
rejects or continues from the report modal.

Copy `.env.example` to `.env` and fill in the Sepolia `MockRewardsNFT` and
`FakeRewardsDrainer` deployment addresses. The addresses can also be entered in
the interface at runtime.

The training action targets the mock NFT collection with
`setApprovalForAll(FakeRewardsDrainer, true)`. This is the actual wallet-owned
approval Sentinel Fork is intended to detect. It must only be used with the
tester-owned Sepolia collection.

Start the Role 1 backend on port 8787, then run this app with `npm run dev`.
