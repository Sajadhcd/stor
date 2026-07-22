import { Test, TestingModule } from '@nestjs/testing';
import { AppLogger } from './logger.service.js';
import { requestContextStorage } from '../../common/context/request-context.js';

describe('AppLogger', () => {
  let logger: AppLogger;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(async () => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const module: TestingModule = await Test.createTestingModule({
      providers: [AppLogger],
    }).compile();

    logger = module.get<AppLogger>(AppLogger);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('should be defined', () => {
    expect(logger).toBeDefined();
  });

  it('should format log message as structured JSON containing timestamp, level, context, and message', () => {
    logger.log('Test info log', 'TestContext');

    expect(consoleLogSpy).toHaveBeenCalled();
    const logStr = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(logStr);

    expect(parsed.level).toBe('INFO');
    expect(parsed.message).toBe('Test info log');
    expect(parsed.context).toBe('TestContext');
    expect(parsed.timestamp).toBeDefined();
  });

  it('should include tenantId, correlationId, and requestId when invoked inside AsyncLocalStorage request context', () => {
    const store = {
      tenantId: 'tenant-ctx-uuid',
      requestId: 'req-uuid',
      correlationId: 'corr-uuid',
      clientIp: '192.168.1.1',
      userAgent: 'JestAgent',
    };

    requestContextStorage.run(store, () => {
      logger.warn('Warning inside context', 'AuthService');
    });

    expect(consoleWarnSpy).toHaveBeenCalled();
    const logStr = consoleWarnSpy.mock.calls[0][0];
    const parsed = JSON.parse(logStr);

    expect(parsed.level).toBe('WARN');
    expect(parsed.message).toBe('Warning inside context');
    expect(parsed.tenantId).toBe('tenant-ctx-uuid');
    expect(parsed.requestId).toBe('req-uuid');
    expect(parsed.correlationId).toBe('corr-uuid');
  });

  it('should format error message and trace into structured JSON', () => {
    logger.error('Error occurred', 'ErrorTraceStack', 'DatabaseService');

    expect(consoleErrorSpy).toHaveBeenCalled();
    const logStr = consoleErrorSpy.mock.calls[0][0];
    const parsed = JSON.parse(logStr);

    expect(parsed.level).toBe('ERROR');
    expect(parsed.message).toBe('Error occurred');
    expect(parsed.trace).toBe('ErrorTraceStack');
    expect(parsed.context).toBe('DatabaseService');
  });
});
