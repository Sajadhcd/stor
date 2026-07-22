import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { InstallmentsService } from './installments.service.js';
import { CreateInstallmentContractDto } from './dto/create-installment-contract.dto.js';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { AuthGuard } from '../../../security/guards/auth.guard.js';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Installment Sales System')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('installments')
export class InstallmentsController {
  constructor(private readonly installmentsService: InstallmentsService) {}

  @ApiOperation({ summary: 'List all installment contracts for current tenant with pagination' })
  @ApiResponse({ status: 200, description: 'Paginated contracts list retrieved' })
  @Get('contracts')
  async findAllContracts(@Query() query?: PaginationQueryDto) {
    return this.installmentsService.findAllContracts(query);
  }

  @ApiOperation({ summary: 'Get details of an installment contract with schedule' })
  @ApiResponse({ status: 200, description: 'Contract details' })
  @Get('contracts/:id')
  async findContractById(@Param('id') id: string) {
    return this.installmentsService.findContractById(id);
  }

  @ApiOperation({ summary: 'Create a new installment sales contract' })
  @ApiResponse({ status: 201, description: 'Installment contract created' })
  @Post('contracts')
  async createContract(@Body() body: CreateInstallmentContractDto) {
    return this.installmentsService.createContract(body);
  }

  @ApiOperation({ summary: 'Record payment for an installment schedule' })
  @ApiResponse({ status: 200, description: 'Installment payment recorded' })
  @Post(':id/payments')
  async payInstallment(@Param('id') scheduleId: string) {
    return this.installmentsService.payInstallment(scheduleId);
  }
}
