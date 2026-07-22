import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CheckoutService } from './checkout.service.js';
import { CreateCheckoutDto } from './dto/create-checkout.dto.js';
import { UpdateCustomerDto } from './dto/update-customer.dto.js';
import { UpdateAddressesDto } from './dto/update-addresses.dto.js';
import { UpdateShippingMethodDto } from './dto/update-shipping-method.dto.js';
import { ApplyCouponDto } from './dto/apply-coupon.dto.js';

@ApiTags('Checkout')
@Controller('checkouts')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @ApiOperation({ summary: 'Create checkout session from cart' })
  @ApiResponse({ status: 201, description: 'Checkout session created' })
  @Post()
  async createCheckout(@Body() body: CreateCheckoutDto) {
    return this.checkoutService.createCheckout(body);
  }

  @ApiOperation({ summary: 'Get checkout session by ID' })
  @ApiResponse({ status: 200, description: 'Checkout session retrieved' })
  @ApiResponse({ status: 404, description: 'Checkout session not found' })
  @Get(':id')
  async getCheckout(@Param('id') id: string) {
    return this.checkoutService.getCheckout(id);
  }

  @ApiOperation({ summary: 'Update customer information for checkout' })
  @ApiResponse({ status: 200, description: 'Customer information updated' })
  @Patch(':id/customer')
  async updateCustomer(
    @Param('id') checkoutId: string,
    @Body() body: UpdateCustomerDto,
  ) {
    return this.checkoutService.updateCustomer(checkoutId, body);
  }

  @ApiOperation({ summary: 'Update shipping and billing addresses' })
  @ApiResponse({ status: 200, description: 'Addresses updated' })
  @Patch(':id/addresses')
  async updateAddresses(
    @Param('id') checkoutId: string,
    @Body() body: UpdateAddressesDto,
  ) {
    return this.checkoutService.updateAddresses(checkoutId, body);
  }

  @ApiOperation({ summary: 'Update shipping method for checkout' })
  @ApiResponse({ status: 200, description: 'Shipping method updated' })
  @Patch(':id/shipping-method')
  async updateShippingMethod(
    @Param('id') checkoutId: string,
    @Body() body: UpdateShippingMethodDto,
  ) {
    return this.checkoutService.updateShippingMethod(checkoutId, body);
  }

  @ApiOperation({ summary: 'Apply coupon code to checkout' })
  @ApiResponse({ status: 200, description: 'Coupon applied successfully' })
  @Post(':id/coupon')
  async applyCoupon(
    @Param('id') checkoutId: string,
    @Body() body: ApplyCouponDto,
  ) {
    return this.checkoutService.applyCoupon(checkoutId, body);
  }

  @ApiOperation({ summary: 'Remove coupon code from checkout' })
  @ApiResponse({ status: 200, description: 'Coupon removed' })
  @Delete(':id/coupon')
  async removeCoupon(@Param('id') checkoutId: string) {
    return this.checkoutService.removeCoupon(checkoutId);
  }

  @ApiOperation({ summary: 'Validate checkout readiness' })
  @ApiResponse({ status: 200, description: 'Validation results returned' })
  @Get(':id/validate')
  async validateCheckout(@Param('id') checkoutId: string) {
    return this.checkoutService.validateCheckout(checkoutId);
  }

  @ApiOperation({ summary: 'Confirm checkout session' })
  @ApiResponse({ status: 200, description: 'Checkout confirmed and cart converted' })
  @Post(':id/confirm')
  async confirmCheckout(@Param('id') checkoutId: string) {
    return this.checkoutService.confirmCheckout(checkoutId);
  }

  @ApiOperation({ summary: 'Expire checkout session' })
  @ApiResponse({ status: 200, description: 'Checkout expired' })
  @Post(':id/expire')
  async expireCheckout(@Param('id') checkoutId: string) {
    return this.checkoutService.expireCheckout(checkoutId);
  }
}
