import { Injectable, Logger } from '@nestjs/common';
import { env } from '../../config/env';

/** Optional: pings the admin on Telegram (needs TELEGRAM_BOT_TOKEN + TELEGRAM_ADMIN_CHAT_ID). */
@Injectable()
export class TelegramService {
  private readonly log = new Logger(TelegramService.name);

  get enabled() {
    return Boolean(env.telegram.botToken && env.telegram.adminChatId);
  }

  async notifyAdmin(text: string): Promise<void> {
    if (!this.enabled) return;
    try {
      const res = await fetch(`https://api.telegram.org/bot${env.telegram.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: env.telegram.adminChatId, text, disable_web_page_preview: true }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) this.log.warn(`telegram ${res.status}`);
    } catch (err) {
      this.log.warn(`telegram failed: ${(err as Error).message}`);
    }
  }
}
