# MCP Platform Architecture

## Overview

The Model Context Protocol (MCP) is an open standard that enables AI applications to securely access tools, resources, and prompts from external servers. This implementation provides a complete MCP platform within the ERP AI system.

## Component Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                       ERPAI Runtime                               │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌───────────┐ │
│  │ AI Gateway │  │ Execution  │  │ Agent      │  │ Provider  │ │
│  │ Service    │  │ Pipeline   │  │ Framework  │  │ Router    │ │
│  └──────┬─────┘  └─────┬──────┘  └─────┬──────┘  └─────┬─────┘ │
│         │              │               │               │        │
└─────────┼──────────────┼───────────────┼───────────────┼────────┘
          │              │               │               │
┌─────────▼──────────────▼───────────────▼───────────────▼────────┐
│                      MCP Module                                   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │              MCPIntegrationService                         │    │
│  │  syncToolsToRegistry() │ refreshAndSync()                  │    │
│  └──────┬──────────────┬──────────────┬──────────────────────┘    │
│         │              │              │                            │
│  ┌──────▼──────┐ ┌─────▼──────┐ ┌─────▼──────────────────────┐   │
│  │ MCPClient   │ │ MCPServer  │ │ MCPToolExecutor             │   │
│  │ Service     │ │ Registry   │ │ Service                     │   │
│  └──────┬──────┘ └─────┬──────┘ └─────┬──────────────────────┘   │
│         │              │              │                            │
│  ┌──────▼──────┐ ┌─────▼──────┐ ┌─────▼──────────────────────┐   │
│  │ MCPTransport│ │ MCP        │ │ MCPAuthorization            │   │
│  │ Factory     │ │ Discovery  │ │ Service                     │   │
│  └──────┬──────┘ └────────────┘ └────────────────────────────┘   │
│         │                                                         │
│  ┌──────┴───────────┬──────────────┬──────────────────┐          │
│  ▼                  ▼              ▼                               │
│  STDIO    HTTP    WebSocket                                       │
│  Transport  Transport  Transport                                   │
└──────────────────────────────────────────────────────────────────┘
```

## Key Interfaces

### IMCPTransport
```typescript
interface IMCPTransport {
  readonly name: string;
  readonly connected: boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(message: unknown): Promise<void>;
  onMessage(handler): void;
  onError(handler): void;
  onClose(handler): void;
  getStats(): TransportStats;
}
```

### IMCPServer
```typescript
interface IMCPServer {
  readonly info: ServerInfo;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  listTools(): Promise<MCPToolDefinition[]>;
  listResources(): Promise<MCPResourceDefinition[]>;
  listPrompts(): Promise<MCPPromptDefinition[]>;
  executeTool(name, args): Promise<unknown>;
  readResource(uri): Promise<unknown>;
  getPrompt(name, args?): Promise<unknown>;
  health(): Promise<boolean>;
}
```

### IMCPAuthProvider
```typescript
interface IMCPAuthProvider {
  readonly name: string;
  authenticate(credentials): Promise<AuthResult>;
  validate(token): Promise<AuthResult>;
  refresh(token): Promise<AuthResult>;
  revoke(token): Promise<boolean>;
}
```

## Architecture Decisions

### Why a New Module Instead of Extending ProviderFactory?
MCP has fundamentally different requirements than LLM providers: transport layer abstraction, session lifecycle, resource/prompt discovery, and bidirectional communication. These concerns are orthogonal to the LLM provider abstraction.

### Why Interface-Based Transport?
Each transport type (STDIO, HTTP, WebSocket) has radically different connection mechanics. The interface allows any transport to be swapped without changing the server adapter or client.

### How MCP Tools Integrate with the AI Runtime
1. `MCPClientService.registerServer()` connects to an external MCP server
2. `MCPServerRegistry` caches the tool/resource/prompt lists
3. `MCPToolExecutorService.createAIToolAdapter()` wraps each MCP tool as an `AITool`
4. `MCPIntegrationService.syncToolsToRegistry()` registers the adapters into `ToolRegistryService`
5. Agents and the execution pipeline can use MCP tools like any other AI tool

## Security Architecture

```
User Request
    │
    ▼
ExecutionPipelineService
    │
    ▼
AISandboxService
  ├── validates org access
  ├── checks permissions (AIPermissionService)
  ├── validates input size
  └── audits execution (AuditLogService)
    │
    ▼
MCPToolExecutorService
  ├── MCPAuthorizationService
  │   ├── tool allow-list check
  │   └── organization isolation
  └── MCPServerAdapter
      ├── transport sends request
      └── auth provider validates credentials
```
