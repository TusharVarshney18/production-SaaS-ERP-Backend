import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../../authorization/authorization.module';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';

@Module({
  imports: [AuthorizationModule, AuditLogModule],
  controllers: [EmployeesController],
  providers: [EmployeesService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
