import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';
import { TenantPrismaService } from './tenant-prisma.service.js';
import { ConfigModule } from '../config/config.module.js';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [PrismaService, TenantPrismaService],
  exports: [PrismaService, TenantPrismaService],
})
export class DatabaseModule {}
