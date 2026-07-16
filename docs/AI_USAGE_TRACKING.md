# AI Usage Tracking

## Overview

Every AI interaction is tracked for monitoring, billing, optimization, and security analysis. Usage data feeds the cost tracking system and provides insights for capacity planning.

## Tracking Data Model

```typescript
// ai_usage_logs table (append-only)
interface AIUsageLog {
  id: string;
  organizationId: string;
  userId: string;
  requestId: string;
  correlationId: string;

  // Provider
  provider: string;           // openai, claude, gemini, ollama
  model: string;              // gpt-4o, claude-sonnet-4, etc.

  // Agent
  agentName: string;          // ceo, finance, sales, etc.
  conversationId: string;

  // Tokens
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;

  // Timing
  requestDuration: number;    // ms
  ttft: number;               // Time to first token (for streaming)
  providerLatency: number;    // Time spent waiting for provider

  // Tool Usage
  toolCallsCount: number;
  toolCallsDuration: number;

  // Cost
  estimatedCost: number;      // In cents (USD)

  // Result
  success: boolean;
  finishReason: string;
  errorMessage?: string;

  createdAt: Date;
}
```

## Tracking Flow

```
Request arrives
    │
    ▼
UsageTracker.start(requestId)
    │
    ├──→ Records start time
    ├──→ Creates usage log entry with status: 'started'
    │
    ▼
Provider called
    │
    ├──→ Track TTFT (time to first token)
    ├──→ Track provider latency
    │
    ▼
Tool executed (if any)
    │
    ├──→ Track tool call count
    ├──→ Track tool call duration
    │
    ▼
Response complete
    │
    ▼
UsageTracker.complete(requestId, metrics)
    │
    ├──→ Calculates token counts
    ├──→ Calculates cost (using provider rate card)
    ├──→ Updates usage log entry
    └──→ Publishes usage event for real-time dashboards
```

## Aggregation Tables (for Reporting)

```typescript
// Usage aggregated hourly
interface UsageHourly {
  id: string;
  organizationId: string;
  provider: string;
  model: string;
  agentName: string;
  hour: Date;
  requestCount: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalCost: number;          // In cents (USD)
  avgLatency: number;
  errorCount: number;
  toolCallCount: number;
}

// Usage aggregated daily
interface UsageDaily {
  id: string;
  organizationId: string;
  provider: string;
  model: string;
  agentName: string;
  date: Date;
  requestCount: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalCost: number;
  avgLatency: number;
  errorCount: number;
  toolCallCount: number;
  uniqueUsers: number;
}
```

## Real-Time Usage Dashboard

The usage data powers a real-time dashboard (via existing Reports module):

```typescript
// Available to organization admins
class UsageDashboard {
  // Current period
  totalRequestsToday: number;
  totalTokensToday: number;
  estimatedCostToday: number;
  avgLatencyToday: number;
  errorRateToday: number;

  // Breakdowns
  byProvider: { provider: string; requests: number; cost: number }[];
  byAgent: { agent: string; requests: number; cost: number }[];
  byUser: { userId: string; requests: number; cost: number }[];
  byModel: { model: string; requests: number; cost: number }[];

  // Trends
  dailyTrend: { date: string; requests: number; cost: number }[];
}
```

## Usage Data Retention

| Aggregation Level | Retention | Purpose |
|---|---|---|
| Raw logs | 90 days | Detailed debugging |
| Hourly aggregation | 1 year | Trend analysis |
| Daily aggregation | 3 years | Billing and audit |
| Monthly aggregation | 7 years | Compliance |

## Usage Alerts

```typescript
interface UsageAlert {
  type: 'threshold_exceeded' | 'cost_spike' | 'error_rate_high' | 'rate_limited';
  severity: 'info' | 'warning' | 'critical';
  organizationId: string;
  metric: string;
  currentValue: number;
  thresholdValue: number;
  message: string;
}

// Alert rules (configurable per org)
const DEFAULT_ALERT_RULES = [
  { metric: 'daily_cost', threshold: 10000, unit: 'cents' },     // $100/day
  { metric: 'error_rate', threshold: 0.05, unit: 'percent' },    // 5% error rate
  { metric: 'monthly_cost', threshold: 100000, unit: 'cents' }, // $1,000/month
];
```

## Frontend APIs

```typescript
// GET /ai/organizations/:orgId/usage/summary
interface UsageSummaryResponse {
  today: UsagePeriodSummary;
  thisWeek: UsagePeriodSummary;
  thisMonth: UsagePeriodSummary;
}

// GET /ai/organizations/:orgId/usage/breakdown
interface UsageBreakdownResponse {
  byProvider: UsageBreakdownItem[];
  byAgent: UsageBreakdownItem[];
  byUser: UsageBreakdownItem[];
  byModel: UsageBreakdownItem[];
}

// GET /ai/organizations/:orgId/usage/trends?period=30d
interface UsageTrendResponse {
  daily: { date: string; requests: number; cost: number }[];
}
```
