# AI Security Architecture

## Overview

Security is built into every layer of the AI Platform. The design follows a defense-in-depth approach with multiple independent security controls at each layer.

## Security Layers

```
User Request
    │
    ▼
┌──────────────────────────────────────────────────────┐
│  L1: Authentication & Authorization                  │
│  ├── JWT verification (existing Auth module)          │
│  ├── Organization membership check                   │
│  └── User active check                               │
└──────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────┐
│  L2: AI-Specific Authorization                       │
│  ├── Can user access AI at all? (ai:access)          │
│  ├── Can user use this agent? (ai:agent:xxx)         │
│  └── Can user's agent use this tool? (ai:tool:xxx)   │
└──────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────┐
│  L3: Input Validation & Injection Mitigation          │
│  ├── Prompt injection detection                      │
│  ├── Sensitive content filtering                     │
│  ├── Rate limiting                                   │
│  └── Max token limits                                │
└──────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────┐
│  L4: Tool Execution Security                         │
│  ├── Permission validation per tool call             │
│  ├── Organization isolation                          │
│  ├── Mutation confirmation for write operations      │
│  └── Data masking on results                         │
└──────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────┐
│  L5: Output Security                                 │
│  ├── Sensitive data masking (PII, financial)         │
│  ├── Hallucination detection (future)                │
│  └── Output content filtering                        │
└──────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────┐
│  L6: Audit & Compliance                              │
│  ├── Every AI interaction is logged                  │
│  ├── Tool executions are audited separately          │
│  ├── Token usage is tracked per org/user             │
│  └── Retention policies enforced                     │
└──────────────────────────────────────────────────────┘
```

## Prompt Injection Mitigation

### Detection Strategies

```typescript
enum InjectionRisk {
  NONE = 'none',
  LOW = 'low',       // Suspicious but not clearly malicious
  HIGH = 'high',     // Clearly an injection attempt
  CRITICAL = 'critical', // System prompt disclosure attempt
}
```

| Pattern | Detection | Action |
|---|---|---|
| "Ignore previous instructions" | Regex + LLM classifier | Reject, log audit |
| "You are now a different AI" | Regex + LLM classifier | Reject, log audit |
| "Tell me the system prompt" | Keyword detection | Reject, log audit |
| "What are your tools?" | ML classifier | Allow (valid question) |
| Base64/encoded instructions | Entropy analysis | Flag for review |
| Repeated injection attempts | Rate limiter | Block user for N minutes |

### System Prompt Isolation

- The system prompt is always injected server-side, never sent from the client
- Client only sends the user's message text
- Tool definitions are appended server-side based on permissions
- The LLM never sees the full system prompt construction logic

## Sensitive Data Masking

```typescript
interface DataMaskingConfig {
  maskPII: boolean;
  maskFinancial: boolean;
  maskEmployeeData: boolean;
  maskThreshold: number;  // Show aggregates if count < threshold
}
```

| Data Type | Masking Strategy |
|---|---|
| Email addresses | `j***@example.com` |
| Phone numbers | `+1-***-***-7890` |
| Tax IDs / SSN | `***-**-1234` |
| Bank account numbers | `****1234` |
| Individual salary | Show only if user has HR admin permission |
| Customer names | Always show |
| Aggregate financials | Always show (revenue, expenses) |
| Individual transaction details | Show only with permission |

## Rate Limiting

| Limit | Scope | Value | Action |
|---|---|---|---|
| AI requests per minute | User | 30 | HTTP 429 |
| AI requests per minute | Organization | 500 | HTTP 429 |
| Tool executions per request | User | 25 | Truncate |
| Max tokens per request | User | 16384 | Truncate |
| Concurrent conversations | User | 5 | Queue |
| Failed injection attempts | User | 3/min | Block 15 min |

## Audit Logging

Every AI interaction produces audit entries:

```typescript
// ai_audit_logs table (extends existing AuditLog pattern)
interface AIAuditEntry {
  id: string;
  organizationId: string;
  userId: string;
  requestId: string;
  correlationId: string;

  // Request
  agentName: string;
  provider: string;
  model: string;
  promptTokens: number;
  userMessage: string;        // Masked for storage

  // Execution
  toolsCalled: ToolCallAudit[];
  completionTokens: number;
  latency: number;
  cost: number;

  // Security
  injectionRisk: InjectionRisk;
  maskingApplied: boolean;

  // Result
  success: boolean;
  errorMessage?: string;
  finishReason: string;

  createdAt: Date;
}

interface ToolCallAudit {
  toolName: string;
  operation: string;
  args: string;               // Masked
  success: boolean;
  duration: number;
}
```

## Organization Isolation

- Every AI operation includes `organizationId`
- Tools always receive `organizationId` in `ToolExecutionContext`
- Business module services are already org-scoped (existing architecture)
- Memory is partitioned by `organizationId`
- RAG knowledge base is partitioned by `organizationId`
- Usage tracking is partitioned by `organizationId`
- One org can never access another org's data

## Provider Security

| Provider | Data Handling | HIPAA? | EU GDPR |
|---|---|---|---|
| OpenAI | API data not used for training (opt-out) | Yes (enterprise) | DPA available |
| Claude | API data not used for training | Yes | DPA available |
| Gemini | Not used for training | Yes | DPA available |
| Ollama | Data stays on-premise | Yes | Yes |
| Azure OpenAI | Data stays in Azure region | Yes | Yes |
| AWS Bedrock | Data stays in AWS region | Yes | Yes |

## Emergency Controls

| Control | Description | Activation |
|---|---|---|
| Kill switch | Disable AI for all orgs | Configuration flag |
| Org disable | Disable AI for specific org | Admin panel |
| Provider disable | Disable specific provider | Configuration flag |
| Rate limit override | Tighten limits during attack | Configuration |
| Audit freeze | Prevent audit log deletion | System setting |
