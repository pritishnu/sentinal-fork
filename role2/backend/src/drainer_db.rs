use alloy_primitives::{Address, B256};
use thiserror::Error;

use crate::types::{address_string, DrainerDb, DrainerMatch, MatchCriterion};

const EMBEDDED_DB: &str = include_str!("../drainer-db/db.json");

#[derive(Debug, Error)]
pub enum DbError {
    #[error("invalid drainer database JSON: {0}")]
    InvalidJson(#[from] serde_json::Error),
}

pub fn load_embedded_db() -> Result<DrainerDb, DbError> {
    Ok(serde_json::from_str(EMBEDDED_DB)?)
}

/// Match against the embedded demo database. Criteria are independent: an
/// address, selector, or bytecode-hash match is surfaced on its own.
pub fn match_drainer_db(
    to: Address,
    selector: [u8; 4],
    bytecode_hash: Option<B256>,
) -> Vec<DrainerMatch> {
    load_embedded_db()
        .map(|db| match_drainer_db_with(&db, to, selector, bytecode_hash))
        .unwrap_or_default()
}

pub fn match_drainer_db_with(
    db: &DrainerDb,
    to: Address,
    selector: [u8; 4],
    bytecode_hash: Option<B256>,
) -> Vec<DrainerMatch> {
    let target = address_string(to);
    let selector = format!("0x{}", hex::encode(selector));
    let bytecode_hash = bytecode_hash.map(|hash| format!("{hash:#x}"));

    db.entries
        .iter()
        .filter_map(|entry| {
            let mut matched_criteria = Vec::new();
            if entry
                .addresses
                .iter()
                .any(|address| address.eq_ignore_ascii_case(&target))
            {
                matched_criteria.push(MatchCriterion::Address {
                    value: target.clone(),
                });
            }
            if entry
                .selectors
                .iter()
                .any(|item| item.eq_ignore_ascii_case(&selector))
            {
                matched_criteria.push(MatchCriterion::Selector {
                    value: selector.clone(),
                });
            }
            if let Some(hash) = &bytecode_hash {
                if entry
                    .bytecode_hashes
                    .iter()
                    .any(|item| item.eq_ignore_ascii_case(hash))
                {
                    matched_criteria.push(MatchCriterion::BytecodeHash {
                        value: hash.clone(),
                    });
                }
            }
            (!matched_criteria.is_empty()).then(|| DrainerMatch {
                entry_id: entry.id.clone(),
                label: entry.label.clone(),
                severity: entry.severity,
                source: entry.source.clone(),
                matched_criteria,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{DrainerEntry, Severity};

    fn sample_db() -> DrainerDb {
        DrainerDb {
            version: 1,
            entries: vec![DrainerEntry {
                id: "demo".into(),
                label: "Demo only".into(),
                chain_id: 11155111,
                addresses: vec!["0x1111111111111111111111111111111111111111".into()],
                selectors: vec!["0xa22cb465".into()],
                bytecode_hashes: vec![format!("{:#x}", B256::repeat_byte(7))],
                severity: Severity::Critical,
                source: "unit test".into(),
            }],
        }
    }

    #[test]
    fn independently_matches_address() {
        let to = "0x1111111111111111111111111111111111111111"
            .parse()
            .unwrap();
        let found = match_drainer_db_with(&sample_db(), to, [0, 0, 0, 0], None);
        assert!(matches!(
            found[0].matched_criteria[0],
            MatchCriterion::Address { .. }
        ));
    }

    #[test]
    fn independently_matches_selector() {
        let found =
            match_drainer_db_with(&sample_db(), Address::ZERO, [0xa2, 0x2c, 0xb4, 0x65], None);
        assert!(matches!(
            found[0].matched_criteria[0],
            MatchCriterion::Selector { .. }
        ));
    }

    #[test]
    fn no_match_returns_empty_list() {
        assert!(match_drainer_db_with(&sample_db(), Address::ZERO, [0, 0, 0, 0], None).is_empty());
    }

    #[test]
    fn embedded_claim_rewards_selector_is_computed_from_signature() {
        let hash = alloy_primitives::keccak256(b"claimRewards(address)");
        let selector: [u8; 4] = hash[..4].try_into().unwrap();
        assert_eq!(selector, [0xef, 0x5c, 0xfb, 0x8c]);
        assert!(!match_drainer_db(Address::ZERO, selector, None).is_empty());
    }
}
