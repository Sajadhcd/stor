import { BadRequestException } from '@nestjs/common';

/**
 * Normalizes an attribute machine key to a standardized format:
 * - Trims whitespace
 * - Converts to lowercase
 * - Replaces spaces with underscores
 * - Rejects empty keys
 * - Rejects keys containing characters outside of a-z, 0-9, and underscore
 *
 * @param key The raw attribute key
 * @throws BadRequestException if the key is empty or contains unsafe characters
 */
export function normalizeAttributeKey(key: string): string {
  if (key === null || key === undefined) {
    throw new BadRequestException('Attribute key cannot be null or undefined');
  }

  // 1. Trim and lowercase
  let normalized = key.trim().toLowerCase();

  // 2. Replace all spaces (including multiple or tabs) with a single underscore
  normalized = normalized.replace(/\s+/g, '_');

  // 3. Reject empty keys
  if (!normalized) {
    throw new BadRequestException('Attribute key cannot be empty');
  }

  // 4. Reject unsafe characters (must match ^[a-z0-9_]+$)
  const safeRegex = /^[a-z0-9_]+$/;
  if (!safeRegex.test(normalized)) {
    throw new BadRequestException(
      `Attribute key "${key}" contains invalid characters. Only English letters, numbers, and underscores are allowed.`,
    );
  }

  return normalized;
}
