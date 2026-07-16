# AI Agent Architecture

## Agent Interface

```typescript
// src/ai/agents/agent.interface.ts

interface IAgent {
  readonly name: string;
  readonly description: string;
  readonly tools: string[];           // Allowed tool names
  readonly modules: string[];         // Allowed module names
  readonly providerPreference: string; // Preferred provider
  readonly memoryStrategy: MemoryStrategy;
  readonly maxConversationLength: number;
  readonly systemPrompt: string;      // Prompt key from registry

  canHandle(request: ChatRequest): boolean;
  beforeExecute(context: AgentContext): Promise<void>;
  afterExecute(context: AgentContext, response: ChatResponse): Promise<void>;
}

interface AgentContext {
  organizationId: string;
  userId: string;
  conversationId: string;
  messages: ChatMessage[];
  agent: IAgent;
  memory: IMemoryStore;
  tools: ITool[];
  permission: AIPermissionContext;
}
```

## Agent Registry

The `AgentRegistryService` is a central registry where agents self-register during `OnModuleInit`. The `AgentOrchestrator` uses the registry to:

1. Route incoming requests to the correct agent
2. Discover which agents are available per org
3. Perform multi-agent handoffs

## Specialized ERP Agents

### 1. CEO Agent

| Property | Value |
|---|---|
| Name | `ceo` |
| Description | Executive dashboard, strategic insights, cross-department analysis |
| System Prompt | `ceo-system-prompt-v1` |
| Allowed Tools | `reporting`, `crm`, `sales`, `inventory`, `procurement`, `accounting`, `hrms`, `workflow` |
| Allowed Modules | ALL modules (read-only) |
| Provider Preference | `openai/gpt-4o` (best reasoning) |
| Memory Strategy | Long-term (org-level patterns) |
| Permissions | `ai:agent:ceo` |

**Responsibilities**:
- Generate executive summaries across all departments
- Identify business trends and anomalies
- Answer cross-functional business questions
- Suggest strategic actions
- Review KPIs and dashboards

### 2. Finance Agent

| Property | Value |
|---|---|
| Name | `finance` |
| Description | Financial analysis, accounting, payments, budgeting |
| System Prompt | `finance-agent-system-prompt-v1` |
| Allowed Tools | `accounting`, `payment`, `reporting`, `workflow` |
| Allowed Modules | Accounting, Payments, Sales (invoices only) |
| Provider Preference | `claude/claude-sonnet-4` (strong with numbers) |
| Memory Strategy | Long-term (fiscal patterns) |
| Permissions | `ai:agent:finance` |

**Responsibilities**:
- Generate financial reports (P&L, Balance Sheet, Trial Balance)
- Analyze revenue trends and anomalies
- Monitor outstanding invoices and payment collections
- Flag unusual transactions
- Provide cash flow insights

### 3. Sales Agent

| Property | Value |
|---|---|
| Name | `sales` |
| Description | Sales pipeline, customer insights, forecasting |
| System Prompt | `sales-agent-system-prompt-v1` |
| Allowed Tools | `crm`, `sales`, `reporting`, `workflow` |
| Allowed Modules | CRM, Sales, Reporting |
| Provider Preference | `openai/gpt-4o-mini` (fast, cost-effective) |
| Memory Strategy | Session + long-term (customer patterns) |
| Permissions | `ai:agent:sales` |

**Responsibilities**:
- Analyze sales pipeline and conversion rates
- Identify top-performing products
- Forecast revenue by period
- Suggest upsell/cross-sell opportunities
- Generate customer insights from CRM data

### 4. Inventory Agent

| Property | Value |
|---|---|
| Name | `inventory` |
| Description | Stock management, reorder suggestions, warehouse optimization |
| System Prompt | `inventory-agent-system-prompt-v1` |
| Allowed Tools | `inventory`, `procurement`, `reporting` |
| Allowed Modules | Inventory, Procurement (read-only) |
| Provider Preference | `gemini/gemini-flash` (fast, cheap) |
| Memory Strategy | Session + long-term (stock patterns) |
| Permissions | `ai:agent:inventory` |

**Responsibilities**:
- Monitor stock levels and flag low stock items
- Suggest reorder quantities and timing
- Analyze inventory turnover rates
- Identify slow-moving or dead stock
- Recommend warehouse optimization

### 5. Procurement Agent

| Property | Value |
|---|---|
| Name | `procurement` |
| Description | Vendor management, purchase orders, supply chain |
| System Prompt | `procurement-agent-system-prompt-v1` |
| Allowed Tools | `procurement`, `inventory`, `reporting`, `workflow` |
| Allowed Modules | Procurement, Inventory (read-only) |
| Provider Preference | `openai/gpt-4o-mini` |
| Memory Strategy | Session + long-term (vendor patterns) |
| Permissions | `ai:agent:procurement` |

**Responsibilities**:
- Analyze vendor performance and spend
- Suggest purchase order optimizations
- Track goods receipt status
- Identify supply chain risks
- Generate procurement insights

### 6. HR Agent

| Property | Value |
|---|---|
| Name | `hr` |
| Description | Employee management, attendance, leave, hiring insights |
| System Prompt | `hr-agent-system-prompt-v1` |
| Allowed Tools | `hrms`, `reporting`, `workflow` |
| Allowed Modules | HRMS |
| Provider Preference | `openai/gpt-4o-mini` |
| Memory Strategy | Session (employee data is sensitive) |
| Permissions | `ai:agent:hr` |

**Responsibilities**:
- Analyze attendance and leave patterns
- Generate employee reports
- Identify staffing gaps
- Answer HR policy questions
- Flag compliance issues

### 7. Reporting Agent

| Property | Value |
|---|---|
| Name | `reporting` |
| Description | Custom report generation, data visualization suggestions |
| System Prompt | `reporting-agent-system-prompt-v1` |
| Allowed Tools | `reporting`, `crm`, `sales`, `inventory`, `procurement`, `accounting`, `hrms` |
| Allowed Modules | ALL (read-only reports) |
| Provider Preference | `openai/gpt-4o` |
| Memory Strategy | Session |
| Permissions | `ai:agent:reporting` |

**Responsibilities**:
- Generate ad-hoc reports across modules
- Suggest chart types for data
- Export data in requested formats
- Schedule recurring reports via Workflow
- Answer natural language questions about data

### 8. Developer Agent

| Property | Value |
|---|---|
| Name | `developer` |
| Description | API documentation, code generation, system configuration |
| System Prompt | `developer-agent-system-prompt-v1` |
| Allowed Tools | `workflow`, `reporting` (system data only) |
| Allowed Modules | System configuration (admin only) |
| Provider Preference | `claude/claude-opus-4` (best at code) |
| Memory Strategy | Session |
| Permissions | `ai:agent:developer` (super-admin only) |

**Responsibilities**:
- Help developers understand API structure
- Generate code snippets for integrations
- Explain system architecture
- Assist with workflow configuration
- Troubleshoot system issues (super-admin)

## Agent Orchestration

### Single-Agent Flow

```
User Request
    │
    ▼
AgentOrchestrator.identifyAgent(request)
    │
    ├──→ Match by keywords in message
    ├──→ Match by explicit agent selection
    └──→ Default to CEO Agent
    │
    ▼
Load Agent Configuration
    │
    ├──→ System prompt from registry
    ├──→ Tool list (permission-filtered)
    └──→ Memory context
    │
    ▼
Execute via Provider Router → LLM → Response
```

### Multi-Agent Handoff

```
User: "What were our sales last month and should we reorder inventory?"

    │
    ▼
CEO Agent receives request
    │
    ├──→ Identifies need: sales data + inventory analysis
    ├──→ Calls Sales Agent (sub-task: get sales summary)
    ├──→ Calls Inventory Agent (sub-task: get stock status)
    │
    ▼
CEO Agent synthesizes both responses
    │
    └──→ Final response to user
```

### Agent Handshake Protocol

```typescript
interface AgentHandoff {
  fromAgent: string;
  toAgent: string;
  context: {
    organizationId: string;
    threadId: string;
    relevantHistory: ChatMessage[];
    extractedData: Record<string, unknown>;
    query: string;
  };
}
```

## Agent Permissions Model

Each agent has a permission scope. The `AIPermissionService` checks:

```typescript
interface AIPermissionContext {
  userId: string;
  organizationId: string;
  roles: string[];
  agentAccess: string[];   // Which agents user can invoke
  toolAccess: string[];    // Which tools user's agents can use
  moduleAccess: string[];  // Which modules user can access via AI
  dataScope: 'org' | 'department' | 'self';
}
```

For example, a Sales Manager using the Sales Agent:
- Can access: `sales` module, `crm` module (customer data)
- Cannot access: `accounting` module (financial data)
- Data scope: org-wide for sales, self for HR

## Agent Configuration (YAML)

```yaml
# config/ai.agents.yaml
agents:
  ceo:
    enabled: true
    provider: openai/gpt-4o
    maxTokens: 4096
    temperature: 0.3
    tools: [reporting, crm, sales, inventory, procurement, accounting, hrms, workflow]
    memory: long-term
    permissions: [ai:agent:ceo]

  finance:
    enabled: true
    provider: claude/claude-sonnet-4
    maxTokens: 4096
    temperature: 0.1
    tools: [accounting, payment, reporting, workflow]
    memory: long-term
    permissions: [ai:agent:finance]

  sales:
    enabled: true
    provider: openai/gpt-4o-mini
    maxTokens: 2048
    temperature: 0.4
    tools: [crm, sales, reporting, workflow]
    memory: session
    permissions: [ai:agent:sales]
```
