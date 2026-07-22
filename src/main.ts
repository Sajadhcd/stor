import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ConfigService } from './infrastructure/config/config.service.js';
import { AppLogger } from './infrastructure/logging/logger.service.js';
import { RFC7807ExceptionFilter } from './common/filters/rfc7807-exception.filter.js';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });

  const configService = app.get(ConfigService);
  const logger = app.get(AppLogger);

  configService.validateSecrets();

  const allowedOrigins = configService.corsOrigins;
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) {
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      const isProd = process.env.NODE_ENV === 'production';
      if (!isProd && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
        return callback(null, true);
      }
      return callback(new Error(`CORS policy violation: origin ${origin} not permitted`), false);
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type,Accept,Authorization,x-tenant-id,x-request-id,x-correlation-id',
  });

  app.useLogger(logger);

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      forbidNonWhitelisted: true,
      disableErrorMessages: false,
      exceptionFactory: (errors) => {
        logger.error(`Validation failed: ${JSON.stringify(errors, null, 2)}`, 'ValidationPipe');
        return new BadRequestException({
          statusCode: 400,
          message: 'Validation failed',
          errors: errors.map(err => ({
            field: err.property,
            constraints: err.constraints,
          })),
        });
      }
    }),
  );

  app.useGlobalFilters(new RFC7807ExceptionFilter(logger));

  const config = new DocumentBuilder()
    .setTitle('Nexio Commerce Core API')
    .setDescription('Enterprise Multi-Tenant Headless SaaS E-Commerce Platform API Spec')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs/swagger', app, document);

  const port = configService.port;
  await app.listen(port);
  
  logger.log(`Nexio Commerce monolith successfully booted on port ${port}`, 'Bootstrap');
}
bootstrap();
