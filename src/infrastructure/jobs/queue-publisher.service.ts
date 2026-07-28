import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class QueuePublisherService {
  constructor(
    @InjectQueue('default_queue') private readonly defaultQueue: Queue,
    @InjectQueue('search_indexing_queue') private readonly searchQueue: Queue,
  ) {}

  /**
   * Publishes a background job to the default queue.
   */
  async publishJob(name: string, data: any, opts?: any): Promise<string> {
    const job = await this.defaultQueue.add(name, data, opts);
    return job.id || '';
  }

  /**
   * Publishes a background job to the search indexing queue.
   */
  async publishSearchJob(name: string, data: any, opts?: any): Promise<string> {
    const job = await this.searchQueue.add(name, data, opts);
    return job.id || '';
  }
}
