import { Injectable } from '@nestjs/common';
import { BaseTransport } from './base.transport';
import { TransportOptions } from '../interfaces/transport.interface';
import { MCPError, MCPErrorCode } from '../interfaces/mcp-error.interface';

@Injectable()
export class WebSocketTransport extends BaseTransport {
  readonly name = 'websocket';
  private ws: any = null;
  private readonly url: string;

  constructor(options: TransportOptions = {}) {
    super(options);
    this.url = options.url || '';
  }

  async connect(): Promise<void> {
    if (!this.url) {
      throw new MCPError('WebSocket transport requires a URL', MCPErrorCode.TRANSPORT_ERROR);
    }
    const startTime = Date.now();
    try {
      const { WebSocket } = await import('ws');
      this.ws = new WebSocket(this.url, {
        headers: this.options.headers,
        handshakeTimeout: this.options.timeout || 10000,
      });

      await new Promise<void>((resolve, reject) => {
        if (!this.ws) return reject(new Error('WebSocket not created'));

        this.ws.on('open', () => {
          this._connected = true;
          this.stats.connectTime = Date.now() - startTime;
          this.stats.lastActivity = Date.now();
          this.logger.log(`WebSocket transport connected: ${this.url}`);
          resolve();
        });

        this.ws.on('message', (data: Buffer) => {
          this.handleMessage(data.toString());
        });

        this.ws.on('error', (err: Error) => {
          this.handleError(
            new MCPError(`WebSocket error: ${err.message}`, MCPErrorCode.TRANSPORT_ERROR),
          );
        });

        this.ws.on('close', () => {
          this.handleClose();
        });

        this.ws.on('unexpected-response', () => {
          reject(new MCPError('WebSocket unexpected response', MCPErrorCode.CONNECTION_FAILED));
        });
      });
    } catch (error) {
      if ((error as Error).message?.includes('Cannot find module')) {
        throw new MCPError(
          'WebSocket transport requires "ws" package. Install with: npm install ws',
          MCPErrorCode.TRANSPORT_ERROR,
        );
      }
      throw new MCPError(
        `WebSocket connection failed: ${(error as Error).message}`,
        MCPErrorCode.CONNECTION_FAILED,
      );
    }
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this._connected = false;
    this.logger.log('WebSocket transport disconnected');
  }

  protected async sendRaw(data: string): Promise<void> {
    if (!this.ws || this.ws.readyState !== 1) {
      throw new MCPError('WebSocket not connected', MCPErrorCode.TRANSPORT_ERROR);
    }
    this.ws.send(data);
  }
}
