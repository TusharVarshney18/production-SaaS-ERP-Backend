import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { OrganizationSettingsModule } from './organization-settings/organization-settings.module';
import { RbacModule } from './rbac/rbac.module';
import { AuthorizationModule } from './authorization/authorization.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { BillingModule } from './billing/billing.module';
import { BillingPortalModule } from './billing-portal/billing-portal.module';
import { SuperAdminModule } from './super-admin/super-admin.module';
import { CrmModule } from './crm/crm.module';
import { ContactsModule } from './contacts/contacts.module';
import { DealsModule } from './deals/deals.module';
import { ActivitiesModule } from './activities/activities.module';
import { ProductsModule } from './products/products.module';
import { SalesModule } from './sales/sales.module';
import { SalesOrdersModule } from './sales/orders/sales-orders.module';
import { InvoicesModule } from './invoices/invoices.module';
import { PaymentsModule } from './payments/payments.module';
import { InventoryModule } from './inventory/inventory.module';
import { ProcurementModule } from './procurement/procurement.module';
import { AccountingModule } from './accounting/accounting.module';
import { HrmsModule } from './hrms/hrms.module';
import { ReportsModule } from './reports/reports.module';
import { WorkflowsModule } from './workflows/workflows.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { validationSchema } from './config/config.schema';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import redisConfig from './config/redis.config';
import jwtConfig from './config/jwt.config';
import razorpayConfig from './config/razorpay.config';
import stripeConfig from './config/stripe.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, redisConfig, jwtConfig, razorpayConfig, stripeConfig],
      validationSchema,
      validationOptions: {
        abortEarly: true,
      },
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    PrismaModule,
    HealthModule,
    AuthModule,
    OrganizationsModule,
    OrganizationSettingsModule,
    RbacModule,
    AuthorizationModule,
    AuditLogModule,
    SubscriptionsModule,
    BillingModule,
    BillingPortalModule,
    SuperAdminModule,
    CrmModule,
    ContactsModule,
    DealsModule,
    ActivitiesModule,
    ProductsModule,
    SalesModule,
    SalesOrdersModule,
    InvoicesModule,
    PaymentsModule,
    InventoryModule,
    ProcurementModule,
    AccountingModule,
    HrmsModule,
    ReportsModule,
    WorkflowsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
