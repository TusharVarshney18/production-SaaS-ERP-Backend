# Sprint 12.7 – Enterprise Model Context Protocol (MCP)

**Date:** 2026-07-18  
**Scope:** MCP Client, Server, Transport, Registry, Authentication, Session Management, Tool/Resource/Prompt Execution  
**Status:** Completed  

---

## Architecture Overview

The MCP platform enables the ERP AI system to communicate with external MCP servers securely and provider-independently.

```
┌──────────────────────────────────────────────────────────────────┐
│                       AI Agent / Runtime                          │
└─────────────────────────────┬────────────────────────────────────┘
                              │
┌─────────────────────────────▼────────────────────────────────────┐
│                        MCP Module                                 │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                  MCPClientService                         │    │
│  │  connect() │ disconnect() │ executeTool() │ health()      │    │
│  └──────────┬───────────────────────────────────────────────┘    │
│             │                                                     │
│  ┌──────────▼───────────────────────────────────────────────┐    │
│  │              MCPServerRegistry                             │    │
│  │  register() │ getTool() │ getAllTools() │ searchTools()    │    │
│  └──────────┬───────────────────────────────────────────────┘    │
│             │                                                     │
│  ┌──────────▼───────────────────────────────────────────────┐    │
│  │            MCPDiscoveryService                             │    │
│  │  discoverServer() │ discoverAll() │ refresh()              │    │
│  └──────────┬───────────────────────────────────────────────┘    │
│             │                                                     │
│  ┌──────────▼───────────────────────────────────────────────┐    │
│  │           MCPSessionManager                                │    │
│  │  createSession() │ heartbeat() │ reconnect() │ endSession() │    │
│  └──────────┬───────────────────────────────────────────────┘    │
│             │                                                     │
│  ┌──────────▼───────────────────────────────────────────────┐    │
│  │           MCPToolExecutorService                           │    │
│  │  execute() │ createAIToolAdapter()                          │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────┐      │
│  │ MCPTransport │  │ MCPAuth       │  │ MCP              │      │
│  │ Factory      │  │ Provider      │  │ Authorization    │      │
│  │              │  │ Factory       │  │ Service          │      │
│  └──────────────┘  └───────────────┘  └──────────────────┘      │
└──────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  STDIO       │    │    HTTP      │    │  WebSocket   │
│  Transport   │    │  Transport   │    │  Transport   │
└──────────────┘    └──────────────┘    └──────────────┘
        │                     │                     │
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  STDIO       │    │    HTTP      │    │  WebSocket   │
│  MCP Server  │    │  MCP Server  │    │  MCP Server  │
└──────────────┘    └──────────────┘    └──────────────┘
```

---

## File Structure

```
src/ai/mcp/
├── mcp.module.ts                 # NestJS module
├── mcp-integration.service.ts    # Integration with AI Runtime
├── index.ts                      # Public exports
├── interfaces/                   # All interfaces
│   ├── index.ts
│   ├── transport.interface.ts    # IMCPTransport
│   ├── server.interface.ts       # IMCPServer
│   ├── client.interface.ts       # IMCPClient
│   ├── auth-provider.interface.ts    # IMCPAuthProvider
│   ├── connection-provider.interface.ts
│   ├── tool-executor.interface.ts
│   ├── session.interface.ts      # IMCPSessionManager
│   ├── registry.interface.ts     # IMCPRegistry
│   ├── discovery.interface.ts    # IMCPDiscoveryService
│   └── mcp-error.interface.ts    # MCPError, MCPErrorCode
├── dto/                          # Data transfer objects
│   ├── index.ts
│   ├── mcp-message.dto.ts        # MCPMessage, MCPRequest, MCPResponse
│   ├── tool.dto.ts               # MCPToolDefinition, MCPToolCallRequest
│   ├── resource.dto.ts           # MCPResourceDefinition
│   ├── prompt.dto.ts             # MCPPromptDefinition
│   └── config.dto.ts             # MCPServerConfig, MCPClientConfig
├── transport/                    # Transport implementations
│   ├── index.ts
│   ├── tokens.ts
│   ├── base.transport.ts         # Abstract BaseTransport
│   ├── stdio.transport.ts        # STDIO transport
│   ├── http.transport.ts         # HTTP transport
│   ├── websocket.transport.ts    # WebSocket transport (dynamic import)
│   ├── mcp-transport.factory.ts  # Transport factory
│   └── ws.d.ts                   # WebSocket type declarations
├── authentication/               # Authentication providers
│   ├── index.ts
│   ├── api-key.auth-provider.ts
│   ├── bearer-token.auth-provider.ts
│   ├── jwt.auth-provider.ts
│   └── mcp-auth-provider.factory.ts
├── authorization/                # Authorization & security
│   ├── index.ts
│   └── mcp-authorization.service.ts  # Allow-list, input validation
├── registry/                     # Server and capability registry
│   ├── index.ts
│   └── mcp-server.registry.ts    # MCPServerRegistry with caching
├── discovery/                    # Server discovery
│   ├── index.ts
│   └── mcp-discovery.service.ts
├── client/                       # MCP Client
│   ├── index.ts
│   └── mcp-client.service.ts
├── server/                       # MCP Server adapter
│   ├── index.ts
│   └── mcp-server.adapter.ts     # MCPServerAdapter
├── sessions/                     # Session management
│   ├── index.ts
│   └── mcp-session.manager.ts    # MCPSessionManager
├── tools/                        # Tool execution
│   ├── index.ts
│   └── mcp-tool-executor.service.ts
├── providers/                    # Connection provider
│   ├── index.ts
│   └── mcp-connection.provider.ts
└── tests/                        # Test suites (53 tests)
    ├── mcp-transport.spec.ts
    ├── mcp-auth.spec.ts
    ├── mcp-registry.spec.ts
    ├── mcp-session.spec.ts
    ├── mcp-authorization.spec.ts
    └── mcp-discovery.spec.ts
```

---

## Architecture & Design Decisions

### 1. Provider-Independent Transport

All transports implement `IMCPTransport`:
- **STDIO** - For local subprocess MCP servers (e.g., `npx @modelcontextprotocol/server-filesystem`)
- **HTTP** - For REST-based MCP servers
- **WebSocket** - For streaming MCP connections (requires `ws` package)

Created via `MCPTransportFactory.createTransport(type, options)`.

### 2. Authentication Abstraction

Three auth providers implement `IMCPAuthProvider`:
- `ApiKeyAuthProvider` - Static API key verification
- `BearerTokenAuthProvider` - Bearer token with optional TTL
- `JwtAuthProvider` - JWT validation with expiry and revocation

Managed via `MCPAuthProviderFactory` registered with interface injection pattern (matching `AiModule`'s existing pattern).

### 3. Registry with Caching

`MCPServerRegistry` provides:
- Multi-tenant server registration (scoped to `organizationId`)
- TTL-based caching of `listTools()`, `listResources()`, `listPrompts()` results
- Search and discovery across registered servers
- Cache invalidation on refresh

### 4. Session Lifecycle Management

`MCPSessionManager` handles:
- Connection lifecycle (connecting → connected → reconnecting → disconnected)
- Heartbeat interval
- Session timeout with automatic cleanup
- Reconnect with configurable retry
- Organization-scoped session management

### 5. Tool Execution Integration

`MCPToolExecutorService.createAIToolAdapter()` wraps MCP tools as `AITool` instances, enabling them to be registered into the existing `ToolRegistryService` and executed through the `ExecutionPipelineService`.

### 6. Security

`MCPAuthorizationService` provides:
- Tool allow-lists per organization
- Input size validation
- Integration with existing `AIPermissionService`

### 7. Reuse of Existing Patterns

| Existing Pattern | MCP Usage |
|-----------------|-----------|
| `IProvider` + `ProviderFactory` | `IMCPAuthProvider` + `MCPAuthProviderFactory` |
| `AITool` + `ToolRegistryService` | `MCPToolDefinition` → `AITool` adapter |
| `ExecutionPipelineService` | MCP tools executed via adapters through the pipeline |
| `AIPermissionService` | Used by `MCPAuthorizationService` |
| `AuditLogService` | Tool execution audited via sandbox |
| `@Inject()` tokens | Transport provider tokens for DI |

---

## Transport Comparison

| Transport | Use Case | Libraries | Pros | Cons |
|-----------|----------|-----------|------|------|
| STDIO | Local MCP servers | Built-in | No network, low latency | Process lifecycle management |
| HTTP | Remote REST MCP servers | Built-in (`fetch`) | Universal support | No streaming |
| WebSocket | Remote streaming MCP | `ws` (optional) | Full-duplex, streaming | Extra dependency |

---

## Verification

- `npm run build` — ✅ Passes
- `npm run test` — ✅ **6 MCP test suites, 53 tests passing; 48 total AI suites, 419 tests passing**
- `npx prisma validate` — ✅ Schema valid

## Future Improvements

| Priority | Item | Description |
|----------|------|-------------|
| Medium | OAuth2 Auth Provider | Implement OAuth2 device code flow |
| Medium | mTLS Auth Provider | Mutual TLS certificate validation |
| Low | SSE Transport | Server-Sent Events transport |
| Low | Named Pipes Transport | Windows named pipe transport |
| Low | Request Batching | Batch multiple tool calls into single request |
| Low | Connection Pooling | Pool HTTP connections per host |
