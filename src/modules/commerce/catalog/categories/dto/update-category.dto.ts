import { PartialType } from '@nestjs/swagger';
import { CreateCategoryDto } from './create-category.dto.js';

/**
 * All fields from CreateCategoryDto become optional for partial updates.
 * PartialType preserves all validation decorators as optional.
 */
export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}
