import { BadRequestException } from '@nestjs/common';
import { normalizeAttributeKey } from './attribute-key.util.js';

describe('normalizeAttributeKey', () => {
  it('should trim and lowercase key', () => {
    expect(normalizeAttributeKey(' Color ')).toBe('color');
  });

  it('should replace spaces with underscores', () => {
    expect(normalizeAttributeKey('Storage Size')).toBe('storage_size');
    expect(normalizeAttributeKey('  Storage   Size  ')).toBe('storage_size');
  });

  it('should allow valid lowercase alphanumeric keys with underscores', () => {
    expect(normalizeAttributeKey('size_12_3')).toBe('size_12_3');
  });

  it('should reject empty keys', () => {
    expect(() => normalizeAttributeKey('')).toThrow(BadRequestException);
    expect(() => normalizeAttributeKey('   ')).toThrow(BadRequestException);
  });

  it('should reject non-ASCII keys (e.g. Arabic)', () => {
    expect(() => normalizeAttributeKey('اللون')).toThrow(BadRequestException);
  });

  it('should reject unsafe/special characters', () => {
    expect(() => normalizeAttributeKey('color-red')).toThrow(BadRequestException); // hyphen
    expect(() => normalizeAttributeKey('size!')).toThrow(BadRequestException); // exclamation
    expect(() => normalizeAttributeKey('color@')).toThrow(BadRequestException); // special char
  });
});
