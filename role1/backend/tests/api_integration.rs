use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use tower::ServiceExt;

#[tokio::test]
async fn typed_permit_flows_through_api_decoder_and_drainer_database() {
    let typed_data = json!({
        "domain": {"name": "Sentinel Demo", "chainId": 11155111},
        "types": {},
        "primaryType": "Permit",
        "message": {
            "owner": "0x1111111111111111111111111111111111111111",
            "spender": "0x251a5db73994b8127821d6d9d83b29e7c9604697",
            "value": "1",
            "deadline": "9999999999"
        }
    });
    let request_body = json!({
        "chain_id": 11155111,
        "request_type": "signature",
        "from": "0x1111111111111111111111111111111111111111",
        "to": "0x0000000000000000000000000000000000000000",
        "value": "0x0",
        "data": typed_data.to_string(),
        "origin": "http://127.0.0.1:5173"
    });

    let response = sentinel_fork_backend::app()
        .oneshot(
            Request::post("/api/analyze")
                .header("content-type", "application/json")
                .body(Body::from(request_body.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let bytes = response.into_body().collect().await.unwrap().to_bytes();
    let report: Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(report["simulation"]["status"], "signature_no_evm_execution");
    assert_eq!(report["intent"]["function"], "EIP-712 Permit");
    assert_eq!(report["risk"]["severity"], "critical");
    assert_eq!(report["drainer_matches"].as_array().unwrap().len(), 1);
}
