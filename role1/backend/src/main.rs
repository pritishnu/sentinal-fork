use sentinel_fork_backend::app;

#[tokio::main]
async fn main() {
    let port = std::env::var("PORT")
        .unwrap_or_else(|_| "8787".to_string());

    let addr = format!("0.0.0.0:{}", port);

    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .expect("unable to bind Sentinel Fork API");

    println!("Sentinel Fork API listening on {}", addr);

    axum::serve(listener, app())
        .await
        .expect("API server failed");
}
