import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response, Request } from 'express';
import { AppLogger } from '../../infrastructure/logging/logger.service.js';
import { requestContextStorage } from '../context/request-context.js';
import * as crypto from 'crypto';

@Catch()
export class RFC7807ExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLogger) {}

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const store = requestContextStorage.getStore();
    const traceId =
      store?.requestId ||
      store?.correlationId ||
      (request.headers['x-request-id'] as string) ||
      (request.headers['x-correlation-id'] as string) ||
      crypto.randomUUID();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let title = 'Internal Server Error';
    let detail = 'An unexpected error occurred on the server.';
    let type = 'https://api.nexiocommerce.com/errors/internal-server-error';
    let invalidParams: any[] | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resContent: any = exception.getResponse();
      title = exception.name;
      detail =
        typeof resContent === 'object' && resContent.message
          ? Array.isArray(resContent.message)
            ? resContent.message.join(', ')
            : resContent.message
          : exception.message;

      if (typeof resContent === 'object' && Array.isArray(resContent.message)) {
        title = 'Validation Failed';
        detail = 'One or more request parameters failed validation constraints.';
        invalidParams = resContent.message.map((msg: string) => {
          const firstWord = typeof msg === 'string' ? msg.split(' ')[0] : 'field';
          return { name: firstWord, reason: msg };
        });
      } else if (typeof resContent === 'object' && resContent.errors) {
        title = 'Validation Failed';
        detail = 'One or more request parameters failed validation constraints.';
        invalidParams = resContent.errors;
      }
      type = `https://api.nexiocommerce.com/errors/${this.camelToKebab(exception.constructor.name)}`;
    } else if (exception?.code && typeof exception.code === 'string' && exception.code.startsWith('P')) {
      status = HttpStatus.BAD_REQUEST;
      title = 'Database Query Error';
      detail = 'A database operation failed due to invalid constraints or data.';
      type = 'https://api.nexiocommerce.com/errors/database-error';
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        title = 'Unique Constraint Conflict';
        const targets = Array.isArray(exception.meta?.target) ? exception.meta.target.join(', ') : exception.meta?.target || 'field';
        detail = `A duplicate record conflict occurred on field(s): ${targets}.`;
        type = 'https://api.nexiocommerce.com/errors/unique-conflict';
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        title = 'Record Not Found';
        detail = 'The requested record does not exist or was deleted.';
        type = 'https://api.nexiocommerce.com/errors/not-found';
      }
    } else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      title = 'Internal Server Error';
      detail = 'An internal server error occurred.';
      type = `https://api.nexiocommerce.com/errors/${this.camelToKebab(exception.constructor.name)}`;
    }

    // Log internally with stack trace for debugging, but never return stack trace to client
    this.logger.error(`${title}: ${detail}`, exception?.stack || '', 'RFC7807Filter');

    const errorResponse: any = {
      type,
      title,
      status,
      detail,
      instance: request.url,
      timestamp: new Date().toISOString(),
      traceId,
      ...(invalidParams ? { invalid_params: invalidParams } : {}),
    };

    response.setHeader('Content-Type', 'application/problem+json');
    response.status(status).json(errorResponse);
  }

  private camelToKebab(str: string): string {
    return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  }
}
