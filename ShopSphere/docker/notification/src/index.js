const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const mysql = require('mysql2/promise');

const app = express();
app.use(cors({ origin: ['http://localhost:5173'] }));
app.use(express.json());
app.use(morgan('dev'));

const PORT = process.env.PORT || 4006;

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
    CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('Notification DB initialized');
}

app.post('/notify', async (req, res) => {
  const { userId, message } = req.body;
  if (!userId || !message) {
    return res.status(400).json({ message: 'userId and message required' });
  }
  try {
    await pool.query(
      'INSERT INTO notifications (user_id, message) VALUES (?, ?)',
      [userId, message]
    );
    console.log('Notification for user', userId, ':', message);
    res.status(201).json({ status: 'stored' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'DB error' });
  }
});

app.get('/notifications', async (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ message: 'userId required' });

  try {
    const [rows] = await pool.query(
      'SELECT id, message, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'DB error' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'notification-service' });
});

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Notification service running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to init DB for notification:', err);
  process.exit(1);
});
