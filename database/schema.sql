CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    item_name VARCHAR(255) NOT NULL,
    item_price NUMERIC(10,2) NOT NULL,
    item_weight NUMERIC(10,2) NOT NULL,
    unit_cost NUMERIC(12,4),
    status VARCHAR(50) DEFAULT 'stable',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS price_logs (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    price NUMERIC(10,2) NOT NULL,
    weight NUMERIC(10,2),
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_name ON products(item_name);
CREATE INDEX IF NOT EXISTS idx_price_logs_product_id ON price_logs(product_id);
