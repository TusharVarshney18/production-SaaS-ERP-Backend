import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ToolRegistryService } from '../../registry/tool-registry.service';
import { AISandboxService } from '../../sandbox/ai-sandbox.service';
import { AIPermissionService } from '../../authorization/ai-permission.service';
import { ExecutionContext } from '../../execution/execution-context';
import { ExecutionPipelineResult, SandboxOptions } from '../../interfaces/runtime.interface';

@Injectable()
export class ExecutionPipelineService {
  private readonly logger = new Logger(ExecutionPipelineService.name);

  constructor(
    private readonly toolRegistry: ToolRegistryService,
    private readonly sandbox: AISandboxService,
    private readonly permissionService: AIPermissionService,
  ) {}

  async execute(
    toolName: string,
    input: unknown,
    context: ExecutionContext,
    options?: Partial<SandboxOptions>,
  ): Promise<ExecutionPipelineResult> {
    const startTime = Date.now();
    const requestId = context.requestId;

    this.logger.debug(`Pipeline: executing tool "${toolName}" for org ${context.organizationId}`);

    try {
      const tool = this.toolRegistry.get(toolName);
      if (!tool) {
        throw new NotFoundException(`Tool "${toolName}" not found in registry`);
      }

      await this.sandbox.enforceRequest(input, tool, context, options);

      this.permissionService.enforceToolPermission(
        context.userId,
        context.organizationId,
        tool.permissions,
      );

      this.permissionService.enforceOrganizationAccess(context);

      const result = await this.sandbox.executeWithTimeout(
        tool.execute(input, context),
        options?.executionTimeout,
      );

      const duration = Date.now() - startTime;

      await this.sandbox.auditExecution({
        organizationId: context.organizationId,
        userId: context.userId,
        toolName,
        success: result.success,
        duration,
        input,
        output: result.data,
        requestId,
      });

      return {
        success: result.success,
        result: result.data,
        duration,
        toolName,
        requestId,
        error: result.error,
        auditLogged: true,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      await this.sandbox.auditExecution({
        organizationId: context.organizationId,
        userId: context.userId,
        toolName,
        success: false,
        duration,
        input,
        error: error.message,
        requestId,
      });

      return {
        success: false,
        result: null,
        duration,
        toolName,
        requestId,
        error: error.message,
        auditLogged: true,
      };
    }
  }

  async executeBatch(
    executions: Array<{ toolName: string; input: unknown }>,
    context: ExecutionContext,
    options?: Partial<SandboxOptions>,
  ): Promise<ExecutionPipelineResult[]> {
    return Promise.all(
      executions.map((exec) => this.execute(exec.toolName, exec.input, context, options)),
    );
  }
}
