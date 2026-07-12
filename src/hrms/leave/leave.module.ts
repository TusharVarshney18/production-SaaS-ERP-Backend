import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../../authorization/authorization.module';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { LeaveController } from './leave.controller';
import { LeaveService } from './leave.service';

@Module({
  imports: [AuthorizationModule, AuditLogModule],
  controllers: [LeaveController],
  providers: [LeaveService],
  exports: [LeaveService],
})
export class LeaveModule {}
