import { Injectable, LoggerService } from '@nestjs/common';
import { requestContextStorage } from '../../common/context/request-context.js';

@Injectable()
export class AppLogger implements LoggerService {
  private formatMessage(level: string, message: unknown, context?: string) {
    const store = requestContextStorage.getStore();
    
    let msgObj: Record<string, unknown>;
    if (typeof message === 'object' && message !== null) {
      msgObj = message as Record<string, unknown>;
    } else {
      msgObj = { message: String(message) };
    }

    const logData = {
      timestamp: new Date().toISOString(),
      level,
      ...msgObj,
      context: context || 'Application',
      requestId: store?.requestId,
      correlationId: store?.correlationId,
      tenantId: store?.tenantId,
      userId: store?.userId,
      clientIp: store?.clientIp,
      userAgent: store?.userAgent,
    };
    return JSON.stringify(logData);
  }

  log(message: unknown, context?: string) {
    console.log(this.formatMessage('INFO', message, context));
  }

  error(message: unknown, trace?: string, context?: string) {
    console.error(this.formatMessage('ERROR', { message: String(message), trace }, context));
  }

  warn(message: unknown, context?: string) {
    console.warn(this.formatMessage('WARN', message, context));
  }

  debug(message: unknown, context?: string) {
    console.debug(this.formatMessage('DEBUG', message, context));
  }

  verbose(message: unknown, context?: string) {
    console.log(this.formatMessage('VERBOSE', message, context));
  }
}
