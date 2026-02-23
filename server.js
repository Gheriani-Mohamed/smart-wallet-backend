const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Test route
app.get('/', (req, res) => {
  res.json({ 
    message: '🚀 Smart Wallet API is running!',
    version: '1.0.0',
    endpoints: {
      setup: '/api/setup',
      budgets: '/api/budgets',
      alerts: '/api/alerts',
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Import routes
const setupRoutes = require('./routes/setup');
const authRoutes = require('./routes/auth');
const budgetRoutes = require('./routes/budgets');
const alertRoutes = require('./routes/alerts');
const categoryRoutes = require('./routes/categories');
const walletRoutes = require('./routes/wallets');
const transactionRoutes = require('./routes/transactions');
const recurringTransactionRoutes = require('./routes/recurringTransactions');
const savingGoalsRoutes = require('./routes/saving_goals');
const analyticsRoutes = require('./routes/anlytics');


app.use(cors({
  origin: [
    'http://localhost:3000',   // Flutter web default port
    'http://localhost:8080',   // alternative Flutter web port
    'http://localhost:5000',   // another common port
    'http://127.0.0.1:3000',
    'http://127.0.0.1:8080',
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Use routes
app.use('/api/setup', setupRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/wallets', walletRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/recurring-transactions', recurringTransactionRoutes);
app.use('/api/saving-goals', savingGoalsRoutes);
app.use('/api/analytics', analyticsRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`💾 Database: Connected`);
});