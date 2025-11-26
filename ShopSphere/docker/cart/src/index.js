const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const mysql = require('mysql2/promise');

const app = express();
app.use(cors({ origin: ['http://localhost:5173'] }));
app.use(express.json());
app.use(morgan('dev'));

const PORT = process.env.PORT || 4003;

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
    CREATE TABLE IF NOT EXISTS cart_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      product_id INT NOT NULL,
      quantity INT NOT NULL,
      UNIQUE KEY uniq_user_product (user_id, product_id)
    )
  `);

  console.log('Cart DB initialized');
}

function requireUser(req, res, next) {
  const userId = req.header('x-user-id');
  if (!userId) return res.status(401).json({ message: 'Missing user' });
  req.userId = Number(userId);
  next();
}

app.get('/cart', requireUser, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT product_id as productId, quantity FROM cart_items WHERE user_id = ?',
      [req.userId]
    );
    res.json({ items: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'DB error' });
  }
});

app.post('/cart/items', requireUser, async (req, res) => {
  const { productId, quantity } = req.body;
  if (!productId || !quantity)
    return res
      .status(400)
      .json({ message: 'productId and quantity are required' });

  try {
    await pool.query(
      `INSERT INTO cart_items (user_id, product_id, quantity)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
      [req.userId, productId, quantity]
    );

    const [rows] = await pool.query(
      'SELECT product_id as productId, quantity FROM cart_items WHERE user_id = ?',
      [req.userId]
    );
    res.status(201).json({ items: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'DB error' });
  }
});

app.delete('/cart/items/:productId', requireUser, async (req, res) => {
  const productId = Number(req.params.productId);
  try {
    await pool.query(
      'DELETE FROM cart_items WHERE user_id = ? AND product_id = ?',
      [req.userId, productId]
    );
    const [rows] = await pool.query(
      'SELECT product_id as productId, quantity FROM cart_items WHERE user_id = ?',
      [req.userId]
    );
    res.json({ items: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'DB error' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'cart-service' });
});

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Cart service running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to init DB for cart:', err);
  process.exit(1);
});
