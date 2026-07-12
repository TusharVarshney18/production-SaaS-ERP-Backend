import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../../authorization/authorization.module';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { DesignationsController } from './designations.controller';
import { DesignationsService } from './designations.service';

@Module({
  imports: [AuthorizationModule, AuditLogModule],
  controllers: [DesignationsController],
  providers: [DesignationsService],
  exports: [DesignationsService],
})
export class DesignationsModule {}
