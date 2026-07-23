import { Module } from '@nestjs/common';
import { BrandsController } from './brands.controller.js';
import { BrandsService } from './brands.service.js';
import { IdentityModule } from '../../../identity/identity.module.js';

@Module({
  imports: [IdentityModule],
  controllers: [BrandsController],
  providers: [BrandsService],
  exports: [BrandsService],
})
export class BrandsModule {}
