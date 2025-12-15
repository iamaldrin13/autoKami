import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { getKamigotchiByIndex } from './supabaseService.js';

// Load env vars if not already loaded
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

export interface TelegramMessageOptions {
  chatId?: string;
  botToken?: string;
  parseMode?: 'Markdown' | 'HTML';
  disableWebPagePreview?: boolean;
}

export class TelegramService {
  private static instance: TelegramService;
  private enabled: boolean = false;

  private constructor() {
    if (TELEGRAM_BOT_TOKEN) {
      this.enabled = true;
      console.log('[Telegram] Service initialized with token.');
    } else {
      console.warn('[Telegram] Missing TELEGRAM_BOT_TOKEN. Service disabled.');
    }
  }

  public static getInstance(): TelegramService {
    if (!TelegramService.instance) {
      TelegramService.instance = new TelegramService();
    }
    return TelegramService.instance;
  }

  /**
   * Process incoming webhook update
   */
  public async processUpdate(update: any): Promise<void> {
    if (!this.enabled) return;

    // Check for message
    const message = update.message;
    if (!message || !message.text) return;

    const chatId = message.chat.id;
    const text = message.text;

    console.log(`[Telegram] Received message from ${chatId}: ${text}`);

    if (text.startsWith('/')) {
      await this.handleCommand(chatId, text);
    }
  }

  /**
   * Start long polling for updates (for local development)
   */
  public async startPolling(): Promise<void> {
    if (!this.enabled) return;
    
    console.log('[Telegram] Starting long polling...');
    let offset = 0;

    // Clear webhook first to enable polling
    try {
        await fetch(`${TELEGRAM_API_URL}/deleteWebhook`);
    } catch (e) {
        console.warn('[Telegram] Failed to delete webhook:', e);
    }

    const poll = async () => {
      try {
        const response = await fetch(`${TELEGRAM_API_URL}/getUpdates?offset=${offset}&timeout=30`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        if (data.ok && data.result.length > 0) {
          for (const update of data.result) {
            await this.processUpdate(update);
            offset = update.update_id + 1;
          }
        }
      } catch (error) {
        console.error('[Telegram] Polling error:', error);
        // Wait a bit before retrying on error
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      
      // Continue polling
      setImmediate(poll);
    };

    poll();
  }

  /**
   * Handle slash commands
   */
  private async handleCommand(chatId: number | string, text: string): Promise<void> {
    const parts = text.split(' ');
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    try {
      switch (command) {
        case '/start':
          await this.sendMessage(
            "👋 *Welcome to Kamigotchi Bot!*\n\n" +
            "Your Chat ID is: `" + chatId + "`\n\n" +
            "Enter this ID in the Kamigotchi App settings to receive notifications.\n\n" +
            "*Commands:*\n" +
            "/kami <index> - Get Kamigotchi stats\n" +
            "/status - Check system status",
            { chatId: String(chatId) }
          );
          break;

        case '/status':
          await this.sendMessage(
            "✅ *System Operational*\n\n" +
            "Time: " + new Date().toLocaleString(),
            { chatId: String(chatId) }
          );
          break;

        case '/kami':
          if (args.length === 0) {
            await this.sendMessage("⚠️ Usage: `/kami <index>` (e.g. /kami 123)", { chatId: String(chatId) });
            return;
          }

          const index = parseInt(args[0]);
          if (isNaN(index)) {
            await this.sendMessage("⚠️ Invalid index provided.", { chatId: String(chatId) });
            return;
          }

          const kami = await getKamigotchiByIndex(index);
          
          if (!kami) {
            await this.sendMessage(`⚠️ Kamigotchi #${index} not found in database.`, { chatId: String(chatId) });
            return;
          }

          const stats = kami.stats;
          const msg = 
            `👻 *Kamigotchi #${kami.kami_index}*\n` +
            `Name: ${kami.kami_name || 'Unnamed'}\n` +
            `Level: ${kami.level}\n` +
            `State: ${kami.state}\n` +
            `Room: ${kami.room_name || '#' + kami.room_index}\n\n` +
            `*Stats:*\n` +
            `💪 Power: ${stats.power.base}\n` +
            `❤️ Health: ${kami.current_health}/${stats.health.base}\n` +
            `☯️ Harmony: ${stats.harmony.base}\n` +
            `⚔️ Violence: ${stats.violence.base}\n\n` +
            `Last Synced: ${new Date(kami.last_synced).toLocaleString()}`;

          await this.sendMessage(msg, { chatId: String(chatId) });
          break;

        default:
          await this.sendMessage("❓ Unknown command. Try /start", { chatId: String(chatId) });
      }
    } catch (error) {
      console.error('[Telegram] Command error:', error);
      await this.sendMessage("🚨 Error processing command.", { chatId: String(chatId) });
    }
  }

  /**
   * Send a text message to Telegram
   */
  public async sendMessage(message: string, options: TelegramMessageOptions = {}): Promise<boolean> {
    const botToken = options.botToken || TELEGRAM_BOT_TOKEN;
    const chatId = options.chatId || TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      console.log('[Telegram] Skipped sending message (missing token or chat ID):', message);
      return false;
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: options.parseMode || 'Markdown',
          disable_web_page_preview: options.disableWebPagePreview
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[Telegram] API Error:', errorData);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[Telegram] Network Error:', error);
      return false;
    }
  }

  /**
   * Send a log message (info)
   */
  public async sendLog(message: string, context?: any): Promise<boolean> {
    const timestamp = new Date().toISOString();
    let text = `ℹ️ *Log* [${timestamp}]\n\n${message}`;
    
    if (context) {
      text += "\n\n```json\n" + JSON.stringify(context, null, 2) + "\n```";
    }

    return this.sendMessage(text, { parseMode: 'Markdown' });
  }

  /**
   * Send an error message
   */
  public async sendError(message: string, error?: any): Promise<boolean> {
    const timestamp = new Date().toISOString();
    let text = `🚨 *Error* [${timestamp}]\n\n${message}`;

    if (error) {
        const errorDetails = error instanceof Error ? error.message + '\n' + error.stack : JSON.stringify(error, null, 2);
        text += "\n\n```\n" + errorDetails + "\n```";
    }

    return this.sendMessage(text, { parseMode: 'Markdown' });
  }
}

export const telegram = TelegramService.getInstance();
