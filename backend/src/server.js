require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { getDb } = require('./db/database');
const { initScheduler } = require('./services/scheduler');

// Routes
const authRoutes = require('./routes/auth');
const medicinesRoutes = require('./routes/medicines');
const settingsRoutes = require('./routes/settings');
const alertsRoutes = require('./routes/alerts');
const dashboardRoutes = require('./routes/dashboard');

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Ensure DB schema is initialized
getDb();

// Middlewares
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Request logging in development
if (process.env.NODE_ENV !== 'test') {
  app.use((req, res, next) => {
    console.log(`[API] ${req.method} ${req.originalUrl}`);
    next();
  });
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'PharmaGuard API', time: new Date().toISOString() });
});

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/medicines', medicinesRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Global 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Endpoint not found: ${req.method} ${req.originalUrl}` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Server Error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start scheduler and server only if run directly (not during Jest testing)
if (process.env.NODE_ENV !== 'test') {
  initScheduler();

  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(` PharmaGuard Backend API is running on http://localhost:${PORT}`);
    console.log(` Allowed Frontend Origin: ${FRONTEND_URL}`);
    console.log(` Database: SQLite initialized`);
    console.log(`======================================================\n`);
  });
}

module.exports = app;
