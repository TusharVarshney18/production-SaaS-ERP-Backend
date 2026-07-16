import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { AuthorizationService } from '../../authorization/authorization.service';
import { ExecutionContext } from '../execution/execution-context';

@Injectable()
export class AIPermissionService {
  private readonly logger = new Logger(AIPermissionService.name);

  constructor(private readonly authorizationService: AuthorizationService) {}

  async checkToolPermission(
    userId: string,
    organizationId: string,
    requiredPermissions: string[],
  ): Promise<boolean> {
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    try {
      return await this.authorizationService.authorize(userId, organizationId, requiredPermissions);
    } catch (error) {
      this.logger.error(
        `Permission check failed for user ${userId} in org ${organizationId}: ${error.message}`,
      );
      return false;
    }
  }

  async enforceToolPermission(
    userId: string,
    organizationId: string,
    requiredPermissions: string[],
  ): Promise<void> {
    const hasPermission = await this.checkToolPermission(
      userId,
      organizationId,
      requiredPermissions,
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        `Insufficient permissions to execute tool. Required: ${requiredPermissions.join(', ')}`,
      );
    }
  }

  validateOrganizationAccess(context: ExecutionContext, toolOrganizationId?: string): boolean {
    if (toolOrganizationId && context.organizationId !== toolOrganizationId) {
      this.logger.warn(
        `Organization isolation violation: context org ${context.organizationId} != tool org ${toolOrganizationId}`,
      );
      return false;
    }
    return true;
  }

  enforceOrganizationAccess(context: ExecutionContext, toolOrganizationId?: string): void {
    if (!this.validateOrganizationAccess(context, toolOrganizationId)) {
      throw new ForbiddenException('Organization access violation');
    }
  }
}
