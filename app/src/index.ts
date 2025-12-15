import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import kamiRoutes from './routes/kamiRoutes.js';
import accountRoutes from './routes/accountRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import farmingRoutes from './routes/farmingRoutes.js';
import harvestRoutes from './routes/harvestRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import kamigotchiRoutes from './routes/kamigotchiRoutes.js';
import systemRoutes from './routes/systemRoutes.js';
import telegramRoutes from './routes/telegramRoutes.js';
import { runAutomationLoop } from './services/automationService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Content Security Policy
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; frame-src 'self' https://auth.privy.io https://verify.privy.io; font-src 'self' data:; img-src 'self' data: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://auth.privy.io; style-src 'self' 'unsafe-inline'; connect-src 'self' https: wss:;"
  );
  next();
});

// Serve static files from frontend/dist
app.use(express.static(path.join(process.cwd(), 'frontend/dist')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/telegram', telegramRoutes);
app.use('/api/kami', kamiRoutes);
import watchlistRoutes from './routes/watchlistRoutes.js';

app.use('/api/watchlist', watchlistRoutes);
app.use('/api/account', accountRoutes);

app.use('/api/transaction', transactionRoutes);
app.use('/api/farming', farmingRoutes);
app.use('/api/harvest', harvestRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/kamigotchis', kamigotchiRoutes);
app.use('/api/system', systemRoutes);

// Catch-all for SPA (must come after API routes but before error handling)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(process.cwd(), 'frontend/dist/index.html'));
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const server = app.listen(PORT, () => {
  console.log(`🚀 Kamigotchi API server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  
  // Start Automation Loop
  runAutomationLoop();

  console.log(`📚 API docs:`);
  console.log(`   GET  /api/kami/:id`);
  console.log(`   GET  /api/kami/index/:index`);
  console.log(`   GET  /api/account/:accountId/kamis`);
  console.log(`   POST /api/transaction/execute`);
  console.log(`   GET  /api/farming/calculate/:kamiId`);
  console.log(`   POST /api/harvest/start`);
  console.log(`   POST /api/harvest/stop`);
  console.log(`   POST /api/harvest/collect`);
  console.log(`   GET  /api/harvest/status/:kamiId`);
  console.log(`   POST /api/profiles/add`);
  console.log(`   GET  /api/profiles`);
  console.log(`   DELETE /api/profiles/:id`);
  console.log(`   POST /api/kamigotchis/refresh`);
  console.log(`   GET  /api/kamigotchis`);
  console.log(`   DELETE /api/kamigotchis/:id`);
  console.log(`   PATCH /api/kamigotchis/:id/automation`);
  console.log(`   POST /api/kamigotchis/:id/harvest/start`);
  console.log(`   POST /api/kamigotchis/:id/harvest/stop`);
  console.log(`   POST /api/kamigotchis/:id/harvest/auto`);
});

// Increase server timeout to 10 minutes to handle slow blockchain transactions
server.setTimeout(600000);
