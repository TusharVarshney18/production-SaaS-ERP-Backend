import {
  Injectable,
  Logger,
  ForbiddenException,
  BadRequestException,
  GatewayTimeoutException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AITool } from '../tools/interfaces/ai-tool.interface';
import { AIPermissionService } from '../authorization/ai-permission.service';
import { AuditLogService, CreateAuditLogParams } from '../../audit-log/audit-log.service';
import { ExecutionContext } from '../execution/execution-context';
import { SandboxOptions } from '../interfaces/runtime.interface';

export interface SandboxValidationResult {
  valid: boolean;
  error?: string;
  details?: Record<string, unknown>;
}

@Injectable()
export class AISandboxService {
  private readonly logger = new Logger(AISandboxService.name);
  private readonly defaultOptions: SandboxOptions;

  constructor(
    private readonly configService: ConfigService,
    private readonly permissionService: AIPermissionService,
    private readonly auditLogService: AuditLogService,
  ) {
    this.defaultOptions = {
      executionTimeout: this.configService.get<number>('ai.sandboxTimeout', 30000),
      maxInputSize: this.configService.get<number>('ai.maxInputSize', 1048576),
      enableAudit: this.configService.get<boolean>('ai.enableAudit', true),
      enableRateLimiting: this.configService.get<boolean>('ai.enableRateLimiting', false),
      sensitiveFields: this.configService.get<string[]>('ai.sensitiveFields', [
        'password',
        'secret',
        'token',
        'apiKey',
        'authorization',
        'ssn',
        'creditCard',
      ]),
    };
  }

  async validateRequest(
    input: unknown,
    tool: AITool,
    context: ExecutionContext,
    options?: Partial<SandboxOptions>,
  ): Promise<SandboxValidationResult> {
    const opts = { ...this.defaultOptions, ...options };

    const orgCheck = this.permissionService.validateOrganizationAccess(context);
    if (!orgCheck) {
      return { valid: false, error: 'Organization access violation' };
    }

    if (tool.permissions && tool.permissions.length > 0) {
      const hasPermission = await this.permissionService.checkToolPermission(
        context.userId,
        context.organizationId,
        tool.permissions,
      );
      if (!hasPermission) {
        return {
          valid: false,
          error: `Insufficient permissions. Required: ${tool.permissions.join(', ')}`,
        };
      }
    }

    if (input !== undefined && input !== null) {
      const inputSize = this.estimateInputSize(input);
      if (inputSize > opts.maxInputSize) {
        return {
          valid: false,
          error: `Input size ${inputSize} bytes exceeds maximum ${opts.maxInputSize} bytes`,
        };
      }
    }

    if (tool.validate) {
      try {
        const valid = await tool.validate(input);
        if (!valid) {
          return { valid: false, error: 'Tool input validation failed' };
        }
      } catch (error) {
        return { valid: false, error: `Tool validation error: ${error.message}` };
      }
    }

    return { valid: true };
  }

  async enforceRequest(
    input: unknown,
    tool: AITool,
    context: ExecutionContext,
    options?: Partial<SandboxOptions>,
  ): Promise<void> {
    const result = await this.validateRequest(input, tool, context, options);
    if (!result.valid) {
      if (result.error?.includes('permission')) {
        throw new ForbiddenException(result.error);
      }
      throw new BadRequestException(result.error);
    }
  }

  maskSensitiveData(data: unknown, options?: Partial<SandboxOptions>): unknown {
    const opts = { ...this.defaultOptions, ...options };

    if (typeof data === 'string') {
      let masked = data;
      for (const field of opts.sensitiveFields) {
        const regex = new RegExp(`("${field}"\\s*:\\s*")([^"]+)(")`, 'gi');
        masked = masked.replace(regex, (_, prefix, __, suffix) => `${prefix}***${suffix}`);
        const urlRegex = new RegExp(`(${field}=)([^&\\s]+)`, 'gi');
        masked = masked.replace(urlRegex, `$1***`);
      }
      return masked;
    }

    if (typeof data === 'object' && data !== null) {
      const masked = { ...(data as Record<string, unknown>) } as Record<string, unknown>;
      for (const field of opts.sensitiveFields) {
        if (field in masked) {
          masked[field] = '***';
        }
      }
      return masked;
    }

    return data;
  }

  async executeWithTimeout<T>(promise: Promise<T>, timeoutMs?: number): Promise<T> {
    const timeout = timeoutMs ?? this.defaultOptions.executionTimeout;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new GatewayTimeoutException(`Execution timed out after ${timeout}ms`));
      }, timeout);

      promise
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  async auditExecution(params: {
    organizationId: string;
    userId: string;
    toolName: string;
    success: boolean;
    duration: number;
    input?: unknown;
    output?: unknown;
    error?: string;
    requestId: string;
  }): Promise<void> {
    if (!this.defaultOptions.enableAudit) return;

    const auditParams: CreateAuditLogParams = {
      organizationId: params.organizationId,
      actorId: params.userId,
      actorType: 'USER' as any,
      event: `ai.tool.${params.success ? 'executed' : 'failed'}`,
      resource: 'ai:tool',
      resourceId: params.toolName,
      action: params.success ? 'execute' : 'error',
      details: {
        toolName: params.toolName,
        duration: params.duration,
        success: params.success,
        error: params.error,
        input: params.input ? this.maskSensitiveData(params.input) : undefined,
      } as Record<string, unknown>,
      severity: params.success ? ('INFO' as any) : ('ERROR' as any),
      requestId: params.requestId,
    };

    try {
      await this.auditLogService.create(auditParams);
    } catch (error) {
      this.logger.error(`Failed to create audit log: ${error.message}`);
    }
  }

  private estimateInputSize(input: unknown): number {
    try {
      const str = typeof input === 'string' ? input : JSON.stringify(input);
      return Buffer.byteLength(str, 'utf-8');
    } catch {
      return 0;
    }
  }
}
