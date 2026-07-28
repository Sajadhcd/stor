import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '../config/config.service.js';
import { QueuePublisherService } from './queue-publisher.service.js';
import { DefaultQueueWorker } from './default.worker.js';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = new URL(config.redisUrl);
        return {
          connection: {
            host: url.hostname,
            port: parseInt(url.port) || 6379,
            password: url.password || undefined,
          },
        };
      },
    }),
    BullModule.registerQueue({
      name: 'default_queue',
    }),
    BullModule.registerQueue({
      name: 'search_indexing_queue',
    }),
  ],
  providers: [QueuePublisherService, DefaultQueueWorker],
  exports: [QueuePublisherService, BullModule],
})
export class JobsModule {}
