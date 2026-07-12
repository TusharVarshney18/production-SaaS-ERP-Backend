import { ApiProperty } from '@nestjs/swagger';

export class ChartDataPoint {
  @ApiProperty()
  label!: string;

  @ApiProperty()
  value!: number;
}

export class ChartDataset {
  @ApiProperty()
  label!: string;

  @ApiProperty({ type: [Number] })
  data!: number[];

  @ApiProperty()
  backgroundColor?: string;

  @ApiProperty()
  borderColor?: string;
}

export class ChartDataDto {
  @ApiProperty({ type: [String] })
  labels!: string[];

  @ApiProperty({ type: [ChartDataset] })
  datasets!: ChartDataset[];
}

export class KpiCardDto {
  @ApiProperty()
  label!: string;

  @ApiProperty()
  value!: number;

  @ApiProperty()
  change!: number;

  @ApiProperty()
  trend!: 'up' | 'down' | 'neutral';
}

export class PaginatedReportDto {
  @ApiProperty({ type: [Object] })
  data!: Record<string, unknown>[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  totalPages!: number;
}
