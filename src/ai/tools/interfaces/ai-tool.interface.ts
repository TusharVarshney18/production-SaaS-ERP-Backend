import { ToolParameter, AIToolResult } from '../../interfaces/runtime.interface';
import { ExecutionContext } from '../../execution/execution-context';

export interface AITool<TInput = unknown, TOutput = unknown> {
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly category: string;
  readonly parameters: ToolParameter[];
  readonly permissions: string[];
  readonly timeout: number;
  readonly requiresConfirmation: boolean;
  readonly providerSupport: string[];
  readonly metadata: Record<string, unknown>;

  execute(input: TInput, context: ExecutionContext): Promise<AIToolResult<TOutput>>;
  validate?(input: unknown): Promise<boolean>;
}
