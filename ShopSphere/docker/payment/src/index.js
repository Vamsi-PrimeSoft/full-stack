const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(morgan('dev'));

const PORT = process.env.PORT || 4005;

// Mock payment: always success
app.post('/payments', (req, res) => {
  const { amount } = req.body;
  console.log('Processing payment for amount:', amount);
  setTimeout(() => {
    res.json({
      status: 'SUCCESS',
      transactionId: `tx_${Date.now()}`
    });
  }, 300); // tiny delay for realism
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'payment-service' });
});

app.listen(PORT, () => {
  console.log(`Payment service running on port ${PORT}`);
});
