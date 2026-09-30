use alloy_primitives::{Address, B256};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DecodedIntent {
    pub title: String,
    pub function: String,
    pub decoded_args: Value,
    pub unknown_calldata: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub kind: Option<IntentKind>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum IntentKind {
    Approval {
        spender: String,
        amount: String,
        unlimited: bool,
    },
    CollectionApproval {
        operator: String,
        approved: bool,
    },
    Transfer {
        from: Option<String>,
        to: String,
        amount_or_token_id: String,
    },
    Erc1155Transfer {
        from: String,
        to: String,
        token_id: String,
        amount: String,
    },
    Permit {
        owner: String,
        spender: String,
        value: String,
        deadline: String,
        unlimited: bool,
    },
    Permit2 {
        spender: String,
        amount: String,
        expiration: Option<String>,
        unlimited: bool,
    },
    MarketplaceOffer,
    Unknown {
        selector: String,
        target: String,
        calldata_size: usize,
        target_has_code: Option<bool>,
        bytecode_checked: bool,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    Info,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Finding {
    pub severity: Severity,
    pub title: String,
    pub explanation: String,
    pub evidence: Value,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DrainerDb {
    pub version: u32,
    pub entries: Vec<DrainerEntry>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DrainerEntry {
    pub id: String,
    pub label: String,
    pub chain_id: u64,
    pub addresses: Vec<String>,
    pub selectors: Vec<String>,
    pub bytecode_hashes: Vec<String>,
    pub severity: Severity,
    pub source: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DrainerMatch {
    pub entry_id: String,
    pub label: String,
    pub severity: Severity,
    pub source: String,
    pub matched_criteria: Vec<MatchCriterion>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "criterion", rename_all = "snake_case")]
pub enum MatchCriterion {
    Address { value: String },
    Selector { value: String },
    BytecodeHash { value: String },
}

#[derive(Debug, Clone, Copy, Default)]
pub struct TargetChainData {
    pub has_code: Option<bool>,
    pub bytecode_hash: Option<B256>,
}

pub(crate) fn address_string(address: Address) -> String {
    format!("{address:#x}")
}
