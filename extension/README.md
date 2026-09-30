# Sentinel Fork Chrome extension

A Manifest V3 extension for reviewing supported Ethereum wallet requests before they reach MetaMask. It uses the same Sepolia-only Rust analysis API as the website dashboard.

## Run it

1. Start the API from `role1/backend` with `cargo run`. Anvil/Foundry must be installed for transaction simulation.
2. Open `chrome://extensions`, enable **Developer mode**, then **Load unpacked** and select this `extension` directory. If it is already loaded, click its **Reload** button.
3. Reload open dApp tabs and initiate a transaction or signature request.

The request pauses while Sentinel simulates/decodes it. A simple green, yellow, or red review card appears **before MetaMask** with **Reject** and **Continue to MetaMask** choices. Red requests require an extra acknowledgement. The full backend report—decoded arguments, findings/evidence, state changes, drainer matches, limitations, and raw JSON—is under **View full analysis** (expanded by default for yellow and red results). If analysis fails, a yellow **Unverified request** card explains why; the wallet request remains paused until you reject it or acknowledge the warning and explicitly choose **Continue unverified to MetaMask**. Continuing unverified does not mean Sentinel considers the request safe.

The popup is neutral until a request from the **current tab** has been analyzed. The verdict expires after five minutes and is a finding about one request, not a rating of the entire site. Green requires a low-risk, successfully simulated, decoded call; high/critical findings are red; medium, unknown, reverted, and signature-only results are yellow. Engine availability is shown separately as text. Disabling review explicitly makes supported requests pass through without analysis.

The popup and in-page approval card use the website's dark void/panel/cyan palette. The approval card forces a normal pointer and the demo website hides its custom cursor while the card is open, so controls remain easy to click.

Supported methods: `eth_sendTransaction`, `eth_sign`, `personal_sign`, `eth_signTypedData`, `eth_signTypedData_v3`, and `eth_signTypedData_v4`.

## Architecture

```text
dApp window.ethereum request
  -> MAIN-world provider wrapper
  -> isolated content script
  -> extension service worker
  -> POST http://127.0.0.1:8787/api/analyze
  -> in-page decision card
  -> reject, or forward to the original wallet provider
```

This remains a page-level prototype, not a wallet-native security boundary. It cannot inspect MetaMask's own extension pages, and a hostile page or alternate wallet API can bypass a page-world wrapper. Do not rely on it as production asset protection. The backend supports Sepolia only.

Run checks with:

```powershell
node tests/interceptor.test.mjs
node tests/analysis-flow.test.mjs
node tests/popup-status.test.mjs
node tests/approval-card.test.mjs
```
