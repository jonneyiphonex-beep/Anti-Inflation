use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::path::Path;
use std::sync::{Arc, Mutex};

#[derive(Clone, Debug, Serialize, Deserialize)]
struct Product {
    id: u64,
    item_name: String,
    item_price: f64,
    item_weight: f64,
    unit_cost: f64,
    status: String,
}

#[derive(Clone, Debug)]
struct AppState {
    products: Arc<Mutex<Vec<Product>>>,
    next_id: Arc<Mutex<u64>>, 
}

impl AppState {
    fn new() -> Self {
        Self {
            products: Arc::new(Mutex::new(Vec::new())),
            next_id: Arc::new(Mutex::new(1)),
        }
    }

    fn add_product(&self, item_name: String, item_price: f64, item_weight: f64) -> Product {
        let unit_cost = item_price / item_weight;
        let status = if unit_cost > 0.5 { "inflation-risk".to_string() } else { "stable".to_string() };

        let mut next_id = self.next_id.lock().unwrap();
        let id = *next_id;
        *next_id += 1;
        drop(next_id);

        let product = Product {
            id,
            item_name,
            item_price,
            item_weight,
            unit_cost,
            status,
        };

        self.products.lock().unwrap().insert(0, product.clone());
        product
    }

    fn list_products(&self) -> Vec<Product> {
        self.products.lock().unwrap().clone()
    }
}

fn serve_static(path: &str) -> Option<Vec<u8>> {
    let cleaned = path.trim_start_matches('/');
    let root = Path::new(".");
    let candidate = if cleaned.is_empty() { "index.html".to_string() } else { cleaned.to_string() };
    let full = root.join(candidate);
    let final_path = if full.is_file() { full } else { root.join("index.html") };

    fs::read(final_path).ok()
}

fn json_response(body: &[u8], status: &str) -> Vec<u8> {
    let mut response = format!(
        "HTTP/1.1 {}\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        status,
        body.len()
    )
    .into_bytes();
    response.extend_from_slice(body);
    response
}

fn text_response(body: &[u8], status: &str, content_type: &str) -> Vec<u8> {
    let mut response = format!(
        "HTTP/1.1 {}\r\nContent-Type: {}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        status,
        content_type,
        body.len()
    )
    .into_bytes();
    response.extend_from_slice(body);
    response
}

fn handle_request(state: &AppState, request: &str) -> Option<Vec<u8>> {
    let mut lines = request.lines();
    let start = lines.next()?;
    let mut parts = start.split_whitespace();
    let method = parts.next()?;
    let uri = parts.next()?;

    if method == "GET" && uri == "/api/health" {
        let body = br#"{"ok":true,"database":"memory"}"#;
        return Some(json_response(body, "200 OK"));
    }

    if method == "GET" && uri == "/api/products" {
        let products = state.list_products();
        let body = serde_json::to_string(&products).unwrap();
        return Some(json_response(body.as_bytes(), "200 OK"));
    }

    if method == "POST" && uri == "/api/products" {
        let mut body = String::new();
        let mut found_headers = false;
        for line in lines {
            if line.trim().is_empty() {
                found_headers = true;
                continue;
            }
            if found_headers {
                body.push_str(line);
                body.push('\n');
            }
        }

        let parsed: Value = match serde_json::from_str(body.trim()) {
            Ok(v) => v,
            Err(_) => {
                let err = br#"{"error":"invalid JSON"}"#;
                return Some(json_response(err, "400 Bad Request"));
            }
        };

        let item_name = parsed["itemName"].as_str().unwrap_or("").trim().to_string();
        let item_price = parsed["itemPrice"].as_f64();
        let item_weight = parsed["itemWeight"].as_f64();

        if item_name.is_empty() || item_price.is_none() || item_weight.is_none() {
            let err = br#"{"error":"itemName, itemPrice and itemWeight are required"}"#;
            return Some(json_response(err, "400 Bad Request"));
        }

        let price = item_price.unwrap();
        let weight = item_weight.unwrap();
        if price <= 0.0 || weight <= 0.0 {
            let err = br#"{"error":"itemPrice and itemWeight must be positive numbers"}"#;
            return Some(json_response(err, "400 Bad Request"));
        }

        let product = state.add_product(item_name, price, weight);
        let body = serde_json::to_string(&product).unwrap();
        return Some(json_response(body.as_bytes(), "201 Created"));
    }

    if method == "GET" {
        let file_bytes = serve_static(uri).unwrap_or_else(|| include_bytes!("index.html").to_vec());
        let content_type = if uri.ends_with(".css") {
            "text/css; charset=utf-8"
        } else if uri.ends_with(".js") {
            "application/javascript; charset=utf-8"
        } else if uri.ends_with(".html") {
            "text/html; charset=utf-8"
        } else {
            "text/plain; charset=utf-8"
        };
        return Some(text_response(&file_bytes, "200 OK", content_type));
    }

    let err = b"Method not allowed";
    Some(text_response(err, "405 Method Not Allowed", "text/plain; charset=utf-8"))
}

fn main() {
    let state = AppState::new();
    let listener = TcpListener::bind("0.0.0.0:3000").expect("Failed to bind port 3000");
    println!("Rust fallback server running on http://localhost:3000");

    for stream in listener.incoming() {
        let state = state.clone();
        match stream {
            Ok(mut socket) => {
                let mut buf = [0u8; 8192];
                let _ = socket.read(&mut buf);
                let request = String::from_utf8_lossy(&buf).to_string();
                let response = handle_request(&state, &request).unwrap_or_else(|| {
                    let body = b"Internal server error";
                    text_response(body, "500 Internal Server Error", "text/plain; charset=utf-8")
                });
                let _ = socket.write_all(&response);
                let _ = socket.flush();
            }
            Err(_) => {}
        }
    }
}
