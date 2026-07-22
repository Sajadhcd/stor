import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AppLogger } from '../logging/logger.service.js';

@Processor('default_queue')
export class DefaultQueueWorker extends WorkerHost {
  constructor(private readonly logger: AppLogger) {
    super();
  }

  /**
   * Process background jobs matching name routing details.
   */
  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Processing background job: ${job.name} (id: ${job.id})`, 'DefaultQueueWorker');
    
    switch (job.name) {
      case 'audit_log_cleanup':
        this.logger.log('Executing audit log cleanup job...', 'DefaultQueueWorker');
        break;
      case 'report_compilation':
        this.logger.log(`Compiling report for tenant: ${job.data?.tenantId}`, 'DefaultQueueWorker');
        break;
      default:
        this.logger.warn(`Unknown job name received: ${job.name}`, 'DefaultQueueWorker');
    }

    return { success: true };
  }
}
