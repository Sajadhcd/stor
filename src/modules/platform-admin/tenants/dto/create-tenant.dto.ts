import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateTenantDto {
  @ApiProperty({ example: 'Velo Activewear', description: 'Tenant company or organization name' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'velo', description: 'Unique subdomain for the tenant' })
  @IsString()
  @IsNotEmpty()
  subdomain!: string;
}
