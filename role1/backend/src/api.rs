use axum::{
    extract::State,
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tower_http::cors::CorsLayer;

use crate::{simulate::simulate, AppState};

#[derive(Debug, Clone, Deserialize)]
pub struct AnalyzeRequest {
    pub chain_id: u64,
    pub request_type: String,
    pub from: String,
    pub to: String,
    pub value: String,
    pub data: String,
    pub origin: String,
    pub rpc_url: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AnalyzeResponse {
    pub simulation: Simulation,
    pub intent: Intent,
    pub findings: Vec<Finding>,
    pub state_diff: StateDiff,
    pub drainer_matches: Vec<Value>,
    pub risk: Risk,
    pub limitations: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct Simulation {
    pub status: String,
    pub fork_block: u64,
    pub gas_used: String,
}
#[derive(Debug, Clone, Serialize)]
pub struct Intent {
    pub title: String,
    pub function: String,
    pub decoded_args: Value,
    pub unknown_calldata: bool,
}
#[derive(Debug, Clone, Serialize)]
pub struct Finding {
    pub severity: String,
    pub title: String,
    pub explanation: String,
    pub evidence: Value,
}
#[derive(Debug, Clone, Serialize, Default)]
pub struct StateDiff {
    pub native: Vec<Value>,
    pub erc20: Vec<Value>,
    pub erc721: Vec<Value>,
    pub erc1155: Vec<Value>,
    pub approvals: Vec<Value>,
}
#[derive(Debug, Clone, Serialize)]
pub struct Risk {
    pub score: u8,
    pub severity: String,
    pub summary: String,
}

pub fn stub_response() -> AnalyzeResponse {
    AnalyzeResponse {
        simulation: Simulation {
            status: "unsupported".into(),
            fork_block: 0,
            gas_used: "0x0".into(),
        },
        intent: Intent {
            title: "Transaction analysis pending".into(),
            function: "unknown".into(),
            decoded_args: json!({}),
            unknown_calldata: true,
        },
        findings: vec![],
        state_diff: StateDiff::default(),
        drainer_matches: vec![],
        risk: Risk {
            score: 0,
            severity: "low".into(),
            summary: "No simulation was performed.".into(),
        },
        limitations: vec!["Simulation engine unavailable.".into()],
    }
}

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(|| async { "ok" }))
        .route("/api/analyze", post(analyze))
        .layer(CorsLayer::permissive())
        .with_state(state)
}

async fn analyze(
    State(state): State<AppState>,
    Json(request): Json<AnalyzeRequest>,
) -> Result<Json<AnalyzeResponse>, (StatusCode, Json<Value>)> {
    simulate(state, request).await.map(Json).map_err(|error| {
        (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": error.to_string()})),
        )
    })
}
