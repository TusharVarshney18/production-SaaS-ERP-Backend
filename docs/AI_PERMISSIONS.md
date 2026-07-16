# AI Permissions Architecture

## Overview

AI permissions extend the existing RBAC system with AI-specific granular controls. They control which users can access which agents, which tools each agent can use, and what data the tools can return.

## Permission Model

```
User
  │
  ├── Has Role(s) ──→ Role has AI Permissions
  │                       │
  │                       ├── ai:access                    (Can use AI at all)
  │                       ├── ai:agent:ceo                 (Can invoke CEO Agent)
  │                       ├── ai:agent:finance             (Can invoke Finance Agent)
  │                       ├── ai:agent:sales               (Can invoke Sales Agent)
  │                       ├── ai:agent:inventory            (Can invoke Inventory Agent)
  │                       ├── ai:agent:procurement          (Can invoke Procurement Agent)
  │                       ├── ai:agent:hr                  (Can invoke HR Agent)
  │                       ├── ai:agent:reporting           (Can invoke Reporting Agent)
  │                       ├── ai:agent:developer           (Can invoke Developer Agent)
  │                       │
  │                       ├── ai:tool:crm:read             (Tool: read CRM data)
  │                       ├── ai:tool:crm:write            (Tool: write CRM data)
  │                       ├── ai:tool:sales:read           (Tool: read sales data)
  │                       ├── ai:tool:sales:write          (Tool: write sales data)
  │                       ├── ai:tool:inventory:read       (Tool: read inventory)
  │                       ├── ai:tool:inventory:write      (Tool: write inventory)
  │                       ├── ai:tool:procurement:read     (Tool: read procurement)
  │                       ├── ai:tool:procurement:write    (Tool: write procurement)
  │                       ├── ai:tool:accounting:read      (Tool: read accounting)
  │                       ├── ai:tool:accounting:write     (Tool: write accounting)
  │                       ├── ai:tool:hrms:read            (Tool: read HR data)
  │                       ├── ai:tool:hrms:write           (Tool: write HR data)
  │                       ├── ai:tool:reporting:read       (Tool: read reports)
  │                       ├── ai:tool:payment:read         (Tool: read payments)
  │                       ├── ai:tool:payment:write        (Tool: write payments)
  │                       ├── ai:tool:workflow:read        (Tool: read workflows)
  │                       └── ai:tool:workflow:write       (Tool: write workflows)
  │
  ├── Has Data Scope
  │       ├── org          (Can see all org data via AI)
  │       ├── department   (Can see only department data)
  │       └── self         (Can see only own data)
  │
  └── Has Agent Config (optional overrides)
          └── Agent-level provider preference, temperature, etc.
```

## Permission Registration

AI permissions follow the same pattern as existing RBAC permissions:

```typescript
// During seed/initialization, AI permissions are registered
const AI_PERMISSIONS = [
  { resource: 'ai', action: 'access', description: 'Can use AI platform' },
  { resource: 'ai', action: 'agent:ceo', description: 'Can invoke CEO Agent' },
  { resource: 'ai', action: 'agent:finance', description: 'Can invoke Finance Agent' },
  { resource: 'ai', action: 'agent:sales', description: 'Can invoke Sales Agent' },
  { resource: 'ai', action: 'agent:inventory', description: 'Can invoke Inventory Agent' },
  { resource: 'ai', action: 'agent:procurement', description: 'Can invoke Procurement Agent' },
  { resource: 'ai', action: 'agent:hr', description: 'Can invoke HR Agent' },
  { resource: 'ai', action: 'agent:reporting', description: 'Can invoke Reporting Agent' },
  { resource: 'ai', action: 'agent:developer', description: 'Can invoke Developer Agent' },
  { resource: 'ai', action: 'tool:crm:read', description: 'Read CRM data via AI' },
  { resource: 'ai', action: 'tool:crm:write', description: 'Write CRM data via AI' },
  // ... one per tool x operation
];
```

## Permission Check Flow

```typescript
@Injectable()
export class AIPermissionService {
  constructor(private readonly auth: AuthorizationService) {}

  async canAccessAI(userId: string, orgId: string): Promise<boolean> {
    return this.auth.authorize(userId, orgId, 'ai', 'access');
  }

  async canUseAgent(userId: string, orgId: string, agentName: string): Promise<boolean> {
    return this.auth.authorize(userId, orgId, 'ai', `agent:${agentName}`);
  }

  async canUseTool(
    userId: string,
    orgId: string,
    toolName: string,
    operation: 'read' | 'write',
  ): Promise<boolean> {
    return this.auth.authorize(userId, orgId, 'ai', `tool:${toolName}:${operation}`);
  }
}
```

## Default Role Permissions

| Role | AI Access | Agents | Tools |
|---|---|---|---|
| Owner | ✅ Full | All | All (read+write) |
| Admin | ✅ Full | All except Developer | All (read+write) |
| Manager | ✅ | CEO, Sales, Inventory, Procurement, Reporting | Read-only for assigned modules |
| Employee | ✅ | Sales, Inventory | Read-only for assigned modules |

## Data Scope per Role

| Role | Default Data Scope | Can Be Elevated? |
|---|---|---|
| Owner | `org` | N/A |
| Admin | `org` | N/A |
| Manager | `department` | Yes (by org admin) |
| Employee | `self` | Yes (by manager) |

## AI Permission Guard

```typescript
@Injectable()
export class AIPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permission: AIPermissionService,
  ) {}

  canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.get<string[]>(
      'ai_permission', context.getHandler(),
    );
    const { user, params } = context.switchToHttp().getRequest();
    return this.permission.canAccessAI(user.sub, params.orgId);
  }
}
```

## Mutation Confirmation

For write operations (creating orders, adjusting stock), the AI must:

1. **Disclose** what it's about to do: "I'm about to create a purchase order for 50 units of Widget Pro from ACME Corp for $5,000. Should I proceed?"
2. **Await confirmation**: The LLM waits for user confirmation before executing the tool
3. **Confirm completion**: After execution, the LLM confirms the result

This prevents accidental data mutations and gives users full control.

## Cross-Org Security

- AI never has cross-org access capabilities
- Organization ID is passed through every layer
- Tools implicitly scope queries by organization ID
- Memory is partitioned by organization ID
- RAG documents are partitioned by organization ID
- Usage/cost data is partitioned by organization ID
