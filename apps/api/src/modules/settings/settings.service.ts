import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppSettings, defaultSettings } from './settings.types';

@Injectable()
export class SettingsService implements OnModuleInit {
  private cache: AppSettings = defaultSettings();
  private loadedAt = 0;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.reload();
  }

  private async reload() {
    const rows = await this.prisma.setting.findMany();
    const merged = defaultSettings() as unknown as Record<string, unknown>;
    for (const r of rows) if (r.key in merged) merged[r.key] = r.value;
    this.cache = merged as unknown as AppSettings;
    this.loadedAt = Date.now();
  }

  async get(): Promise<AppSettings> {
    // several API processes may run; refresh every 30s
    if (Date.now() - this.loadedAt > 30_000) await this.reload();
    return this.cache;
  }

  async update(patch: Partial<AppSettings>): Promise<AppSettings> {
    const defaults = defaultSettings() as unknown as Record<string, unknown>;
    for (const [key, value] of Object.entries(patch)) {
      if (!(key in defaults) || value === undefined) continue;
      if (typeof value !== typeof defaults[key]) continue;
      await this.prisma.setting.upsert({
        where: { key },
        create: { key, value: value as never },
        update: { value: value as never },
      });
    }
    await this.reload();
    return this.cache;
  }
}
