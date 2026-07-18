import { Injectable, Logger } from '@nestjs/common';
import { IJobProcessor, JobProcessorDefinition } from '../interfaces/job-processor.interface';
import { JobDefinition, JobResult } from '../dto/job.dto';
import { ExecutionContext } from '../../execution/execution-context';
import { MCPToolExecutorService } from '../../mcp/tools/mcp-tool-executor.service';

@Injectable()
export class McpToolProcessor implements IJobProcessor {
  private readonly logger = new Logger(McpToolProcessor.name);
  readonly definition: JobProcessorDefinition = {
    jobType: 'mcp.tool-execution',
    description: 'Executes MCP tool calls asynchronously',
    concurrency: 5,
    timeout: 60000,
  };

  constructor(private readonly mcpToolExecutor: MCPToolExecutorService) {}

  async process(job: JobDefinition, _context: ExecutionContext): Promise<JobResult> {
    const startTime = Date.now();
    const serverId = (job.payload.serverId || job.payload.serverName || '') as string;
    const toolName = job.payload.toolName as string;
    const args = job.payload.arguments || job.payload.args;

    const result = await this.mcpToolExecutor.execute(serverId, toolName, args);

    return {
      success: result.success,
      data: result.content,
      error: result.isError ? 'Tool execution returned error' : undefined,
      duration: Date.now() - startTime,
    };
  }
}
