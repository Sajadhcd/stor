import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, Min, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class JournalEntryLineDto {
  @ApiProperty({ example: 'Cash', description: 'Account name or ledger head' })
  @IsString()
  @IsNotEmpty()
  accountName!: string;

  @ApiProperty({ example: 100000, description: 'Debit amount' })
  @IsNumber()
  @Min(0)
  debit!: number;

  @ApiProperty({ example: 0, description: 'Credit amount' })
  @IsNumber()
  @Min(0)
  credit!: number;
}

export class RecordJournalEntryDto {
  @ApiProperty({ example: 'JE-2026-001', description: 'Unique entry reference number' })
  @IsString()
  @IsNotEmpty()
  entryNumber!: string;

  @ApiProperty({ example: 'Monthly salary disbursement', description: 'Description of the journal entry' })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiPropertyOptional({ example: 'INV-001', description: 'Optional reference ID (Invoice/Order)' })
  @IsOptional()
  @IsString()
  referenceId?: string;

  @ApiProperty({ type: [JournalEntryLineDto], description: 'Double entry lines' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JournalEntryLineDto)
  lines!: JournalEntryLineDto[];
}
