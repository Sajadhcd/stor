import { Module } from '@nestjs/common';
import { AttributeDefinitionsService } from './attribute-definitions.service.js';
import { AttributeDefinitionsController } from './attribute-definitions.controller.js';
import { IdentityModule } from '../../../identity/identity.module.js';

@Module({
  imports: [IdentityModule],
  controllers: [AttributeDefinitionsController],
  providers: [AttributeDefinitionsService],
  exports: [AttributeDefinitionsService],
})
export class AttributeDefinitionsModule {}
