import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AttributeType } from '@prisma/client';
import { AttributeValidationService } from './attribute-validation.service.js';
import { TenantPrismaService } from '../../../../infrastructure/database/tenant-prisma.service.js';

const TENANT_ID = 'tenant-123';

const mockDefinitions = () => [
  {
    id: 'def-1',
    tenantId: TENANT_ID,
    categoryId: null, // global
    name: 'size',
    type: AttributeType.select,
    options: [
      { value: 'S', labelTranslations: { en: 'Small' } },
      { value: 'M', labelTranslations: { en: 'Medium' } },
    ],
    isRequired: true,
  },
  {
    id: 'def-2',
    tenantId: TENANT_ID,
    categoryId: null, // global
    name: 'Color', // mixed case key
    type: AttributeType.color,
    options: [
      { value: '#FF0000', labelTranslations: { en: 'Red' } },
      { value: '#0000FF', labelTranslations: { en: 'Blue' } },
    ],
    isRequired: false,
  },
  {
    id: 'def-3',
    tenantId: TENANT_ID,
    categoryId: 'cat-apparel', // category-scoped
    name: 'material',
    type: AttributeType.text,
    isRequired: false,
  },
  {
    id: 'def-4',
    tenantId: TENANT_ID,
    categoryId: 'cat-electronics', // category-scoped
    name: 'voltage',
    type: AttributeType.number,
    isRequired: false,
  },
  {
    id: 'def-5',
    tenantId: TENANT_ID,
    categoryId: 'cat-electronics', // category-scoped
    name: 'hasBattery',
    type: AttributeType.boolean,
    isRequired: false,
  },
];

type TxCallback<T> = (tx: any) => Promise<T>;

describe('AttributeValidationService', () => {
  let service: AttributeValidationService;
  let mockDb: { exec: jest.Mock };

  beforeEach(async () => {
    mockDb = {
      exec: jest.fn().mockImplementation(async (cb: TxCallback<any>) => {
        const tx = {
          attributeDefinition: {
            findMany: jest.fn().mockImplementation((args) => {
              const OR = args?.where?.OR;
              if (!OR) return mockDefinitions();
              const catInObj = OR.find((clause: any) => clause.categoryId && clause.categoryId.in);
              const allowedCatIds = catInObj ? catInObj.categoryId.in : [];
              return mockDefinitions().filter(
                (def) =>
                  def.categoryId === null || allowedCatIds.includes(def.categoryId),
              );
            }),
          },
        };
        return cb(tx);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttributeValidationService,
        { provide: TenantPrismaService, useValue: mockDb },
      ],
    }).compile();

    service = module.get<AttributeValidationService>(AttributeValidationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateAttributes', () => {
    it('accepts and normalizes valid attributes (select, color, text, number, boolean)', async () => {
      const input = {
        size: 'S',
        color: '#ff0000', // lowercased value matches '#FF0000' case-insensitively
        material: 'Cotton',
        voltage: '220', // numeric string parsed to number
        hasBattery: 'true', // boolean string parsed to boolean
      };

      const result = await service.validateAttributes(
        TENANT_ID,
        ['cat-apparel', 'cat-electronics'],
        input,
      );

      // Verify normalization of keys to definitions
      expect(result).toHaveProperty('size', 'S');
      expect(result).toHaveProperty('color', '#FF0000'); // Normalized key casing and option value casing
      expect(result).toHaveProperty('material', 'Cotton');
      expect(result).toHaveProperty('voltage', 220); // Normalized to finite number
      expect(result).toHaveProperty('hasbattery', true); // Normalized to boolean true
    });

    it('rejects missing isRequired attributes', async () => {
      const input = {
        Color: '#FF0000',
      };

      await expect(
        service.validateAttributes(TENANT_ID, [], input),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects invalid select values', async () => {
      const input = {
        size: 'XXL', // Not in options [S, M]
      };

      await expect(
        service.validateAttributes(TENANT_ID, [], input),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects invalid color values', async () => {
      const input = {
        size: 'S',
        Color: '#FFFFFF', // Not in options [#FF0000, #0000FF]
      };

      await expect(
        service.validateAttributes(TENANT_ID, [], input),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects invalid type for text attribute', async () => {
      const input = {
        size: 'S',
        material: 12345, // Must be string
      };

      await expect(
        service.validateAttributes(TENANT_ID, ['cat-apparel'], input),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects invalid type for number attribute', async () => {
      const input = {
        size: 'S',
        voltage: 'not-a-number', // Cannot parse
      };

      await expect(
        service.validateAttributes(TENANT_ID, ['cat-electronics'], input),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects invalid type for boolean attribute', async () => {
      const input = {
        size: 'S',
        hasBattery: 'maybe', // Invalid boolean value
      };

      await expect(
        service.validateAttributes(TENANT_ID, ['cat-electronics'], input),
      ).rejects.toThrow(BadRequestException);
    });

    it('respects category scoped definitions and ignores scoped definitions if product is not in that category', async () => {
      // waterproof/voltage/hasBattery belong to 'cat-electronics', material belongs to 'cat-apparel'.
      // If we are in 'cat-apparel', 'voltage' is treated as legacy and allowed, while 'material' is validated.
      const input = {
        size: 'S',
        material: 'Denim',
        voltage: 'not-a-number-but-allowed-because-scoped-out',
      };

      const result = await service.validateAttributes(
        TENANT_ID,
        ['cat-apparel'],
        input,
      );

      expect(result).toHaveProperty('material', 'Denim');
      expect(result).toHaveProperty(
        'voltage',
        'not-a-number-but-allowed-because-scoped-out',
      );
    });

    it('allows legacy/custom attributes for backward compatibility', async () => {
      const input = {
        size: 'S',
        custom_sku_suffix: 'LE', // Not defined in schema
      };

      const result = await service.validateAttributes(TENANT_ID, [], input);

      expect(result).toHaveProperty('size', 'S');
      expect(result).toHaveProperty('custom_sku_suffix', 'LE'); // Preserved without error
    });

    it('rejects duplicate normalized keys', async () => {
      const input = {
        size: 'S',
        Size: 'M',
      };

      await expect(
        service.validateAttributes(TENANT_ID, [], input),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('validateMatrixOptions', () => {
    it('accepts and normalizes valid matrix options lists', async () => {
      const options = {
        size: ['S', 'M'],
        Color: ['#ff0000', '#0000ff'],
        custom_field: ['value1', 'value2'],
      };

      const result = await service.validateMatrixOptions(
        TENANT_ID,
        [],
        options,
      );

      expect(result).toHaveProperty('size', ['S', 'M']);
      expect(result).toHaveProperty('color', ['#FF0000', '#0000FF']); // Casing normalized
      expect(result).toHaveProperty('custom_field', ['value1', 'value2']); // Legacy allowed
    });

    it('rejects missing required attributes in options keys', async () => {
      const options = {
        Color: ['#ff0000'],
      };

      await expect(
        service.validateMatrixOptions(TENANT_ID, [], options),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects invalid option values in matrix lists', async () => {
      const options = {
        size: ['S', 'L'], // L is invalid
      };

      await expect(
        service.validateMatrixOptions(TENANT_ID, [], options),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects duplicate normalized keys in matrix options', async () => {
      const options = {
        size: ['S'],
        Size: ['M'],
      };

      await expect(
        service.validateMatrixOptions(TENANT_ID, [], options),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
