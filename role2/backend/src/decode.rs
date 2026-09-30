use alloy_primitives::{Address, B256, U256};
use alloy_sol_types::{sol, SolCall};
use serde_json::json;

use crate::types::{address_string, DecodedIntent, IntentKind};

mod erc20_approve {
    use super::*;
    sol!(function approve(address spender, uint256 amount););
}
mod erc20_transfer {
    use super::*;
    sol!(function transfer(address to, uint256 amount););
}
mod transfer_from {
    use super::*;
    sol!(function transferFrom(address from, address to, uint256 amount););
}
mod approval_for_all {
    use super::*;
    sol!(function setApprovalForAll(address operator, bool approved););
}
mod erc721_safe_transfer {
    use super::*;
    sol!(function safeTransferFrom(address from, address to, uint256 tokenId););
}
mod erc721_safe_transfer_data {
    use super::*;
    sol!(function safeTransferFrom(address from, address to, uint256 tokenId, bytes data););
}
mod erc1155_safe_transfer {
    use super::*;
    sol!(function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data););
}
mod eip2612_permit {
    use super::*;
    sol!(function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s););
}

/// Optional chain-read integration supplied by the simulation/RPC layer.
pub trait ChainLookup {
    fn has_code(&self, address: Address) -> Option<bool>;
    fn code_hash_at(&self, address: Address) -> Option<B256>;
}

/// Decode without performing or implying any chain lookup.
pub fn decode_transaction(to: Address, data: &[u8]) -> DecodedIntent {
    decode_inner(to, data, None)
}

/// Decode and enrich unknown-call fallback data using a caller-owned RPC adapter.
pub fn decode_transaction_with_lookup(
    to: Address,
    data: &[u8],
    lookup: &dyn ChainLookup,
) -> DecodedIntent {
    decode_inner(to, data, Some(lookup))
}

fn decode_inner(to: Address, data: &[u8], lookup: Option<&dyn ChainLookup>) -> DecodedIntent {
    if let Some(call) = decode_call::<erc20_approve::approveCall>(data) {
        let amount = call.amount.to_string();
        let unlimited = call.amount == U256::MAX;
        return intent(
            if unlimited {
                "Approve unlimited spending"
            } else {
                "Approve token spending"
            },
            "approve(address,uint256)",
            json!({"spender": address_string(call.spender), "amount": amount, "unlimited": unlimited}),
            IntentKind::Approval {
                spender: address_string(call.spender),
                amount,
                unlimited,
            },
        );
    }
    if let Some(call) = decode_call::<erc20_transfer::transferCall>(data) {
        return transfer_intent("transfer(address,uint256)", None, call.to, call.amount);
    }
    if let Some(call) = decode_call::<transfer_from::transferFromCall>(data) {
        let from = address_string(call.from);
        return transfer_intent(
            "transferFrom(address,address,uint256)",
            Some(from),
            call.to,
            call.amount,
        );
    }
    if let Some(call) = decode_call::<approval_for_all::setApprovalForAllCall>(data) {
        let operator = address_string(call.operator);
        return intent(
            if call.approved {
                "Grant collection-wide approval"
            } else {
                "Revoke collection-wide approval"
            },
            "setApprovalForAll(address,bool)",
            json!({"operator": operator, "approved": call.approved}),
            IntentKind::CollectionApproval {
                operator,
                approved: call.approved,
            },
        );
    }
    if let Some(call) = decode_call::<erc721_safe_transfer::safeTransferFromCall>(data) {
        return transfer_intent(
            "safeTransferFrom(address,address,uint256)",
            Some(address_string(call.from)),
            call.to,
            call.tokenId,
        );
    }
    if let Some(call) = decode_call::<erc721_safe_transfer_data::safeTransferFromCall>(data) {
        let mut decoded = transfer_intent(
            "safeTransferFrom(address,address,uint256,bytes)",
            Some(address_string(call.from)),
            call.to,
            call.tokenId,
        );
        decoded.decoded_args["data"] = json!(format!("0x{}", hex::encode(call.data)));
        return decoded;
    }
    if let Some(call) = decode_call::<erc1155_safe_transfer::safeTransferFromCall>(data) {
        let from = address_string(call.from);
        let to_address = address_string(call.to);
        let token_id = call.id.to_string();
        let amount = call.amount.to_string();
        return intent(
            "Transfer ERC-1155 tokens",
            "safeTransferFrom(address,address,uint256,uint256,bytes)",
            json!({"from": from, "to": to_address, "token_id": token_id, "amount": amount, "data": format!("0x{}", hex::encode(call.data))}),
            IntentKind::Erc1155Transfer {
                from,
                to: to_address,
                token_id,
                amount,
            },
        );
    }
    if let Some(call) = decode_call::<eip2612_permit::permitCall>(data) {
        let owner = address_string(call.owner);
        let spender = address_string(call.spender);
        let value = call.value.to_string();
        let deadline = call.deadline.to_string();
        let unlimited = call.value == U256::MAX;
        return intent(
            if unlimited {
                "Permit unlimited token spending"
            } else {
                "Permit token spending"
            },
            "permit(address,address,uint256,uint256,uint8,bytes32,bytes32)",
            json!({"owner": owner, "spender": spender, "value": value, "deadline": deadline, "v": call.v, "r": format!("{:#x}", call.r), "s": format!("{:#x}", call.s), "unlimited": unlimited}),
            IntentKind::Permit {
                owner,
                spender,
                value,
                deadline,
                unlimited,
            },
        );
    }

    let target_has_code = lookup.and_then(|item| item.has_code(to));
    unknown_intent(to, data, target_has_code, target_has_code.is_some())
}

fn decode_call<T: SolCall>(data: &[u8]) -> Option<T> {
    (data.len() >= 4 && data[..4] == T::SELECTOR)
        .then(|| T::abi_decode(data, true).ok())
        .flatten()
}

fn transfer_intent(
    function: &str,
    from: Option<String>,
    to: Address,
    value: U256,
) -> DecodedIntent {
    let to = address_string(to);
    let amount_or_token_id = value.to_string();
    intent(
        "Transfer tokens or an NFT",
        function,
        json!({"from": from, "to": to, "amount_or_token_id": amount_or_token_id}),
        IntentKind::Transfer {
            from,
            to,
            amount_or_token_id,
        },
    )
}

fn unknown_intent(
    to: Address,
    data: &[u8],
    target_has_code: Option<bool>,
    bytecode_checked: bool,
) -> DecodedIntent {
    let selector = if data.len() >= 4 {
        format!("0x{}", hex::encode(&data[..4]))
    } else {
        format!("0x{}", hex::encode(data))
    };
    let target = address_string(to);
    DecodedIntent {
        title: "Unknown contract call".into(),
        function: "unknown".into(),
        decoded_args: json!({"selector": selector, "target": target, "calldata_size": data.len(), "target_has_code": target_has_code, "bytecode_checked": bytecode_checked}),
        unknown_calldata: true,
        kind: Some(IntentKind::Unknown {
            selector,
            target,
            calldata_size: data.len(),
            target_has_code,
            bytecode_checked,
        }),
    }
}

fn intent(
    title: &str,
    function: &str,
    decoded_args: serde_json::Value,
    kind: IntentKind,
) -> DecodedIntent {
    DecodedIntent {
        title: title.into(),
        function: function.into(),
        decoded_args,
        unknown_calldata: false,
        kind: Some(kind),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use alloy_sol_types::SolCall;

    fn address(hex: &str) -> Address {
        hex.parse().unwrap()
    }

    #[test]
    fn decodes_erc20_approve() {
        let spender = address("0x1111111111111111111111111111111111111111");
        let data = erc20_approve::approveCall {
            spender,
            amount: U256::MAX,
        }
        .abi_encode();
        let decoded = decode_transaction(Address::ZERO, &data);
        assert_eq!(decoded.function, "approve(address,uint256)");
        assert_eq!(decoded.decoded_args["spender"], address_string(spender));
        assert_eq!(decoded.decoded_args["unlimited"], true);
    }

    #[test]
    fn decodes_erc721_approval_for_all() {
        let operator = address("0x2222222222222222222222222222222222222222");
        let data = approval_for_all::setApprovalForAllCall {
            operator,
            approved: true,
        }
        .abi_encode();
        let decoded = decode_transaction(Address::ZERO, &data);
        assert_eq!(decoded.function, "setApprovalForAll(address,bool)");
        assert_eq!(decoded.decoded_args["operator"], address_string(operator));
    }

    #[test]
    fn decodes_erc721_transfer_from() {
        let from = address("0x3333333333333333333333333333333333333333");
        let to = address("0x4444444444444444444444444444444444444444");
        let data = transfer_from::transferFromCall {
            from,
            to,
            amount: U256::from(42),
        }
        .abi_encode();
        let decoded = decode_transaction(Address::ZERO, &data);
        assert_eq!(decoded.decoded_args["amount_or_token_id"], "42");
        assert_eq!(decoded.decoded_args["to"], address_string(to));
    }

    #[test]
    fn unknown_is_not_silently_dropped() {
        let decoded = decode_transaction(Address::ZERO, &[0xde, 0xad, 0xbe, 0xef, 1]);
        assert!(decoded.unknown_calldata);
        assert_eq!(decoded.decoded_args["selector"], "0xdeadbeef");
        assert_eq!(decoded.decoded_args["calldata_size"], 5);
        assert_eq!(decoded.decoded_args["bytecode_checked"], false);
    }
}
