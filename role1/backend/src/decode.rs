use alloy_primitives::{Address, B256};
use sentinel_fork_decoder::{
    decode_transaction, decode_transaction_with_lookup, decode_typed_data, generate_findings,
    match_drainer_db, ChainLookup, DecodedIntent as LibraryIntent, DrainerMatch, IntentKind,
    Severity, TypedDataPayload,
};
use serde_json::{json, Value};

use crate::api::{Finding, Intent};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DecodedKind {
    Approve {
        spender: String,
        amount: String,
        unlimited: bool,
    },
    SetApprovalForAll {
        operator: String,
        approved: bool,
    },
    Unknown,
}

#[derive(Debug, Clone)]
pub struct DecodedAnalysis {
    pub intent: Intent,
    pub kind: DecodedKind,
    pub findings: Vec<Finding>,
    pub drainer_matches: Vec<Value>,
}

/// Snapshot-backed adapter that enriches Role 2 without giving it network access.
pub struct StaticChainLookup {
    pub target: Address,
    pub has_code: bool,
    pub bytecode_hash: Option<B256>,
}

impl ChainLookup for StaticChainLookup {
    fn has_code(&self, address: Address) -> Option<bool> {
        (address == self.target).then_some(self.has_code)
    }

    fn code_hash_at(&self, address: Address) -> Option<B256> {
        (address == self.target)
            .then_some(self.bytecode_hash)
            .flatten()
    }
}

pub fn decode_transaction_request(
    to: &str,
    data: &str,
    lookup: Option<&dyn ChainLookup>,
) -> Result<DecodedAnalysis, String> {
    let target: Address = to
        .parse()
        .map_err(|_| format!("invalid EVM address: {to}"))?;
    let calldata = decode_hex(data)?;
    let intent = match lookup {
        Some(lookup) => decode_transaction_with_lookup(target, &calldata, lookup),
        None => decode_transaction(target, &calldata),
    };
    let selector = calldata
        .get(..4)
        .and_then(|slice| slice.try_into().ok())
        .unwrap_or([0; 4]);
    let bytecode_hash = lookup.and_then(|lookup| lookup.code_hash_at(target));
    let mut matches = match_drainer_db(target, selector, bytecode_hash);

    // Approval calls target a token, while the suspicious address is carried
    // in the spender/operator argument. Match both independently.
    for candidate in related_addresses(&intent) {
        if candidate != target {
            merge_matches(&mut matches, match_drainer_db(candidate, [0; 4], None));
        }
    }
    Ok(build_analysis(intent, matches))
}

pub fn decode_signature_request(to: &str, data: &str) -> DecodedAnalysis {
    let intent = serde_json::from_str::<TypedDataPayload>(data)
        .ok()
        .and_then(|payload| decode_typed_data(&payload).ok())
        .unwrap_or_else(|| LibraryIntent {
            title: "Sign unrecognized wallet data".into(),
            function: "wallet signature".into(),
            decoded_args: json!({"payload_type": "opaque_or_unsupported", "signature_only": true}),
            unknown_calldata: true,
            kind: None,
        });

    let mut matches = Vec::new();
    if let Ok(target) = to.parse::<Address>() {
        merge_matches(&mut matches, match_drainer_db(target, [0; 4], None));
    }
    for candidate in related_addresses(&intent) {
        merge_matches(&mut matches, match_drainer_db(candidate, [0; 4], None));
    }
    build_analysis(intent, matches)
}

fn build_analysis(intent: LibraryIntent, matches: Vec<DrainerMatch>) -> DecodedAnalysis {
    let kind = match intent.kind.as_ref() {
        Some(IntentKind::Approval {
            spender,
            amount,
            unlimited,
        }) => DecodedKind::Approve {
            spender: spender.clone(),
            amount: amount.clone(),
            unlimited: *unlimited,
        },
        Some(IntentKind::CollectionApproval { operator, approved }) => {
            DecodedKind::SetApprovalForAll {
                operator: operator.clone(),
                approved: *approved,
            }
        }
        _ => DecodedKind::Unknown,
    };
    let findings = generate_findings(&intent, &matches)
        .into_iter()
        .map(|finding| Finding {
            severity: severity_name(finding.severity).into(),
            title: finding.title,
            explanation: finding.explanation,
            evidence: finding.evidence,
        })
        .collect();
    let drainer_matches = matches
        .into_iter()
        .filter_map(|matched| serde_json::to_value(matched).ok())
        .collect();
    DecodedAnalysis {
        intent: Intent {
            title: intent.title,
            function: intent.function,
            decoded_args: intent.decoded_args,
            unknown_calldata: intent.unknown_calldata,
        },
        kind,
        findings,
        drainer_matches,
    }
}

fn related_addresses(intent: &LibraryIntent) -> Vec<Address> {
    let values: Vec<&str> = match intent.kind.as_ref() {
        Some(IntentKind::Approval { spender, .. }) => vec![spender],
        Some(IntentKind::CollectionApproval { operator, .. }) => vec![operator],
        Some(IntentKind::Transfer { to, .. }) => vec![to],
        Some(IntentKind::Erc1155Transfer { to, .. }) => vec![to],
        Some(IntentKind::Permit { spender, .. }) => vec![spender],
        Some(IntentKind::Permit2 { spender, .. }) => vec![spender],
        _ => Vec::new(),
    };
    values
        .into_iter()
        .filter_map(|value| value.parse().ok())
        .collect()
}

fn merge_matches(existing: &mut Vec<DrainerMatch>, incoming: Vec<DrainerMatch>) {
    for mut candidate in incoming {
        if let Some(current) = existing
            .iter_mut()
            .find(|item| item.entry_id == candidate.entry_id)
        {
            for criterion in candidate.matched_criteria.drain(..) {
                if !current.matched_criteria.contains(&criterion) {
                    current.matched_criteria.push(criterion);
                }
            }
        } else {
            existing.push(candidate);
        }
    }
}

fn decode_hex(data: &str) -> Result<Vec<u8>, String> {
    let value = data.strip_prefix("0x").unwrap_or(data);
    if value.is_empty() {
        return Ok(Vec::new());
    }
    hex::decode(value).map_err(|_| "transaction data must be hexadecimal".into())
}

fn severity_name(severity: Severity) -> &'static str {
    match severity {
        Severity::Info => "info",
        Severity::Medium => "medium",
        Severity::High => "high",
        Severity::Critical => "critical",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const DRAINER: &str = "0x251a5db73994b8127821d6d9d83b29e7c9604697";

    #[test]
    fn decodes_frontend_approval_and_matches_operator_address() {
        let calldata = format!(
            "0xa22cb465{:0>64}{:0>64}",
            DRAINER.trim_start_matches("0x"),
            "1"
        );
        let analysis = decode_transaction_request(
            "0x18525b9229f983ae2aa61bb921ca6f516f3156b1",
            &calldata,
            None,
        )
        .unwrap();
        assert_eq!(analysis.intent.function, "setApprovalForAll(address,bool)");
        assert!(!analysis.drainer_matches.is_empty());
        assert!(analysis
            .findings
            .iter()
            .any(|finding| finding.severity == "critical"));
    }

    #[test]
    fn decodes_eip712_signature_without_claiming_execution() {
        let payload = json!({
            "domain": {"name": "Demo", "chainId": 11155111},
            "types": {},
            "primaryType": "Permit",
            "message": {
                "owner": "0x1111111111111111111111111111111111111111",
                "spender": DRAINER,
                "value": "1",
                "deadline": "9999999999"
            }
        });
        let analysis = decode_signature_request(&Address::ZERO.to_string(), &payload.to_string());
        assert_eq!(analysis.intent.function, "EIP-712 Permit");
        assert_eq!(analysis.intent.decoded_args["signature_only"], true);
    }
}
