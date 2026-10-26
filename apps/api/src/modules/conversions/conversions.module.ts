import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { CONVERSION_QUEUE } from '../../common/constants';
import { CleanupService } from './cleanup.service';
import { ConversionsController } from './conversions.controller';
import { ConversionsProcessor } from './conversions.processor';
import { ConversionsService } from './conversions.service';
import { ConverterClient } from './converter.client';

@Module({
  imports: [BullModule.registerQueue({ name: CONVERSION_QUEUE })],
  controllers: [ConversionsController],
  providers: [ConversionsService, ConverterClient, ConversionsProcessor, CleanupService],
  exports: [ConversionsService],
})
export class ConversionsModule {}
