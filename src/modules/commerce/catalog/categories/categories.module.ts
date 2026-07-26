import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller.js';
import { CategoriesService } from './categories.service.js';
import { AttributeDefinitionsService } from '../attribute-definitions/attribute-definitions.service.js';
import { IdentityModule } from '../../../identity/identity.module.js';

@Module({
  imports: [IdentityModule],
  controllers: [CategoriesController],
  providers: [CategoriesService, AttributeDefinitionsService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
