const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const mysql = require('mysql2/promise');

const app = express();
app.use(cors({ origin: ['http://localhost:5173'] }));
app.use(express.json());
app.use(morgan('dev'));

const PORT = process.env.PORT || 4002;

const DB_CONFIG = {
  host: process.env.DB_HOST || 'mysql',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER || 'shopsphere',
  password: process.env.DB_PASSWORD || 'shopsphere',
  database: process.env.DB_NAME || 'shopsphere'
};

let pool;

async function initDb() {
  pool = await mysql.createPool(DB_CONFIG);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      price INT NOT NULL,
      stock INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const [rows] = await pool.query('SELECT COUNT(*) as cnt FROM products');
  if (rows[0].cnt === 0) {
    await pool.query(
      'INSERT INTO products (name, price, stock) VALUES ?',
      [[
        ['Laptop', 70000, 10],
        ['Headphones', 3000, 25],
        ['Smartphone', 45000, 15]
      ]]
    );
  }

  console.log('Catalog DB initialized');
}

app.get('/products', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, price, stock FROM products');
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'DB error' });
  }
});

app.get('/products/:id', async (req, res) => {
  const id = Number(req.params.id);
  try {
    const [rows] = await pool.query(
      'SELECT id, name, price, stock FROM products WHERE id = ?',
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'DB error' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'catalog-service' });
});

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Catalog service running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to init DB for catalog:', err);
  process.exit(1);
});
