import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { TenantPrismaService } from '../../../infrastructure/database/tenant-prisma.service.js';
import { requestContextStorage } from '../../../common/context/request-context.js';
import { AccountingService } from '../accounting/accounting.service.js';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto.js';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';

@Injectable()
export class InstallmentsService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly accountingService: AccountingService
  ) {}

  async findAllContracts(query?: PaginationQueryDto) {
    const take = query?.take || 20;
    const skip = query?.skip || 0;
    return this.db.exec(async (tx) => {
      const [items, total] = await Promise.all([
        tx.installmentContract.findMany({
          include: {
            customer: true,
            order: true,
            schedules: { orderBy: { dueDate: 'asc' } },
          },
          orderBy: { createdAt: 'desc' },
          take,
          skip,
        }),
        tx.installmentContract.count(),
      ]);
      return new PaginatedResponseDto(items, total, query?.page || 1, query?.limit || 20);
    });
  }

  async findContractById(id: string) {
    const contract = await this.db.exec(async (tx) => {
      return tx.installmentContract.findUnique({
        where: { id },
        include: {
          customer: true,
          order: true,
          schedules: { orderBy: { dueDate: 'asc' } },
        },
      });
    });
    if (!contract) throw new NotFoundException(`Installment contract with ID ${id} not found`);
    return contract;
  }

  async createContract(data: {
    customerId: string;
    orderId: string;
    totalAmount: number;
    downPayment: number;
    months: number;
  }) {
    const ctx = requestContextStorage.getStore();
    const tenantId = ctx?.tenantId || '';

    const remainingAmount = data.totalAmount - data.downPayment;
    if (remainingAmount <= 0) {
      throw new BadRequestException('Down payment cannot equal or exceed total amount');
    }

    const monthlyAmount = remainingAmount / data.months;

    const contract = await this.db.exec(async (tx) => {
      const createdContract = await tx.installmentContract.create({
        data: {
          tenantId,
          customerId: data.customerId,
          orderId: data.orderId,
          totalAmount: data.totalAmount,
          downPayment: data.downPayment,
          remainingAmount,
          months: data.months,
          status: 'ACTIVE',
        },
      });

      // Auto-generate monthly schedules
      for (let i = 1; i <= data.months; i++) {
        const dueDate = new Date(Date.now() + i * 30 * 24 * 60 * 60 * 1000);
        await tx.installmentSchedule.create({
          data: {
            contractId: createdContract.id,
            amount: monthlyAmount,
            dueDate,
            status: 'PENDING',
          },
        });
      }

      return createdContract;
    });

    // Record Accounting Entry
    await this.accountingService.recordEntry({
      entryNumber: `INS-${contract.id.slice(0, 8)}`,
      description: `Installment contract created for Order ${data.orderId}`,
      referenceId: contract.id,
      lines: [
        { accountName: 'Cash', debit: data.downPayment, credit: 0 },
        { accountName: 'Customer Receivables', debit: remainingAmount, credit: 0 },
        { accountName: 'Sales Revenue', debit: 0, credit: data.totalAmount },
      ],
    });

    return contract;
  }

  async payInstallment(scheduleId: string) {
    const result = await this.db.exec(async (tx) => {
      const schedule = await tx.installmentSchedule.findUnique({
        where: { id: scheduleId },
        include: { contract: true },
      });

      if (!schedule) throw new NotFoundException(`Schedule ${scheduleId} not found`);
      if (schedule.status === 'PAID') throw new BadRequestException('Schedule is already paid');

      const updatedSchedule = await tx.installmentSchedule.update({
        where: { id: scheduleId },
        data: {
          status: 'PAID',
          paidAt: new Date(),
        },
      });

      // Check if all schedules paid
      const unpaidCount = await tx.installmentSchedule.count({
        where: { contractId: schedule.contractId, status: 'PENDING' },
      });

      if (unpaidCount === 0) {
        await tx.installmentContract.update({
          where: { id: schedule.contractId },
          data: { status: 'COMPLETED' },
        });
      }

      return updatedSchedule;
    });

    // Record Accounting Entry
    await this.accountingService.recordEntry({
      entryNumber: `PMT-INS-${scheduleId.slice(0, 8)}`,
      description: `Installment collection received`,
      referenceId: scheduleId,
      lines: [
        { accountName: 'Cash', debit: Number(result.amount), credit: 0 },
        { accountName: 'Customer Receivables', debit: 0, credit: Number(result.amount) },
      ],
    });

    return result;
  }
}
