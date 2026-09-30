# Sentinel Fork — Product Requirements & Technical Specification

## Overview
**Sentinel Fork** is a Web3 transaction security engine and pre-execution simulation platform. It intercepts wallet transaction requests before signature or broadcast, simulates state transitions on a local EVM fork, decodes contract intent, and evaluates potential malicious patterns (such as setApprovalForAll drains, Permit2 exploits, unverified proxy upgrades, and ice-phishing attacks).

This document serves as the product specification and frontend-backend interface contract.

---

## 1. Core User Workflows & Scenarios

### 1.1 dApp Security Sandbox
The interactive demo provides a simulation studio where users can test how Sentinel Fork protects wallets across 4 key Web3 attack/transaction scenarios:

1. **Scenario A: NFT Drainer (`setApprovalForAll`)** — *Critical Risk (Score: 94)*
   - **Target**: Malicious NFT Mint / Claim Page.
   - **Attack vector**: Requests `setApprovalForAll(operator, true)` to an unverified contract deployed <1h ago matching known drainer bytecode family `0xDRAIN-7B`.
   - **State Diff**: Grants operator full transfer authority over all owned NFTs in collection.

2. **Scenario B: Permit2 Unlimited Signature Drainer** — *High Risk (Score: 88)*
   - **Target**: Fake Token Airdrop / Staking Vault.
   - **Attack vector**: Prompts off-chain EIP-712 typed signature granting unlimited Permit2 spending allowance for USDC/WETH to an unverified spender.
   - **State Diff**: Unlimited ERC20 allowance set for `0xPermit2...`.

3. **Scenario C: Malicious Proxy Upgrade / Route Hijack** — *Medium Risk (Score: 62)*
   - **Target**: Fake DEX Router.
   - **Attack vector**: Unverified proxy implementation upgraded recently with uninitialized ownership and high gas consumption anomaly.
   - **State Diff**: Native ETH transferred to unverified proxy vault.

4. **Scenario D: Standard Safe Uniswap V3 Swap** — *Low Risk (Score: 8)*
   - **Target**: Verified Uniswap V3 Router.
   - **Attack vector**: None. Standard ETH -> DAI swap with exact output verification.
   - **State Diff**: -1.0 ETH, +3,450 DAI.

---

## 2. Architecture & Backend Integration Points

### 2.1 Frontend State & Mock Services
The frontend exposes a clean, decoupled data pipeline for backend integration:
- `types/analyze.ts`: Full TypeScript schema for simulation requests & responses.
- `data/mockScenarios.ts`: Pre-packaged mock simulation responses for each attack vector.
- `services/api.ts`: Backend service abstraction that switches between Mock Engine and Live RPC (`POST /api/v1/analyze`).

### 2.2 Expected Backend API Contract
```typescript
POST /api/v1/analyze
Request Body:
{
  "chain_id": 1 | 11155111 | 42161 | 137,
  "from": string,
  "to": string,
  "data": string,
  "value": string,
  "gas": string
}

Response Body: AnalyzeResponse (matching src/types/analyze.ts)
```

---

## 3. UI/UX Design System Guidelines

- **Theme**: Dark Cyberpunk / Deep Space Glassmorphism (`bg-void`, `bg-panel`, `cyan-glow`, `plasma-purple`, `emerald-safe`, `amber-medium`, `rose-critical`).
- **Typography**: Space Grotesk / Inter (`font-display`), JetBrains Mono (`font-mono`).
- **Animations**: GSAP motion choreography, glowing state badges, live radar pulse, interactive card hover lift effects.
- **Interactions**:
  - Live scenario switching tabs with real-time risk radar update.
  - Interactive Web3 dApp simulation widget (Connect Wallet, Scenario Controls, Live Execution Log).
  - High-precision Security Interceptor Modal (`ReportModal`) with tabbed breakdown (Risk Overview, Findings, Decoded Calls, State Diff Tree, Drainer Database Matches, JSON Payload Inspector).
