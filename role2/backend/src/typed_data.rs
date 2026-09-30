use alloy_primitives::U256;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::str::FromStr;
use thiserror::Error;

use crate::types::{DecodedIntent, IntentKind};

/// JSON shape accepted by `eth_signTypedData` and `eth_signTypedData_v4`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TypedDataPayload {
    #[serde(default)]
    pub domain: Value,
    #[serde(default)]
    pub types: Value,
    pub primary_type: String,
    pub message: Value,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum TypedDataError {
    #[error("typed-data message must be a JSON object")]
    MessageIsNotObject,
    #[error("recognized {pattern} payload is missing `{field}`")]
    MissingField {
        pattern: &'static str,
        field: &'static str,
    },
}

/// Decode signing intent only. This function never claims that execution or an
/// on-chain state change has occurred.
pub fn decode_typed_data(payload: &TypedDataPayload) -> Result<DecodedIntent, TypedDataError> {
    if !payload.message.is_object() {
        return Err(TypedDataError::MessageIsNotObject);
    }
    let primary = payload.primary_type.to_ascii_lowercase();

    if primary == "permit" {
        return decode_permit(payload);
    }
    if primary.contains("permit") {
        return decode_permit2(payload);
    }
    if primary.contains("order") || primary.contains("offer") || looks_like_seaport(payload) {
        return Ok(DecodedIntent {
            title: "Sign a marketplace offer or listing".into(),
            function: format!("EIP-712 {}", payload.primary_type),
            decoded_args: json!({"domain": payload.domain, "primary_type": payload.primary_type, "message": payload.message}),
            unknown_calldata: false,
            kind: Some(IntentKind::MarketplaceOffer),
        });
    }

    Ok(DecodedIntent {
        title: "Sign unrecognized structured data".into(),
        function: format!("EIP-712 {}", payload.primary_type),
        decoded_args: json!({"domain": payload.domain, "types": payload.types, "primary_type": payload.primary_type, "message": payload.message}),
        unknown_calldata: true,
        kind: None,
    })
}

fn decode_permit(payload: &TypedDataPayload) -> Result<DecodedIntent, TypedDataError> {
    let owner = field_string(&payload.message, "owner").ok_or(TypedDataError::MissingField {
        pattern: "Permit",
        field: "owner",
    })?;
    let spender =
        field_string(&payload.message, "spender").ok_or(TypedDataError::MissingField {
            pattern: "Permit",
            field: "spender",
        })?;
    let value = field_string(&payload.message, "value")
        .or_else(|| field_string(&payload.message, "amount"))
        .ok_or(TypedDataError::MissingField {
            pattern: "Permit",
            field: "value",
        })?;
    let deadline =
        field_string(&payload.message, "deadline").ok_or(TypedDataError::MissingField {
            pattern: "Permit",
            field: "deadline",
        })?;
    let unlimited = is_unlimited_or_very_large(&value);
    Ok(DecodedIntent {
        title: if unlimited {
            "Sign unlimited token permit".into()
        } else {
            "Sign token permit".into()
        },
        function: "EIP-712 Permit".into(),
        decoded_args: json!({"domain": payload.domain, "owner": owner, "spender": spender, "value": value, "deadline": deadline, "unlimited_or_very_large": unlimited, "signature_only": true}),
        unknown_calldata: false,
        kind: Some(IntentKind::Permit {
            owner,
            spender,
            value,
            deadline,
            unlimited,
        }),
    })
}

fn decode_permit2(payload: &TypedDataPayload) -> Result<DecodedIntent, TypedDataError> {
    let spender = recursive_field_string(&payload.message, "spender").ok_or(
        TypedDataError::MissingField {
            pattern: "Permit2",
            field: "spender",
        },
    )?;
    let amount = recursive_field_string(&payload.message, "amount")
        .or_else(|| recursive_field_string(&payload.message, "value"))
        .ok_or(TypedDataError::MissingField {
            pattern: "Permit2",
            field: "amount",
        })?;
    let expiration = recursive_field_string(&payload.message, "expiration")
        .or_else(|| recursive_field_string(&payload.message, "deadline"));
    let unlimited = is_unlimited_or_very_large(&amount);
    Ok(DecodedIntent {
        title: if unlimited {
            "Sign a very large Permit2 allowance".into()
        } else {
            "Sign a Permit2 allowance".into()
        },
        function: format!("EIP-712 {}", payload.primary_type),
        decoded_args: json!({"domain": payload.domain, "spender": spender, "amount": amount, "expiration": expiration, "message": payload.message, "unlimited_or_very_large": unlimited, "signature_only": true}),
        unknown_calldata: false,
        kind: Some(IntentKind::Permit2 {
            spender,
            amount,
            expiration,
            unlimited,
        }),
    })
}

fn looks_like_seaport(payload: &TypedDataPayload) -> bool {
    let domain_name = field_string(&payload.domain, "name")
        .unwrap_or_default()
        .to_ascii_lowercase();
    domain_name.contains("seaport")
        || (payload.message.get("offer").is_some()
            && payload.message.get("consideration").is_some())
}

fn field_string(value: &Value, name: &str) -> Option<String> {
    value.get(name).and_then(value_string)
}

fn recursive_field_string(value: &Value, name: &str) -> Option<String> {
    match value {
        Value::Object(map) => map.get(name).and_then(value_string).or_else(|| {
            map.values()
                .find_map(|value| recursive_field_string(value, name))
        }),
        Value::Array(items) => items
            .iter()
            .find_map(|value| recursive_field_string(value, name)),
        _ => None,
    }
}

fn value_string(value: &Value) -> Option<String> {
    match value {
        Value::String(value) => Some(value.clone()),
        Value::Number(value) => Some(value.to_string()),
        _ => None,
    }
}

fn is_unlimited_or_very_large(value: &str) -> bool {
    let parsed = if let Some(hex) = value
        .strip_prefix("0x")
        .or_else(|| value.strip_prefix("0X"))
    {
        U256::from_str_radix(hex, 16).ok()
    } else {
        U256::from_str(value).ok()
    };
    parsed.is_some_and(|number| number == U256::MAX || number > U256::from(u128::MAX))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_eip712_permit_and_flags_max_value() {
        let payload: TypedDataPayload = serde_json::from_value(json!({
            "domain": {"name": "Demo Token", "version": "1", "chainId": 11155111, "verifyingContract": "0x1111111111111111111111111111111111111111"},
            "types": {"Permit": [
                {"name":"owner","type":"address"}, {"name":"spender","type":"address"},
                {"name":"value","type":"uint256"}, {"name":"deadline","type":"uint256"}
            ]},
            "primaryType": "Permit",
            "message": {
                "owner": "0x2222222222222222222222222222222222222222",
                "spender": "0x3333333333333333333333333333333333333333",
                "value": "115792089237316195423570985008687907853269984665640564039457584007913129639935",
                "deadline": "9999999999"
            }
        })).unwrap();
        let decoded = decode_typed_data(&payload).unwrap();
        assert_eq!(decoded.function, "EIP-712 Permit");
        assert_eq!(decoded.decoded_args["unlimited_or_very_large"], true);
        assert_eq!(decoded.decoded_args["signature_only"], true);
    }

    #[test]
    fn recognizes_seaport_shape() {
        let payload = TypedDataPayload {
            domain: json!({"name":"Seaport"}),
            types: json!({}),
            primary_type: "OrderComponents".into(),
            message: json!({"offer":[], "consideration":[]}),
        };
        assert!(matches!(
            decode_typed_data(&payload).unwrap().kind,
            Some(IntentKind::MarketplaceOffer)
        ));
    }
}
