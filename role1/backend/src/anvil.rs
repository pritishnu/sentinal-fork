use std::{path::PathBuf, process::Stdio, time::Duration};

use anyhow::{bail, Context, Result};
use serde_json::{json, Value};
use tokio::{
    process::{Child, Command},
    sync::Mutex,
    time::sleep,
};

const DEFAULT_SEPOLIA_RPC: &str = "https://ethereum-sepolia-rpc.publicnode.com";

struct RunningAnvil {
    child: Child,
    block: u64,
    rpc_url: String,
    local_url: String,
}

pub struct AnvilManager {
    client: reqwest::Client,
    running: Mutex<Option<RunningAnvil>>,
}

impl Default for AnvilManager {
    fn default() -> Self {
        Self::new()
    }
}

impl AnvilManager {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::new(),
            running: Mutex::new(None),
        }
    }
    pub fn upstream_url(&self, supplied: Option<&str>) -> String {
        supplied
            .map(str::to_owned)
            .or_else(|| std::env::var("SEPOLIA_RPC_URL").ok())
            .unwrap_or_else(|| DEFAULT_SEPOLIA_RPC.into())
    }

    pub async fn ensure_fork(&self, rpc_url: &str) -> Result<(String, u64)> {
        let block = self.block_number(rpc_url).await?;
        let mut running = self.running.lock().await;
        if let Some(current) = running.as_mut() {
            if current.child.try_wait()?.is_none()
                && current.rpc_url == rpc_url
                && block.saturating_sub(current.block) <= 3
            {
                return Ok((current.local_url.clone(), current.block));
            }
        }
        if let Some(mut old) = running.take() {
            let _ = old.child.kill().await;
        }
        let port = 8545u16;
        let child = Command::new(anvil_executable())
            .args([
                "--host",
                "127.0.0.1",
                "--port",
                &port.to_string(),
                "--fork-url",
                rpc_url,
                "--fork-block-number",
                &block.to_string(),
            ])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .context("could not start anvil; install Foundry and ensure `anvil` is on PATH")?;
        let local_url = format!("http://127.0.0.1:{port}");
        for _ in 0..20 {
            if self.rpc(&local_url, "eth_chainId", json!([])).await.is_ok() {
                *running = Some(RunningAnvil {
                    child,
                    block,
                    rpc_url: rpc_url.into(),
                    local_url: local_url.clone(),
                });
                return Ok((local_url, block));
            }
            sleep(Duration::from_millis(150)).await;
        }
        bail!("Anvil did not start its local JSON-RPC endpoint")
    }

    pub async fn block_number(&self, url: &str) -> Result<u64> {
        let hex = self.rpc(url, "eth_blockNumber", json!([])).await?;
        u64::from_str_radix(
            hex.as_str()
                .context("eth_blockNumber was not a string")?
                .trim_start_matches("0x"),
            16,
        )
        .context("invalid fork block")
    }
    pub async fn rpc(&self, url: &str, method: &str, params: Value) -> Result<Value> {
        let body = json!({"jsonrpc":"2.0","id":1,"method":method,"params":params});
        let response: Value = self
            .client
            .post(url)
            .json(&body)
            .send()
            .await
            .context("RPC request failed")?
            .error_for_status()
            .context("RPC HTTP error")?
            .json()
            .await
            .context("RPC returned invalid JSON")?;
        if let Some(error) = response.get("error") {
            bail!("{method}: {error}");
        }
        response
            .get("result")
            .cloned()
            .context("RPC response did not contain result")
    }
}

/// Uses PATH when available, then the standard Windows Foundry installation path.
fn anvil_executable() -> PathBuf {
    let user_install = std::env::var_os("USERPROFILE")
        .map(PathBuf::from)
        .map(|root| root.join(".foundry").join("bin").join("anvil.exe"));
    user_install
        .filter(|path| path.is_file())
        .unwrap_or_else(|| PathBuf::from("anvil"))
}
