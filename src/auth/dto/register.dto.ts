import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'john@acme.com', description: 'User email address' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'P@ssw0rd!',
    description: 'User password (min 8 chars)',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiProperty({ example: 'John', description: 'First name' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName!: string;

  @ApiProperty({ example: 'Doe', description: 'Last name' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName!: string;

  @ApiProperty({ example: 'Acme Inc.', description: 'Organization name' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  organizationName!: string;

  @ApiProperty({
    example: 'acme',
    description: 'Unique organization code (lowercase, alphanumeric + hyphens)',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'organizationCode must be lowercase alphanumeric with hyphens only',
  })
  organizationCode!: string;
}
