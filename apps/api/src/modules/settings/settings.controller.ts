import { Controller, Get } from '@nestjs/common';
import { FORMATS } from '../../common/constants';
import { SettingsService } from './settings.service';

/** Public settings the website needs before anyone signs in. */
@Controller('config')
export class PublicConfigController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  async config() {
    const s = await this.settings.get();
    return {
      guestCredits: s.guestCredits,
      signupCredits: s.signupCredits,
      creditCost: s.creditCost,
      maxFileMb: s.maxFileMb,
      maxPages: s.maxPages,
      maxFilesPerBatch: s.maxFilesPerBatch,
      telegramUsername: s.telegramUsername,
      registrationOpen: s.registrationOpen,
      announcement: s.announcement,
      formats: FORMATS,
    };
  }
}
