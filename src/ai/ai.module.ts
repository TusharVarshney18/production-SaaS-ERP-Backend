import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AIController } from './ai.controller';
import { AIGatewayService } from './core/ai-gateway.service';
import { ProviderRouterService } from './core/provider-router.service';
import { ProviderFactory } from './providers/provider.factory';
import { OpenAIProvider } from './providers/openai/openai.provider';
import { GeminiProvider } from './providers/gemini/gemini.provider';
import { ClaudeProvider } from './providers/claude/claude.provider';
import { OllamaProvider } from './providers/ollama/ollama.provider';
import { AzureOpenAIProvider } from './providers/azure-openai/azure-openai.provider';
import { BedrockProvider } from './providers/bedrock/bedrock.provider';
import { AIHealthService } from './health/ai-health.service';
import { PromptRegistryService } from './registry/prompt-registry.service';
import { CapabilityRegistryService } from './registry/capability-registry.service';
import { ToolRegistryService } from './registry/tool-registry.service';
import { MetadataService } from './registry/metadata/metadata.service';
import { AISandboxService } from './sandbox/ai-sandbox.service';
import { AIPermissionService } from './authorization/ai-permission.service';
import { ExecutionPipelineService } from './tools/execution/execution-pipeline.service';
import { AgentRegistryService } from './agents/registry/agent-registry.service';
import { AgentFactoryService } from './agents/factory/agent-factory.service';
import { AgentRouterService } from './agents/router/agent-router.service';
import { AgentPlannerService } from './agents/planner/agent-planner.service';
import { AgentExecutorService } from './agents/executor/agent-executor.service';
import { ContextBuilderService } from './agents/context/context-builder.service';
import { CeoAgent } from './agents/agents/ceo.agent';
import { FinanceAgent } from './agents/agents/finance.agent';
import { SalesAgent } from './agents/agents/sales.agent';
import { InventoryAgent } from './agents/agents/inventory.agent';
import { HrAgent } from './agents/agents/hr.agent';
import { ReportingAgent } from './agents/agents/reporting.agent';
import { DeveloperAgent } from './agents/agents/developer.agent';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import aiConfig from './config/ai.config';

@Module({
  imports: [ConfigModule.forFeature(aiConfig), AuthorizationModule, AuditLogModule],
  controllers: [AIController],
  providers: [
    ProviderFactory,
    ProviderRouterService,
    AIGatewayService,
    AIHealthService,
    OpenAIProvider,
    GeminiProvider,
    ClaudeProvider,
    OllamaProvider,
    AzureOpenAIProvider,
    BedrockProvider,
    PromptRegistryService,
    CapabilityRegistryService,
    ToolRegistryService,
    MetadataService,
    AISandboxService,
    AIPermissionService,
    ExecutionPipelineService,
    AgentRegistryService,
    AgentFactoryService,
    AgentRouterService,
    AgentPlannerService,
    AgentExecutorService,
    ContextBuilderService,
    CeoAgent,
    FinanceAgent,
    SalesAgent,
    InventoryAgent,
    HrAgent,
    ReportingAgent,
    DeveloperAgent,
  ],
  exports: [
    AIGatewayService,
    ProviderRouterService,
    ProviderFactory,
    AIHealthService,
    PromptRegistryService,
    CapabilityRegistryService,
    ToolRegistryService,
    MetadataService,
    AISandboxService,
    AIPermissionService,
    ExecutionPipelineService,
    AgentRegistryService,
    AgentFactoryService,
    AgentRouterService,
    AgentPlannerService,
    AgentExecutorService,
    ContextBuilderService,
  ],
})
export class AiModule implements OnModuleInit {
  constructor(
    private readonly factory: ProviderFactory,
    private readonly openai: OpenAIProvider,
    private readonly gemini: GeminiProvider,
    private readonly claude: ClaudeProvider,
    private readonly ollama: OllamaProvider,
    private readonly azureOpenAI: AzureOpenAIProvider,
    private readonly bedrock: BedrockProvider,
    private readonly agentRegistry: AgentRegistryService,
    private readonly ceoAgent: CeoAgent,
    private readonly financeAgent: FinanceAgent,
    private readonly salesAgent: SalesAgent,
    private readonly inventoryAgent: InventoryAgent,
    private readonly hrAgent: HrAgent,
    private readonly reportingAgent: ReportingAgent,
    private readonly developerAgent: DeveloperAgent,
  ) {}

  onModuleInit() {
    this.factory.registerProvider(this.openai);
    this.factory.registerProvider(this.gemini);
    this.factory.registerProvider(this.claude);
    this.factory.registerProvider(this.ollama);
    this.factory.registerProvider(this.azureOpenAI);
    this.factory.registerProvider(this.bedrock);

    this.agentRegistry.register(this.ceoAgent);
    this.agentRegistry.register(this.financeAgent);
    this.agentRegistry.register(this.salesAgent);
    this.agentRegistry.register(this.inventoryAgent);
    this.agentRegistry.register(this.hrAgent);
    this.agentRegistry.register(this.reportingAgent);
    this.agentRegistry.register(this.developerAgent);
  }
}
