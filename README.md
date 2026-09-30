# Sentinel Fork

Sentinel Fork is a Sepolia-only wallet security training demo. It pauses a wallet request, simulates it against a local Anvil fork, decodes its intent, checks a small local drainer-pattern database, and shows a report before the request can reach MetaMask.

No mainnet transaction is created by the demo. The included contracts cannot withdraw or transfer user assets.

## Integrated architecture

```text
React demo dApp
  -> inline window.ethereum interceptor
  -> POST /api/analyze
  -> Axum API
       -> Role 2 calldata / EIP-712 decoder
       -> local drainer database
       -> Anvil fork of Sepolia
       -> state diff + deterministic risk score
  -> blocking report modal
       -> Reject, or explicitly Continue to MetaMask

Chrome extension
  -> intercepts supported wallet requests on ordinary dApp tabs
  -> uses the same POST /api/analyze engine and review flow
```

| Component | Location | Responsibility |
| --- | --- | --- |
| API and simulator | `role1/backend` | Axum endpoint, Anvil lifecycle, fork execution, state diffs, risk scoring |
| Decoder library | `role2/backend` | ERC calldata decoding, EIP-712 intent decoding, local drainer matching and findings |
| Demo contracts | `role3` | Sepolia-only mock assets, training drainer, Foundry tests and deployment |
| Frontend | `role4/nothing2-main/project` | Landing/demo UI, provider interception, report and wallet decision flow |
| Chrome extension | `extension` | Browser-wide request interception, analysis bridge, popup status, and full risk report |

Role 1 consumes Role 2 as a local Cargo dependency. The frontend and API share the request/response contract documented below.

## Deployed Sepolia demo contracts

```text
MockRewardsNFT:      0x18525b9229f983ae2aa61bb921ca6f516f3156b1
MockRewardsToken:    0x4119cfe4f08f0f70314a19436e0dd7059988e7ae
FakeRewardsDrainer:  0x251a5db73994b8127821d6d9d83b29e7c9604697
```

The drainer address is included in `role2/backend/drainer-db/db.json`. The frontend reads the NFT and drainer addresses from its local `.env` file.

## Requirements

- Rust and Cargo
- Foundry (`anvil` and `forge`)
- Node.js 20+ and npm
- MetaMask configured for Ethereum Sepolia
- Sepolia test ETH only if you choose to submit a transaction or redeploy contracts

## Run locally

Create `role4/nothing2-main/project/.env` from `.env.example`:

```env
VITE_SENTINEL_API_URL=http://127.0.0.1:8787/api/analyze
VITE_MOCK_REWARDS_NFT_ADDRESS=0x18525b9229f983ae2aa61bb921ca6f516f3156b1
VITE_FAKE_REWARDS_DRAINER_ADDRESS=0x251a5db73994b8127821d6d9d83b29e7c9604697
```

Optionally set a private Alchemy/Infura Sepolia RPC URL in the terminal that runs the backend. If omitted, the backend uses a public Sepolia endpoint.

```powershell
$env:SEPOLIA_RPC_URL = "https://your-sepolia-rpc"
```

Start the API in terminal 1:

```powershell
cd role1/backend
cargo run
```

Start the frontend in terminal 2:

```powershell
cd role4/nothing2-main/project
npm install
npm run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173` in a browser with MetaMask installed.

### Load the Chrome extension

1. Keep the backend running on `http://127.0.0.1:8787`.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Choose **Load unpacked** and select the repository's `extension` directory.
4. Reload any dApp tabs that were already open.

The extension protects `eth_sendTransaction`, `eth_sign`, `personal_sign`, and EIP-712 signing requests. It shows the decoded intent, findings and evidence, state changes, drainer matches, limitations, and raw backend report before the wallet opens.

## Demo walkthrough

1. Launch the demo from the landing page.
2. Connect a disposable MetaMask test account on Ethereum Sepolia.
3. Click **Review claim request**.
4. Confirm the Sentinel report appears before MetaMask.
5. Inspect the decoded `setApprovalForAll(address,bool)` intent, critical local database match, and fork state changes.
6. Choose **Reject** to prove MetaMask never receives the request.
7. Repeat and acknowledge the warning only if you want to test **Continue to MetaMask**. Rejecting inside MetaMask is still safe and demonstrates the forwarding boundary.

## API contract

`POST http://127.0.0.1:8787/api/analyze`

```json
{
  "chain_id": 11155111,
  "request_type": "transaction",
  "from": "0x...",
  "to": "0x...",
  "value": "0x0",
  "data": "0x...",
  "origin": "http://127.0.0.1:5173",
  "rpc_url": "optional request-specific override"
}
```

The response contains `simulation`, `intent`, `findings`, `state_diff`, `drainer_matches`, `risk`, and `limitations`.

## Tests

```powershell
cd role2/backend
cargo test

cd ../../role1/backend
cargo test

cd ../../role3
forge test -vv

cd ../role4/nothing2-main/project
npm run typecheck
npm run lint
npm run build

cd ../../../extension
node tests/interceptor.test.mjs
node tests/analysis-flow.test.mjs
node tests/popup-status.test.mjs
node tests/approval-card.test.mjs
```

GitHub Actions runs the Rust formatting/lint/tests, Foundry tests, and frontend typecheck/lint/build.

## Safety and known limitations

- Sepolia only; the backend rejects other chain IDs.
- The drainer database is a small local demonstration list, not comprehensive threat intelligence.
- The inline demo protects its own page. The optional Manifest V3 extension applies the same flow to ordinary dApp tabs, but remains a page-level prototype rather than a wallet-native security boundary.
- The simulator currently focuses its pre/post storage probes on native balance, ERC-20 allowance, and ERC-721/1155-style operator approval, while receipt logs provide additional transfer evidence.
- Signature requests are decoded as intent only and never executed.
- Solidity cannot make a wallet-owned ERC-721 collection grant approval from inside another contract because the NFT sees that contract as `msg.sender`. The training page therefore constructs the wallet's explicit `setApprovalForAll` request and Sentinel intercepts it before MetaMask.
- Existing deployment addresses are public. A private key is required only to redeploy contracts and must never be committed or shared.
