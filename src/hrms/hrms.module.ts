import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { DepartmentsModule } from './departments/departments.module';
import { DesignationsModule } from './designations/designations.module';
import { EmployeesModule } from './employees/employees.module';
import { AttendanceModule } from './attendance/attendance.module';
import { LeaveModule } from './leave/leave.module';

@Module({
  imports: [
    AuthorizationModule,
    AuditLogModule,
    DepartmentsModule,
    DesignationsModule,
    EmployeesModule,
    AttendanceModule,
    LeaveModule,
  ],
})
export class HrmsModule {}
