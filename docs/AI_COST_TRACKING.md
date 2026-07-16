# AI Cost Tracking

## Overview

Cost tracking provides visibility into AI spending per organization, user, agent, provider, and model. It enables budget management, cost optimization, and future SaaS billing integration.

## Cost Calculation

Costs are calculated using the provider's rate card at the time of each request:

```typescript
interface ProviderRateCard {
  provider: string;
  model: string;
  inputCostPer1kTokens: number;    // In cents (USD)
  outputCostPer1kTokens: number;   // In cents (USD)
  effectiveDate: Date;
}

// Example: OpenAI GPT-4o
{
  provider: 'openai',
  model: 'gpt-4o',
  inputCostPer1kTokens: 0.25,     // $0.0025 per 1K input tokens → 0.25 cents
  outputCostPer1kTokens: 1.0,     // $0.01 per 1K output tokens → 1.0 cents
}

// Cost per request:
// cost = (promptTokens / 1000) * inputCostPer1kTokens
//      + (completionTokens / 1000) * outputCostPer1kTokens
// Example: 500 prompt tokens + 200 completion tokens on GPT-4o
// = (500/1000) * 0.25 + (200/1000) * 1.0
// = 0.125 + 0.2 = 0.325 cents
```

## Rate Card Management

```yaml
# config/ai.costs.yaml
rateCards:
  openai:
    gpt-4o:
      inputCostPer1kTokens: 0.25
      outputCostPer1kTokens: 1.0
      effectiveDate: "2026-01-01"

    gpt-4o-mini:
      inputCostPer1kTokens: 0.015
      outputCostPer1kTokens: 0.06
      effectiveDate: "2026-01-01"

  claude:
    claude-sonnet-4:
      inputCostPer1kTokens: 0.3
      outputCostPer1kTokens: 1.5
      effectiveDate: "2026-01-01"

  gemini:
    gemini-pro:
      inputCostPer1kTokens: 0.05
      outputCostPer1kTokens: 0.15
      effectiveDate: "2026-01-01"
```

## Cost Aggregation Tables

```typescript
// Monthly cost per organization
interface CostMonthly {
  id: string;
  organizationId: string;
  year: number;
  month: number;
  totalCost: number;            // In cents (USD)
  byProvider: JSON;             // { openai: 5000, claude: 2000 }
  byModel: JSON;                // { 'gpt-4o': 4000, 'claude-sonnet-4': 2000 }
  byAgent: JSON;                // { ceo: 3000, finance: 2000 }
  totalTokens: number;
  totalRequests: number;
  uniqueUsers: number;
  createdAt: Date;
}

// Budget configuration per organization
interface AIConfig {
  id: string;
  organizationId: string;
  enabled: boolean;
  monthlyBudgetCents: number;
  monthlyBudgetAlertThreshold: number;  // 0.8 = 80%
  allowedProviders: string[];           // ['openai', 'ollama']
  allowedModels: string[];              // ['gpt-4o-mini', 'gpt-4o']
  defaultAgent: string;
  createdAt: Date;
  updatedAt: Date;
}
```

## Budget Management

```typescript
@Injectable()
export class BudgetService {
  async checkBudget(orgId: string): Promise<BudgetStatus> {
    const config = await this.getConfig(orgId);
    const usage = await this.getCurrentMonthUsage(orgId);

    return {
      budgetCents: config.monthlyBudgetCents,
      spentCents: usage.totalCost,
      remainingCents: config.monthlyBudgetCents - usage.totalCost,
      percentUsed: (usage.totalCost / config.monthlyBudgetCents) * 100,
      alertsTriggered: usage.totalCost >= config.monthlyBudgetCents * config.monthlyBudgetAlertThreshold,
    };
  }

  async enforceBudget(orgId: string): Promise<void> {
    const status = await this.checkBudget(orgId);
    if (status.spentCents >= status.budgetCents) {
      throw new BudgetExceededError(
        `Monthly AI budget of $${(status.budgetCents / 100).toFixed(2)} exceeded. ` +
        `Spent: $${(status.spentCents / 100).toFixed(2)}. ` +
        `Contact your administrator to increase the budget.`,
      );
    }
  }
}
```

## Cost Optimization Strategies

| Strategy | Impact | Implementation |
|---|---|---|
| Model tiering | 60-90% cost reduction | Use mini/flash models for simple queries |
| Prompt optimization | 30-50% token reduction | Shorter prompts, fewer examples |
| Caching | 20-40% cost reduction | Cache identical requests |
| Local models | 100% cost elimination | Use Ollama for development |
| Request batching | 10-20% reduction | Batch non-urgent requests |
| Token limits | Predictable costs | Cap max tokens per request |

### Model Tiering Logic

```typescript
function selectModel(queryType: QueryType): string {
  switch (queryType) {
    case 'simple_qa':
      return 'gpt-4o-mini';           // $0.015/1K input
    case 'analysis':
      return 'gpt-4o';                 // $0.25/1K input
    case 'code_generation':
      return 'claude-sonnet-4';        // $0.30/1K input
    case 'data_extraction':
      return 'gemini-flash';           // $0.0075/1K input
    default:
      return 'gpt-4o-mini';
  }
}
```

## Cost Reporting (via Reports Module)

```typescript
// GET /ai/organizations/:orgId/costs/summary
interface CostSummaryResponse {
  thisMonth: number;
  lastMonth: number;
  averageDaily: number;
  projectedMonth: number;
  budgetCents: number;
  percentUsed: number;
}

// GET /ai/organizations/:orgId/costs/breakdown
interface CostBreakdownResponse {
  byProvider: CostItem[];
  byModel: CostItem[];
  byAgent: CostItem[];
  byUser: CostItem[];
}

// GET /ai/organizations/:orgId/costs/trend?months=6
interface CostTrendResponse {
  monthly: { month: string; cost: number }[];
}
```

## Future SaaS Billing Integration

The `ai_usage_logs` and `cost_monthly` tables are designed to integrate with the existing Billing module:

```typescript
// Future: AI usage as a billable metric
// 1. AIConfig.subscriptionTier determines included tokens
// 2. Usage beyond included tokens = overage billing
// 3. Monthly cost aggregation feeds into Invoice generation

// The billing integration would:
// - Hook into CostMonthly aggregation
// - Generate Invoice line items for AI usage
// - Track against subscription plan limits
// - Support tiered pricing (per org size)
```
