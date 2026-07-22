import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class QueuePublisherService {
  constructor(
    @InjectQueue('default_queue') private readonly defaultQueue: Queue,
  ) {}

  /**
   * Publishes a background job to the default queue.
   */
  async publishJob(name: string, data: any, opts?: any): Promise<string> {
    const job = await this.defaultQueue.add(name, data, opts);
    return job.id || '';
  }
}
