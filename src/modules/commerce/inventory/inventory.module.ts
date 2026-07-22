import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service.js';
import { WarehousesController } from './warehouses.controller.js';
import { InventoryController } from './inventory.controller.js';
import { IdentityModule } from '../../identity/identity.module.js';

@Module({
  imports: [IdentityModule],
  controllers: [WarehousesController, InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
