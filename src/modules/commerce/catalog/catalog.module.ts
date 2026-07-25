import { Module } from '@nestjs/common';
import { ProductsService } from './products.service.js';
import { ProductsController } from './products.controller.js';
import { BrandsModule } from './brands/brands.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { IdentityModule } from '../../identity/identity.module.js';

@Module({
  imports: [IdentityModule, BrandsModule, CategoriesModule],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService, CategoriesModule],
})
export class CatalogModule {}

