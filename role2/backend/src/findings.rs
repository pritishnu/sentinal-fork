use serde_json::json;

use crate::types::{DecodedIntent, DrainerMatch, Finding, IntentKind, Severity};

pub fn generate_findings(intent: &DecodedIntent, matches: &[DrainerMatch]) -> Vec<Finding> {
    let mut findings = Vec::new();

    if let Some(kind) = &intent.kind {
        match kind {
            IntentKind::Approval { spender, amount, unlimited } => findings.push(Finding {
                severity: if *unlimited { Severity::High } else { Severity::Medium },
                title: if *unlimited { "Unlimited token approval requested" } else { "Token approval requested" }.into(),
                explanation: if *unlimited {
                    "This lets the spender move any amount of this token until the approval is revoked."
                } else {
                    "This lets the spender move tokens from the wallet up to the approved amount."
                }.into(),
                evidence: json!({"function": intent.function, "spender": spender, "amount": amount, "unlimited": unlimited}),
            }),
            IntentKind::CollectionApproval { operator, approved } if *approved => findings.push(Finding {
                severity: Severity::High,
                title: "Collection-wide NFT approval requested".into(),
                explanation: "This grants the operator permission to move every NFT in the collection until the approval is revoked.".into(),
                evidence: json!({"function": intent.function, "operator": operator, "approved": approved}),
            }),
            IntentKind::CollectionApproval { operator, approved } => findings.push(Finding {
                severity: Severity::Info,
                title: "Collection-wide NFT approval revoked".into(),
                explanation: "This removes an operator's permission to move NFTs in the collection.".into(),
                evidence: json!({"function": intent.function, "operator": operator, "approved": approved}),
            }),
            IntentKind::Transfer { from, to, amount_or_token_id } => findings.push(Finding {
                severity: Severity::High,
                title: "Token or NFT transfer requested".into(),
                explanation: "This call can move an asset to another address. The ABI alone cannot distinguish an ERC-20 amount from an ERC-721 token ID for this shared signature.".into(),
                evidence: json!({"function": intent.function, "from": from, "to": to, "amount_or_token_id": amount_or_token_id}),
            }),
            IntentKind::Erc1155Transfer { from, to, token_id, amount } => findings.push(Finding {
                severity: Severity::High,
                title: "ERC-1155 token transfer requested".into(),
                explanation: "This call moves one or more units of an ERC-1155 token to another address.".into(),
                evidence: json!({"function": intent.function, "from": from, "to": to, "token_id": token_id, "amount": amount}),
            }),
            IntentKind::Permit { owner, spender, value, deadline, unlimited } => findings.push(Finding {
                severity: if *unlimited { Severity::High } else { Severity::Medium },
                title: if *unlimited { "Unlimited token permit signature requested" } else { "Token permit signature requested" }.into(),
                explanation: if *unlimited {
                    "This signature grants a spender a very large or unlimited allowance without sending a separate approval transaction. No execution has occurred yet."
                } else {
                    "This signature can grant a token allowance without a separate approval transaction. No execution has occurred yet."
                }.into(),
                evidence: json!({"owner": owner, "spender": spender, "value": value, "deadline": deadline, "signature_only": true}),
            }),
            IntentKind::Permit2 { spender, amount, expiration, unlimited } => findings.push(Finding {
                severity: if *unlimited { Severity::High } else { Severity::Medium },
                title: "Permit2 allowance signature requested".into(),
                explanation: "This signature can authorize the spender through Permit2. No execution has occurred yet.".into(),
                evidence: json!({"spender": spender, "amount": amount, "expiration": expiration, "unlimited_or_very_large": unlimited, "signature_only": true}),
            }),
            IntentKind::MarketplaceOffer => findings.push(Finding {
                severity: Severity::Medium,
                title: "Marketplace offer or listing signature requested".into(),
                explanation: "This structured-data signature appears to authorize a marketplace order. Review every offered and requested item; no execution has occurred yet.".into(),
                evidence: json!({"function": intent.function, "message": intent.decoded_args.get("message")}),
            }),
            IntentKind::Unknown { selector, target, calldata_size, target_has_code, bytecode_checked } => findings.push(Finding {
                severity: Severity::Medium,
                title: "Unknown contract function".into(),
                explanation: if *bytecode_checked {
                    "Unknown function sent to a target whose code was checked; this local demo database did not establish that the call is safe."
                } else {
                    "Unknown function; target bytecode was not checked."
                }.into(),
                evidence: json!({"selector": selector, "target": target, "calldata_size": calldata_size, "target_has_code": target_has_code, "bytecode_checked": bytecode_checked}),
            }),
        }
    } else if intent.unknown_calldata {
        findings.push(Finding {
            severity: Severity::Medium,
            title: "Unrecognized signing intent".into(),
            explanation: "The structured request did not match a supported Permit, Permit2, or marketplace pattern.".into(),
            evidence: json!({"function": intent.function, "decoded_args": intent.decoded_args}),
        });
    }

    findings.extend(matches.iter().map(|matched| Finding {
        severity: matched.severity,
        title: format!("Local drainer signature match: {}", matched.label),
        explanation: "The target matched the small Sentinel Fork demo database. This is a local demonstration list, not comprehensive threat intelligence.".into(),
        evidence: json!({"entry_id": matched.entry_id, "source": matched.source, "matched_criteria": matched.matched_criteria}),
    }));
    findings
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::decode::decode_transaction;
    use alloy_primitives::Address;

    #[test]
    fn unknown_call_gets_verifiable_medium_finding() {
        let intent = decode_transaction(Address::ZERO, &[0xde, 0xad, 0xbe, 0xef]);
        let findings = generate_findings(&intent, &[]);
        assert_eq!(findings[0].severity, Severity::Medium);
        assert_eq!(findings[0].evidence["selector"], "0xdeadbeef");
    }
}
