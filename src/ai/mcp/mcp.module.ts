import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthorizationModule } from '../../authorization/authorization.module';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { StdioTransport } from './transport/stdio.transport';
import { HttpTransport } from './transport/http.transport';
import { WebSocketTransport } from './transport/websocket.transport';
import { MCPTransportFactory } from './transport/mcp-transport.factory';
import { ApiKeyAuthProvider } from './authentication/api-key.auth-provider';
import { BearerTokenAuthProvider } from './authentication/bearer-token.auth-provider';
import { JwtAuthProvider } from './authentication/jwt.auth-provider';
import { MCPAuthProviderFactory } from './authentication/mcp-auth-provider.factory';
import { MCPServerRegistry } from './registry/mcp-server.registry';
import { MCPDiscoveryService } from './discovery/mcp-discovery.service';
import { MCPClientService } from './client/mcp-client.service';
import { MCPSessionManager } from './sessions/mcp-session.manager';
import { MCPConnectionProvider } from './providers/mcp-connection.provider';
import { MCPAuthorizationService } from './authorization/mcp-authorization.service';
import { MCPToolExecutorService } from './tools/mcp-tool-executor.service';

@Module({
  imports: [AuthorizationModule, AuditLogModule],
  providers: [
    StdioTransport,
    HttpTransport,
    WebSocketTransport,
    MCPTransportFactory,
    ApiKeyAuthProvider,
    BearerTokenAuthProvider,
    JwtAuthProvider,
    MCPAuthProviderFactory,
    MCPServerRegistry,
    MCPDiscoveryService,
    MCPClientService,
    MCPSessionManager,
    MCPConnectionProvider,
    MCPAuthorizationService,
    MCPToolExecutorService,
  ],
  exports: [
    MCPTransportFactory,
    MCPAuthProviderFactory,
    MCPServerRegistry,
    MCPDiscoveryService,
    MCPClientService,
    MCPSessionManager,
    MCPConnectionProvider,
    MCPAuthorizationService,
    MCPToolExecutorService,
  ],
})
export class MCPModule {}
