const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
app.use(morgan('dev'));

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

const AUTH_URL = process.env.AUTH_URL || 'http://auth:4001';
const CATALOG_URL = process.env.CATALOG_URL || 'http://catalog:4002';
const CART_URL = process.env.CART_URL || 'http://cart:4003';
const ORDER_URL = process.env.ORDER_URL || 'http://order:4004';

// --- Auth routes ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const response = await axios.post(`${AUTH_URL}/auth/register`, req.body);
    res.status(response.status).json(response.data);
  } catch (err) {
    handleAxiosError(err, res);
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const response = await axios.post(`${AUTH_URL}/auth/login`, req.body);
    res.status(response.status).json(response.data);
  } catch (err) {
    handleAxiosError(err, res);
  }
});

// --- JWT auth middleware ---
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ message: 'Missing token' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (e) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

// --- Catalog routes ---
app.get('/api/products', async (req, res) => {
  try {
    const response = await axios.get(`${CATALOG_URL}/products`);
    res.status(200).json(response.data);
  } catch (err) {
    handleAxiosError(err, res);
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const response = await axios.get(
      `${CATALOG_URL}/products/${req.params.id}`
    );
    res.status(response.status).json(response.data);
  } catch (err) {
    handleAxiosError(err, res);
  }
});

// --- Cart routes (protected) ---
app.get('/api/cart', authMiddleware, async (req, res) => {
  try {
    const response = await axios.get(`${CART_URL}/cart`, {
      headers: { 'x-user-id': req.userId }
    });
    res.status(response.status).json(response.data);
  } catch (err) {
    handleAxiosError(err, res);
  }
});

app.post('/api/cart/items', authMiddleware, async (req, res) => {
  try {
    const response = await axios.post(`${CART_URL}/cart/items`, req.body, {
      headers: { 'x-user-id': req.userId }
    });
    res.status(response.status).json(response.data);
  } catch (err) {
    handleAxiosError(err, res);
  }
});

app.delete('/api/cart/items/:productId', authMiddleware, async (req, res) => {
  try {
    const response = await axios.delete(
      `${CART_URL}/cart/items/${req.params.productId}`,
      { headers: { 'x-user-id': req.userId } }
    );
    res.status(response.status).json(response.data);
  } catch (err) {
    handleAxiosError(err, res);
  }
});

// --- Order routes (protected) ---
app.post('/api/orders', authMiddleware, async (req, res) => {
  try {
    const response = await axios.post(
      `${ORDER_URL}/orders`,
      {},
      { headers: { 'x-user-id': req.userId } }
    );
    res.status(response.status).json(response.data);
  } catch (err) {
    handleAxiosError(err, res);
  }
});

app.get('/api/orders', authMiddleware, async (req, res) => {
  try {
    const response = await axios.get(`${ORDER_URL}/orders`, {
      headers: { 'x-user-id': req.userId }
    });
    res.status(response.status).json(response.data);
  } catch (err) {
    handleAxiosError(err, res);
  }
});

function handleAxiosError(err, res) {
  if (err.response) {
    res.status(err.response.status).json(err.response.data);
  } else {
    console.error(err.message);
    res.status(500).json({ message: 'Internal gateway error' });
  }
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'gateway' });
});

app.listen(PORT, () => {
  console.log(`Gateway running on port ${PORT}`);
});
