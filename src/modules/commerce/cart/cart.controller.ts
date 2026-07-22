import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CartService } from './cart.service.js';
import { CreateCartDto } from './dto/create-cart.dto.js';
import { AddCartItemDto } from './dto/add-cart-item.dto.js';
import { UpdateCartItemDto } from './dto/update-cart-item.dto.js';
import { MergeCartDto } from './dto/merge-cart.dto.js';
import { AuthGuard } from '../../../security/guards/auth.guard.js';
import { PermissionsGuard } from '../../../security/guards/permissions.guard.js';
import { RequirePermissions } from '../../../security/decorators/permissions.decorator.js';

@ApiTags('Cart')
@Controller('carts')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @ApiOperation({ summary: 'Create a new shopping cart (Guest or Customer)' })
  @ApiResponse({ status: 201, description: 'Cart created successfully' })
  @Post()
  async createCart(@Body() body: CreateCartDto) {
    return this.cartService.createCart(body);
  }

  @ApiOperation({ summary: 'Get active cart by ID' })
  @ApiResponse({ status: 200, description: 'Cart details retrieved' })
  @ApiResponse({ status: 404, description: 'Cart not found' })
  @Get(':id')
  async getCart(@Param('id') id: string) {
    return this.cartService.getCart(id);
  }

  @ApiOperation({ summary: 'Add item to shopping cart' })
  @ApiResponse({ status: 201, description: 'Item added to cart' })
  @Post(':id/items')
  async addItem(
    @Param('id') cartId: string,
    @Body() body: AddCartItemDto,
  ) {
    return this.cartService.addItem(cartId, body);
  }

  @ApiOperation({ summary: 'Update item quantity in cart' })
  @ApiResponse({ status: 200, description: 'Cart item updated' })
  @Patch(':id/items/:itemId')
  async updateItem(
    @Param('id') cartId: string,
    @Param('itemId') itemId: string,
    @Body() body: UpdateCartItemDto,
  ) {
    return this.cartService.updateItem(cartId, itemId, body);
  }

  @ApiOperation({ summary: 'Remove item from cart' })
  @ApiResponse({ status: 200, description: 'Cart item removed' })
  @Delete(':id/items/:itemId')
  async removeItem(
    @Param('id') cartId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.cartService.removeItem(cartId, itemId);
  }

  @ApiOperation({ summary: 'Clear all items from cart' })
  @ApiResponse({ status: 200, description: 'Cart cleared' })
  @Delete(':id/clear')
  async clearCart(@Param('id') cartId: string) {
    return this.cartService.clearCart(cartId);
  }

  @ApiOperation({ summary: 'Merge guest cart into authenticated customer cart' })
  @ApiResponse({ status: 200, description: 'Carts merged successfully' })
  @Post('merge')
  async mergeCart(@Body() body: MergeCartDto) {
    return this.cartService.mergeGuestCart(
      body.guestSessionIdOrCartId,
      body.customerId || '',
      body.storeId,
    );
  }
}
