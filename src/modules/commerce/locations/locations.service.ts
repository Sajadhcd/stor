import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../../../infrastructure/database/tenant-prisma.service.js';
import { requestContextStorage } from '../../../common/context/request-context.js';

@Injectable()
export class LocationsService {
  constructor(private readonly db: TenantPrismaService) {}

  private readonly defaultProvinces = [
    { nameArabic: 'بغداد', nameEnglish: 'Baghdad', code: 'BGD' },
    { nameArabic: 'البصرة', nameEnglish: 'Basra', code: 'BSR' },
    { nameArabic: 'أربيل', nameEnglish: 'Erbil', code: 'EBL' },
    { nameArabic: 'النجف', nameEnglish: 'Najaf', code: 'NJF' },
    { nameArabic: 'كربلاء المقدسة', nameEnglish: 'Karbala', code: 'KRB' },
    { nameArabic: 'نينوى', nameEnglish: 'Nineveh', code: 'NNV' },
    { nameArabic: 'السليمانية', nameEnglish: 'Sulaymaniyah', code: 'SUL' },
    { nameArabic: 'دهوك', nameEnglish: 'Duhok', code: 'DHK' },
    { nameArabic: 'الأنبار', nameEnglish: 'Anbar', code: 'ANB' },
    { nameArabic: 'بابل', nameEnglish: 'Babil', code: 'BBL' },
    { nameArabic: 'ديالى', nameEnglish: 'Diyala', code: 'DYL' },
    { nameArabic: 'ذي قار', nameEnglish: 'Dhi Qar', code: 'DQR' },
    { nameArabic: 'القادسية', nameEnglish: 'Qadisiyyah', code: 'QAD' },
    { nameArabic: 'كركوك', nameEnglish: 'Kirkuk', code: 'KRK' },
    { nameArabic: 'ميسان', nameEnglish: 'Maysan', code: 'MSN' },
    { nameArabic: 'المثنى', nameEnglish: 'Muthanna', code: 'MTN' },
    { nameArabic: 'صلاح الدين', nameEnglish: 'Saladin', code: 'SAL' },
    { nameArabic: 'واسط', nameEnglish: 'Wasit', code: 'WST' },
  ];

  async findAllProvinces() {
    const ctx = requestContextStorage.getStore();
    const tenantId = ctx?.tenantId || '';

    return this.db.exec(async (tx) => {
      const count = await tx.province.count();
      if (count === 0 && tenantId) {
        for (const p of this.defaultProvinces) {
          await tx.province.create({
            data: {
              tenantId,
              nameArabic: p.nameArabic,
              nameEnglish: p.nameEnglish,
              code: p.code,
              active: true,
            },
          });
        }
      }

      return tx.province.findMany({
        orderBy: { code: 'asc' },
      });
    });
  }

  async findAllDeliveryZones() {
    return this.db.exec(async (tx) => {
      return tx.deliveryZone.findMany({
        include: { province: true },
        orderBy: { createdAt: 'desc' },
      });
    });
  }

  async createDeliveryZone(data: { provinceId: string; name: string; deliveryFee: number; estimatedDays?: number }) {
    const ctx = requestContextStorage.getStore();
    const tenantId = ctx?.tenantId || '';

    return this.db.exec(async (tx) => {
      return tx.deliveryZone.create({
        data: {
          tenantId,
          provinceId: data.provinceId,
          name: data.name,
          deliveryFee: data.deliveryFee,
          estimatedDays: data.estimatedDays ?? 2,
        },
      });
    });
  }

  async updateDeliveryZone(id: string, data: { name?: string; deliveryFee?: number; estimatedDays?: number; active?: boolean }) {
    return this.db.exec(async (tx) => {
      const zone = await tx.deliveryZone.findUnique({ where: { id } });
      if (!zone) throw new NotFoundException(`Delivery zone with ID ${id} not found`);

      return tx.deliveryZone.update({
        where: { id },
        data,
      });
    });
  }
}
