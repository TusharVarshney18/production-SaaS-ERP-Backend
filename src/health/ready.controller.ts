import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Health')
@Controller({ path: 'ready', version: VERSION_NEUTRAL })
export class ReadyController {
  @Get()
  @ApiOperation({ summary: 'Readiness probe — lightweight check if app can accept traffic' })
  check(): { status: string; timestamp: string } {
    return {
      status: 'ready',
      timestamp: new Date().toISOString(),
    };
  }
}
