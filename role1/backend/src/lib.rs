pub mod anvil;
pub mod api;
pub mod decode;
pub mod diff;
pub mod risk;
pub mod simulate;

use std::sync::Arc;

use anvil::AnvilManager;
use api::router;

#[derive(Clone)]
pub struct AppState {
    pub anvil: Arc<AnvilManager>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            anvil: Arc::new(AnvilManager::new()),
        }
    }
}

pub fn app() -> axum::Router {
    router(AppState::default())
}
