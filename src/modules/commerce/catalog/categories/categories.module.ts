import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller.js';
import { CategoriesService } from './categories.service.js';
import { IdentityModule } from '../../../identity/identity.module.js';

@Module({
  imports: [IdentityModule],
  controllers: [CategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
