import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';
import { AuthGuard } from '../../../security/guards/auth.guard.js';
import { PermissionsGuard } from '../../../security/guards/permissions.guard.js';
import { ExecutionContext } from '@nestjs/common';

describe('ProductsController', () => {
  let controller: ProductsController;
  let mockProductsService: any;

  const mockProduct = {
    id: 'prod-123',
    tenantId: 'tenant-123',
    storeId: 'store-123',
    titleTranslations: { en: 'Test Product' },
    isPublished: false,
  };

  const mockUser = {
    sub: 'user-123',
    tenantId: 'tenant-123',
    role: 'store_manager',
  };

  beforeEach(async () => {
    mockProductsService = {
      findAll: jest.fn().mockResolvedValue({
        data: [mockProduct],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 }
      }),
      findById: jest.fn().mockResolvedValue(mockProduct),
      create: jest.fn().mockResolvedValue(mockProduct),
      update: jest.fn().mockResolvedValue(mockProduct),
      softDelete: jest.fn().mockResolvedValue(mockProduct),
      createVariant: jest.fn().mockResolvedValue({ id: 'var-123', sku: 'SKU-1' }),
      updateVariant: jest.fn().mockResolvedValue({ id: 'var-123', sku: 'SKU-Updated' }),
      deleteVariant: jest.fn().mockResolvedValue({ success: true }),
      generateVariantMatrix: jest.fn().mockResolvedValue([{ id: 'var-1' }, { id: 'var-2' }]),
    };

    const mockAuthGuard = {
      canActivate: jest.fn().mockImplementation((context: ExecutionContext) => {
        const req = context.switchToHttp().getRequest();
        req.user = mockUser;
        return true;
      }),
    };

    const mockPermissionsGuard = {
      canActivate: jest.fn().mockReturnValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        { provide: ProductsService, useValue: mockProductsService },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockAuthGuard)
      .overrideGuard(PermissionsGuard)
      .useValue(mockPermissionsGuard)
      .compile();

    controller = module.get<ProductsController>(ProductsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated products', async () => {
      const query = { storeId: 'store-123', isPublished: true, skip: 0, take: 20 };
      const result = await controller.findAll(query);
      expect(result).toEqual({
        data: [mockProduct],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 }
      });
      expect(mockProductsService.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('findOne', () => {
    it('should return product details', async () => {
      const result = await controller.findOne('prod-123');
      expect(result).toEqual(mockProduct);
      expect(mockProductsService.findById).toHaveBeenCalledWith('prod-123');
    });
  });

  describe('create', () => {
    it('should create a product', async () => {
      const body = {
        storeId: 'store-123',
        titleTranslations: { en: 'Tee' },
      };
      const req = { user: mockUser } as any;
      const result = await controller.create(req, body);
      expect(result).toEqual(mockProduct);
      expect(mockProductsService.create).toHaveBeenCalledWith({ ...body, tenantId: 'tenant-123' });
    });
  });

  describe('createVariant', () => {
    it('should create a variant', async () => {
      const body = {
        sku: 'SKU-1',
        price: 99,
      };
      const req = { user: mockUser } as any;
      const result = await controller.createVariant('prod-123', body, req);
      expect(result).toEqual({ id: 'var-123', sku: 'SKU-1' });
      expect(mockProductsService.createVariant).toHaveBeenCalledWith('prod-123', { ...body, tenantId: 'tenant-123' });
    });
  });

  describe('generateMatrix', () => {
    it('should generate combinations of variants', async () => {
      const body = {
        baseSku: 'VELO',
        basePrice: 100,
        options: { size: ['S', 'M'] },
      };
      const req = { user: mockUser } as any;
      const result = await controller.generateMatrix('prod-123', body, req);
      expect(result).toEqual([{ id: 'var-1' }, { id: 'var-2' }]);
      expect(mockProductsService.generateVariantMatrix).toHaveBeenCalledWith('prod-123', { ...body, tenantId: 'tenant-123' });
    });
  });
});
