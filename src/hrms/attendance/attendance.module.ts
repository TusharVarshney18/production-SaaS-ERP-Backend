import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../../authorization/authorization.module';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';

@Module({
  imports: [AuthorizationModule, AuditLogModule],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
