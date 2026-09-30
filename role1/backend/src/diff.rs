use serde_json::{json, Value};

pub fn quantity_to_decimal(quantity: &str) -> String {
    u128::from_str_radix(quantity.trim_start_matches("0x"), 16)
        .unwrap_or(0)
        .to_string()
}

pub fn native_diff(address: &str, before: &str, after: &str) -> Option<Value> {
    if before == after {
        None
    } else {
        Some(
            json!({"address": address, "before": quantity_to_decimal(before), "after": quantity_to_decimal(after), "evidence": {"before_raw": before, "after_raw": after}}),
        )
    }
}

pub fn approval_diff(
    token: &str,
    owner: &str,
    spender: &str,
    before: &str,
    after: &str,
) -> Option<Value> {
    if before == after {
        None
    } else {
        Some(
            json!({"standard":"erc20", "token":token, "owner":owner, "spender":spender, "before":quantity_to_decimal(before), "after":quantity_to_decimal(after), "evidence":{"before_raw":before,"after_raw":after}}),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn computes_displayable_native_delta() {
        let item = native_diff("0xa", "0x0", "0xa").unwrap();
        assert_eq!(item["after"], "10");
        assert!(native_diff("0xa", "0x1", "0x1").is_none());
    }
}
