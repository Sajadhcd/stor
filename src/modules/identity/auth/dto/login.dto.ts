import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, MinLength, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@veloactivewear.com', description: 'User login email address' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password123', description: 'User secure password' })
  @IsNotEmpty()
  @MinLength(6)
  password!: string;

  @ApiProperty({ example: '3a1f8c2b-...', description: 'Optional explicit tenant ID for multi-tenant isolation', required: false })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiProperty({ example: 'velo', description: 'Optional tenant subdomain for login resolution', required: false })
  @IsOptional()
  @IsString()
  subdomain?: string;
}
