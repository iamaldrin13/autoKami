import { telegram } from '../services/telegram.js';

console.log('🤖 Starting Telegram Bot (Polling Mode)...');

// Keep process alive
process.on('SIGINT', () => {
  console.log('Stopping...');
  process.exit(0);
});

telegram.startPolling();
