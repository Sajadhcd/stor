import { Module } from '@nestjs/common';
import { ProductsService } from './products.service.js';
import { ProductsController } from './products.controller.js';
import { BrandsModule } from './brands/brands.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { AttributeDefinitionsModule } from './attribute-definitions/attribute-definitions.module.js';
import { IdentityModule } from '../../identity/identity.module.js';

import { CatalogSearchRepository } from './repositories/catalog-search.repository.js';

@Module({
  imports: [IdentityModule, BrandsModule, CategoriesModule, AttributeDefinitionsModule],
  controllers: [ProductsController],
  providers: [ProductsService, CatalogSearchRepository],
  exports: [ProductsService, CategoriesModule, AttributeDefinitionsModule],
})
export class CatalogModule {}

