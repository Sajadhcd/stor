import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContextStore {
  tenantId: string;
  userId?: string;
  clientIp?: string;
  userAgent?: string;
  requestId: string;
  correlationId: string;
}

export const requestContextStorage = new AsyncLocalStorage<RequestContextStore>();
