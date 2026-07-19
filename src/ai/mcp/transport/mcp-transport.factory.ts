import { Injectable, Logger } from '@nestjs/common';
import { IMCPTransport, TransportOptions } from '../interfaces/transport.interface';
import { StdioTransport } from './stdio.transport';
import { HttpTransport } from './http.transport';
import { WebSocketTransport } from './websocket.transport';
import { MCPError, MCPErrorCode } from '../interfaces/mcp-error.interface';

export type TransportType = 'stdio' | 'http' | 'websocket';

@Injectable()
export class MCPTransportFactory {
  private readonly logger = new Logger(MCPTransportFactory.name);

  createTransport(type: TransportType, options: TransportOptions): IMCPTransport {
    switch (type) {
      case 'stdio':
        return new StdioTransport(options);
      case 'http':
        return new HttpTransport(options);
      case 'websocket':
        return new WebSocketTransport(options);
      default:
        throw new MCPError(`Unsupported transport type: ${type}`, MCPErrorCode.TRANSPORT_ERROR);
    }
  }

  getSupportedTransports(): TransportType[] {
    return ['stdio', 'http', 'websocket'];
  }
}
