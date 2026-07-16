import { ApiProperty } from '@nestjs/swagger';

export class ProviderHealthDto {
  @ApiProperty()
  provider: string;

  @ApiProperty()
  available: boolean;

  @ApiProperty()
  latency: number;

  @ApiProperty()
  configured: boolean;

  @ApiProperty()
  model: string;
}

export class HealthResponseDto {
  @ApiProperty()
  status: string;

  @ApiProperty()
  timestamp: string;

  @ApiProperty({ type: [ProviderHealthDto] })
  providers: ProviderHealthDto[];
}
