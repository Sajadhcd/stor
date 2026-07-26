import { Module } from '@nestjs/common';
import { AttributeDefinitionsService } from './attribute-definitions.service.js';
import { AttributeDefinitionsController } from './attribute-definitions.controller.js';
import { AttributeValidationService } from './attribute-validation.service.js';
import { IdentityModule } from '../../../identity/identity.module.js';

@Module({
  imports: [IdentityModule],
  controllers: [AttributeDefinitionsController],
  providers: [AttributeDefinitionsService, AttributeValidationService],
  exports: [AttributeDefinitionsService, AttributeValidationService],
})
export class AttributeDefinitionsModule {}

