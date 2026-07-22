import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { AccountingService } from './accounting.service.js';
import { RecordJournalEntryDto } from './dto/record-journal-entry.dto.js';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { AuthGuard } from '../../../security/guards/auth.guard.js';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Iraqi Accounting Foundation')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('accounting')
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @ApiOperation({ summary: 'List all double-entry journal entries for current tenant with pagination' })
  @ApiResponse({ status: 200, description: 'Paginated journal entries retrieved' })
  @Get('entries')
  async findAllEntries(@Query() query?: PaginationQueryDto) {
    return this.accountingService.findAllEntries(query);
  }

  @ApiOperation({ summary: 'Record manual journal entry' })
  @ApiResponse({ status: 201, description: 'Journal entry recorded' })
  @Post('entries')
  async recordEntry(@Body() body: RecordJournalEntryDto) {
    return this.accountingService.recordEntry(body);
  }
}
