# MCP Sequence Diagrams

## 1. Register External MCP Server

```
Agent/Runtime                  MCPClientService           MCPServerRegistry         MCPServerAdapter        External MCP Server
     │                              │                          │                         │                         │
     │  registerServer(config)      │                          │                         │                         │
     │─────────────────────────────►│                          │                         │                         │
     │                              │  createTransport(type)   │                         │                         │
     │                              │──────────────────────────►                         │                         │
     │                              │                          │  new MCPServerAdapter()  │                         │
     │                              │                          │◄─────────────────────────│                         │
     │                              │  register(id,server,org) │                         │                         │
     │                              │─────────────────────────►│                         │                         │
     │                              │                          │  connect()               │                         │
     │                              │                          │─────────────────────────►│  connect()               │
     │                              │                          │                         │─────────────────────────►│
     │                              │                          │                         │◄────────────────────────│
     │                              │                          │◄────────────────────────│                         │
     │                              │◄─────────────────────────│                         │                         │
     │◄─────────────────────────────│                          │                         │                         │
```

## 2. Tool Discovery and Sync to AI Runtime

```
MCPIntegrationService           MCPServerRegistry         MCPDiscoveryService        ToolRegistryService
     │                              │                          │                         │
     │  syncToolsToRegistry(org)    │                          │                         │
     │─────────────────────────────►│                          │                         │
     │                              │  getAllTools(org)        │                         │
     │                              │─────────────────────────►│                         │
     │                              │                          │  listTools() on each     │
     │                              │                          │  registered server       │
     │                              │◄─────────────────────────│                         │
     │                              │ return tools[]           │                         │
     │◄─────────────────────────────│                          │                         │
     │                              │                          │                         │
     │  for each tool:              │                          │                         │
     │  createAIToolAdapter()       │                          │                         │
     │  register(tool)              │                          │                         │
     │──────────────────────────────────────────────────────────────────────────────────►│
     │                              │                          │                         │
```

## 3. Execute MCP Tool via AI Runtime

```
Agent                   ExecutionPipeline           MCPToolExecutor         MCPServerAdapter        External MCP
  │                          │                          │                         │                     │
  │ execute("mcp:server:tool", input, context)           │                         │                     │
  │─────────────────────────►│                          │                         │                     │
  │                          │ lookup tool in registry  │                         │                     │
  │                          │ sandbox validate         │                         │                     │
  │                          │ permission check         │                         │                     │
  │                          │ enforce org access       │                         │                     │
  │                          │                          │                         │                     │
  │                          │ tool.execute(input)      │                         │                     │
  │                          │─────────────────────────►│                         │                     │
  │                          │                          │  execute(tool, args)    │                     │
  │                          │                          │─────────────────────────►│                     │
  │                          │                          │                         │ send MCP request    │
  │                          │                          │                         │────────────────────►│
  │                          │                          │                         │◄────────────────────│
  │                          │                          │◄────────────────────────│                     │
  │                          │◄─────────────────────────│                         │                     │
  │                          │ return AIToolResult      │                         │                     │
  │◄─────────────────────────│                          │                         │                     │
```

## 4. Session Lifecycle

```
Runtime                    MCPSessionManager           MCPServerRegistry        MCPServerAdapter
  │                              │                          │                         │
  │  createSession(config)       │                          │                         │
  │─────────────────────────────►│                          │                         │
  │                              │  getServer(srv, org)     │                         │
  │                              │─────────────────────────►│                         │
  │                              │◄─────────────────────────│                         │
  │                              │                          │                         │
  │                              │  server.connect()        │                         │
  │                              │──────────────────────────────────────────────────►│
  │                              │                          │                         │
  │                              │  status = "connected"    │                         │
  │                              │  start heartbeat timer   │                         │
  │                              │  start timeout timer     │                         │
  │                              │                          │                         │
  │◄─────────────────────────────│                          │                         │
  │                              │                          │                         │
  │  [Heartbeat interval]        │                          │                         │
  │                              │  sendHeartbeat(session)  │                         │
  │                              │─────────────────────────►│                         │
  │                              │                          │  health()               │
  │                              │                          │─────────────────────────►│
  │                              │                          │◄─────────────────────────│
  │                              │◄─────────────────────────│                         │
  │                              │                          │                         │
  │  [Timeout]                   │                          │                         │
  │                              │  auto-end session        │                         │
  │                              │  server.disconnect()     │                         │
  │                              │──────────────────────────────────────────────────►│
  │                              │                          │                         │
  │  [Reconnect]                 │                          │                         │
  │                              │  reconnect(session)      │                         │
  │                              │─────────────────────────►│                         │
  │                              │  server.disconnect()     │                         │
  │                              │──────────────────────────────────────────────────►│
  │                              │  server.connect()        │                         │
  │                              │──────────────────────────────────────────────────►│
  │                              │  status = "connected"    │                         │
  │                              │◄─────────────────────────│                         │
```

## 5. Authentication Flow

```
MCPClient                     MCPServerAdapter            MCPAuthProvider         External MCP Server
  │                              │                          │                         │
  │  connect()                   │                          │                         │
  │─────────────────────────────►│                          │                         │
  │                              │  transport.connect()     │                         │
  │                              │─────────────────────────►│                         │
  │                              │◄─────────────────────────│                         │
  │                              │                          │                         │
  │                              │  authProvider.auth()     │                         │
  │                              │─────────────────────────►│                         │
  │                              │  validate credentials    │                         │
  │                              │◄─────────────────────────│                         │
  │                              │                          │                         │
  │                              │  [if failed] disconnect  │                         │
  │                              │  [if success] connected  │                         │
  │◄─────────────────────────────│                          │                         │
```
