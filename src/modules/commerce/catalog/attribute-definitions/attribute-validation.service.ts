import { Injectable, BadRequestException } from '@nestjs/common';
import { AttributeType } from '@prisma/client';
import { TenantPrismaService } from '../../../../infrastructure/database/tenant-prisma.service.js';
import { normalizeAttributeKey } from './attribute-key.util.js';

@Injectable()
export class AttributeValidationService {
  constructor(private readonly db: TenantPrismaService) {}

  /**
   * Validate variant attributes against global and category-scoped definitions for a tenant.
   * Returns a normalized attributes object.
   *
   * @param tenantId The current tenant ID
   * @param categoryIds Categories associated with the product
   * @param attributes The raw attributes object to validate
   */
  async validateAttributes(
    tenantId: string,
    categoryIds: string[],
    attributes: Record<string, any> | undefined | null,
    isVariant?: boolean,
  ): Promise<Record<string, any>> {
    const attrs = attributes || {};

    // 1. Fetch active attribute definitions (global + category-scoped)
    let definitions = await this.db.exec((tx) =>
      tx.attributeDefinition.findMany({
        where: {
          tenantId,
          OR: [
            { categoryId: null },
            { categoryId: { in: categoryIds || [] } },
          ],
        },
      }),
    );

    if (isVariant !== undefined) {
      definitions = definitions.filter((def) => def.isVariantAxis === isVariant);
    }

    // Create maps for case-insensitive lookup
    const defMap = new Map<string, any>();
    for (const def of definitions) {
      try {
        const normName = normalizeAttributeKey(def.name);
        defMap.set(normName, def);
      } catch {
        const safeName = def.name.trim().toLowerCase().replace(/\s+/g, '_');
        defMap.set(safeName, def);
      }
    }

    const normalizedAttrs: Record<string, any> = {};
    const inputKeysNormalized = new Set<string>();

    // 2. Validate and normalize provided attributes
    for (const [key, value] of Object.entries(attrs)) {
      let normalizedKey: string;
      try {
        normalizedKey = normalizeAttributeKey(key);
      } catch (err: any) {
        throw new BadRequestException(`Invalid attribute key: ${err.message}`);
      }

      if (inputKeysNormalized.has(normalizedKey)) {
        throw new BadRequestException(
          `Duplicate attribute key "${normalizedKey}" detected after normalization`,
        );
      }
      inputKeysNormalized.add(normalizedKey);

      const def = defMap.get(normalizedKey);

      if (!def) {
        // Legacy/ad-hoc attribute — allow it but store with normalized key
        normalizedAttrs[normalizedKey] = value;
        continue;
      }

      // If value is null or undefined, treat it as missing/empty
      if (value === null || value === undefined) {
        if (def.isRequired) {
          throw new BadRequestException(
            `Required attribute "${def.name}" is missing or empty`,
          );
        }
        normalizedAttrs[normalizedKey] = null;
        continue;
      }

      let normalizedValue: any = value;

      switch (def.type) {
        case AttributeType.select:
        case AttributeType.color: {
          const options = (def.options as any[]) || [];
          const stringVal = String(value).trim();
          
          const matchedOption = options.find(
            (opt) =>
              String(opt.value).trim().toLowerCase() === stringVal.toLowerCase(),
          );

          if (!matchedOption) {
            throw new BadRequestException(
              `Value "${value}" is not a valid option for attribute "${def.name}". Allowed options: ${options
                .map((o) => o.value)
                .join(', ')}`,
            );
          }
          normalizedValue = matchedOption.value;
          break;
        }

        case AttributeType.text: {
          if (typeof value !== 'string') {
            throw new BadRequestException(
              `Attribute "${def.name}" must be a string`,
            );
          }
          normalizedValue = value;
          break;
        }

        case AttributeType.number: {
          let num: number;
          if (typeof value === 'number') {
            num = value;
          } else if (typeof value === 'string' && value.trim() !== '') {
            num = Number(value);
          } else {
            throw new BadRequestException(
              `Attribute "${def.name}" must be a finite number`,
            );
          }

          if (isNaN(num) || !isFinite(num)) {
            throw new BadRequestException(
              `Attribute "${def.name}" must be a finite number`,
            );
          }
          normalizedValue = num;
          break;
        }

        case AttributeType.boolean: {
          if (typeof value === 'boolean') {
            normalizedValue = value;
          } else if (typeof value === 'string') {
            const lowerStr = value.trim().toLowerCase();
            if (lowerStr === 'true' || lowerStr === '1') {
              normalizedValue = true;
            } else if (lowerStr === 'false' || lowerStr === '0') {
              normalizedValue = false;
            } else {
              throw new BadRequestException(
                `Attribute "${def.name}" must be a boolean`,
              );
            }
          } else {
            throw new BadRequestException(
              `Attribute "${def.name}" must be a boolean`,
            );
          }
          break;
        }

        default:
          normalizedValue = value;
      }

      normalizedAttrs[normalizedKey] = normalizedValue;
    }

    // 3. Check for missing required attributes
    for (const def of definitions) {
      if (def.isRequired) {
        let normName: string;
        try {
          normName = normalizeAttributeKey(def.name);
        } catch {
          normName = def.name.trim().toLowerCase().replace(/\s+/g, '_');
        }
        if (!inputKeysNormalized.has(normName)) {
          throw new BadRequestException(
            `Required attribute "${def.name}" is missing`,
          );
        }
      }
    }

    return normalizedAttrs;
  }

  /**
   * Validate matrix options upfront to avoid multiple DB calls during Cartesian generation.
   * Returns a normalized options object.
   *
   * @param tenantId The current tenant ID
   * @param categoryIds Categories associated with the product
   * @param options The raw matrix options map (e.g. { size: ['S', 'M'], color: ['Red'] })
   */
  async validateMatrixOptions(
    tenantId: string,
    categoryIds: string[],
    options: Record<string, string[]> | undefined | null,
  ): Promise<Record<string, string[]>> {
    const opts = options || {};

    // 1. Fetch active attribute definitions (global + category-scoped)
    const definitions = await this.db.exec((tx) =>
      tx.attributeDefinition.findMany({
        where: {
          tenantId,
          OR: [
            { categoryId: null },
            { categoryId: { in: categoryIds || [] } },
          ],
        },
      }),
    );

    // Create maps for case-insensitive lookup
    const defMap = new Map<string, any>();
    for (const def of definitions) {
      try {
        const normName = normalizeAttributeKey(def.name);
        defMap.set(normName, def);
      } catch {
        const safeName = def.name.trim().toLowerCase().replace(/\s+/g, '_');
        defMap.set(safeName, def);
      }
    }

    const normalizedOptions: Record<string, string[]> = {};
    const inputKeysNormalized = new Set<string>();

    // 2. Validate and normalize provided options
    for (const [key, values] of Object.entries(opts)) {
      let normalizedKey: string;
      try {
        normalizedKey = normalizeAttributeKey(key);
      } catch (err: any) {
        throw new BadRequestException(`Invalid attribute key: ${err.message}`);
      }

      if (inputKeysNormalized.has(normalizedKey)) {
        throw new BadRequestException(
          `Duplicate attribute key "${normalizedKey}" detected after normalization`,
        );
      }
      inputKeysNormalized.add(normalizedKey);

      const def = defMap.get(normalizedKey);

      if (!def) {
        // Legacy/ad-hoc option — allow it and pass as-is (with normalized key)
        normalizedOptions[normalizedKey] = values;
        continue;
      }

      if (!Array.isArray(values)) {
        throw new BadRequestException(
          `Values for attribute "${def.name}" must be an array`,
        );
      }

      const normalizedValues: string[] = [];

      for (const val of values) {
        if (val === null || val === undefined) {
          throw new BadRequestException(
            `Values in options array for "${def.name}" cannot be null or undefined`,
          );
        }

        switch (def.type) {
          case AttributeType.select:
          case AttributeType.color: {
            const defOptions = (def.options as any[]) || [];
            const stringVal = String(val).trim();
            const matchedOption = defOptions.find(
              (opt) =>
                String(opt.value).trim().toLowerCase() === stringVal.toLowerCase(),
            );

            if (!matchedOption) {
              throw new BadRequestException(
                `Value "${val}" is not a valid option for attribute "${def.name}". Allowed options: ${defOptions
                  .map((o) => o.value)
                  .join(', ')}`,
              );
            }
            normalizedValues.push(matchedOption.value);
            break;
          }

          case AttributeType.text: {
            if (typeof val !== 'string') {
              throw new BadRequestException(
                `Value "${val}" for attribute "${def.name}" must be a string`,
              );
            }
            normalizedValues.push(val);
            break;
          }

          case AttributeType.number: {
            let num: number;
            if (typeof val === 'number') {
              num = val;
            } else if (typeof val === 'string' && val.trim() !== '') {
              num = Number(val);
            } else {
              throw new BadRequestException(
                `Value "${val}" for attribute "${def.name}" must be a finite number`,
              );
            }

            if (isNaN(num) || !isFinite(num)) {
              throw new BadRequestException(
                `Value "${val}" for attribute "${def.name}" must be a finite number`,
              );
            }
            normalizedValues.push(String(num));
            break;
          }

          case AttributeType.boolean: {
            if (typeof val === 'boolean') {
              normalizedValues.push(String(val));
            } else if (typeof val === 'string') {
              const lowerStr = val.trim().toLowerCase();
              if (lowerStr === 'true' || lowerStr === '1') {
                normalizedValues.push('true');
              } else if (lowerStr === 'false' || lowerStr === '0') {
                normalizedValues.push('false');
              } else {
                throw new BadRequestException(
                  `Value "${val}" for attribute "${def.name}" must be a boolean`,
                );
              }
            } else {
              throw new BadRequestException(
                `Value "${val}" for attribute "${def.name}" must be a boolean`,
              );
            }
            break;
          }

          default:
            normalizedValues.push(String(val));
        }
      }

      normalizedOptions[normalizedKey] = normalizedValues;
    }

    // 3. Check for missing required attributes
    for (const def of definitions) {
      if (def.isRequired) {
        let normName: string;
        try {
          normName = normalizeAttributeKey(def.name);
        } catch {
          normName = def.name.trim().toLowerCase().replace(/\s+/g, '_');
        }
        if (!inputKeysNormalized.has(normName)) {
          throw new BadRequestException(
            `Required attribute "${def.name}" is missing`,
          );
        }
      }
    }

    return normalizedOptions;
  }
}
