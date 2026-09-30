//! Calldata, signing-intent, and local demo-drainer detection for Sentinel Fork.
//!
//! This crate performs no network I/O. Callers may supply [`ChainLookup`] to
//! enrich unknown-call reporting and bytecode-hash matching with chain data.

pub mod decode;
pub mod drainer_db;
pub mod findings;
pub mod typed_data;
pub mod types;

pub use decode::{decode_transaction, decode_transaction_with_lookup, ChainLookup};
pub use drainer_db::{load_embedded_db, match_drainer_db, match_drainer_db_with, DbError};
pub use findings::generate_findings;
pub use typed_data::{decode_typed_data, TypedDataError, TypedDataPayload};
pub use types::*;
