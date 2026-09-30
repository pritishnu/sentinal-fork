use anyhow::{bail, Result};
use serde_json::{json, Value};
use tokio::time::{sleep, Duration};

use crate::{
    api::{AnalyzeRequest, AnalyzeResponse, Finding, Simulation, StateDiff},
    decode::{
        decode_signature_request, decode_transaction_request, DecodedAnalysis, DecodedKind,
        StaticChainLookup,
    },
    diff::{approval_diff, native_diff},
    risk, AppState,
};

pub async fn simulate(state: AppState, request: AnalyzeRequest) -> Result<AnalyzeResponse> {
    if request.chain_id != 11155111 {
        return Ok(unsupported(
            "Only Sepolia (chain_id 11155111) is supported by this demo backend.",
        ));
    }
    if request.request_type == "signature" {
        return Ok(signature_response(decode_signature_request(
            &request.to,
            &request.data,
        )));
    }
    if request.request_type != "transaction" {
        return Ok(unsupported(
            "request_type must be transaction or signature.",
        ));
    }
    validate_address(&request.from)?;
    validate_address(&request.to)?;
    let upstream = state.anvil.upstream_url(request.rpc_url.as_deref());
    let (local, fork_block) = state.anvil.ensure_fork(&upstream).await?;
    let target: alloy_primitives::Address = request.to.parse()?;
    let runtime_code = state
        .anvil
        .rpc(&local, "eth_getCode", json!([request.to, "latest"]))
        .await?
        .as_str()
        .unwrap_or("0x")
        .to_owned();
    let runtime_bytes = hex::decode(runtime_code.trim_start_matches("0x")).unwrap_or_default();
    let lookup = StaticChainLookup {
        target,
        has_code: !runtime_bytes.is_empty(),
        bytecode_hash: (!runtime_bytes.is_empty())
            .then(|| alloy_primitives::keccak256(&runtime_bytes)),
    };
    let decoded = decode_transaction_request(&request.to, &request.data, Some(&lookup))
        .map_err(anyhow::Error::msg)?;
    state
        .anvil
        .rpc(&local, "anvil_impersonateAccount", json!([request.from]))
        .await?;
    // This is an Anvil-only balance mutation. It is never sent to the upstream Sepolia RPC.
    state
        .anvil
        .rpc(
            &local,
            "anvil_setBalance",
            json!([request.from, "0x3635C9ADC5DEA00000"]),
        )
        .await?;
    let before_native = state
        .anvil
        .rpc(&local, "eth_getBalance", json!([request.from, "latest"]))
        .await?
        .as_str()
        .unwrap_or("0x0")
        .to_owned();
    let before_target_native = state
        .anvil
        .rpc(&local, "eth_getBalance", json!([request.to, "latest"]))
        .await?
        .as_str()
        .unwrap_or("0x0")
        .to_owned();
    let before_approval = if let DecodedKind::Approve { spender, .. } = &decoded.kind {
        Some((
            spender.clone(),
            erc20_allowance(&state, &local, &request.to, &request.from, spender).await?,
        ))
    } else {
        None
    };
    let before_nft_operator = if let DecodedKind::SetApprovalForAll { operator, .. } = &decoded.kind
    {
        Some((
            operator.clone(),
            nft_operator_approval(&state, &local, &request.to, &request.from, operator).await?,
        ))
    } else {
        None
    };
    let tx = json!({"from":request.from,"to":request.to,"value":request.value,"data":request.data,"gas":"0x7A1200"});
    let send = state
        .anvil
        .rpc(&local, "eth_sendTransaction", json!([tx]))
        .await;
    let mut limitations = Vec::new();
    let (status, gas_used, receipt) = match send {
        Ok(hash) => match receipt(&state, &local, &hash).await? {
            Some(value) if value.get("status").and_then(Value::as_str) == Some("0x1") => (
                "success".into(),
                value
                    .get("gasUsed")
                    .and_then(Value::as_str)
                    .unwrap_or("0x0")
                    .into(),
                Some(value),
            ),
            Some(value) => (
                "reverted".into(),
                value
                    .get("gasUsed")
                    .and_then(Value::as_str)
                    .unwrap_or("0x0")
                    .into(),
                Some(value),
            ),
            None => {
                limitations
                    .push("Fork transaction receipt was not available before timeout.".into());
                ("reverted".into(), "0x0".into(), None)
            }
        },
        Err(error) => {
            limitations.push(format!("Fork execution reverted or was rejected: {error}"));
            ("reverted".into(), "0x0".into(), None)
        }
    };
    let after_native = state
        .anvil
        .rpc(&local, "eth_getBalance", json!([request.from, "latest"]))
        .await?
        .as_str()
        .unwrap_or("0x0")
        .to_owned();
    let after_target_native = state
        .anvil
        .rpc(&local, "eth_getBalance", json!([request.to, "latest"]))
        .await?
        .as_str()
        .unwrap_or("0x0")
        .to_owned();
    let mut state_diff = StateDiff::default();
    if let Some(diff) = native_diff(&request.from, &before_native, &after_native) {
        state_diff.native.push(diff);
    }
    if let Some(diff) = native_diff(&request.to, &before_target_native, &after_target_native) {
        state_diff.native.push(diff);
    }
    let mut findings = decoded.findings.clone();
    if let Some((spender, before)) = before_approval {
        let after = erc20_allowance(&state, &local, &request.to, &request.from, &spender).await?;
        if let Some(diff) = approval_diff(&request.to, &request.from, &spender, &before, &after) {
            state_diff.approvals.push(diff);
        }
    }
    if let Some((operator, before)) = before_nft_operator {
        let after =
            nft_operator_approval(&state, &local, &request.to, &request.from, &operator).await?;
        if before != after {
            state_diff.approvals.push(json!({
                "standard": "erc721", "token": request.to, "owner": request.from, "operator": operator,
                "before": before, "after": after,
                "evidence": {"before_raw": before, "after_raw": after}
            }));
        }
    }
    if let Some(receipt) = receipt.as_ref() {
        expand_standard_logs(receipt, &mut state_diff, &mut findings);
    }
    if status == "reverted" {
        findings.push(finding("medium", "Transaction reverted on the fork", "The simulated transaction did not complete. This is not a safety verdict; review the requested intent and limitations."));
    }
    if decoded.intent.unknown_calldata {
        limitations.push("The function selector is not recognized; no low-risk conclusion should be inferred from the simulation alone.".into());
    }
    if receipt.is_none() && status == "success" {
        limitations.push("No receipt logs were available to expand the watch set.".into());
    }
    let risk = risk::score(&findings);
    Ok(AnalyzeResponse {
        simulation: Simulation {
            status,
            fork_block,
            gas_used,
        },
        intent: decoded.intent,
        findings,
        state_diff,
        drainer_matches: decoded.drainer_matches,
        risk,
        limitations,
    })
}

async fn erc20_allowance(
    state: &AppState,
    rpc: &str,
    token: &str,
    owner: &str,
    spender: &str,
) -> Result<String> {
    let owner = owner.trim_start_matches("0x");
    let spender = spender.trim_start_matches("0x");
    let data = format!("0xdd62ed3e{:0>64}{:0>64}", owner, spender);
    Ok(state
        .anvil
        .rpc(rpc, "eth_call", json!([{"to":token,"data":data}, "latest"]))
        .await?
        .as_str()
        .unwrap_or("0x0")
        .to_owned())
}

async fn nft_operator_approval(
    state: &AppState,
    rpc: &str,
    token: &str,
    owner: &str,
    operator: &str,
) -> Result<bool> {
    let data = format!(
        "0xe985e9c5{:0>64}{:0>64}",
        owner.trim_start_matches("0x"),
        operator.trim_start_matches("0x")
    );
    let value = state
        .anvil
        .rpc(rpc, "eth_call", json!([{"to":token,"data":data}, "latest"]))
        .await?;
    Ok(value.as_str().unwrap_or("0x0").ends_with('1'))
}

fn expand_standard_logs(receipt: &Value, state_diff: &mut StateDiff, findings: &mut Vec<Finding>) {
    const TRANSFER: &str = "0xddf252ad";
    const APPROVAL_FOR_ALL: &str = "0x17307eab";
    for log in receipt
        .get("logs")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
    {
        let Some(topic0) = log
            .get("topics")
            .and_then(Value::as_array)
            .and_then(|topics| topics.first())
            .and_then(Value::as_str)
        else {
            continue;
        };
        let address = log
            .get("address")
            .and_then(Value::as_str)
            .unwrap_or_default();
        if topic0.starts_with(TRANSFER) {
            state_diff.erc20.push(json!({"token": address, "event": "Transfer", "evidence": {"topics": log["topics"], "data": log["data"]}}));
            findings.push(finding(
                "high",
                "Asset transfer",
                "A standard Transfer event was emitted during the fork simulation.",
            ));
        } else if topic0.starts_with(APPROVAL_FOR_ALL) {
            state_diff.approvals.push(json!({"standard": "erc721_or_erc1155", "token": address, "event": "ApprovalForAll", "evidence": {"topics": log["topics"], "data": log["data"]}}));
        }
    }
}
async fn receipt(state: &AppState, rpc: &str, hash: &Value) -> Result<Option<Value>> {
    for _ in 0..30 {
        let value = state
            .anvil
            .rpc(rpc, "eth_getTransactionReceipt", json!([hash]))
            .await?;
        if !value.is_null() {
            return Ok(Some(value));
        }
        sleep(Duration::from_millis(100)).await;
    }
    Ok(None)
}
fn validate_address(value: &str) -> Result<()> {
    if value.len() == 42
        && value.starts_with("0x")
        && value[2..].bytes().all(|b| b.is_ascii_hexdigit())
    {
        Ok(())
    } else {
        bail!("invalid EVM address: {value}")
    }
}
fn finding(severity: &str, title: &str, explanation: &str) -> Finding {
    Finding {
        severity: severity.into(),
        title: title.into(),
        explanation: explanation.into(),
        evidence: json!({}),
    }
}
fn unsupported(message: &str) -> AnalyzeResponse {
    let mut result = crate::api::stub_response();
    result.limitations = vec![message.into()];
    result
}
fn signature_response(decoded: DecodedAnalysis) -> AnalyzeResponse {
    let risk = risk::score(&decoded.findings);
    AnalyzeResponse {
        simulation: Simulation {
            status: "signature_no_evm_execution".into(),
            fork_block: 0,
            gas_used: "0x0".into(),
        },
        intent: decoded.intent,
        findings: decoded.findings,
        state_diff: StateDiff::default(),
        drainer_matches: decoded.drainer_matches,
        risk,
        limitations: vec!["Signature intent was decoded without executing EVM code; no on-chain state change has occurred.".into()],
    }
}
