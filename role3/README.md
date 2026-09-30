# Sentinel Fork contracts (Role 3)

This is a **Sepolia-only security-training demo**. `FakeRewardsDrainer` has exactly one external action: it verifies that the caller owns an NFT in the specified collection, then calls `setApprovalForAll(address(this), true)` on that collection. It contains no transfer, withdrawal, ownership, or asset-movement functions.

Run checks:

```powershell
$env:PATH = "$env:USERPROFILE\.foundry\bin;$env:PATH"
forge test -vv
```

Deploy only to Sepolia:

```powershell
forge script script/Deploy.s.sol --rpc-url $env:SEPOLIA_RPC_URL --broadcast
```

The deploy script rejects all non-Sepolia chain IDs and prints the addresses required by the frontend and drainer database.

Important: Solidity cannot make the wallet itself grant an ERC-721 approval from inside this contract. The ERC-721 sees this contract as `msg.sender`; this implementation is deliberately harmless and proves that no user asset approval or transfer is possible.
