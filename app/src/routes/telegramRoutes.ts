import express from 'express';
import { telegram } from '../services/telegram.js';

const router = express.Router();

// Webhook endpoint for Telegram updates
router.post('/webhook', async (req, res) => {
  try {
    const update = req.body;
    await telegram.processUpdate(update);
    res.status(200).send('OK');
  } catch (error) {
    console.error('[Telegram] Webhook error:', error);
    res.status(500).send('Error');
  }
});

// Helper endpoint to check if webhook route is reachable
router.get('/health', (req, res) => {
    res.json({ status: 'Telegram route operational' });
});

export default router;
