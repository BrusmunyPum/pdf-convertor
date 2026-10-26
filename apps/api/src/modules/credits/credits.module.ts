import { Global, Module } from '@nestjs/common';
import { CreditsController } from './credits.controller';
import { CreditsService } from './credits.service';

@Global()
@Module({ providers: [CreditsService], controllers: [CreditsController], exports: [CreditsService] })
export class CreditsModule {}
