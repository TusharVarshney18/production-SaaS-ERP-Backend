import { Module, OnModuleInit } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { PrismaModule } from '../prisma/prisma.module';
import { WorkflowsController } from './workflows.controller';
import { WorkflowDefinitionsService } from './services/workflow-definitions.service';
import { WorkflowEngineService } from './engine/workflow-engine.service';
import { EventBusService } from './events/event-bus.service';
import { ActionRegistryService } from './actions/action-registry.service';
import { EmailActionService } from './actions/email-action.service';
import { WebhookActionService } from './actions/webhook-action.service';
import { NotificationActionService } from './actions/notification-action.service';
import { AuditActionService } from './actions/audit-action.service';
import { AiHookActionService } from './actions/ai-hook-action.service';

@Module({
  imports: [AuthorizationModule, AuditLogModule, PrismaModule],
  controllers: [WorkflowsController],
  providers: [
    WorkflowDefinitionsService,
    WorkflowEngineService,
    EventBusService,
    ActionRegistryService,
    EmailActionService,
    WebhookActionService,
    NotificationActionService,
    AuditActionService,
    AiHookActionService,
  ],
  exports: [EventBusService, WorkflowEngineService],
})
export class WorkflowsModule implements OnModuleInit {
  constructor(
    private readonly registry: ActionRegistryService,
    private readonly email: EmailActionService,
    private readonly webhook: WebhookActionService,
    private readonly notification: NotificationActionService,
    private readonly audit: AuditActionService,
    private readonly ai: AiHookActionService,
  ) {}

  onModuleInit() {
    this.registry.register(this.email);
    this.registry.register(this.webhook);
    this.registry.register(this.notification);
    this.registry.register(this.audit);
    this.registry.register(this.ai);
  }
}
