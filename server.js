const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

const client = new Client({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'antiinflation',
  password: process.env.PGPASSWORD || 'antiinflation123',
  database: process.env.PGDATABASE || 'anti_inflation',
});

async function connectDb() {
  try {
    await client.connect();
    console.log('Connected to PostgreSQL');
  } catch (error) {
    console.error('PostgreSQL connection failed:', error.message);
  }
}

async function initDb() {
  const schema = `
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
  `;

  await client.query(schema);
}

app.get('/api/health', async (_req, res) => {
  try {
    const result = await client.query('SELECT NOW()');
    res.json({ ok: true, time: result.rows[0].now, database: 'postgresql' });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get('/api/products', async (_req, res) => {
  try {
    const result = await client.query(`
      SELECT id, item_name, item_price, item_weight,
             COALESCE(unit_cost, 0) AS unit_cost,
             status
      FROM products
      ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/products', async (req, res) => {
  const { itemName, itemPrice, itemWeight } = req.body;

  if (!itemName || !itemPrice || !itemWeight) {
    return res.status(400).json({ error: 'itemName, itemPrice and itemWeight are required' });
  }

  const price = Number(itemPrice);
  const weight = Number(itemWeight);

  if (Number.isNaN(price) || Number.isNaN(weight) || price <= 0 || weight <= 0) {
    return res.status(400).json({ error: 'itemPrice and itemWeight must be positive numbers' });
  }

  const unitCost = price / weight;
  const status = unitCost > 0 && unitCost > 0.5 ? 'inflation-risk' : 'stable';

  try {
    const inserted = await client.query(
      `INSERT INTO products (item_name, item_price, item_weight, unit_cost, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, item_name, item_price, item_weight, unit_cost, status`,
      [itemName, price, weight, unitCost, status]
    );

    await client.query(
      `INSERT INTO price_logs (product_id, price, weight)
       VALUES ($1, $2, $3)`,
      [inserted.rows[0].id, price, weight]
    );

    res.status(201).json(inserted.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

connectDb()
  .then(initDb)
  .catch((error) => {
    console.error('Database initialization failed:', error.message);
  });

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
