const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const axios = require('axios');
const mysql = require('mysql2/promise');

const app = express();
app.use(cors({ origin: ['http://localhost:5173'] }));
app.use(express.json());
app.use(morgan('dev'));

const PORT = process.env.PORT || 4004;
const CART_URL = process.env.CART_URL || 'http://cart:4003';
const CATALOG_URL = process.env.CATALOG_URL || 'http://catalog:4002';
const PAYMENT_URL = process.env.PAYMENT_URL || 'http://payment:4005';
const NOTIFICATION_URL =
  process.env.NOTIFICATION_URL || 'http://notification:4006';

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
    CREATE TABLE IF NOT EXISTS orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      total INT NOT NULL,
      status VARCHAR(32) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NOT NULL,
      product_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      quantity INT NOT NULL,
      price INT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    )
  `);

  console.log('Order DB initialized');
}

function requireUser(req, res, next) {
  const userId = req.header('x-user-id');
  if (!userId) return res.status(401).json({ message: 'Missing user' });
  req.userId = Number(userId);
  next();
}

async function getUserCart(userId) {
  const res = await axios.get(`${CART_URL}/cart`, {
    headers: { 'x-user-id': userId }
  });
  return res.data.items || [];
}

async function getProduct(productId) {
  const res = await axios.get(`${CATALOG_URL}/products/${productId}`);
  return res.data;
}

async function sendNotification(userId, message) {
  try {
    await axios.post(`${NOTIFICATION_URL}/notify`, { userId, message });
  } catch (e) {
    console.error('Failed to send notification:', e.message);
  }
}

// Create order
app.post('/orders', requireUser, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const items = await getUserCart(req.userId);
    if (!items.length)
      return res.status(400).json({ message: 'Cart is empty' });

    let total = 0;
    const detailedItems = [];
    for (const item of items) {
      const product = await getProduct(item.productId);
      const lineTotal = product.price * item.quantity;
      total += lineTotal;
      detailedItems.push({
        productId: product.id,
        name: product.name,
        quantity: item.quantity,
        price: product.price
      });
    }

    // Mock payment
    const payRes = await axios.post(`${PAYMENT_URL}/payments`, { amount: total });
    const payData = payRes.data;
    const status = payData.status === 'SUCCESS' ? 'PAID' : 'FAILED';

    await conn.beginTransaction();

    const [orderResult] = await conn.query(
      'INSERT INTO orders (user_id, total, status) VALUES (?, ?, ?)',
      [req.userId, total, status]
    );
    const orderId = orderResult.insertId;

    const values = detailedItems.map(i => [
      orderId,
      i.productId,
      i.name,
      i.quantity,
      i.price
    ]);

    await conn.query(
      'INSERT INTO order_items (order_id, product_id, name, quantity, price) VALUES ?',
      [values]
    );

    await conn.commit();

    const order = {
      id: orderId,
      userId: req.userId,
      items: detailedItems,
      total,
      status,
      payment: payData
    };

    if (status === 'PAID') {
      sendNotification(
        req.userId,
        `Your order #${order.id} for ₹${total} has been placed successfully.`
      );
    }

    res.status(201).json(order);
  } catch (err) {
    await conn.rollback();
    console.error(err.message);
    res.status(500).json({ message: 'Failed to create order' });
  } finally {
    conn.release();
  }
});

app.get('/orders', requireUser, async (req, res) => {
  try {
    const [orders] = await pool.query(
      'SELECT id, total, status, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC',
      [req.userId]
    );
    res.json(
      orders.map(o => ({
        id: o.id,
        total: o.total,
        status: o.status,
        createdAt: o.created_at
      }))
    );
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'DB error' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'order-service' });
});

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Order service running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to init DB for order:', err);
  process.exit(1);
});
