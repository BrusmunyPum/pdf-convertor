import { Global, Module } from '@nestjs/common';
import { PublicConfigController } from './settings.controller';
import { SettingsService } from './settings.service';

@Global()
@Module({
  providers: [SettingsService],
  controllers: [PublicConfigController],
  exports: [SettingsService],
})
export class SettingsModule {}
